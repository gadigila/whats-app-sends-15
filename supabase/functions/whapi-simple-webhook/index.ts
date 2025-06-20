
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
    console.log('📬 Simple Webhook received:', webhookData)

    const { event, data, type } = webhookData
    const webhookType = event || type

    // Handle channel status updates
    if (webhookType === 'channel' && data?.status && data?.id) {
      console.log('📢 Channel status update:', {
        channelId: data.id,
        status: data.status
      })

      // Find user with this channel
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, instance_status')
        .eq('instance_id', data.id)

      if (profiles && profiles.length > 0) {
        const profile = profiles[0]
        let newStatus = profile.instance_status

        // Simple status mapping
        switch (data.status.toLowerCase()) {
          case 'unauthorized':
          case 'qr':
          case 'ready':
            newStatus = 'unauthorized'
            break
          case 'authenticated':
          case 'connected':
          case 'online':
            newStatus = 'connected'
            break
          case 'disconnected':
          case 'error':
          case 'failed':
            newStatus = 'disconnected'
            break
        }

        // Update if status changed
        if (newStatus !== profile.instance_status) {
          await supabase
            .from('profiles')
            .update({
              instance_status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', profile.id)

          console.log('✅ Status updated:', {
            userId: profile.id,
            oldStatus: profile.instance_status,
            newStatus: newStatus
          })
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        received: true,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Simple Webhook Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing failed', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
