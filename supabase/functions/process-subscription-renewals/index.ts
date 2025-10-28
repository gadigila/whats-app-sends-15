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

    console.log('🔄 Starting subscription cleanup process...');
    console.log('⚠️ NOTE: Tranzila now handles all automatic renewals via native recurring');
    console.log('⚠️ This function only processes downgrades for expired subscriptions');

    const now = new Date();

    // Process expired subscriptions (cancelled users only)
    const { data: expiredUsers, error: expiredError } = await supabase
      .from('profiles')
      .select('*')
      .in('subscription_status', ['active', 'cancelled'])
      .eq('auto_renew', false)
      .lt('subscription_expires_at', now.toISOString());

    if (!expiredError && expiredUsers) {
      console.log(`📋 Found ${expiredUsers.length} expired subscriptions`);

      for (const user of expiredUsers) {
        try {
          await supabase
            .from('profiles')
            .update({
              payment_plan: 'expired',
              subscription_status: 'expired',
            })
            .eq('id', user.id);

          // Downgrade WHAPI channel to trial
          if (user.whapi_channel_id) {
            const whapiToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!;
            await fetch(
              `https://manager.whapi.cloud/channels/${user.whapi_channel_id}/mode`,
              {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${whapiToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mode: 'trial' }),
              }
            );
          }

          console.log('✅ Expired and downgraded user:', user.id);
        } catch (error) {
          console.error('❌ Error expiring user:', user.id, error);
        }
      }
    }

    console.log('✅ Subscription renewal process completed');

    return new Response(
      JSON.stringify({ success: true, message: 'Renewal process completed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error in process-subscription-renewals:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
