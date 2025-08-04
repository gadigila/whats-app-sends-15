import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduledMessage {
  id: string
  user_id: string
  message: string
  group_ids: string[]
  media_url?: string
  send_at: string
  status: string
}

interface UserProfile {
  instance_id: string
  whapi_token: string
  instance_status: string
  payment_plan: string
  trial_expires_at: string | null
}

// ✅ FIXED: Media type detection and endpoint selection (copied from working send-immediate-message)
function getMessageTypeAndEndpoint(mediaUrl: string): { endpoint: string; messageType: string } {
  if (!mediaUrl) {
    return { endpoint: 'https://gate.whapi.cloud/messages/text', messageType: 'text' };
  }

  // Extract file extension
  const urlLower = mediaUrl.toLowerCase();
  const extension = urlLower.split('.').pop()?.split('?')[0]; // Remove query params

  // Image types
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension || '')) {
    return { endpoint: 'https://gate.whapi.cloud/messages/image', messageType: 'image' };
  }

  // Video types
  if (['mp4', 'avi', 'mov', '3gp', 'mkv', 'webm'].includes(extension || '')) {
    return { endpoint: 'https://gate.whapi.cloud/messages/video', messageType: 'video' };
  }

  // Audio types
  if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'opus'].includes(extension || '')) {
    return { endpoint: 'https://gate.whapi.cloud/messages/audio', messageType: 'audio' };
  }

  // Document types (PDF, Office files, etc.)
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv'].includes(extension || '')) {
    return { endpoint: 'https://gate.whapi.cloud/messages/document', messageType: 'document' };
  }

  // Default to document for unknown types
  console.log(`⚠️ Unknown file type: ${extension}, treating as document`);
  return { endpoint: 'https://gate.whapi.cloud/messages/document', messageType: 'document' };
}

// ✅ FIXED: Get filename from URL for documents
function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'file';
    return decodeURIComponent(filename);
  } catch {
    return 'file';
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('📅 WhatsApp Scheduler: Starting job with FIXED media support...')

    // Query for pending messages that should be sent
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('send_at', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching pending messages:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending messages' }),
        { status: 500, headers: corsHeaders }
      )
    }

    console.log(`Found ${pendingMessages?.length || 0} pending messages to process`)

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending messages to process' }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Process each pending message
    for (const message of pendingMessages as ScheduledMessage[]) {
      try {
        console.log(`📤 Processing message ${message.id}`)

        // Get user's instance ID, token and status
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('instance_id, whapi_token, instance_status, payment_plan, trial_expires_at')
          .eq('id', message.user_id)
          .single()

        if (profileError || !profile?.whapi_token) {
          console.error(`❌ No WHAPI token found for user ${message.user_id}`)
          
          // Update message status to failed
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              error_message: 'No WhatsApp instance configured or user not found',
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id)
          
          continue
        }

        const userProfile = profile as UserProfile

        // Check if user's trial has expired
        const now = new Date()
        const trialExpired = userProfile.trial_expires_at && 
                           new Date(userProfile.trial_expires_at) < now &&
                           userProfile.payment_plan === 'trial'

        if (trialExpired) {
          console.error(`❌ User ${message.user_id} trial has expired`)
          
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              error_message: 'Trial period has expired',
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id)
          
          continue
        }

        // Check if instance is connected
        if (userProfile.instance_status !== 'connected') {
          console.error(`❌ Instance ${userProfile.instance_id} is not connected`)
          
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              error_message: 'WhatsApp instance is not connected',
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id)
          
          continue
        }

        // ✅ FIXED: Detect media type and get correct endpoint
        const { endpoint, messageType } = getMessageTypeAndEndpoint(message.media_url || '');
        console.log(`📤 Sending ${messageType} message to ${message.group_ids.length} groups`);
        if (message.media_url) {
          console.log(`📎 Media URL: ${message.media_url}`)
        }

        let allMessagesSent = true
        let errorMessage = ''
        let successCount = 0

        // ✅ FIXED: Send message to each group with proper media handling
        for (const groupId of message.group_ids) {
          try {
            console.log(`📤 Sending ${messageType} message to group ${groupId}`)

            // ✅ FIXED: Prepare request body based on media type (copied from working code)
            let requestBody: any;

            if (message.media_url) {
              console.log(`📎 Detected file type: ${messageType} for URL: ${message.media_url}`);
              
              // Prepare body based on message type
              switch (messageType) {
                case 'image':
                  requestBody = {
                    to: groupId,
                    media: message.media_url,        // ✅ FIXED: Direct URL, not nested object
                    caption: message.message || ''   // ✅ Images can have captions
                  };
                  break;

                case 'video':
                  requestBody = {
                    to: groupId,
                    media: message.media_url,        // ✅ FIXED: Direct URL
                    caption: message.message || ''   // ✅ Videos can have captions
                  };
                  break;

                case 'audio':
                  requestBody = {
                    to: groupId,
                    media: message.media_url         // ✅ Audio messages don't support captions
                  };
                  // We'll send text message separately if there's a message
                  break;

                case 'document':
                  const filename = getFilenameFromUrl(message.media_url);
                  requestBody = {
                    to: groupId,
                    media: message.media_url,        // ✅ FIXED: Direct URL
                    filename: filename,              // ✅ Important for documents
                    caption: message.message || ''   // ✅ Documents can have captions
                  };
                  console.log(`📄 Document filename: ${filename}`);
                  break;

                default:
                  // Fallback to document
                  requestBody = {
                    to: groupId,
                    media: message.media_url,
                    filename: getFilenameFromUrl(message.media_url),
                    caption: message.message || ''
                  };
              }

              console.log(`📤 Sending ${messageType} to ${groupId}:`, {
                endpoint,
                filename: requestBody.filename || 'N/A',
                hasCaption: !!requestBody.caption
              });

            } else {
              // ✅ Text-only message
              requestBody = {
                to: groupId,
                body: message.message
              };
              console.log('💬 Sending text message:', { groupId, message: message.message });
            }

            // ✅ FIXED: Use the correct endpoint for media type
            const whapiResponse = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${userProfile.whapi_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            })

            if (!whapiResponse.ok) {
              const errorText = await whapiResponse.text()
              console.error(`❌ Failed to send ${messageType} to ${groupId}:`, errorText)
              allMessagesSent = false
              errorMessage += `Failed to send to ${groupId}: ${errorText}. `
            } else {
              console.log(`✅ Successfully sent ${messageType} to group ${groupId}`)
              successCount++

              // ✅ FIXED: For audio files, send text message separately if there's a message
              if (messageType === 'audio' && message.message) {
                try {
                  console.log(`📝 Sending separate text message for audio to ${groupId}`);
                  const textResponse = await fetch('https://gate.whapi.cloud/messages/text', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${userProfile.whapi_token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      to: groupId,
                      body: message.message
                    })
                  });
                  
                  if (textResponse.ok) {
                    console.log(`✅ Also sent text message for audio to ${groupId}`);
                  } else {
                    console.log(`⚠️ Failed to send text with audio to ${groupId}`);
                  }
                } catch (textError) {
                  console.log(`⚠️ Error sending text with audio to ${groupId}:`, textError);
                }
              }
            }

          } catch (error) {
            console.error(`❌ Error sending to group ${groupId}:`, error)
            allMessagesSent = false
            errorMessage += `Error sending to ${groupId}: ${error.message}. `
          }
        }

        // Update message status
        const newStatus = allMessagesSent ? 'sent' : (successCount > 0 ? 'partially_sent' : 'failed')
        
        await supabase
          .from('scheduled_messages')
          .update({ 
            status: newStatus,
            error_message: errorMessage || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id)

        console.log(`✅ Updated message ${message.id} status to ${newStatus} (${successCount}/${message.group_ids.length} groups)`)

      } catch (error) {
        console.error(`❌ Error processing message ${message.id}:`, error)
        
        // Update message status to failed
        await supabase
          .from('scheduled_messages')
          .update({ 
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id)
      }
    }

    console.log('🎯 WhatsApp Scheduler: Job completed with FIXED media support')

    return new Response(
      JSON.stringify({ 
        message: 'WhatsApp scheduling job completed with media support',
        processed: pendingMessages.length 
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 WhatsApp Scheduler Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})