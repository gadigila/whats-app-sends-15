import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Verify user has active subscription
    if (profile.subscription_status !== 'active') {
      throw new Error('No active subscription to cancel');
    }

    // Cancel subscription (keep access until expiry date)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'cancelled',
        auto_renew: false,
        subscription_cancelled_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error cancelling subscription:', updateError);
      throw updateError;
    }

    // ======= CRITICAL: Stop Tranzila recurring charges via STO API =======
    try {
      // Get user's STO ID
      if (!profile.tranzila_sto_id) {
        throw new Error('No subscription ID found. Cannot cancel recurring payments.');
      }

      console.log('🛑 Stopping Tranzila recurring billing, STO ID:', profile.tranzila_sto_id);

      // Get Tranzila credentials
      const terminalName = Deno.env.get('TRANZILA_TERMINAL_NAME')!;
      const appKey = Deno.env.get('TRANZILA_API_APP_KEY')!;
      const secret = Deno.env.get('TRANZILA_API_SECRET')!;
      
      // Get user's email
      const { data: { user: authUser }, error: userError } = await supabase.auth.admin.getUserById(user.id);
      
      // Generate HMAC authentication for STO API
      const nonce = crypto.randomUUID().replace(/-/g, '').substring(0, 40);
      const timestamp = Date.now().toString();
      
      // Create HMAC SHA256: hash_hmac('sha256', app_key + request_time + nonce, secret)
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(appKey + timestamp + nonce);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const accessToken = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      console.log('🔐 Generated HMAC authentication for Tranzila STO API');

      // Call Tranzila STO Update API to set status to 'inactive'
      const stoResponse = await fetch('https://api.tranzila.com/v1/sto/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-tranzila-api-access-token': accessToken,
          'X-tranzila-api-app-key': appKey,
          'X-tranzila-api-nonce': nonce,
          'X-tranzila-api-request-time': timestamp,
        },
        body: JSON.stringify({
          terminal_name: terminalName,
          sto_id: profile.tranzila_sto_id,
          sto_status: 'inactive',
          response_language: 'english',
          updated_by_user: authUser?.email || user.id,
        }),
      });

      const stoResult = await stoResponse.json();
      console.log('📡 Tranzila STO API response:', stoResult);

      // Check Tranzila response (error_code: 0 = success)
      if (stoResult.error_code !== 0) {
        const errorMessages: Record<number, string> = {
          20300: 'Too many payment methods',
          20301: 'Failed to insert standing order',
          20302: 'Failed to retrieve standing order',
          20303: 'No payment method found',
          20305: 'Failed to create token',
        };
        
        const errorMsg = errorMessages[stoResult.error_code] || stoResult.message || 'Unknown error';
        console.error('❌ Tranzila STO API error:', stoResult);
        throw new Error(`Tranzila cancellation failed: ${errorMsg}`);
      }

      console.log('✅ Tranzila recurring billing stopped successfully:', stoResult.message);
    } catch (cancelError) {
      console.error('❌ Error stopping Tranzila recurring:', cancelError);
      // This is critical - if we can't stop Tranzila billing, throw the error
      throw new Error(`Failed to stop recurring payments: ${cancelError.message}`);
    }
    // ======= END CRITICAL SECTION =======

    console.log('✅ Subscription cancelled for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription cancelled. Access continues until expiry date.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error in cancel-subscription:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
