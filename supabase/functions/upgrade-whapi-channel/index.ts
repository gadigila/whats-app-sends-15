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
    const { userId, channelId } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log('🔄 Upgrading WHAPI channel for user:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_channel_id, whapi_token, payment_plan')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError);
      throw profileError;
    }

    // Update channel ID if provided and missing
    let finalChannelId = profile.whapi_channel_id;
    
    if (!finalChannelId && channelId) {
      console.log('📝 Updating profile with channel ID:', channelId);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ whapi_channel_id: channelId })
        .eq('id', userId);

      if (updateError) {
        console.error('❌ Profile update error:', updateError);
        throw updateError;
      }
      finalChannelId = channelId;
    }

    if (!finalChannelId) {
      throw new Error('No WHAPI channel ID found or provided');
    }

    console.log('📋 Channel ID:', finalChannelId);
    console.log('💎 Current plan:', profile.payment_plan);

    // Upgrade channel to live mode
    const whapiToken = Deno.env.get('WHAPI_PARTNER_TOKEN');
    if (!whapiToken) {
      throw new Error('WHAPI_PARTNER_TOKEN not configured');
    }

    console.log('🚀 Upgrading channel to live mode...');

    const upgradeResponse = await fetch(
      `https://gate.whapi.cloud/channels/${finalChannelId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'live' }),
      }
    );

    if (!upgradeResponse.ok) {
      const errorText = await upgradeResponse.text();
      console.error('❌ WHAPI upgrade failed:', errorText);
      throw new Error(`WHAPI upgrade failed: ${errorText}`);
    }

    const upgradeResult = await upgradeResponse.json();
    console.log('✅ Channel upgraded successfully:', upgradeResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Channel upgraded to live mode',
        channelId: finalChannelId,
        mode: 'live',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error upgrading channel:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
