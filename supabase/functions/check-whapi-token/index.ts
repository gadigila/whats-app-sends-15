
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
    
    const { userId } = await req.json()
    
    // Get user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: corsHeaders }
      )
    }
    
    // Check token validity
    const tokenAnalysis = {
      userId: userId,
      hasToken: !!profile.whapi_token,
      tokenLength: profile.whapi_token?.length,
      tokenEqualsUserId: profile.whapi_token === userId,
      tokenPrefix: profile.whapi_token?.substring(0, 50) + '...',
      instanceId: profile.instance_id,
      instanceStatus: profile.instance_status,
      lastUpdated: profile.updated_at
    }
    
    // If token exists and is not the user ID, try to validate it
    if (profile.whapi_token && profile.whapi_token !== userId) {
      try {
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })
        
        tokenAnalysis.tokenValid = healthResponse.ok
        tokenAnalysis.healthStatus = healthResponse.status
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json()
          tokenAnalysis.channelStatus = healthData.status
        }
      } catch (e) {
        tokenAnalysis.tokenValid = false
        tokenAnalysis.validationError = e.message
      }
    }
    
    return new Response(
      JSON.stringify(tokenAnalysis, null, 2),
      { status: 200, headers: corsHeaders }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
