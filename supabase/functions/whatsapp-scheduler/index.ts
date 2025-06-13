
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
  whapi_token: string
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

    console.log('WhatsApp Scheduler: Starting job...')

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
        console.log(`Processing message ${message.id}`)

        // Get user's WHAPI token
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('whapi_token')
          .eq('id', message.user_id)
          .single()

        if (profileError || !profile?.whapi_token) {
          console.error(`No WHAPI token found for user ${message.user_id}`)
          
          // Update message status to failed
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              error_message: 'No WHAPI token configured',
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id)
          
          continue
        }

        const userProfile = profile as UserProfile
        let allMessagesSent = true
        let errorMessage = ''

        // Send message to each group
        for (const groupId of message.group_ids) {
          try {
            console.log(`Sending message to group ${groupId}`)

            // Prepare WHAPI request body
            const requestBody: any = {
              to: groupId,
              body: message.message
            }

            // Add media if provided
            if (message.media_url) {
              requestBody.media = {
                url: message.media_url
              }
            }

            // Send message via WHAPI
            const whapiResponse = await fetch('https://gate.whapi.cloud/messages/text', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${userProfile.whapi_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            })

            if (!whapiResponse.ok) {
              const errorText = await whapiResponse.text()
              console.error(`Failed to send message to ${groupId}:`, errorText)
              allMessagesSent = false
              errorMessage += `Failed to send to ${groupId}: ${errorText}. `
            } else {
              console.log(`Successfully sent message to group ${groupId}`)
            }

          } catch (error) {
            console.error(`Error sending to group ${groupId}:`, error)
            allMessagesSent = false
            errorMessage += `Error sending to ${groupId}: ${error.message}. `
          }
        }

        // Update message status
        const newStatus = allMessagesSent ? 'sent' : 'failed'
        
        await supabase
          .from('scheduled_messages')
          .update({ 
            status: newStatus,
            error_message: errorMessage || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id)

        console.log(`Updated message ${message.id} status to ${newStatus}`)

      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error)
        
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

    console.log('WhatsApp Scheduler: Job completed')

    return new Response(
      JSON.stringify({ 
        message: 'WhatsApp scheduling job completed',
        processed: pendingMessages.length 
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('WhatsApp Scheduler Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})
