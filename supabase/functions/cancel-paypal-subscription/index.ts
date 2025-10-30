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

async function cancelPayPalSubscription(
  subscriptionId: string,
  accessToken: string,
  reason: string = 'User requested cancellation'
): Promise<void> {
  console.log('🚫 Cancelling PayPal subscription:', subscriptionId);

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ PayPal cancellation error:', error);
    
    // Check if subscription is already cancelled
    if (response.status === 422) {
      console.log('⚠️ Subscription may already be cancelled');
      return; // Continue with database update
    }
    
    throw new Error(`Failed to cancel PayPal subscription: ${error}`);
  }

  console.log('✅ PayPal subscription cancelled successfully');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Cancel PayPal subscription request received');

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

    // Get user's PayPal subscription ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('paypal_subscription_id, subscription_status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile not found:', profileError);
      throw new Error('User profile not found');
    }

    const subscriptionId = profile.paypal_subscription_id;
    if (!subscriptionId) {
      throw new Error('No active PayPal subscription found');
    }

    console.log('💳 Found subscription ID:', subscriptionId);

    // Check if already cancelled
    if (profile.subscription_status === 'cancelled') {
      console.log('ℹ️ Subscription already cancelled');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Subscription is already cancelled',
          alreadyCancelled: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Cancel subscription via PayPal API
    await cancelPayPalSubscription(subscriptionId, accessToken);

    // Update profile in database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'cancelled',
        subscription_cancelled_at: new Date().toISOString(),
        auto_renew: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('⚠️ Warning: Could not update profile:', updateError);
      // Still return success since PayPal cancellation worked
    } else {
      console.log('✅ Profile updated with cancelled status');
    }

    console.log('✅ Subscription cancelled successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription cancelled successfully. You can continue using the service until the end of your current billing period.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Error in cancel-paypal-subscription:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to cancel subscription',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
