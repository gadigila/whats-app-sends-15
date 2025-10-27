import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  planType: 'monthly' | 'yearly';
}

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

    const { planType }: PaymentRequest = await req.json();

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Determine amount based on plan
    const amount = planType === 'yearly' ? 999 : 99;
    
    // Generate unique transaction ID
    const transactionId = `${user.id}_${Date.now()}`;

    // Tranzila configuration
    const terminalName = Deno.env.get('TRANZILA_TERMINAL_NAME')!;
    const terminalPassword = Deno.env.get('TRANZILA_TERMINAL_PASSWORD')!;
    
    // Build Tranzila iFrame URL
    const tranzilaParams = new URLSearchParams({
      supplier: terminalName,
      sum: amount.toString(),
      currency: '1', // ILS
      cred_type: '1', // Regular credit card
      tranmode: 'VK', // iFrame mode
      notify_url_address: `https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/verify-tranzila-payment`,
      success_url_address: 'https://reecher.app/payment-success',
      fail_url_address: 'https://reecher.app/payment-failed',
      user_id: user.id,
      contact: profile.name || user.email || '',
      email: user.email || '',
      company: planType === 'yearly' ? 'yearly_plan' : 'monthly_plan',
      remarks: transactionId,
      maxpay: '1', // Single payment
      trBgColor: 'ffffff',
      trTextColor: '000000',
      lang: 'il', // Hebrew
    });

    const iframeUrl = `https://direct.tranzila.com/${terminalName}/iframenew.php?${tranzilaParams.toString()}`;

    console.log('✅ Created Tranzila payment URL for user:', user.id, 'Plan:', planType);

    return new Response(
      JSON.stringify({
        success: true,
        iframeUrl,
        transactionId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error creating Tranzila payment:', error);
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
