import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncGroupsRequest {
  userId: string
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced phone matching with comprehensive debugging
function isPhoneMatch(userPhone: string, participantPhone: string, debug: boolean = false): boolean {
  if (debug) {
    console.log(`🔍 PHONE MATCHING DEBUG:`)
    console.log(`  User phone: "${userPhone}" (type: ${typeof userPhone})`)
    console.log(`  Participant phone: "${participantPhone}" (type: ${typeof participantPhone})`)
  }
  
  if (!userPhone || !participantPhone) {
    if (debug) console.log(`  ❌ Missing phone: user=${!!userPhone}, participant=${!!participantPhone}`)
    return false;
  }
  
  const clean1 = userPhone.replace(/[^\d]/g, '');
  const clean2 = participantPhone.replace(/[^\d]/g, '');
  
  if (debug) {
    console.log(`  Cleaned user: "${clean1}"`)
    console.log(`  Cleaned participant: "${clean2}"`)
  }
  
  // Direct exact match
  if (clean1 === clean2) {
    if (debug) console.log(`  ✅ EXACT MATCH`)
    return true;
  }
  
  // Israeli format handling (972 vs 0 prefix)
  if (clean1.startsWith('972') && clean2.startsWith('0')) {
    const match = clean1.substring(3) === clean2.substring(1);
    if (debug) console.log(`  🇮🇱 972->0 format: ${clean1.substring(3)} vs ${clean2.substring(1)} = ${match}`)
    if (match) return true;
  }
  
  if (clean2.startsWith('972') && clean1.startsWith('0')) {
    const match = clean2.substring(3) === clean1.substring(1);
    if (debug) console.log(`  🇮🇱 0->972 format: ${clean2.substring(3)} vs ${clean1.substring(1)} = ${match}`)
    if (match) return true;
  }
  
  // Last 9 digits match (Israeli mobile standard)
  if (clean1.length >= 9 && clean2.length >= 9) {
    const match = clean1.slice(-9) === clean2.slice(-9);
    if (debug) console.log(`  📱 Last 9 digits: ${clean1.slice(-9)} vs ${clean2.slice(-9)} = ${match}`)
    if (match) return true;
  }
  
  if (debug) console.log(`  ❌ NO MATCH FOUND`)
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔍 PHONE DEBUG SYNC: Enhanced phone matching debugging...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId }: SyncGroupsRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Starting PHONE DEBUG sync for user:', userId)

    // Get user's WHAPI credentials
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instance_id, whapi_token, instance_status, phone_number')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.whapi_token) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found or not connected' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('📋 Profile info:', {
      hasToken: !!profile.whapi_token,
      instanceId: profile.instance_id,
      status: profile.instance_status,
      storedPhone: profile.phone_number
    })

    // Get/update phone number with enhanced debugging
    let userPhoneNumber = profile.phone_number

    if (!userPhoneNumber) {
      console.log('📱 No phone stored, fetching from /health...')
      
      try {
        const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        })

        console.log('📊 Health response status:', healthResponse.status)

        if (healthResponse.ok) {
          const healthData = await healthResponse.json()
          console.log('📊 Health data structure:', {
            hasUser: !!healthData.user,
            userId: healthData.user?.id,
            hasMe: !!healthData.me,
            mePhone: healthData.me?.phone,
            phone: healthData.phone,
            allKeys: Object.keys(healthData)
          })
          
          if (healthData?.user?.id) {
            userPhoneNumber = healthData.user.id.replace(/[^\d]/g, '');
            console.log('📱 Raw phone from health:', healthData.user.id)
            console.log('📱 Cleaned phone:', userPhoneNumber)
            
            await supabase
              .from('profiles')
              .update({
                phone_number: userPhoneNumber,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
            
            console.log('📱 Phone saved to database:', userPhoneNumber)
          } else {
            console.log('❌ No user.id found in health response')
          }
        } else {
          const errorText = await healthResponse.text()
          console.log('❌ Health response error:', errorText)
        }
      } catch (healthError) {
        console.error('❌ Error calling /health:', healthError)
      }
    } else {
      console.log('📱 Using stored phone number:', userPhoneNumber)
    }

    if (!userPhoneNumber) {
      console.log('❌ CRITICAL: No phone number available')
      return new Response(
        JSON.stringify({ 
          error: 'Could not determine your phone number',
          suggestion: 'Check connection status and try reconnecting WhatsApp',
          debug_info: {
            stored_phone: profile.phone_number,
            health_call_attempted: true
          }
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`📱 FINAL USER PHONE: "${userPhoneNumber}"`)
    console.log(`📱 Phone length: ${userPhoneNumber.length}`)
    console.log(`📱 Phone starts with: ${userPhoneNumber.substring(0, 3)}`)

    // Test phone matching with a few simple examples
    console.log('\n🧪 PHONE MATCHING TESTS:')
    const testPhones = [
      userPhoneNumber,
      '0' + userPhoneNumber.substring(3),
      '972' + userPhoneNumber.substring(1),
      userPhoneNumber.slice(-9)
    ]
    
    testPhones.forEach((testPhone, index) => {
      if (testPhone) {
        const match = isPhoneMatch(userPhoneNumber, testPhone, false)
        console.log(`  Test ${index + 1}: "${testPhone}" -> ${match ? '✅' : '❌'}`)
      }
    })

    // Get a small sample of groups for testing
    console.log('\n📡 Getting sample groups for phone debugging...')
    
    try {
      const groupsResponse = await fetch(
        `https://gate.whapi.cloud/groups?count=10&offset=0`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.whapi_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!groupsResponse.ok) {
        throw new Error(`Groups API failed: ${groupsResponse.status}`)
      }

      const groupsData = await groupsResponse.json()
      const sampleGroups = groupsData.groups || []
      
      console.log(`📊 Retrieved ${sampleGroups.length} sample groups for testing`)

      // Analyze first few groups in detail
      const groupsToAnalyze = Math.min(3, sampleGroups.length)
      
      for (let i = 0; i < groupsToAnalyze; i++) {
        const group = sampleGroups[i]
        const groupName = group.name || group.subject || `Group ${group.id}`
        const participantsCount = group.participants?.length || 0
        
        console.log(`\n🔍 ANALYZING GROUP ${i + 1}: "${groupName}"`)
        console.log(`📊 Participants: ${participantsCount}`)
        
        if (!group.participants || group.participants.length === 0) {
          console.log('⚠️ No participants data')
          continue
        }
        
        // Show first few participants
        const participantsToShow = Math.min(5, group.participants.length)
        console.log(`👥 First ${participantsToShow} participants:`)
        
        for (let j = 0; j < participantsToShow; j++) {
          const participant = group.participants[j]
          const participantId = participant.id || participant.phone || participant.number
          const participantRank = participant.rank || participant.role || 'member'
          
          console.log(`  ${j + 1}. ID: "${participantId}", Role: "${participantRank}"`)
          console.log(`     Keys: [${Object.keys(participant).join(', ')}]`)
          
          // Test phone matching with debug
          if (participantId) {
            console.log(`     🔍 Phone match test:`)
            const isMatch = isPhoneMatch(userPhoneNumber, participantId, true)
            console.log(`     Result: ${isMatch ? '✅ MATCH!' : '❌ No match'}`)
            
            if (isMatch) {
              console.log(`     🎉 FOUND USER IN GROUP: ${groupName}`)
              console.log(`     👤 User role: ${participantRank}`)
            }
          } else {
            console.log(`     ⚠️ No participant ID available`)
          }
        }
      }

    } catch (error) {
      console.error('❌ Error testing groups:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to test phone matching', 
          details: error.message,
          user_phone: userPhoneNumber
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        debug_completed: true,
        user_phone: userPhoneNumber,
        phone_length: userPhoneNumber.length,
        phone_format: userPhoneNumber.startsWith('972') ? 'international' : 'local',
        message: 'Phone debugging completed - check logs for detailed analysis'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Phone Debug Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})