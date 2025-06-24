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
    console.log('🔔 Webhook received:', JSON.stringify(webhookData, null, 2))

    // 🆕 HANDLE USERS.POST EVENT - This is fired when user connects!
    if (webhookData.event?.type === 'users' && webhookData.event?.event === 'post') {
      console.log('🎉 USER CONNECTED EVENT DETECTED!')
      
      const channelId = webhookData.channel_id
      const userData = webhookData.user
      
      console.log('📱 Channel ID:', channelId)
      console.log('👤 User data:', userData)
      
      if (channelId) {
        // Find user by instance_id (channel_id) and update to connected
        const { data: profile, error: findError } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('instance_id', channelId)
          .single()
        
        if (findError) {
          console.error('❌ Could not find user with channel ID:', channelId, findError)
        } else {
          console.log('✅ Found user profile:', profile.id)
          
          // Update user status to connected
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              instance_status: 'connected',
              updated_at: new Date().toISOString()
            })
            .eq('id', profile.id)
          
          if (updateError) {
            console.error('❌ Failed to update user status:', updateError)
          } else {
            console.log('🎯 SUCCESS: User marked as connected in database!')
          }
        }
      }
      
      return new Response('OK', { headers: corsHeaders })
    }
    
    // 🆕 HANDLE USERS.DELETE EVENT - This is fired when user disconnects
    if (webhookData.event?.type === 'users' && webhookData.event?.event === 'delete') {
      console.log('📱 USER DISCONNECTED EVENT DETECTED!')
      
      const channelId = webhookData.channel_id
      
      if (channelId) {
        // Find user by instance_id and update to disconnected
        const { data: profile, error: findError } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('instance_id', channelId)
          .single()
        
        if (findError) {
          console.error('❌ Could not find user with channel ID:', channelId)
        } else {
          // Update user status to disconnected
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              instance_status: 'unauthorized',
              updated_at: new Date().toISOString()
            })
            .eq('id', profile.id)
          
          if (updateError) {
            console.error('❌ Failed to update user status:', updateError)
          } else {
            console.log('📱 User marked as disconnected in database')
          }
        }
      }
      
      return new Response('OK', { headers: corsHeaders })
    }

    // Handle other webhook events (messages, etc.) - your existing code
    if (webhookData.messages) {
      console.log('📨 Message webhook received')
      // Your existing message handling code...
    }

    return new Response('OK', { headers: corsHeaders })

  } catch (error) {
    console.error('💥 Webhook Error:', error)
    return new Response('Error', { status: 500, headers: corsHeaders })
  }
})