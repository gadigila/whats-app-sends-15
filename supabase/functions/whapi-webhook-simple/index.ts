import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('📨 WHAPI Webhook - Enhanced Connection Detection')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const webhookData = await req.json()
    console.log('📊 Webhook Event:', {
      type: webhookData.type,
      timestamp: new Date().toISOString(),
      data: webhookData.data ? Object.keys(webhookData.data) : 'no data'
    })

    const eventType = webhookData.type
    const eventData = webhookData.data || {}

    switch (eventType) {
      case 'ready':
        console.log('🎉 WhatsApp Connected!')
        await handleConnectionSuccess(supabase, eventData)
        break

      case 'users':
        console.log('👤 User Status Change')
        if (eventData.authenticated || eventData.status === 'authenticated') {
          console.log('✅ User authenticated via webhook')
          await handleConnectionSuccess(supabase, eventData)
        }
        break

      case 'auth_failure':
        console.log('❌ Authentication Failed')
        await handleAuthFailure(supabase, eventData)
        break

      case 'messages':
        // Log but don't process message events for connection
        console.log('💬 Message Event (ignored for connection)')
        break

      default:
        console.log(`ℹ️ Unhandled event: ${eventType}`)
        break
    }

    return new Response(
      JSON.stringify({ 
        received: true, 
        processed: eventType,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Webhook Error:', error)
    return new Response(
      JSON.stringify({ received: true, error: error.message }),
      { status: 200, headers: corsHeaders }
    )
  }
})

async function handleConnectionSuccess(supabase: any, eventData: any) {
  try {
    console.log('🔍 Processing connection success...')
    console.log('📱 Event data:', eventData)

    const phone = eventData.phone || eventData.me?.phone
    console.log('📞 Phone number:', phone)

    if (!phone) {
      console.log('⚠️ No phone number in connection event')
      return
    }

    // Find profiles that are waiting for connection
    const { data: waitingProfiles, error: findError } = await supabase
      .from('profiles')
      .select('id, instance_id, whapi_token')
      .in('instance_status', ['unauthorized', 'qr_displayed', 'initializing'])

    if (findError) {
      console.error('❌ Error finding waiting profiles:', findError)
      return
    }

    if (!waitingProfiles || waitingProfiles.length === 0) {
      console.log('ℹ️ No profiles waiting for connection')
      return
    }

    console.log(`🔍 Checking ${waitingProfiles.length} waiting profiles...`)

    // Check which profile this connection belongs to
    for (const profile of waitingProfiles) {
      try {
        console.log(`🔍 Checking profile ${profile.id}...`)
        
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (healthResponse.ok) {
          const healthData = await healthResponse.json()
          console.log(`📊 Profile ${profile.id} health:`, healthData.status)

          if (healthData.status === 'connected' && healthData.me?.phone === phone) {
            console.log(`✅ Found matching profile ${profile.id} for phone ${phone}`)
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                instance_status: 'connected',
                updated_at: new Date().toISOString()
              })
              .eq('id', profile.id)

            if (updateError) {
              console.error('❌ Error updating profile:', updateError)
            } else {
              console.log(`✅ Profile ${profile.id} updated to connected`)
              return // Found and updated the correct profile
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Error checking profile ${profile.id}:`, error.message)
      }
    }

    console.log('⚠️ Could not match connection event to any waiting profile')
  } catch (error) {
    console.error('💥 Error in handleConnectionSuccess:', error)
  }
}

async function handleAuthFailure(supabase: any, eventData: any) {
  try {
    console.log('❌ Processing auth failure...')
    
    // Reset profiles that might have failed authentication
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_status: 'unauthorized',
        updated_at: new Date().toISOString()
      })
      .in('instance_status', ['qr_displayed', 'initializing'])

    if (updateError) {
      console.error('❌ Error updating auth failure status:', updateError)
    } else {
      console.log('✅ Reset profiles after auth failure')
    }
  } catch (error) {
    console.error('💥 Error in handleAuthFailure:', error)
  }
}