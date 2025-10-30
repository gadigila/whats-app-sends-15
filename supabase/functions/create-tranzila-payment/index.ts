import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  planType: 'monthly' | 'yearly';
  redirectOrigin?: string;
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

    const { planType, redirectOrigin }: PaymentRequest = await req.json();

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

    // Determine the origin for redirect URLs (priority: body param, origin header, referer, fallback)
    let origin = redirectOrigin || req.headers.get('origin') || '';
    if (!origin) {
      const referer = req.headers.get('referer') || '';
      try {
        origin = new URL(referer).origin;
      } catch {
        // Ignore parsing errors
      }
    }
    if (!origin) {
      origin = 'https://reecher.app'; // Fallback to production
    }
    console.log('🔗 Using redirect origin:', origin);

    // Tranzila configuration
    const terminalName = Deno.env.get('TRANZILA_TERMINAL_NAME')!;
    const terminalPassword = Deno.env.get('TRANZILA_TERMINAL_PASSWORD')!;
    
    // STEP 1: Perform handshake for fraud prevention
    console.log('🤝 Starting Tranzila handshake...');
    const handshakeUrl = new URL('https://api.tranzila.com/v1/handshake/create');
    handshakeUrl.searchParams.set('supplier', terminalName);
    handshakeUrl.searchParams.set('sum', amount.toString()); // Full amount for handshake
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
    
    // Set recurring to start NEXT period (charge immediately now, then recurring later)
    const recurStartDate = new Date();
    if (planType === 'yearly') {
      recurStartDate.setFullYear(recurStartDate.getFullYear() + 1);
    } else {
      recurStartDate.setMonth(recurStartDate.getMonth() + 1);
    }
    const formattedRecurDate = recurStartDate.toISOString().split('T')[0]; // yyyy-mm-dd

    // Build Tranzila iFrame URL with NATIVE RECURRING PARAMETERS
    const tranzilaParams = new URLSearchParams({
      supplier: terminalName,
      sum: amount.toString(), // Charge immediately for first period
      currency: '1', // ILS
      
      // GUIDE SPECIFICATION: Payment type and transaction mode
      cred_type: '1', // Payment type (explicit in guide)
      tranmode: 'A', // Standard transaction
      
      // HANDSHAKE FRAUD PREVENTION
      new_process: '1', // Enable handshake verification
      thtk: thtk, // Transaction handshake token
      
      // NATIVE RECURRING PARAMETERS (from guide)
      recur_sum: amount.toString(), // Amount for each recurring charge
      recur_transaction: planType === 'yearly' ? '7_approved' : '4_approved', // 4=monthly, 7=yearly, not customer choice
      // recur_payments: NOT INCLUDED - omit for unlimited recurring until cancelled
      recur_start_date: formattedRecurDate, // yyyy-mm-dd format
      
      // Webhook URLs (environment-aware)
      notify_url_address: `https://ifxvwettmgixfbivlzzl.supabase.co/functions/v1/verify-tranzila-payment`,
      success_url_address: `${origin}/payment-success`,
      fail_url_address: `${origin}/payment-failed`,
      
      // Customer information
      user_id: user.id,
      contact: profile.name || user.email || '',
      email: user.email || '',
      company: planType === 'yearly' ? 'yearly_plan' : 'monthly_plan',
      remarks: transactionId,
      
      // Display customization
      trBgColor: 'ffffff',
      trTextColor: '000000',
      lang: 'il', // Hebrew
    });

    const iframeUrl = `https://direct.tranzila.com/${terminalName}/iframenew.php?${tranzilaParams.toString()}`;

    console.log('✅ Created Tranzila payment URL for user:', user.id, 'Plan:', planType, 'Return URLs:', `${origin}/payment-success`, `${origin}/payment-failed`);

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
