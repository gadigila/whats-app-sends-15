
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecoveryRequest {
  userId: string
  forceNewInstance?: boolean
}

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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
    const { userId, forceNewInstance = false }: RecoveryRequest = await req.json()

    console.log('🚑 WHAPI Auto Recovery starting for user:', userId)
    console.log('Force new instance:', forceNewInstance)

    // Step 1: Get current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    console.log('📋 Current profile state:', {
      hasInstanceId: !!profile.instance_id,
      hasToken: !!profile.whapi_token,
      status: profile.instance_status,
      paymentPlan: profile.payment_plan,
      lastUpdated: profile.updated_at
    })

    let recoverySteps = []
    let needsNewInstance = forceNewInstance

    // Step 2: Check existing instance if not forcing new
    if (!forceNewInstance && profile.instance_id && profile.whapi_token) {
      console.log('🔍 Checking existing instance health...')
      
      try {
        // Check channel status
        const statusResponse = await fetch(`https://gate.whapi.cloud/status`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          console.log('✅ Channel is alive, status:', statusData.status)
          recoverySteps.push(`Channel found with status: ${statusData.status}`)

          // Update database status
          let dbStatus = 'disconnected'
          if (statusData.status === 'qr' || statusData.status === 'unauthorized') {
            dbStatus = 'unauthorized'
          } else if (statusData.status === 'authenticated' || statusData.status === 'ready') {
            dbStatus = 'connected'
          } else if (statusData.status === 'loading' || statusData.status === 'initializing') {
            dbStatus = 'initializing'
          }

          if (dbStatus !== profile.instance_status) {
            await supabase
              .from('profiles')
              .update({
                instance_status: dbStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
            
            recoverySteps.push(`Updated database status from ${profile.instance_status} to ${dbStatus}`)
          }

          // If connected, we're done!
          if (dbStatus === 'connected') {
            return new Response(
              JSON.stringify({
                success: true,
                message: 'WhatsApp is already connected!',
                instance_id: profile.instance_id,
                recovery_steps: recoverySteps
              }),
              { status: 200, headers: corsHeaders }
            )
          }

          // If ready for QR, try to get it
          if (dbStatus === 'unauthorized') {
            console.log('📱 Getting QR code...')
            
            const qrResponse = await fetch(`https://gate.whapi.cloud/screen`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${profile.whapi_token}`,
                'Accept': 'application/json'
              }
            })

            if (qrResponse.ok) {
              const qrData = await qrResponse.json()
              let qrCode = null

              // Try all possible QR fields
              const qrFields = ['qr', 'screen', 'image', 'base64', 'qrCode']
              for (const field of qrFields) {
                if (qrData[field]) {
                  qrCode = qrData[field]
                  break
                }
              }

              if (qrCode) {
                if (!qrCode.startsWith('data:image/')) {
                  qrCode = `data:image/png;base64,${qrCode}`
                }

                recoverySteps.push('QR code retrieved successfully')

                return new Response(
                  JSON.stringify({
                    success: true,
                    qr_code: qrCode,
                    message: 'QR code ready! Scan with WhatsApp.',
                    instance_id: profile.instance_id,
                    recovery_steps: recoverySteps
                  }),
                  { status: 200, headers: corsHeaders }
                )
              } else {
                recoverySteps.push('QR code not found in response, may need to wait')
              }
            } else {
              recoverySteps.push(`QR request failed: ${qrResponse.status}`)
            }
          }

          // If initializing, wait a bit
          if (dbStatus === 'initializing') {
            recoverySteps.push('Channel is initializing, please wait...')
            return new Response(
              JSON.stringify({
                success: true,
                message: 'Channel is initializing. Try again in 30 seconds.',
                instance_id: profile.instance_id,
                retry_after: 30,
                recovery_steps: recoverySteps
              }),
              { status: 200, headers: corsHeaders }
            )
          }

        } else if (statusResponse.status === 404) {
          console.log('❌ Channel not found in WHAPI')
          recoverySteps.push('Channel not found in WHAPI - needs recreation')
          needsNewInstance = true
        } else {
          console.log('❌ Channel check failed:', statusResponse.status)
          recoverySteps.push(`Channel check failed with status ${statusResponse.status}`)
          needsNewInstance = true
        }
      } catch (error) {
        console.error('❌ Error checking channel:', error)
        recoverySteps.push(`Error checking channel: ${error.message}`)
        needsNewInstance = true
      }
    } else if (!profile.instance_id || !profile.whapi_token) {
      console.log('🆕 No existing instance found')
      recoverySteps.push('No existing instance found')
      needsNewInstance = true
    }

    // Step 3: Clean up if needed
    if (needsNewInstance && profile.instance_id) {
      console.log('🧹 Cleaning up old instance...')
      
      try {
        // Try to delete from WHAPI
        const deleteResponse = await fetch(`https://manager.whapi.cloud/channels/${profile.instance_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${whapiPartnerToken}`
          }
        })
        
        if (deleteResponse.ok) {
          recoverySteps.push('Old instance deleted from WHAPI')
        } else {
          recoverySteps.push(`Failed to delete old instance: ${deleteResponse.status}`)
        }
      } catch (error) {
        recoverySteps.push(`Error deleting old instance: ${error.message}`)
      }

      // Clear from database
      await supabase
        .from('profiles')
        .update({
          instance_id: null,
          whapi_token: null,
          instance_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
      
      recoverySteps.push('Database cleared')
    }

    // Step 4: Create new instance if needed
    if (needsNewInstance) {
      console.log('🏗️ Creating new instance...')
      
      // Check for project ID
      let projectId = whapiProjectId
      if (!projectId) {
        console.log('🔍 Fetching project ID...')
        try {
          const projectsResponse = await fetch('https://manager.whapi.cloud/projects', {
            headers: {
              'Authorization': `Bearer ${whapiPartnerToken}`
            }
          })

          if (projectsResponse.ok) {
            const projects = await projectsResponse.json()
            if (projects && projects.length > 0) {
              projectId = projects[0].id
              recoverySteps.push(`Using project ID: ${projectId}`)
            }
          }
        } catch (error) {
          recoverySteps.push(`Error fetching projects: ${error.message}`)
        }
      }

      if (!projectId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No project ID available',
            recovery_steps: recoverySteps
          }),
          { status: 400, headers: corsHeaders }
        )
      }

      // Create new channel
      const createResponse = await fetch('https://manager.whapi.cloud/channels', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `reecher_user_${userId.substring(0, 8)}`,
          projectId: projectId
        })
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to create new instance',
            details: errorText,
            recovery_steps: recoverySteps
          }),
          { status: 400, headers: corsHeaders }
        )
      }

      const channelData = await createResponse.json()
      console.log('✅ New channel created:', channelData.id)
      recoverySteps.push(`New channel created: ${channelData.id}`)

      // Setup webhook
      const webhookUrl = `${supabaseUrl}/functions/v1/whapi-webhook`
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
          recoverySteps.push('Webhook configured')
        }
      } catch (error) {
        recoverySteps.push(`Webhook setup error: ${error.message}`)
      }

      // Save to database
      const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      
      await supabase
        .from('profiles')
        .update({
          instance_id: channelData.id,
          whapi_token: channelData.token,
          instance_status: 'initializing',
          payment_plan: 'trial',
          trial_expires_at: trialExpiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
      
      recoverySteps.push('Database updated with new instance')

      // Wait for initialization
      console.log('⏳ Waiting for instance to initialize...')
      await delay(5000) // Wait 5 seconds

      // Check if ready for QR
      let attempts = 0
      const maxAttempts = 10
      
      while (attempts < maxAttempts) {
        const statusResponse = await fetch(`https://gate.whapi.cloud/status`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${channelData.token}`,
            'Content-Type': 'application/json'
          }
        })

        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          console.log(`Status check ${attempts + 1}: ${statusData.status}`)
          
          if (statusData.status === 'qr' || statusData.status === 'unauthorized') {
            // Update database
            await supabase
              .from('profiles')
              .update({
                instance_status: 'unauthorized',
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
            
            // Get QR code
            const qrResponse = await fetch(`https://gate.whapi.cloud/screen`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${channelData.token}`,
                'Accept': 'application/json'
              }
            })

            if (qrResponse.ok) {
              const qrData = await qrResponse.json()
              let qrCode = qrData.qr || qrData.screen || qrData.image || qrData.base64 || qrData.qrCode

              if (qrCode && !qrCode.startsWith('data:image/')) {
                qrCode = `data:image/png;base64,${qrCode}`
              }

              recoverySteps.push('QR code ready!')

              return new Response(
                JSON.stringify({
                  success: true,
                  qr_code: qrCode,
                  message: 'New instance created and QR code ready!',
                  instance_id: channelData.id,
                  recovery_steps: recoverySteps
                }),
                { status: 200, headers: corsHeaders }
              )
            }
          }
        }

        attempts++
        await delay(2000)
      }

      recoverySteps.push('Instance created but QR may need more time')

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Instance created. Please try getting QR in a moment.',
          instance_id: channelData.id,
          recovery_steps: recoverySteps
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Default response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Recovery process completed',
        recovery_steps: recoverySteps
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Auto Recovery Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Recovery failed', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
