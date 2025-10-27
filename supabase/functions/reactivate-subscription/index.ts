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

    // Verify subscription is cancelled
    if (profile.subscription_status !== 'cancelled') {
      throw new Error('No cancelled subscription to reactivate');
    }

    // Verify still within subscription period
    const now = new Date();
    const expiresAt = new Date(profile.subscription_expires_at);
    
    if (now >= expiresAt) {
      throw new Error('Subscription has already expired. Please purchase a new subscription.');
    }

    // Reactivate subscription
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'active',
        auto_renew: true,
        subscription_cancelled_at: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error reactivating subscription:', updateError);
      throw updateError;
    }

    console.log('✅ Subscription reactivated for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription reactivated successfully.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error in reactivate-subscription:', error);
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
