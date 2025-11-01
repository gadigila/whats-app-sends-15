import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYPAL_API_BASE = Deno.env.get('PAYPAL_MODE') === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');

async function getPayPalAccessToken(): Promise<string> {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

async function verifyWebhookSignature(
  webhookId: string,
  headers: Headers,
  body: string
): Promise<boolean> {
  try {
    const accessToken = await getPayPalAccessToken();
    
    const verifyRequest = {
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_time: headers.get('paypal-transmission-time'),
      cert_url: headers.get('paypal-cert-url'),
      auth_algo: headers.get('paypal-auth-algo'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    };

    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verifyRequest),
      }
    );

    const result = await response.json();
    return result.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('❌ Webhook verification error:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 PayPal webhook received');

    // Read raw body for signature verification
    const rawBody = await req.text();
    const webhookEvent = JSON.parse(rawBody);

    console.log('📦 Event type:', webhookEvent.event_type);
    console.log('📦 Event ID:', webhookEvent.id);

    // Create Supabase admin client (service role)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // PHASE 2: Idempotency - Check if webhook already processed
    const eventId = webhookEvent.id;
    const eventType = webhookEvent.event_type;

    const { data: alreadyProcessed } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .eq('paypal_event_id', eventId)
      .maybeSingle();

    if (alreadyProcessed) {
      console.log('✅ Webhook already processed:', eventId);
      return new Response(JSON.stringify({ 
        received: true, 
        cached: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PHASE 3: Signature Verification (Live mode only)
    if (Deno.env.get('PAYPAL_MODE') === 'live') {
      const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');
      
      if (!webhookId) {
        console.error('⚠️ PAYPAL_WEBHOOK_ID not set in Live mode!');
        return new Response('Webhook ID not configured', { 
          status: 500,
          headers: corsHeaders 
        });
      }
      
      const isValid = await verifyWebhookSignature(webhookId, req.headers, rawBody);
      
      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return new Response('Invalid signature', { 
          status: 401,
          headers: corsHeaders 
        });
      }
      
      console.log('✅ Webhook signature verified');
    } else {
      console.log('ℹ️ Sandbox mode: skipping signature verification');
    }

    const resource = webhookEvent.resource;

    // Handle different webhook events
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        console.log('✅ Subscription activated:', resource.id);
        
        const subscriptionId = resource.id;
        const subscriberEmail = resource.subscriber?.email_address;
        const planId = resource.plan_id;

        // Debug: Log plan detection
        console.log('🔍 Plan ID from PayPal:', planId);
        console.log('🔍 Expected yearly plan ID:', Deno.env.get('PAYPAL_YEARLY_PLAN_ID'));
        console.log('🔍 Expected monthly plan ID:', Deno.env.get('PAYPAL_MONTHLY_PLAN_ID'));

        // Determine plan type and expiration
        const isYearly = planId === Deno.env.get('PAYPAL_YEARLY_PLAN_ID');
        console.log('🔍 Is yearly?', isYearly);
        
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + (isYearly ? 12 : 1));

        // PHASE 1: Use custom_id for direct user lookup
        let userId: string | null = resource.custom_id || null;
        
        if (userId) {
          console.log('✅ Found user ID from custom_id:', userId);
        } else {
          console.log('⚠️ No custom_id, falling back to email lookup');
          
          // Fallback to email lookup
          if (subscriberEmail) {
            const { data: authUser } = await supabase.auth.admin.listUsers();
            const user = authUser?.users.find(u => u.email === subscriberEmail);
            userId = user?.id || null;
          }

          if (!userId) {
            // Last resort: find by subscription ID
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('paypal_subscription_id', subscriptionId)
              .maybeSingle();
            
            userId = profile?.id || null;
          }

          if (!userId) {
            console.error('❌ User not found for subscription:', subscriptionId);
            break;
          }
        }

        // Update profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            paypal_subscription_id: subscriptionId,
            payment_provider: 'paypal',
            subscription_status: 'active',
            subscription_created_at: new Date().toISOString(),
            subscription_expires_at: expiresAt.toISOString(),
            payment_plan: isYearly ? 'yearly' : 'monthly',
            auto_renew: true,
            last_payment_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          console.error('❌ Error updating profile:', updateError);
        } else {
          console.log('✅ Profile updated for user:', userId);
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        console.log('🚫 Subscription cancelled:', resource.id);
        
        const subscriptionId = resource.id;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'cancelled',
            subscription_cancelled_at: new Date().toISOString(),
            auto_renew: false,
            updated_at: new Date().toISOString(),
          })
          .eq('paypal_subscription_id', subscriptionId);

        if (updateError) {
          console.error('❌ Error updating profile:', updateError);
        } else {
          console.log('✅ Subscription cancelled in database');
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        console.log('⏸️ Subscription suspended:', resource.id);
        
        const subscriptionId = resource.id;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'suspended',
            updated_at: new Date().toISOString(),
          })
          .eq('paypal_subscription_id', subscriptionId);

        if (updateError) {
          console.error('❌ Error updating profile:', updateError);
        }
        break;
      }

      case 'PAYMENT.SALE.COMPLETED': {
        console.log('💰 Payment completed:', resource.id);
        
        const billingAgreementId = resource.billing_agreement_id;

        if (billingAgreementId) {
          // Update last payment date and extend subscription
          const { data: profile } = await supabase
            .from('profiles')
            .select('payment_plan, subscription_expires_at, subscription_created_at')
            .eq('paypal_subscription_id', billingAgreementId)
            .maybeSingle();

          if (profile) {
            // Skip if this is the first payment (subscription just created)
            const createdAt = new Date(profile.subscription_created_at);
            const now = new Date();
            const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
            
            if (minutesSinceCreation < 5) {
              console.log('⏭️ Skipping first payment extension (already handled by ACTIVATED event)');
              break;
            }

            const isYearly = profile.payment_plan === 'yearly';
            const currentExpiry = new Date(profile.subscription_expires_at || new Date());
            
            // Extend from current expiry or now, whichever is later
            const baseDate = currentExpiry > now ? currentExpiry : now;
            baseDate.setMonth(baseDate.getMonth() + (isYearly ? 12 : 1));

            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                last_payment_date: new Date().toISOString(),
                subscription_expires_at: baseDate.toISOString(),
                subscription_status: 'active',
                failed_payment_attempts: 0,
                updated_at: new Date().toISOString(),
              })
              .eq('paypal_subscription_id', billingAgreementId);

            if (updateError) {
              console.error('❌ Error updating payment:', updateError);
            } else {
              console.log('✅ Payment recorded, subscription extended');
            }
          }
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        console.log('❌ Payment failed:', resource.id);
        
        const subscriptionId = resource.id;
        
        // Set grace period (7 days)
        const gracePeriodEnds = new Date();
        gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 7);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'grace_period',
            grace_period_ends_at: gracePeriodEnds.toISOString(),
            failed_payment_attempts: supabase.sql`failed_payment_attempts + 1`,
            updated_at: new Date().toISOString(),
          })
          .eq('paypal_subscription_id', subscriptionId);

        if (updateError) {
          console.error('❌ Error updating profile:', updateError);
        } else {
          console.log('⚠️ Grace period set for failed payment');
        }
        break;
      }

      default:
        console.log('ℹ️ Unhandled event type:', eventType);
    }

    // Mark webhook as processed (after successful processing)
    await supabase
      .from('processed_webhook_events')
      .insert({
        paypal_event_id: eventId,
        event_type: eventType,
        processed_at: new Date().toISOString()
      });

    console.log('✅ Webhook marked as processed');

    // Always return 200 to PayPal
    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    
    // Still return 200 to prevent PayPal retries on our errors
    return new Response(
      JSON.stringify({ received: true, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
