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

// Find canonical ChannelID by friendly name
async function findChannelIdByName(
  friendlyName: string,
  whapiToken: string,
  projectId: string
): Promise<string | null> {
  try {
    console.log('🔍 Searching for canonical ChannelID by name:', friendlyName);
    
    const response = await fetch(
      `https://manager.whapi.cloud/channels?projectId=${projectId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('⚠️ Failed to list channels:', await response.text());
      return null;
    }

    const data = await response.json();
    const channels = data?.items || data?.data || data?.channels || data || [];
    
    const channel = channels.find((ch: any) => ch.name === friendlyName);
    
    if (channel && isValidWhapiId(channel.id)) {
      console.log('✅ Found canonical ChannelID:', channel.id);
      return channel.id;
    }
    
    console.error('⚠️ Channel not found by name:', friendlyName);
    return null;
  } catch (error) {
    console.error('⚠️ Error finding channel by name:', error);
    return null;
  }
}

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
    const whapiToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!;
    const projectId = Deno.env.get('WHAPI_PROJECT_ID')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_channel_id, instance_id, payment_plan')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError);
      throw profileError;
    }

    // Determine valid canonical ChannelID
    let finalChannelId: string | null = null;
    
    // 1. Use provided channelId if valid
    if (channelId && isValidWhapiId(channelId)) {
      finalChannelId = channelId;
      console.log('✅ Using provided valid channelId:', finalChannelId);
    }
    // 2. Check whapi_channel_id from profile
    else if (isValidWhapiId(profile.whapi_channel_id)) {
      finalChannelId = profile.whapi_channel_id;
      console.log('✅ Using valid whapi_channel_id from profile:', finalChannelId);
    }
    // 3. Check instance_id from profile
    else if (isValidWhapiId(profile.instance_id)) {
      finalChannelId = profile.instance_id;
      console.log('✅ Using valid instance_id from profile:', finalChannelId);
    }
    // 4. Attempt recovery by name
    else {
      const nameToRecover = channelId || profile.whapi_channel_id || profile.instance_id;
      
      if (nameToRecover) {
        console.log('⚠️ No valid ChannelID found, attempting recovery for:', nameToRecover);
        finalChannelId = await findChannelIdByName(nameToRecover, whapiToken, projectId);
        
        if (finalChannelId) {
          // Update profile with recovered canonical ID
          console.log('💾 Updating profile with recovered canonical ChannelID');
          await supabase
            .from('profiles')
            .update({
              instance_id: finalChannelId,
              whapi_channel_id: finalChannelId,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
        }
      }
    }

    if (!finalChannelId) {
      throw new Error('No valid WHAPI channel ID found or could be recovered');
    }

    console.log('📋 Final canonical ChannelID:', finalChannelId);
    console.log('💎 Current plan:', profile.payment_plan);

    // Upgrade channel to live mode using Manager API
    console.log('🚀 Upgrading channel to live mode...');

    const upgradeResponse = await fetch(
      `https://manager.whapi.cloud/channels/${finalChannelId}/mode`,
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
        recovered: finalChannelId !== (channelId || profile.whapi_channel_id)
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
