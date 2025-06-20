
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

interface PhoneAuthRequest {
  userId: string
  phoneNumber: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId, phoneNumber }: PhoneAuthRequest = await req.json()

    if (!userId || !phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'User ID and phone number are required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📱 Phone auth request for user:', userId, 'phone:', phoneNumber)

    // Get user's WHAPI token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_token, instance_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      console.error('❌ No WHAPI token found for user')
      return new Response(
        JSON.stringify({ error: 'No WhatsApp instance found. Please create one first.' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Clean phone number (remove +, spaces, etc.)
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '')
    
    // Use WHAPI phone login endpoint
    const loginResponse = await fetch(`https://gate.whapi.cloud/users/login/${cleanPhone}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.whapi_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text()
      console.error('❌ Phone login failed:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Phone authentication failed',
          details: errorText 
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const loginData = await loginResponse.json()
    console.log('📱 Phone login response:', loginData)

    // If login successful, update user status
    if (loginData.success || loginData.status === 'authenticated') {
      await supabase
        .from('profiles')
        .update({
          instance_status: 'connected',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      console.log('✅ Phone authentication successful')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Phone authentication successful',
          phone: cleanPhone
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // If code is required
    if (loginData.code_required || loginData.status === 'code_required') {
      console.log('📨 Verification code sent to phone')
      return new Response(
        JSON.stringify({
          success: true,
          code_required: true,
          message: 'Verification code sent to your phone',
          phone: cleanPhone
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        error: 'Unknown response from phone authentication',
        details: loginData
      }),
      { status: 400, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Phone Auth Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
