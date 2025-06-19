
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiagnosticsRequest {
  userId: string
  channelToken?: string // Optional: if you want to test a specific token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { userId, channelToken }: DiagnosticsRequest = await req.json()

    console.log('🔬 Running WHAPI diagnostics for user:', userId)

    const diagnostics = {
      timestamp: new Date().toISOString(),
      userId,
      database: {},
      whapi: {},
      endpoints: {},
      recommendations: []
    }

    // Step 1: Check database state
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      diagnostics.database = { error: 'Profile not found' }
      diagnostics.recommendations.push('User profile not found in database')
      return new Response(JSON.stringify(diagnostics), { status: 200, headers: corsHeaders })
    }

    diagnostics.database = {
      hasInstanceId: !!profile.instance_id,
      instanceId: profile.instance_id,
      hasToken: !!profile.whapi_token,
      tokenPrefix: profile.whapi_token ? profile.whapi_token.substring(0, 20) + '...' : null,
      instanceStatus: profile.instance_status,
      paymentPlan: profile.payment_plan,
      trialExpiresAt: profile.trial_expires_at,
      lastUpdated: profile.updated_at
    }

    // Use provided token or profile token
    const token = channelToken || profile.whapi_token

    if (!token) {
      diagnostics.recommendations.push('No WHAPI token found - need to create new instance')
      return new Response(JSON.stringify(diagnostics), { status: 200, headers: corsHeaders })
    }

    // Step 2: Test various WHAPI endpoints
    console.log('Testing WHAPI endpoints...')

    // Test 1: Health endpoint (fixed from status)
    try {
      const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      diagnostics.endpoints.health = {
        httpStatus: healthResponse.status,
        ok: healthResponse.ok
      }

      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        diagnostics.whapi.status = healthData.status || healthData.state
        diagnostics.endpoints.health.data = healthData
      } else {
        diagnostics.endpoints.health.error = await healthResponse.text()
      }
    } catch (error) {
      diagnostics.endpoints.health = { error: error.message }
    }

    // Test 2: QR endpoint (fixed from screen)
    try {
      const qrResponse = await fetch(`https://gate.whapi.cloud/qr`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })

      diagnostics.endpoints.qr = {
        httpStatus: qrResponse.status,
        ok: qrResponse.ok
      }

      if (qrResponse.ok) {
        const qrData = await qrResponse.json()
        diagnostics.endpoints.qr.hasQr = !!(qrData.qr || qrData.qrCode || qrData.image || qrData.base64)
        diagnostics.endpoints.qr.fields = Object.keys(qrData)
        diagnostics.endpoints.qr.responseSize = JSON.stringify(qrData).length
      } else {
        diagnostics.endpoints.qr.error = await qrResponse.text()
      }
    } catch (error) {
      diagnostics.endpoints.qr = { error: error.message }
    }

    // Test 3: Check channel settings
    try {
      const settingsResponse = await fetch(`https://gate.whapi.cloud/settings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      diagnostics.endpoints.settings = {
        httpStatus: settingsResponse.status,
        ok: settingsResponse.ok
      }

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json()
        diagnostics.endpoints.settings.data = settingsData
        
        // Check webhook configuration
        const expectedWebhook = `${supabaseUrl}/functions/v1/whapi-webhook`
        const hasWebhook = settingsData.webhooks?.some((wh: any) => wh.url === expectedWebhook)
        diagnostics.endpoints.settings.hasCorrectWebhook = hasWebhook
      }
    } catch (error) {
      diagnostics.endpoints.settings = { error: error.message }
    }

    // Test 4: List all channels (partner API)
    try {
      const channelsResponse = await fetch('https://manager.whapi.cloud/channels', {
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`
        }
      })

      if (channelsResponse.ok) {
        const channels = await channelsResponse.json()
        const userChannels = channels.filter((ch: any) => 
          ch.name && ch.name.includes(userId.substring(0, 8))
        )
        
        diagnostics.whapi.totalChannels = channels.length
        diagnostics.whapi.userChannels = userChannels.map(ch => ({
          id: ch.id,
          name: ch.name,
          status: ch.status
        }))
        diagnostics.whapi.userChannelCount = userChannels.length
        
        if (userChannels.length > 1) {
          diagnostics.recommendations.push(`Multiple channels found (${userChannels.length}) - may need cleanup`)
        }
        
        // Check if database instance ID matches any actual channel
        const matchingChannel = userChannels.find(ch => ch.id === profile.instance_id)
        diagnostics.whapi.instanceIdMatches = !!matchingChannel
        
        if (!matchingChannel && profile.instance_id) {
          diagnostics.recommendations.push('Instance ID in database does not match any WHAPI channel')
        }
      }
    } catch (error) {
      diagnostics.whapi.channelListError = error.message
    }

    // Generate specific recommendations
    if (diagnostics.endpoints.health?.httpStatus === 404) {
      diagnostics.recommendations.push('❌ Channel not found with token - need new instance')
    }

    if (diagnostics.endpoints.health?.httpStatus === 401) {
      diagnostics.recommendations.push('❌ Token authentication failed - token may be invalid')
    }

    if (diagnostics.endpoints.health?.data?.status === 'qr' || 
        diagnostics.endpoints.health?.data?.status === 'unauthorized' ||
        diagnostics.endpoints.health?.data?.state === 'qr' ||
        diagnostics.endpoints.health?.data?.state === 'unauthorized') {
      diagnostics.recommendations.push('✅ Channel ready for QR scan')
      
      if (!diagnostics.endpoints.qr?.hasQr) {
        diagnostics.recommendations.push('⚠️ QR endpoint not returning QR code - may need to wait or retry')
      } else {
        diagnostics.recommendations.push('✅ QR code is available')
      }
    }

    if (diagnostics.endpoints.health?.data?.status === 'authenticated' || 
        diagnostics.endpoints.health?.data?.status === 'ready' ||
        diagnostics.endpoints.health?.data?.state === 'authenticated' ||
        diagnostics.endpoints.health?.data?.state === 'ready') {
      diagnostics.recommendations.push('✅ Channel already authenticated - no QR needed')
    }

    if (diagnostics.endpoints.health?.data?.status === 'loading' ||
        diagnostics.endpoints.health?.data?.status === 'initializing' ||
        diagnostics.endpoints.health?.data?.state === 'loading' ||
        diagnostics.endpoints.health?.data?.state === 'initializing') {
      diagnostics.recommendations.push('⏳ Channel is initializing - wait 30-60 seconds and retry')
    }

    const actualStatus = diagnostics.endpoints.health?.data?.status || diagnostics.endpoints.health?.data?.state
    if (diagnostics.database.instanceStatus !== actualStatus) {
      diagnostics.recommendations.push(
        `🔄 Database status mismatch: DB says '${diagnostics.database.instanceStatus}' but WHAPI says '${actualStatus}' - need to sync`
      )
    }

    // Check for expired trial
    if (profile.trial_expires_at && new Date(profile.trial_expires_at) < new Date()) {
      diagnostics.recommendations.push('⚠️ Trial has expired - channel may be disabled')
    }

    // Check webhook configuration
    if (!diagnostics.endpoints.settings?.hasCorrectWebhook) {
      diagnostics.recommendations.push('⚠️ Webhook not configured - status updates may not work')
    }

    // Final recommendation
    if (diagnostics.recommendations.length === 0) {
      diagnostics.recommendations.push('✅ Everything looks good - connection should work')
    }

    console.log('🔬 Diagnostics complete')

    return new Response(
      JSON.stringify(diagnostics, null, 2),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Diagnostics Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Diagnostics failed', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
