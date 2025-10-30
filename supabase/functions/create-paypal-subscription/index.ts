import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PayPal API configuration
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_MODE') === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');
const PAYPAL_MONTHLY_PLAN_ID = Deno.env.get('PAYPAL_MONTHLY_PLAN_ID');
const PAYPAL_YEARLY_PLAN_ID = Deno.env.get('PAYPAL_YEARLY_PLAN_ID');

interface CreateSubscriptionRequest {
  planType: 'monthly' | 'yearly';
  returnUrl: string;
  cancelUrl: string;
}

async function getPayPalAccessToken(): Promise<string> {
  console.log('🔑 Getting PayPal access token...');
  
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ PayPal auth error:', error);
    throw new Error(`PayPal authentication failed: ${error}`);
  }

  const data = await response.json();
  console.log('✅ PayPal access token obtained');
  return data.access_token;
}

async function createPayPalSubscription(
  planId: string,
  returnUrl: string,
  cancelUrl: string,
  accessToken: string,
  userEmail: string
): Promise<{ approvalUrl: string; subscriptionId: string }> {
  console.log('📝 Creating PayPal subscription with plan:', planId);

  const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: planId,
      subscriber: {
        email_address: userEmail,
      },
      application_context: {
        brand_name: 'Reecher',
        locale: 'he-IL',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
        },
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ PayPal subscription creation error:', error);
    throw new Error(`Failed to create PayPal subscription: ${error}`);
  }

  const data = await response.json();
  console.log('✅ PayPal subscription created:', data.id);

  // Extract approval URL
  const approvalLink = data.links.find((link: any) => link.rel === 'approve');
  
  if (!approvalLink) {
    throw new Error('No approval URL found in PayPal response');
  }

  return {
    approvalUrl: approvalLink.href,
    subscriptionId: data.id,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Create PayPal subscription request received');

    // Get authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('👤 User authenticated:', user.id);

    // Get user email
    const userEmail = user.email;
    if (!userEmail) {
      throw new Error('User email not found');
    }

    // Parse request body
    const { planType, returnUrl, cancelUrl }: CreateSubscriptionRequest = await req.json();
    console.log('📦 Request params:', { planType, returnUrl, cancelUrl });

    // Validate plan type
    if (!planType || !['monthly', 'yearly'].includes(planType)) {
      throw new Error('Invalid plan type. Must be "monthly" or "yearly"');
    }

    // Get PayPal plan ID
    const planId = planType === 'monthly' 
      ? PAYPAL_MONTHLY_PLAN_ID 
      : PAYPAL_YEARLY_PLAN_ID;

    if (!planId) {
      throw new Error(`PayPal plan ID not configured for ${planType} plan`);
    }

    console.log('💳 Using PayPal plan ID:', planId);

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create subscription
    const { approvalUrl, subscriptionId } = await createPayPalSubscription(
      planId,
      returnUrl,
      cancelUrl,
      accessToken,
      userEmail
    );

    // Store pending subscription info in database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        paypal_subscription_id: subscriptionId,
        payment_provider: 'paypal',
        subscription_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('⚠️ Warning: Could not update profile:', updateError);
      // Continue anyway - webhook will handle the update
    }

    console.log('✅ Subscription created successfully, returning approval URL');

    return new Response(
      JSON.stringify({
        success: true,
        approvalUrl,
        subscriptionId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Error in create-paypal-subscription:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to create subscription',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
