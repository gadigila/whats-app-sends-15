
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConnectRequest {
  userId: string
}

// Helper function to wait/delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function checkWhapiStatus(instanceId: string, token: string) {
  try {
    const response = await fetch(`https://gate.whapi.cloud/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      return { success: true, status: data.status, data }
    }
    
    return { success: false, status: response.status }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function getQrCode(instanceId: string, token: string, retryCount = 0) {
  const maxRetries = 3
  
  try {
    console.log(`🔄 Getting QR code (attempt ${retryCount + 1}/${maxRetries + 1})`)
    
    const qrResponse = await fetch(`https://gate.whapi.cloud/instance/qr?id=${instanceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })
    
    if (qrResponse.ok) {
      const qrData = await qrResponse.json()
      if (qrData.qr_code || qrData.qr) {
        return { success: true, qr_code: qrData.qr_code || qrData.qr }
      }
    }
    
    if (retryCount < maxRetries) {
      await delay(2000 * Math.pow(2, retryCount))
      return getQrCode(instanceId, token, retryCount + 1)
    }
    
    return { success: false, error: 'QR code not available' }
  } catch (error) {
    if (retryCount < maxRetries) {
      await delay(2000 * Math.pow(2, retryCount))
      return getQrCode(instanceId, token, retryCount + 1)
    }
    return { success: false, error: error.message }
  }
}

async function createNewInstance(whapiPartnerToken: string, whapiProjectId: string, userId: string) {
  console.log('🏗️ Creating new WHAPI instance...')
  
  const createResponse = await fetch('https://manager.whapi.cloud/channels', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${whapiPartnerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `reecher_user_${userId.substring(0, 8)}`,
      projectId: whapiProjectId
    })
  })
  
  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    throw new Error(`Failed to create instance: ${errorText}`)
  }
  
  const channelData = await createResponse.json()
  
  if (!channelData.id || !channelData.token) {
    throw new Error('Invalid channel data received')
  }
  
  return {
    instanceId: channelData.id,
    token: channelData.token
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    const whapiProjectId = Deno.env.get('WHAPI_PROJECT_ID')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: ConnectRequest = await req.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), 
        { status: 400, headers: corsHeaders })
    }

    console.log('🔄 Starting unified connection flow for user:', userId)

    // Get user's current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError)
      return new Response(JSON.stringify({ error: 'Profile not found' }), 
        { status: 404, headers: corsHeaders })
    }

    let instanceId = profile?.instance_id
    let token = profile?.whapi_token
    let needsNewInstance = false

    // Check if we have a valid existing instance
    if (instanceId && token) {
      console.log('🔍 Checking existing instance status...')
      const statusCheck = await checkWhapiStatus(instanceId, token)
      
      if (statusCheck.success) {
        if (statusCheck.status === 'authenticated' || statusCheck.status === 'ready') {
          // Already connected!
          await supabase
            .from('profiles')
            .update({ instance_status: 'connected', updated_at: new Date().toISOString() })
            .eq('id', userId)
          
          return new Response(JSON.stringify({
            success: true,
            already_connected: true,
            message: 'WhatsApp already connected'
          }), { status: 200, headers: corsHeaders })
        } else if (statusCheck.status === 'qr' || statusCheck.status === 'unauthorized') {
          // Ready for QR
          console.log('✅ Existing instance ready for QR')
        } else {
          needsNewInstance = true
        }
      } else {
        needsNewInstance = true
      }
    } else {
      needsNewInstance = true
    }

    // Create new instance if needed
    if (needsNewInstance) {
      console.log('🆕 Creating new instance...')
      try {
        const newInstance = await createNewInstance(whapiPartnerToken, whapiProjectId, userId)
        instanceId = newInstance.instanceId
        token = newInstance.token
        
        // Save to database
        const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        
        await supabase
          .from('profiles')
          .update({
            instance_id: instanceId,
            whapi_token: token,
            instance_status: 'unauthorized',
            payment_plan: 'trial',
            trial_expires_at: trialExpiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
        
        console.log('✅ New instance created and saved')
        
        // Wait a moment for instance to initialize
        await delay(3000)
      } catch (error) {
        console.error('❌ Failed to create instance:', error)
        return new Response(JSON.stringify({ 
          error: 'Failed to create WhatsApp instance',
          details: error.message 
        }), { status: 500, headers: corsHeaders })
      }
    }

    // Get QR code
    console.log('📱 Getting QR code...')
    const qrResult = await getQrCode(instanceId!, token!)
    
    if (!qrResult.success) {
      console.error('❌ Failed to get QR code:', qrResult.error)
      return new Response(JSON.stringify({ 
        error: 'Failed to get QR code',
        details: qrResult.error 
      }), { status: 400, headers: corsHeaders })
    }

    // Update status to unauthorized (ready for QR)
    await supabase
      .from('profiles')
      .update({ 
        instance_status: 'unauthorized',
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)

    console.log('✅ Connection flow completed successfully')

    return new Response(JSON.stringify({
      success: true,
      qr_code: qrResult.qr_code,
      instance_id: instanceId,
      message: 'Ready to scan QR code'
    }), { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('💥 Unified connect error:', error)
    return new Response(JSON.stringify({ 
      error: 'Connection failed', 
      details: error.message 
    }), { status: 500, headers: corsHeaders })
  }
})
