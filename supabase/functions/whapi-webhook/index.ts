
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const webhookData = await req.json()
    console.log('📬 Received WHAPI webhook at:', new Date().toISOString())
    console.log('📦 Full webhook payload:', JSON.stringify(webhookData, null, 2))

    const { event, data, type } = webhookData
    const webhookType = event || type

    console.log('🔍 Webhook details:', {
      event: event,
      type: type,
      webhookType: webhookType,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      timestamp: new Date().toISOString()
    })

    if (webhookType === 'channel' && data?.status) {
      console.log('📢 Channel status update detected:', {
        event: webhookType,
        status: data.status,
        channelId: data.id,
        timestamp: new Date().toISOString(),
        allDataFields: Object.keys(data)
      })

      // Find user by instance_id and update status
      if (data.id) {
        const { data: profiles, error: findError } = await supabase
          .from('profiles')
          .select('id, instance_id, instance_status')
          .eq('instance_id', data.id)

        if (findError) {
          console.error('❌ Error finding profile:', findError)
          return new Response(
            JSON.stringify({ error: 'Failed to find profile' }),
            { status: 500, headers: corsHeaders }
          )
        }

        if (profiles && profiles.length > 0) {
          const profile = profiles[0]
          console.log('👤 Found profile for channel update:', {
            userId: profile.id,
            currentStatus: profile.instance_status,
            incomingWhapiStatus: data.status,
            channelId: data.id
          })

          // IMPROVED: Better status mapping with comprehensive logging
          let newStatus = profile.instance_status // Default to current status
          
          console.log('🎯 Processing status mapping for:', data.status)
          
          if (data.status === 'unauthorized' || data.status === 'qr') {
            newStatus = 'unauthorized'
            console.log('✅ Channel is ready for QR generation! Status: unauthorized')
          } else if (data.status === 'active' || data.status === 'ready' || data.status === 'launched') {
            newStatus = 'unauthorized'
            console.log('📱 Channel is ready for authentication! Status: unauthorized')
          } else if (data.status === 'authenticated' || data.status === 'connected') {
            newStatus = 'connected'
            console.log('🎉 WhatsApp session is now connected! Status: connected')
          } else if (data.status === 'initializing' || data.status === 'creating') {
            newStatus = 'initializing'
            console.log('⏳ Channel is still initializing... Status: initializing')
          } else if (data.status === 'disconnected' || data.status === 'error' || data.status === 'failed') {
            newStatus = 'disconnected'
            console.log('❌ Channel disconnected or failed! Status: disconnected')
          } else {
            console.log('⚠️ Unknown WHAPI status, mapping to unauthorized:', data.status)
            newStatus = 'unauthorized'
          }

          // Only update if status actually changed
          if (newStatus !== profile.instance_status) {
            console.log('🔄 Status change detected, updating database...', {
              userId: profile.id,
              oldStatus: profile.instance_status,
              newStatus: newStatus,
              originalWhapiStatus: data.status
            })
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                instance_status: newStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', profile.id)

            if (updateError) {
              console.error('❌ Error updating profile status:', updateError)
            } else {
              console.log('✅ Profile status updated successfully:', {
                userId: profile.id,
                oldStatus: profile.instance_status,
                newStatus: newStatus,
                webhookStatus: data.status,
                updateTimestamp: new Date().toISOString()
              })
            }
          } else {
            console.log('ℹ️ Status unchanged, no database update needed:', {
              currentStatus: profile.instance_status,
              incomingStatus: data.status,
              mappedStatus: newStatus
            })
          }
        } else {
          console.log('⚠️ No profile found for channel ID:', data.id)
          console.log('🔍 This might be a channel that was deleted or from a different environment')
        }
      } else {
        console.log('⚠️ Channel update received without channel ID')
      }
    } else if (webhookType === 'users' && data?.status) {
      console.log('👥 User status update detected:', {
        event: webhookType,
        status: data.status,
        phone: data.phone,
        timestamp: new Date().toISOString()
      })

      // Handle user authentication status updates
      if (data.status === 'authenticated' && data.phone) {
        console.log('🔐 User authenticated with phone:', data.phone)
        // Additional logic for user authentication can be added here
      }
    } else {
      console.log('📝 Received other webhook event:', {
        webhookType: webhookType,
        hasData: !!data,
        dataStatus: data?.status,
        timestamp: new Date().toISOString()
      })
      
      if (data) {
        console.log('🔍 Other webhook data for debugging:', JSON.stringify(data, null, 2))
      }
    }

    // Always return success to WHAPI to confirm receipt
    console.log('✅ Webhook processing completed successfully')
    return new Response(
      JSON.stringify({ 
        success: true, 
        received: true, 
        timestamp: new Date().toISOString(),
        processed: true 
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Webhook Error:', error)
    console.error('💥 Error details:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })
    console.error('💥 Request details:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    })
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
