
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
    console.log('📬 Enhanced Webhook received at:', new Date().toISOString())
    console.log('📦 Full webhook payload:', JSON.stringify(webhookData, null, 2))

    const { event, data, type } = webhookData
    const webhookType = event || type

    console.log('🔍 Enhanced webhook processing:', {
      event: event,
      type: type,
      webhookType: webhookType,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      timestamp: new Date().toISOString(),
      headers: Object.fromEntries(req.headers.entries())
    })

    // Enhanced channel status processing
    if (webhookType === 'channel' && data?.status) {
      console.log('📢 Enhanced channel status update:', {
        event: webhookType,
        status: data.status,
        channelId: data.id,
        timestamp: new Date().toISOString(),
        allDataFields: Object.keys(data)
      })

      // Validate channel exists in our system
      if (data.id) {
        const { data: profiles, error: findError } = await supabase
          .from('profiles')
          .select('id, instance_id, instance_status, whapi_token')
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
          console.log('👤 Enhanced profile processing:', {
            userId: profile.id,
            currentStatus: profile.instance_status,
            incomingWhapiStatus: data.status,
            channelId: data.id,
            hasToken: !!profile.whapi_token
          })

          // Enhanced status mapping with validation
          let newStatus = profile.instance_status
          let statusChanged = false
          
          console.log('🎯 Enhanced status mapping for:', data.status)
          
          // More comprehensive status mapping
          switch (data.status.toLowerCase()) {
            case 'unauthorized':
            case 'qr':
            case 'ready':
            case 'active':
            case 'launched':
              if (profile.instance_status !== 'unauthorized') {
                newStatus = 'unauthorized'
                statusChanged = true
                console.log('✅ Channel ready for QR generation! Status: unauthorized')
              }
              break
              
            case 'authenticated':
            case 'connected':
            case 'online':
              if (profile.instance_status !== 'connected') {
                newStatus = 'connected'
                statusChanged = true
                console.log('🎉 WhatsApp session connected! Status: connected')
              }
              break
              
            case 'initializing':
            case 'creating':
            case 'starting':
              if (profile.instance_status !== 'initializing') {
                newStatus = 'initializing'
                statusChanged = true
                console.log('⏳ Channel initializing... Status: initializing')
              }
              break
              
            case 'disconnected':
            case 'error':
            case 'failed':
            case 'offline':
              if (profile.instance_status !== 'disconnected') {
                newStatus = 'disconnected'
                statusChanged = true
                console.log('❌ Channel disconnected/failed! Status: disconnected')
              }
              break
              
            default:
              console.log('⚠️ Unknown WHAPI status:', data.status)
              // Don't change status for unknown statuses
              break
          }

          // Update database if status changed
          if (statusChanged) {
            console.log('🔄 Enhanced status update:', {
              userId: profile.id,
              oldStatus: profile.instance_status,
              newStatus: newStatus,
              originalWhapiStatus: data.status,
              timestamp: new Date().toISOString()
            })
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                instance_status: newStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', profile.id)

            if (updateError) {
              console.error('❌ Enhanced status update failed:', updateError)
            } else {
              console.log('✅ Enhanced status updated successfully:', {
                userId: profile.id,
                oldStatus: profile.instance_status,
                newStatus: newStatus,
                webhookStatus: data.status,
                updateTimestamp: new Date().toISOString()
              })
              
              // Log successful webhook processing for monitoring
              console.log('📊 Webhook processing metrics:', {
                type: 'status_update_success',
                channelId: data.id,
                userId: profile.id,
                statusChange: `${profile.instance_status} -> ${newStatus}`,
                processingTime: Date.now(),
                webhookReceived: true
              })
            }
          } else {
            console.log('ℹ️ Enhanced status unchanged:', {
              currentStatus: profile.instance_status,
              incomingStatus: data.status,
              mappedStatus: newStatus,
              noUpdateNeeded: true
            })
          }
        } else {
          console.log('⚠️ Enhanced webhook - no profile found:', {
            channelId: data.id,
            possibleReasons: [
              'Channel was deleted from our system',
              'Channel belongs to different environment',
              'Channel ID mismatch'
            ],
            recommendedAction: 'This might indicate orphaned channel in WHAPI'
          })
          
          // Log orphaned channel for cleanup
          console.log('🧹 Orphaned channel detected:', {
            type: 'orphaned_channel',
            channelId: data.id,
            status: data.status,
            timestamp: new Date().toISOString(),
            shouldCleanup: true
          })
        }
      } else {
        console.log('⚠️ Enhanced webhook - missing channel ID:', {
          event: webhookType,
          dataKeys: Object.keys(data || {}),
          fullData: data
        })
      }
    } 
    // Enhanced user status processing
    else if (webhookType === 'users' && data?.status) {
      console.log('👥 Enhanced user status update:', {
        event: webhookType,
        status: data.status,
        phone: data.phone,
        timestamp: new Date().toISOString(),
        additionalData: Object.keys(data).filter(key => !['status', 'phone'].includes(key))
      })

      if (data.status === 'authenticated' && data.phone) {
        console.log('🔐 Enhanced user authentication detected:', {
          phone: data.phone,
          timestamp: new Date().toISOString(),
          shouldUpdateProfile: true
        })
      }
    } 
    // Log other webhook types for monitoring
    else {
      console.log('📝 Enhanced webhook - other event:', {
        webhookType: webhookType,
        hasData: !!data,
        dataStatus: data?.status,
        timestamp: new Date().toISOString(),
        eventKeys: Object.keys(webhookData),
        dataKeys: data ? Object.keys(data) : []
      })
      
      if (data) {
        console.log('🔍 Enhanced webhook data analysis:', {
          type: 'unknown_webhook_data',
          webhookType: webhookType,
          dataSnapshot: JSON.stringify(data, null, 2),
          timestamp: new Date().toISOString()
        })
      }
    }

    // Enhanced success response with processing details
    console.log('✅ Enhanced webhook processing completed:', {
      processed: true,
      webhookType: webhookType,
      processingTimestamp: new Date().toISOString(),
      success: true
    })
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        received: true, 
        processed: true,
        webhookType: webhookType,
        timestamp: new Date().toISOString(),
        processingDetails: {
          dataReceived: !!data,
          eventType: webhookType,
          channelId: data?.id || null,
          status: data?.status || null
        }
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Enhanced Webhook Error:', error)
    console.error('💥 Enhanced error details:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      requestInfo: {
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries())
      }
    })
    
    // Log webhook processing failure for monitoring
    console.log('📊 Webhook processing metrics:', {
      type: 'webhook_processing_error',
      error: error.message,
      timestamp: Date.now(),
      webhookReceived: true,
      processingFailed: true
    })
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        timestamp: new Date().toISOString(),
        webhookProcessingFailed: true
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
