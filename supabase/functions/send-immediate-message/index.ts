import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendMessageRequest {
  userId: string
  groupIds: string[]
  message: string
  mediaUrl?: string
}

// ✅ Helper function to detect file type and get appropriate endpoint
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

// ✅ Helper function to get filename from URL
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

    console.log('📤 Send Immediate Message: Enhanced with multi-media support...')

    const { userId, groupIds, message, mediaUrl }: SendMessageRequest = await req.json()

    if (!userId || !groupIds || groupIds.length === 0 || !message) {
      return new Response(
        JSON.stringify({ error: 'User ID, group IDs, and message are required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's WHAPI token and instance details
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      console.error('No WHAPI token found for user:', userId)
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found or not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.instance_status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance is not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get group names for the message record
    const { data: groups } = await supabase
      .from('whatsapp_groups')
      .select('group_id, name')
      .eq('user_id', userId)
      .in('group_id', groupIds)

    const groupNames = groups?.map(g => g.name) || []

    // ✅ Detect media type if provided
    const { messageType } = getMessageTypeAndEndpoint(mediaUrl);
    console.log(`📋 Sending ${messageType} message to ${groupIds.length} groups via instance ${profile.instance_id}`)
    if (mediaUrl) {
      console.log(`📎 Media URL: ${mediaUrl}`)
    }

    const results = []
    let successCount = 0
    let failureCount = 0

    // ✅ ENHANCED: Send message to each group with proper media handling
    for (const groupId of groupIds) {
      try {
        console.log(`📤 Sending ${messageType} message to group ${groupId}`)

        // Get endpoint and prepare request body based on media type
        const { endpoint, messageType: detectedType } = getMessageTypeAndEndpoint(mediaUrl);
        let requestBody: any;

        if (mediaUrl) {
          console.log(`📎 Detected file type: ${detectedType} for URL: ${mediaUrl}`);
          
          // Prepare body based on message type
          switch (detectedType) {
            case 'image':
              requestBody = {
                to: groupId,
                media: mediaUrl,
                caption: message || '' // Images can have captions
              };
              break;

            case 'video':
              requestBody = {
                to: groupId,
                media: mediaUrl,
                caption: message || '' // Videos can have captions
              };
              break;

            case 'audio':
              requestBody = {
                to: groupId,
                media: mediaUrl,
                // Audio messages don't support captions in WHAPI
              };
              // We'll send text message separately if there's a message
              if (message) {
                console.log('📝 Will send text separately for audio message');
              }
              break;

            case 'document':
              const filename = getFilenameFromUrl(mediaUrl);
              requestBody = {
                to: groupId,
                media: mediaUrl,
                filename: filename, // ✅ Important for documents like PDFs
                caption: message || '' // Documents can have captions
              };
              console.log(`📄 Document filename: ${filename}`);
              break;

            default:
              // Fallback to document
              requestBody = {
                to: groupId,
                media: mediaUrl,
                filename: getFilenameFromUrl(mediaUrl),
                caption: message || ''
              };
          }

          console.log(`📤 Sending ${detectedType} to ${groupId}:`, {
            endpoint,
            filename: requestBody.filename || 'N/A',
            hasCaption: !!requestBody.caption
          });

        } else {
          // Text-only message
          requestBody = {
            to: groupId,
            body: message
          };
          console.log('💬 Sending text message:', { groupId, message });
        }

        // Send the main message
        const whapiResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (whapiResponse.ok) {
          const responseData = await whapiResponse.json();
          console.log(`✅ Successfully sent ${detectedType} to group ${groupId}`);
          
          // ✅ For audio files, send text message separately if there's a message
          if (detectedType === 'audio' && message) {
            try {
              console.log(`📝 Sending separate text message for audio to ${groupId}`);
              const textResponse = await fetch('https://gate.whapi.cloud/messages/text', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${profile.whapi_token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  to: groupId,
                  body: message
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

          results.push({
            groupId,
            status: 'sent',
            messageId: responseData.id || null,
            messageType: detectedType
          });
          successCount++;

        } else {
          const errorText = await whapiResponse.text();
          console.error(`❌ Failed to send ${detectedType} to group ${groupId}:`, errorText);
          results.push({
            groupId,
            status: 'failed',
            error: errorText,
            messageType: detectedType
          });
          failureCount++;
        }

      } catch (error) {
        console.error(`❌ Error sending to group ${groupId}:`, error);
        results.push({
          groupId,
          status: 'failed',
          error: error.message
        });
        failureCount++;
      }
    }

    console.log(`📊 Message sending completed: ${successCount} successful, ${failureCount} failed`)

    // Store the message record in the database
    const messageStatus = successCount > 0 ? 'sent' : 'failed'
    const errorMessage = failureCount > 0 ? `${failureCount} out of ${groupIds.length} groups failed` : null

    try {
      const { error: insertError } = await supabase
        .from('scheduled_messages')
        .insert({
          user_id: userId,
          group_ids: groupIds,
          group_names: groupNames,
          message: message,
          media_url: mediaUrl,
          send_at: new Date().toISOString(), // Set to current time for immediate messages
          status: messageStatus,
          total_groups: groupIds.length,
          error_message: errorMessage
        })

      if (insertError) {
        console.error('Failed to store message record:', insertError)
        // Don't fail the request if storage fails, the message was already sent
      } else {
        console.log('✅ Message record stored successfully')
      }
    } catch (storageError) {
      console.error('Error storing message record:', storageError)
      // Don't fail the request if storage fails
    }

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        results,
        summary: {
          total: groupIds.length,
          successful: successCount,
          failed: failureCount,
          messageType: messageType
        },
        message: `${messageType} message sent to ${successCount} out of ${groupIds.length} groups`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Send Immediate Message Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})