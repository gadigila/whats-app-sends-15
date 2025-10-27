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

    // Parse Tranzila webhook data
    const formData = await req.formData();
    const response = formData.get('Response')?.toString();
    const userId = formData.get('user_id')?.toString();
    const transactionId = formData.get('remarks')?.toString();
    const company = formData.get('company')?.toString(); // 'yearly_plan' or 'monthly_plan'
    const cardToken = formData.get('TranzilaTK')?.toString(); // For recurring payments

    console.log('📥 Tranzila webhook received:', {
      response,
      userId,
      transactionId,
      company,
      hasToken: !!cardToken,
    });

    // Verify successful payment (Response = "000")
    if (response !== '000') {
      console.error('❌ Payment failed with response:', response);
      return new Response('Payment failed', { status: 400 });
    }

    if (!userId) {
      console.error('❌ Missing user_id in webhook');
      return new Response('Missing user_id', { status: 400 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile not found for user:', userId);
      return new Response('Profile not found', { status: 404 });
    }

    const planType = company === 'yearly_plan' ? 'yearly' : 'monthly';
    const daysToAdd = planType === 'yearly' ? 365 : 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    // Update user profile with subscription
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        payment_plan: planType,
        subscription_status: 'active',
        auto_renew: true,
        subscription_expires_at: expiresAt.toISOString(),
        subscription_created_at: new Date().toISOString(),
        last_payment_date: new Date().toISOString(),
        tranzila_token: cardToken || null,
        failed_payment_attempts: 0,
        trial_expires_at: null, // Clear trial
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Error updating profile:', updateError);
      throw updateError;
    }

    // Activate WHAPI channel to live mode
    if (profile.whapi_channel_id) {
      const whapiToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!;
      
      try {
        const whapiResponse = await fetch(
          `https://manager.whapi.cloud/channels/${profile.whapi_channel_id}/mode`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${whapiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mode: 'live' }),
          }
        );

        if (!whapiResponse.ok) {
          console.error('⚠️ WHAPI activation failed:', await whapiResponse.text());
        } else {
          console.log('✅ WHAPI channel activated to live mode');
        }
      } catch (whapiError) {
        console.error('⚠️ WHAPI activation error:', whapiError);
        // Continue despite WHAPI error - payment was successful
      }
    }

    console.log('✅ Payment verified and subscription activated for user:', userId);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error verifying Tranzila payment:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
