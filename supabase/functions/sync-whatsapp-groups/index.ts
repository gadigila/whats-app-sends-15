import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DebugRequest {
  userId: string
  maxGroups?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔍 PHONE MATCHING DEBUGGER: Finding exact mismatch...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId, maxGroups = 5 }: DebugRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's WHAPI credentials and phone
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_token, phone_number')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's phone number
    let userPhone = profile.phone_number;
    if (!userPhone) {
      console.log('📱 Getting phone from health...');
      try {
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          userPhone = healthData?.user?.id?.replace(/[^\d]/g, '');
        }
      } catch (error) {
        console.log('Health check failed:', error.message);
      }
    }

    if (!userPhone) {
      return new Response(
        JSON.stringify({ error: 'Could not determine user phone' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`🔍 DEBUGGING USER PHONE: ${userPhone}`);

    // Create all possible variants of user phone
    const userPhoneClean = userPhone.replace(/[^\d]/g, '');
    const userVariants = [
      userPhoneClean,
      userPhoneClean.startsWith('972') ? '0' + userPhoneClean.substring(3) : null,
      userPhoneClean.startsWith('0') ? '972' + userPhoneClean.substring(1) : null,
      userPhoneClean.slice(-9),
      userPhoneClean.slice(-10),
    ].filter(Boolean);

    console.log(`📱 USER VARIANTS: ${userVariants.join(', ')}`);

    // Get sample groups with participants
    const groupsResponse = await fetch(
      `https://gate.whapi.cloud/groups?count=${maxGroups}&offset=0&participants=true`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${profile.whapi_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!groupsResponse.ok) {
      throw new Error(`Groups API failed: ${groupsResponse.status}`);
    }

    const groupsData = await groupsResponse.json();
    const groups = groupsData.groups || [];

    console.log(`📊 Got ${groups.length} groups for debugging`);

    const debugResults = {
      userPhone: userPhone,
      userPhoneClean: userPhoneClean,
      userVariants: userVariants,
      groupsAnalyzed: groups.length,
      participantSamples: [] as any[],
      potentialMatches: [] as any[],
      exactMatches: [] as any[],
      phoneFormats: new Set<string>(),
      ranks: new Set<string>()
    };

    // Analyze each group
    for (const group of groups) {
      const groupName = group.name || group.subject || `Group ${group.id}`;
      console.log(`🔍 Analyzing: ${groupName}`);

      if (group.participants && Array.isArray(group.participants)) {
        console.log(`  👥 ${group.participants.length} participants`);

        for (const participant of group.participants) {
          const participantId = participant.id || participant.phone || participant.number;
          const participantRank = participant.rank || participant.role || 'member';
          
          // Track all phone formats and ranks
          if (participantId) {
            debugResults.phoneFormats.add(getPhoneFormat(participantId));
          }
          debugResults.ranks.add(participantRank);

          // Sample first few participants for analysis
          if (debugResults.participantSamples.length < 20) {
            debugResults.participantSamples.push({
              groupName: groupName,
              id: participantId,
              rank: participantRank,
              format: getPhoneFormat(participantId),
              length: participantId?.length || 0
            });
          }

          // Check for potential matches
          if (participantId) {
            const cleanParticipant = participantId.replace(/@lid$/, '').replace(/[^\d]/g, '');
            
            // Check if any variant matches
            for (const variant of userVariants) {
              if (variant === cleanParticipant) {
                debugResults.exactMatches.push({
                  groupName: groupName,
                  participantId: participantId,
                  cleanParticipant: cleanParticipant,
                  matchedVariant: variant,
                  rank: participantRank,
                  isAdmin: ['admin', 'administrator', 'creator', 'owner'].includes(participantRank.toLowerCase())
                });
                console.log(`🎯 EXACT MATCH FOUND: ${participantId} = ${variant} (${participantRank})`);
              }
              
              // Check partial matches (last 9 digits)
              if (variant.length >= 9 && cleanParticipant.length >= 9) {
                if (variant.slice(-9) === cleanParticipant.slice(-9)) {
                  debugResults.potentialMatches.push({
                    groupName: groupName,
                    participantId: participantId,
                    cleanParticipant: cleanParticipant,
                    userVariant: variant,
                    matchType: 'last_9_digits',
                    rank: participantRank,
                    isAdmin: ['admin', 'administrator', 'creator', 'owner'].includes(participantRank.toLowerCase())
                  });
                  console.log(`🔍 PARTIAL MATCH: ${participantId} ~= ${variant} (last 9 digits, ${participantRank})`);
                }
              }
            }
          }
        }
      } else {
        console.log(`  ⚠️ No participants data for ${groupName}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Convert Sets to Arrays for JSON response
    const finalResults = {
      ...debugResults,
      phoneFormats: Array.from(debugResults.phoneFormats),
      ranks: Array.from(debugResults.ranks),
      summary: {
        totalParticipantsAnalyzed: debugResults.participantSamples.length,
        exactMatches: debugResults.exactMatches.length,
        potentialMatches: debugResults.potentialMatches.length,
        adminMatches: debugResults.exactMatches.filter(m => m.isAdmin).length + 
                     debugResults.potentialMatches.filter(m => m.isAdmin).length,
        phoneFormatsFound: Array.from(debugResults.phoneFormats),
        ranksFound: Array.from(debugResults.ranks)
      }
    };

    console.log(`🎯 DEBUG COMPLETE:`);
    console.log(`- Exact matches: ${finalResults.exactMatches.length}`);
    console.log(`- Potential matches: ${finalResults.potentialMatches.length}`);
    console.log(`- Admin matches: ${finalResults.summary.adminMatches}`);

    return new Response(
      JSON.stringify(finalResults, null, 2),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Debug Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Debug failed', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})

function getPhoneFormat(phone: string): string {
  if (!phone) return 'empty';
  
  if (phone.includes('@lid')) return 'lid_format';
  if (phone.includes('@')) return 'email_format';
  if (/^\d+$/.test(phone)) return 'numeric_only';
  if (phone.startsWith('972')) return 'israel_international';
  if (phone.startsWith('0')) return 'israel_local';
  if (phone.startsWith('+')) return 'plus_international';
  
  return 'other_format';
}