
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

async function checkWhapiStatus(token: string) {
  try {
    console.log(`🔍 Checking WHAPI status...`)
    
    // FIXED: Use correct endpoint /me instead of /health or /status
    const response = await fetch(`https://gate.whapi.cloud/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`📊 WHAPI me response: ${response.status}`)
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ WHAPI me data:`, data)
      // If we get user data back, we're authenticated
      return { success: true, status: 'authenticated', data }
    } else if (response.status === 401) {
      // 401 means not authenticated yet - need QR scan
      console.log(`📱 Not authenticated yet - need QR scan`)
      return { success: true, status: 'unauthorized' }
    }
    
    const errorText = await response.text()
    console.error(`❌ WHAPI me error: ${response.status} - ${errorText}`)
    return { success: false, status: response.status, error: errorText }
  } catch (error) {
    console.error(`💥 WHAPI me network error:`, error)
    return { success: false, error: error.message }
  }
}

async function getQrCode(token: string, retryCount = 0) {
  const maxRetries = 3
  
  try {
    console.log(`📱 Getting QR code (attempt ${retryCount + 1}/${maxRetries + 1})`)
    
    // FIXED: Use correct endpoint /screenshot instead of /qr
    const qrResponse = await fetch(`https://gate.whapi.cloud/screenshot`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })
    
    console.log(`📱 QR response status: ${qrResponse.status}`)
    
    if (qrResponse.ok) {
      const qrData = await qrResponse.json()
      console.log(`✅ QR data received:`, Object.keys(qrData))
      console.log(`🔍 Full QR response:`, qrData)
      
      // FIXED: WHAPI /screenshot returns QR in 'image' field
      let qrCode = null
      
      if (qrData.image) {
        qrCode = qrData.image
        console.log(`🎯 QR code found in 'image' field (WHAPI screenshot format)`)
      } else if (qrData.qr) {
        qrCode = qrData.qr
        console.log(`🎯 QR code found in 'qr' field (legacy format)`)
      } else if (qrData.qrCode) {
        qrCode = qrData.qrCode
        console.log(`🎯 QR code found in 'qrCode' field (legacy format)`)
      }
      
      if (qrCode) {
        // Ensure proper base64 formatting
        if (!qrCode.startsWith('data:image/')) {
          qrCode = `data:image/png;base64,${qrCode}`
        }
        
        console.log(`🎯 QR code found and formatted, length: ${qrCode.length}`)
        return { success: true, qr_code: qrCode }
      }
      
      console.log(`⚠️ No QR code found in response fields:`, Object.keys(qrData))
      return { success: false, error: 'QR code not found in response', details: qrData }
    }
    
    const errorText = await qrResponse.text()
    console.error(`❌ QR request failed: ${qrResponse.status} - ${errorText}`)
    
    // Retry logic for server errors
    if ((qrResponse.status >= 500 || qrResponse.status === 429) && retryCount < maxRetries) {
      const delayMs = 2000 * Math.pow(2, retryCount)
      console.log(`⏳ Retrying QR request in ${delayMs}ms...`)
      await delay(delayMs)
      return getQrCode(token, retryCount + 1)
    }
    
    return { success: false, error: `QR request failed: ${qrResponse.status}`, details: errorText }
  } catch (error) {
    console.error(`💥 QR request network error:`, error)
    
    if (retryCount < maxRetries) {
      const delayMs = 2000 * Math.pow(2, retryCount)
      console.log(`⏳ Retrying QR request after error in ${delayMs}ms...`)
      await delay(delayMs)
      return getQrCode(token, retryCount + 1)
    }
    
    return { success: false, error: error.message }
  }
}

async function createNewInstance(whapiPartnerToken: string, whapiProjectId: string, userId: string, supabaseUrl: string) {
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
  
  console.log(`🏗️ Create response status: ${createResponse.status}`)
  
  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    console.error(`❌ Failed to create instance: ${errorText}`)
    throw new Error(`Failed to create instance: ${errorText}`)
  }
  
  const channelData = await createResponse.json()
  console.log(`✅ Channel created:`, Object.keys(channelData))
  
  if (!channelData.id || !channelData.token) {
    console.error(`❌ Invalid channel data:`, channelData)
    throw new Error('Invalid channel data received')
  }
  
  // Setup webhook after instance creation
  const webhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook`
  console.log(`🔗 Setting up webhook: ${webhookUrl}`)
  
  try {
    const webhookResponse = await fetch(`https://gate.whapi.cloud/settings`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${channelData.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhooks: [{
          url: webhookUrl,
          events: ['users', 'channel'],
          mode: 'body'
        }]
      })
    })
    
    if (webhookResponse.ok) {
      console.log('✅ Webhook setup successful')
    } else {
      console.log('⚠️ Webhook setup failed, but continuing...')
    }
  } catch (webhookError) {
    console.log('⚠️ Webhook setup error, but continuing...', webhookError.message)
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
    
    console.log(`🔧 Environment check - WHAPI Project ID: ${whapiProjectId ? 'Set' : 'Missing'}`)
    console.log(`🔧 Environment check - WHAPI Partner Token: ${whapiPartnerToken ? 'Set' : 'Missing'}`)
    
    if (!whapiPartnerToken || !whapiProjectId) {
      return new Response(JSON.stringify({ 
        error: 'WHAPI configuration missing',
        details: 'Partner token or project ID not configured'
      }), { status: 500, headers: corsHeaders })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId }: ConnectRequest = await req.json()

    if (!userId) {
      console.error('❌ Missing user ID in request')
      return new Response(JSON.stringify({ error: 'User ID is required' }), 
        { status: 400, headers: corsHeaders })
    }

    console.log('🚀 Starting unified connection flow for user:', userId)

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

    console.log('👤 User profile:', {
      hasInstanceId: !!profile?.instance_id,
      hasToken: !!profile?.whapi_token,
      status: profile?.instance_status
    })

    let instanceId = profile?.instance_id
    let token = profile?.whapi_token
    let needsNewInstance = false

    // Check if we have a valid existing instance
    if (instanceId && token) {
      console.log('🔍 Checking existing instance status...')
      const statusCheck = await checkWhapiStatus(token)
      
      if (statusCheck.success) {
        console.log(`📊 Current instance status: ${statusCheck.status}`)
        
        // Map WHAPI status properly
        if (statusCheck.status === 'authenticated') {
          // Already connected!
          console.log('🎉 Instance already authenticated!')
          
          await supabase
            .from('profiles')
            .update({ instance_status: 'connected', updated_at: new Date().toISOString() })
            .eq('id', userId)
          
          return new Response(JSON.stringify({
            success: true,
            already_connected: true,
            message: 'WhatsApp already connected',
            instance_id: instanceId
          }), { status: 200, headers: corsHeaders })
          
        } else if (statusCheck.status === 'unauthorized') {
          // Ready for QR - this is good!
          console.log('✅ Existing instance ready for QR')
          
          // Update status in database
          await supabase
            .from('profiles')
            .update({ 
              instance_status: 'unauthorized',
              updated_at: new Date().toISOString() 
            })
            .eq('id', userId)
            
        } else {
          console.log(`⚠️ Instance status not suitable for QR: ${statusCheck.status}`)
          needsNewInstance = true
        }
      } else {
        console.log('❌ Instance status check failed, need new instance')
        needsNewInstance = true
      }
    } else {
      console.log('🆕 No existing instance found')
      needsNewInstance = true
    }

    // Create new instance if needed
    if (needsNewInstance) {
      console.log('🆕 Creating new instance...')
      try {
        const newInstance = await createNewInstance(whapiPartnerToken, whapiProjectId, userId, supabaseUrl)
        instanceId = newInstance.instanceId
        token = newInstance.token
        
        console.log(`✅ New instance created: ${instanceId}`)
        
        // Save to database
        const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            instance_id: instanceId,
            whapi_token: token,
            instance_status: 'initializing',
            payment_plan: 'trial',
            trial_expires_at: trialExpiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
        
        if (updateError) {
          console.error('❌ Failed to update profile:', updateError)
          throw new Error('Failed to save instance data')
        }
        
        console.log('✅ New instance saved to database')
        
        // Wait for instance to initialize
        console.log('⏳ Waiting for instance to initialize...')
        await delay(5000) // Wait 5 seconds for initialization
        
        // Update status to ready for QR
        await supabase
          .from('profiles')
          .update({ 
            instance_status: 'unauthorized',
            updated_at: new Date().toISOString() 
          })
          .eq('id', userId)
        
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
    const qrResult = await getQrCode(token!)
    
    if (!qrResult.success) {
      console.error('❌ Failed to get QR code:', qrResult.error)
      return new Response(JSON.stringify({ 
        error: 'Failed to get QR code',
        details: qrResult.error,
        qr_debug: qrResult.details
      }), { status: 400, headers: corsHeaders })
    }

    console.log('✅ Connection flow completed successfully')

    return new Response(JSON.stringify({
      success: true,
      qr_code: qrResult.qr_code,
      instance_id: instanceId,
      message: 'Ready to scan QR code. Scan with WhatsApp mobile app.',
      instructions: 'Open WhatsApp on your phone > Settings > Linked Devices > Link a Device > Scan this QR code'
    }), { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('💥 Unified connect error:', error)
    return new Response(JSON.stringify({ 
      error: 'Connection failed', 
      details: error.message 
    }), { status: 500, headers: corsHeaders })
  }
})
