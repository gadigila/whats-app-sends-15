
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

        // Get user's instance ID, token and status
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('instance_id, whapi_token, instance_status, payment_plan, trial_expires_at')
          .eq('id', message.user_id)
          .single()

        if (profileError || !profile?.whapi_token) {
          console.error(`No WHAPI token found for user ${message.user_id}`)
          
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
          console.error(`User ${message.user_id} trial has expired`)
          
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
          console.error(`Instance ${userProfile.instance_id} is not connected`)
          
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

        let allMessagesSent = true
        let errorMessage = ''
        let successCount = 0

        // Send message to each group using the user's WHAPI token
        for (const groupId of message.group_ids) {
          try {
            console.log(`Sending message to group ${groupId} via instance ${userProfile.instance_id}`)

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

            // Send message via WHAPI using user's token (not partner token)
            const whapiResponse = await fetch(`https://gate.whapi.cloud/messages/text`, {
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
              successCount++
            }

          } catch (error) {
            console.error(`Error sending to group ${groupId}:`, error)
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

        console.log(`Updated message ${message.id} status to ${newStatus} (${successCount}/${message.group_ids.length} groups)`)

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
