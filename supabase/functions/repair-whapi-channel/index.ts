import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate canonical WHAPI ChannelID format
function isValidWhapiId(id: string | null | undefined): boolean {
  if (!id) return false;
  const WHAPI_ID_REGEX = /^(?:[A-Z]{6}-[A-Z0-9]{5}|[A-Z0-9]{12})$/;
  return WHAPI_ID_REGEX.test(id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log('🔧 Starting channel repair for user:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const whapiToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!;
    const projectId = Deno.env.get('WHAPI_PROJECT_ID')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_channel_id, instance_id, payment_plan')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    const storedId = profile.whapi_channel_id || profile.instance_id;
    console.log('📋 Current stored ID:', storedId);

    // Check if already valid
    if (isValidWhapiId(storedId)) {
      console.log('✅ Channel ID is already valid:', storedId);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Channel ID is already valid',
          channelId: storedId,
          alreadyValid: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Invalid ID detected, searching WHAPI for real channel ID...');

    // Query WHAPI Manager API to find all channels
    const channelsResponse = await fetch(
      `https://manager.whapi.cloud/channels?projectId=${projectId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!channelsResponse.ok) {
      const errorText = await channelsResponse.text();
      console.error('❌ Failed to list channels:', errorText);
      throw new Error(`WHAPI API error: ${errorText}`);
    }

    const channelsData = await channelsResponse.json();
    const channels = channelsData?.items || channelsData?.data || channelsData?.channels || channelsData || [];
    
    console.log(`📊 Found ${channels.length} total channels`);

    // Find channel by friendly name
    const matchingChannel = channels.find((ch: any) => ch.name === storedId);

    if (!matchingChannel) {
      console.error('❌ No matching channel found with name:', storedId);
      console.log('Available channels:', channels.map((ch: any) => ({ id: ch.id, name: ch.name })));
      throw new Error(`No channel found with name: ${storedId}`);
    }

    const realChannelId = matchingChannel.id;
    console.log('✅ Found real channel ID:', realChannelId);

    // Validate the found ID
    if (!isValidWhapiId(realChannelId)) {
      throw new Error(`WHAPI returned invalid channel ID: ${realChannelId}`);
    }

    // Update database with correct ID
    console.log('💾 Updating database with correct channel ID...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        instance_id: realChannelId,
        whapi_channel_id: realChannelId,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Database update failed:', updateError);
      throw updateError;
    }

    console.log('✅ Database updated successfully');

    // Upgrade to live mode if user has paid plan
    const isPaidUser = profile.payment_plan && 
                       profile.payment_plan !== 'trial' && 
                       profile.payment_plan !== 'free' &&
                       profile.payment_plan !== 'none';

    if (isPaidUser) {
      console.log('💎 User has paid plan, upgrading to live mode...');
      
      const upgradeResponse = await fetch(
        `https://manager.whapi.cloud/channels/${realChannelId}/mode`,
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
        console.error('⚠️ Upgrade failed:', errorText);
        // Don't throw - we still fixed the ID
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Channel ID repaired but upgrade failed',
            channelId: realChannelId,
            oldId: storedId,
            upgraded: false,
            upgradeError: errorText
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Channel upgraded to live mode');
    } else {
      console.log('ℹ️ User on trial/free plan, skipping upgrade');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Channel repaired successfully',
        channelId: realChannelId,
        oldId: storedId,
        upgraded: isPaidUser,
        paymentPlan: profile.payment_plan
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Repair failed:', error);
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
