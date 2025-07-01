
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

    console.log('Send Immediate Message: Starting...')

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

    console.log(`Sending message to ${groupIds.length} groups via instance ${profile.instance_id}`)

    const results = []
    let successCount = 0
    let failureCount = 0

    // Send message to each group
    for (const groupId of groupIds) {
      try {
        console.log(`Sending message to group ${groupId}`)

        // Prepare WHAPI request body
        const requestBody: any = {
          to: groupId,
          body: message
        }

        // Add media if provided
        if (mediaUrl) {
          requestBody.media = {
            url: mediaUrl
          }
        }

        // Send message via WHAPI
        const whapiResponse = await fetch(`https://gate.whapi.cloud/messages/text`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        if (whapiResponse.ok) {
          const responseData = await whapiResponse.json()
          console.log(`Successfully sent message to group ${groupId}`)
          results.push({
            groupId,
            status: 'sent',
            messageId: responseData.id || null
          })
          successCount++
        } else {
          const errorText = await whapiResponse.text()
          console.error(`Failed to send message to group ${groupId}:`, errorText)
          results.push({
            groupId,
            status: 'failed',
            error: errorText
          })
          failureCount++
        }

      } catch (error) {
        console.error(`Error sending to group ${groupId}:`, error)
        results.push({
          groupId,
          status: 'failed',
          error: error.message
        })
        failureCount++
      }
    }

    console.log(`Message sending completed: ${successCount} successful, ${failureCount} failed`)

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
        console.log('Message record stored successfully')
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
          failed: failureCount
        },
        message: `Message sent to ${successCount} out of ${groupIds.length} groups`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Send Immediate Message Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
