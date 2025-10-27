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

    console.log('🔄 Starting subscription renewal process...');

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Process auto-renewals (subscriptions expiring within 1 day)
    const { data: expiringUsers, error: expiringError } = await supabase
      .from('profiles')
      .select('*')
      .eq('subscription_status', 'active')
      .eq('auto_renew', true)
      .lt('subscription_expires_at', tomorrow.toISOString())
      .not('tranzila_token', 'is', null);

    if (expiringError) {
      console.error('❌ Error fetching expiring subscriptions:', expiringError);
    } else {
      console.log(`📋 Found ${expiringUsers?.length || 0} subscriptions to renew`);

      for (const user of expiringUsers || []) {
        try {
          // Attempt to charge via Tranzila token
          const amount = user.payment_plan === 'yearly' ? 999 : 99;
          const terminalName = Deno.env.get('TRANZILA_TERMINAL_NAME')!;
          const terminalPassword = Deno.env.get('TRANZILA_TERMINAL_PASSWORD')!;

          const chargeParams = new URLSearchParams({
            supplier: terminalName,
            TranzilaPW: terminalPassword,
            TranzilaTK: user.tranzila_token,
            sum: amount.toString(),
            currency: '1',
            cred_type: '1',
          });

          const chargeResponse = await fetch(
            `https://direct.tranzila.com/${terminalName}/api`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: chargeParams.toString(),
            }
          );

          const chargeResult = await chargeResponse.text();
          
          // Check if charge was successful (Response=000)
          if (chargeResult.includes('Response=000')) {
            // Success! Extend subscription
            const daysToAdd = user.payment_plan === 'yearly' ? 365 : 30;
            const newExpiresAt = new Date(user.subscription_expires_at);
            newExpiresAt.setDate(newExpiresAt.getDate() + daysToAdd);

            await supabase
              .from('profiles')
              .update({
                subscription_expires_at: newExpiresAt.toISOString(),
                last_payment_date: new Date().toISOString(),
                failed_payment_attempts: 0,
              })
              .eq('id', user.id);

            // Create invoice for renewal
            try {
              const { data: { user: authUser }, error: userError } = await supabase.auth.admin.getUserById(user.id);
              
              if (!userError && authUser?.email) {
                const itemDescription = user.payment_plan === 'yearly' 
                  ? 'חידוש מנוי שנתי Reecher Premium' 
                  : 'חידוש מנוי חודשי Reecher Premium';
                
                const invoiceParams = new URLSearchParams({
                  supplier: terminalName,
                  TranzilaPW: terminalPassword,
                  transaction_id: `renewal_${user.id}_${Date.now()}`,
                  
                  customer_name: user.name || authUser.email.split('@')[0],
                  customer_email: authUser.email,
                  customer_phone: user.phone_number || '',
                  
                  item_description: itemDescription,
                  item_quantity: '1',
                  item_unit_price: amount.toString(),
                  item_total: amount.toString(),
                  
                  currency: 'ILS',
                  send_email: 'true',
                  language: 'he',
                });

                const invoiceResponse = await fetch(
                  'https://secure5.tranzila.com/cgi-bin/invoice.cgi',
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: invoiceParams.toString(),
                  }
                );

                const invoiceResult = await invoiceResponse.text();
                const invoiceData: Record<string, string> = {};
                invoiceResult.split('&').forEach(pair => {
                  const [key, value] = pair.split('=');
                  if (key && value) invoiceData[key] = decodeURIComponent(value);
                });

                if (invoiceData.invoice_id) {
                  await supabase.from('profiles').update({
                    last_invoice_id: invoiceData.invoice_id,
                    last_invoice_number: invoiceData.invoice_number,
                    last_invoice_url: invoiceData.invoice_url || invoiceData.pdf_url,
                    last_invoice_date: new Date().toISOString(),
                  }).eq('id', user.id);

                  await supabase.from('invoices').insert({
                    user_id: user.id,
                    tranzila_invoice_id: invoiceData.invoice_id,
                    invoice_number: invoiceData.invoice_number || invoiceData.invoice_id,
                    invoice_url: invoiceData.invoice_url,
                    pdf_url: invoiceData.pdf_url,
                    amount,
                    currency: 'ILS',
                    plan_type: user.payment_plan,
                    transaction_id: `renewal_${user.id}_${Date.now()}`,
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                  });

                  console.log('✅ Renewal invoice created:', invoiceData.invoice_number);
                }
              }
            } catch (invoiceError) {
              console.error('⚠️ Error creating renewal invoice:', invoiceError);
            }

            console.log('✅ Renewed subscription for user:', user.id);
          } else {
            // Payment failed - set grace period
            const gracePeriodEnds = new Date();
            gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 2);

            await supabase
              .from('profiles')
              .update({
                subscription_status: 'grace_period',
                grace_period_ends_at: gracePeriodEnds.toISOString(),
                failed_payment_attempts: (user.failed_payment_attempts || 0) + 1,
              })
              .eq('id', user.id);

            console.log('⚠️ Payment failed, grace period set for user:', user.id);
          }
        } catch (error) {
          console.error('❌ Error processing renewal for user:', user.id, error);
        }
      }
    }

    // 2. Process expired grace periods
    const { data: gracePeriodUsers, error: gracePeriodError } = await supabase
      .from('profiles')
      .select('*')
      .eq('subscription_status', 'grace_period')
      .lt('grace_period_ends_at', now.toISOString());

    if (!gracePeriodError && gracePeriodUsers) {
      console.log(`📋 Found ${gracePeriodUsers.length} expired grace periods`);

      for (const user of gracePeriodUsers) {
        try {
          // Downgrade to trial mode
          await supabase
            .from('profiles')
            .update({
              payment_plan: 'expired',
              subscription_status: 'expired',
              auto_renew: false,
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

          console.log('✅ Downgraded user after grace period:', user.id);
        } catch (error) {
          console.error('❌ Error downgrading user:', user.id, error);
        }
      }
    }

    // 3. Process expired subscriptions (cancelled or unpaid)
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
