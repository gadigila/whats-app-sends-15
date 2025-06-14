
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateInstanceRequest {
  userId: string
}

interface DeleteInstanceRequest {
  userId: string
  instanceId: string
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
    const whapiPartnerToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { method } = req
    const body = method === 'POST' || method === 'DELETE' ? await req.json() : null

    console.log(`Instance Manager: ${method} request received`)

    if (method === 'POST') {
      // Create new instance
      const { userId } = body as CreateInstanceRequest

      console.log(`Creating instance for user: ${userId}`)

      // Check user's billing status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('billing_status, instance_id')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        return new Response(
          JSON.stringify({ error: 'User profile not found' }),
          { status: 404, headers: corsHeaders }
        )
      }

      // Check if user already has an instance
      if (profile.instance_id) {
        return new Response(
          JSON.stringify({ 
            error: 'User already has an instance',
            instanceId: profile.instance_id 
          }),
          { status: 400, headers: corsHeaders }
        )
      }

      // For now, allow trial users to create instances (can be restricted later)
      console.log(`User billing status: ${profile.billing_status}`)

      // Create instance via WHAPI Partner API
      const createInstanceResponse = await fetch('https://gate.whapi.cloud/partner/instances', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `user_${userId}_instance`,
          webhook_url: `${supabaseUrl}/functions/v1/whatsapp-webhook`
        })
      })

      if (!createInstanceResponse.ok) {
        const errorText = await createInstanceResponse.text()
        console.error('WHAPI instance creation failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to create WhatsApp instance' }),
          { status: 500, headers: corsHeaders }
        )
      }

      const instanceData = await createInstanceResponse.json()
      console.log('Instance created:', instanceData)

      // Update user profile with instance ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          instance_id: instanceData.id,
          instance_status: 'created',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Profile update error:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update user profile' }),
          { status: 500, headers: corsHeaders }
        )
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          instanceId: instanceData.id,
          status: 'created'
        }),
        { status: 200, headers: corsHeaders }
      )

    } else if (method === 'DELETE') {
      // Delete instance
      const { userId, instanceId } = body as DeleteInstanceRequest

      console.log(`Deleting instance ${instanceId} for user: ${userId}`)

      // Verify instance belongs to user
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('instance_id')
        .eq('id', userId)
        .single()

      if (profileError || profile.instance_id !== instanceId) {
        return new Response(
          JSON.stringify({ error: 'Instance not found or unauthorized' }),
          { status: 404, headers: corsHeaders }
        )
      }

      // Delete instance via WHAPI Partner API
      const deleteInstanceResponse = await fetch(`https://gate.whapi.cloud/partner/instances/${instanceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${whapiPartnerToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!deleteInstanceResponse.ok) {
        const errorText = await deleteInstanceResponse.text()
        console.error('WHAPI instance deletion failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to delete WhatsApp instance' }),
          { status: 500, headers: corsHeaders }
        )
      }

      // Update user profile to remove instance
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          instance_id: null,
          instance_status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Profile update error:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update user profile' }),
          { status: 500, headers: corsHeaders }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders }
      )

    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      )
    }

  } catch (error) {
    console.error('Instance Manager Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})
