import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InspectRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔍 DETAILED PHONE INSPECTOR: Deep Analysis...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: InspectRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Get user's WHAPI credentials
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('whapi_token, phone_number, instance_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const results = {
      timestamp: new Date().toISOString(),
      user_analysis: {} as any,
      phone_analysis: {} as any,
      groups_analysis: {} as any,
      participant_samples: [] as any[],
      matching_analysis: {} as any,
      recommendations: [] as string[]
    };

    // STEP 1: Analyze user's phone from multiple sources
    console.log('📱 STEP 1: User Phone Analysis...');
    
    results.user_analysis = {
      stored_phone: profile.phone_number,
      instance_status: profile.instance_status
    };

    // Get phone from health endpoint
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
        results.user_analysis.health_response = healthData;
        results.user_analysis.health_phone_raw = healthData?.user?.id;
        results.user_analysis.health_phone_clean = healthData?.user?.id?.replace(/[^\d]/g, '');
        results.user_analysis.health_name = healthData?.user?.name;
        
        console.log(`📱 Health phone: ${healthData?.user?.id}`);
        console.log(`📱 Health name: ${healthData?.user?.name}`);
      } else {
        results.user_analysis.health_error = `HTTP ${healthResponse.status}`;
      }
    } catch (healthError) {
      results.user_analysis.health_error = healthError.message;
    }

    // Determine final user phone
    const finalUserPhone = results.user_analysis.health_phone_clean || profile.phone_number;
    if (!finalUserPhone) {
      return new Response(
        JSON.stringify({
          error: 'Cannot determine user phone',
          analysis: results
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // STEP 2: Phone variant analysis
    console.log('🔍 STEP 2: Phone Variant Analysis...');
    
    const phoneClean = finalUserPhone.replace(/[^\d]/g, '');
    const phoneVariants = [
      phoneClean,
      phoneClean.startsWith('972') ? '0' + phoneClean.substring(3) : null,
      phoneClean.startsWith('0') ? '972' + phoneClean.substring(1) : null,
      phoneClean.slice(-9),
      phoneClean.slice(-10),
      phoneClean.slice(-8),
      // Add more variants
      '+' + phoneClean,
      phoneClean.startsWith('972') ? phoneClean.substring(3) : null
    ].filter(Boolean);

    results.phone_analysis = {
      final_user_phone: finalUserPhone,
      phone_clean: phoneClean,
      phone_length: phoneClean.length,
      variants_count: phoneVariants.length,
      all_variants: phoneVariants
    };

    console.log(`📱 Final user phone: ${finalUserPhone}`);
    console.log(`📱 Generated ${phoneVariants.length} variants: ${phoneVariants.join(', ')}`);

    // STEP 3: Get groups with detailed participant analysis
    console.log('👥 STEP 3: Groups & Participants Analysis...');
    
    const groupsResponse = await fetch(
      `https://gate.whapi.cloud/groups?count=3&offset=0&participants=true`,
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

    results.groups_analysis = {
      total_groups: groups.length,
      groups_with_participants: 0,
      total_participants: 0,
      participant_formats: {} as any,
      ranks_found: {} as any
    };

    // STEP 4: Detailed participant analysis
    console.log('🔍 STEP 4: Detailed Participant Analysis...');
    
    for (const group of groups) {
      const groupName = group.name || group.subject || `Group ${group.id}`;
      console.log(`📊 Analyzing group: ${groupName}`);

      if (group.participants && Array.isArray(group.participants)) {
        results.groups_analysis.groups_with_participants++;
        results.groups_analysis.total_participants += group.participants.length;

        console.log(`  👥 ${group.participants.length} participants`);

        // Analyze first 10 participants in detail
        const participantsToAnalyze = group.participants.slice(0, 10);
        
        for (const participant of participantsToAnalyze) {
          const participantId = participant.id || participant.phone || participant.number;
          const participantRank = participant.rank || participant.role || 'member';
          
          // Track formats
          const format = getDetailedFormat(participantId);
          results.groups_analysis.participant_formats[format] = 
            (results.groups_analysis.participant_formats[format] || 0) + 1;
          
          // Track ranks
          results.groups_analysis.ranks_found[participantRank] = 
            (results.groups_analysis.ranks_found[participantRank] || 0) + 1;

          // Add to samples
          const participantSample = {
            group_name: groupName,
            participant_id: participantId,
            participant_rank: participantRank,
            raw_length: participantId?.length || 0,
            format: format,
            clean_id: participantId?.replace(/@lid$/, '').replace(/[^\d]/g, ''),
            is_admin: ['admin', 'administrator', 'creator', 'owner'].includes(participantRank.toLowerCase())
          };

          results.participant_samples.push(participantSample);

          // DETAILED MATCHING ANALYSIS
          if (participantId) {
            const cleanParticipant = participantId.replace(/@lid$/, '').replace(/[^\d]/g, '');
            
            for (const variant of phoneVariants) {
              if (variant === cleanParticipant) {
                console.log(`🎯 EXACT MATCH FOUND: ${participantId} = ${variant} (${participantRank})`);
                
                if (!results.matching_analysis.exact_matches) {
                  results.matching_analysis.exact_matches = [];
                }
                results.matching_analysis.exact_matches.push({
                  group_name: groupName,
                  participant_id: participantId,
                  matched_variant: variant,
                  rank: participantRank,
                  is_admin: participantSample.is_admin
                });
              }
              
              // Partial matches
              if (variant.length >= 8 && cleanParticipant.length >= 8) {
                const variantLast8 = variant.slice(-8);
                const participantLast8 = cleanParticipant.slice(-8);
                
                if (variantLast8 === participantLast8) {
                  console.log(`🔍 PARTIAL MATCH (last 8): ${participantId} ~= ${variant}`);
                  
                  if (!results.matching_analysis.partial_matches) {
                    results.matching_analysis.partial_matches = [];
                  }
                  results.matching_analysis.partial_matches.push({
                    group_name: groupName,
                    participant_id: participantId,
                    matched_variant: variant,
                    match_type: 'last_8_digits',
                    rank: participantRank,
                    is_admin: participantSample.is_admin
                  });
                }
              }
            }
          }
        }
      } else {
        console.log(`  ⚠️ No participants data for ${groupName}`);
      }
    }

    // STEP 5: Generate recommendations
    console.log('💡 STEP 5: Generating Recommendations...');
    
    const exactMatches = results.matching_analysis.exact_matches?.length || 0;
    const partialMatches = results.matching_analysis.partial_matches?.length || 0;
    const adminMatches = (results.matching_analysis.exact_matches?.filter((m: any) => m.is_admin).length || 0) +
                        (results.matching_analysis.partial_matches?.filter((m: any) => m.is_admin).length || 0);

    if (exactMatches === 0 && partialMatches === 0) {
      results.recommendations.push('❌ No phone matches found - you may not be in these groups');
      results.recommendations.push('🔍 Check your WhatsApp phone number manually');
      results.recommendations.push('👥 Verify you are actually a participant in the groups being synced');
      
      // Check if all participants are LID format
      const lidCount = results.participant_samples.filter(p => p.format === 'lid_format').length;
      const totalSamples = results.participant_samples.length;
      
      if (lidCount / totalSamples > 0.8) {
        results.recommendations.push('🚨 Most participants use LID format - this may be the issue');
        results.recommendations.push('📱 WhatsApp may be hiding real phone numbers');
      }
    } else if (adminMatches === 0) {
      results.recommendations.push('⚠️ Phone matches found but no admin roles');
      results.recommendations.push('👤 You are in the groups but not as admin/creator');
      results.recommendations.push('🔐 Check your admin status in WhatsApp groups manually');
    } else {
      results.recommendations.push('✅ Admin matches found - sync should work!');
      results.recommendations.push('🚀 Deploy the fixed sync function');
    }

    results.matching_analysis.summary = {
      exact_matches: exactMatches,
      partial_matches: partialMatches,
      admin_matches: adminMatches,
      total_participants_checked: results.participant_samples.length
    };

    console.log(`🎯 INSPECTION COMPLETE:`);
    console.log(`- Exact matches: ${exactMatches}`);
    console.log(`- Partial matches: ${partialMatches}`);
    console.log(`- Admin matches: ${adminMatches}`);

    return new Response(
      JSON.stringify(results, null, 2),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Inspector Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Inspection failed', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})

function getDetailedFormat(phone: string): string {
  if (!phone) return 'empty';
  
  if (phone.includes('@lid')) return 'lid_format';
  if (phone.includes('@')) return 'email_format';
  if (phone.startsWith('+972')) return 'israel_plus_international';
  if (phone.startsWith('972')) return 'israel_international';
  if (phone.startsWith('0')) return 'israel_local';
  if (/^\d+$/.test(phone)) {
    if (phone.length === 12) return 'numeric_12_digits';
    if (phone.length === 10) return 'numeric_10_digits';
    if (phone.length === 9) return 'numeric_9_digits';
    return `numeric_${phone.length}_digits`;
  }
  
  return 'unknown_format';
}