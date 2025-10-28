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
    
    // STEP 1: Perform handshake for fraud prevention
    console.log('🤝 Starting Tranzila handshake...');
    const handshakeUrl = new URL('https://api.tranzila.com/v1/handshake/create');
    handshakeUrl.searchParams.set('supplier', terminalName);
    handshakeUrl.searchParams.set('sum', amount.toString());
    handshakeUrl.searchParams.set('TranzilaPW', terminalPassword);

    const handshakeResponse = await fetch(handshakeUrl.toString(), {
      method: 'GET',
    });

    if (!handshakeResponse.ok) {
      const errorText = await handshakeResponse.text();
      console.error('❌ Handshake failed:', errorText);
      throw new Error(`Handshake failed: ${errorText}`);
    }

    const handshakeResult = await handshakeResponse.text();
    console.log('🤝 Handshake raw response:', handshakeResult);

    // Parse the response (format: key=value&key=value)
    const handshakeData: Record<string, string> = {};
    handshakeResult.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        handshakeData[key] = decodeURIComponent(value);
      }
    });

    const thtk = handshakeData.thtk;
    if (!thtk) {
      console.error('❌ No thtk in handshake response:', handshakeData);
      throw new Error('Handshake did not return thtk parameter');
    }

    console.log('✅ Handshake successful, thtk:', thtk);
    
    // Build Tranzila iFrame URL
    const tranzilaParams = new URLSearchParams({
      supplier: terminalName,
      sum: amount.toString(),
      currency: '1', // ILS
      cred_type: '8', // Tokenized payment for auto-renewal
      tranmode: 'VK', // iFrame mode
      
      // HANDSHAKE FRAUD PREVENTION
      new_process: '1', // Enable handshake verification
      thtk: thtk, // Transaction handshake token
      
      notify_url_address: `https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/verify-tranzila-payment`,
      success_url_address: 'https://reecher.app/payment-success',
      fail_url_address: 'https://reecher.app/payment-failed',
      user_id: user.id,
      contact: profile.name || user.email || '',
      email: user.email || '',
      company: planType === 'yearly' ? 'yearly_plan' : 'monthly_plan',
      remarks: transactionId,
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
