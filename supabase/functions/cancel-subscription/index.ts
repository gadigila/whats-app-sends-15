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

    // ======= CRITICAL: Stop Tranzila recurring charges =======
    try {
      const terminalName = Deno.env.get('TRANZILA_TERMINAL_NAME')!;
      const terminalPassword = Deno.env.get('TRANZILA_TERMINAL_PASSWORD')!;
      
      // Get user's email for Tranzila API
      const { data: { user: authUser }, error: userError } = await supabase.auth.admin.getUserById(user.id);
      
      if (!userError && authUser?.email) {
        console.log('🛑 Stopping Tranzila recurring billing for:', authUser.email);
        
        // Note: Tranzila's guide doesn't specify the exact cancellation API endpoint
        // You may need to contact Tranzila support for the correct endpoint
        // For now, this is a placeholder that logs the cancellation intent
        console.log('⚠️ IMPORTANT: Verify Tranzila recurring cancellation API endpoint');
        console.log('User email:', authUser.email);
        console.log('User ID:', user.id);
        console.log('Plan:', profile.payment_plan);
        
        // TODO: Add actual Tranzila recurring cancellation API call
        // Possible endpoint (verify with Tranzila):
        // const cancelParams = new URLSearchParams({
        //   supplier: terminalName,
        //   TranzilaPW: terminalPassword,
        //   customer_email: authUser.email,
        //   action: 'cancel_recurring',
        // });
        // const cancelResponse = await fetch('https://secure5.tranzila.com/api/cancel-recurring', {
        //   method: 'POST',
        //   body: cancelParams.toString(),
        // });
      }
    } catch (cancelError) {
      console.error('⚠️ Error stopping Tranzila recurring:', cancelError);
      // Don't throw - subscription is cancelled in our system
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
