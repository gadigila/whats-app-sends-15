import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Background Admin Detection Service
// Runs automatically via cron job every 5 minutes
// Processes groups that need admin detection in batches

interface AdminDetectionRequest {
  batchSize?: number
  userId?: string // Optional: process specific user
}

// Helper function for phone matching
class PhoneMatcher {
  private userPhoneVariants: string[];

  constructor(userPhone: string) {
    const cleanPhone = userPhone.replace(/[^\d]/g, '');
    
    this.userPhoneVariants = [
      cleanPhone,
      cleanPhone.startsWith('972') ? '0' + cleanPhone.substring(3) : null,
      cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : null,
      cleanPhone.slice(-9), // Last 9 digits
    ].filter(Boolean) as string[];
  }

  isMatch(participantPhone: string): boolean {
    if (!participantPhone) return false;
    
    const cleanParticipant = participantPhone.replace(/[^\d]/g, '');
    
    // Fast exact match
    if (this.userPhoneVariants.includes(cleanParticipant)) {
      return true;
    }
    
    // Check last 9 digits for Israeli numbers
    if (cleanParticipant.length >= 9) {
      const lastNine = cleanParticipant.slice(-9);
      return this.userPhoneVariants.some(variant => 
        variant.length >= 9 && variant.slice(-9) === lastNine
      );
    }
    
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🤖 BACKGROUND ADMIN DETECTION: Starting automated job...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { batchSize = 10, userId }: AdminDetectionRequest = await req.json().catch(() => ({}))

    console.log('🔧 Job configuration:', { batchSize, specificUser: userId || 'all users' })

    // Get groups that need admin detection (pending status)
    let query = supabase
      .from('whatsapp_groups')
      .select(`
        id, group_id, name, user_id, participants_count,
        profiles!inner(whapi_token, phone_number, instance_status)
      `)
      .eq('admin_detection_status', 'pending')
      .eq('profiles.instance_status', 'connected') // Only process connected users
      .limit(batchSize)
      .order('created_at', { ascending: true }) // Process oldest first

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: pendingGroups, error: fetchError } = await query

    if (fetchError) {
      console.error('❌ Error fetching pending groups:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending groups' }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (!pendingGroups || pendingGroups.length === 0) {
      console.log('✅ No groups need admin detection at this time')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending admin detections',
          processed: 0
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    console.log(`🔍 Processing ${pendingGroups.length} groups for admin detection`)

    let processed = 0
    let adminFound = 0
    let creatorFound = 0
    let failed = 0

    // Mark groups as processing
    const groupIds = pendingGroups.map(g => g.id)
    await supabase
      .from('whatsapp_groups')
      .update({ admin_detection_status: 'processing' })
      .in('id', groupIds)

    // Process each group
    for (const group of pendingGroups) {
      try {
        const profile = group.profiles
        if (!profile?.whapi_token || !profile?.phone_number) {
          console.log(`⚠️ Missing credentials for group ${group.name}`)
          continue
        }

        console.log(`🔍 Checking admin status for: ${group.name}`)

        // Get detailed group info with participants
        const groupResponse = await fetch(
          `https://gate.whapi.cloud/groups/${group.group_id}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${profile.whapi_token}`,
              'Content-Type': 'application/json'
            }
          }
        )

        if (!groupResponse.ok) {
          console.log(`⚠️ Failed to get group details for ${group.name}: ${groupResponse.status}`)
          
          // Mark as failed
          await supabase
            .from('whatsapp_groups')
            .update({
              admin_detection_status: 'failed',
              admin_detection_at: new Date().toISOString()
            })
            .eq('id', group.id)
          
          failed++
          continue
        }

        const groupData = await groupResponse.json()
        
        // Check if user is in participants
        if (!groupData.participants || !Array.isArray(groupData.participants)) {
          console.log(`⚠️ No participants data for ${group.name}`)
          
          await supabase
            .from('whatsapp_groups')
            .update({
              admin_detection_status: 'completed',
              admin_detection_at: new Date().toISOString(),
              is_admin: false,
              is_creator: false
            })
            .eq('id', group.id)
          
          processed++
          continue
        }

        // Initialize phone matcher for this user
        const phoneMatcher = new PhoneMatcher(profile.phone_number)

        // Find user in participants
        const userParticipant = groupData.participants.find((participant: any) => {
          const participantId = participant.id || participant.phone || participant.number;
          return phoneMatcher.isMatch(participantId);
        });

        let isAdmin = false
        let isCreator = false

        if (userParticipant) {
          const participantRank = (userParticipant.rank || userParticipant.role || 'member').toLowerCase()
          
          isCreator = participantRank === 'creator' || participantRank === 'owner'
          isAdmin = participantRank === 'admin' || participantRank === 'administrator' || isCreator

          if (isCreator) {
            console.log(`👑 CREATOR role found in: ${group.name}`)
            creatorFound++
          } else if (isAdmin) {
            console.log(`⭐ ADMIN role found in: ${group.name}`)
            adminFound++
          } else {
            console.log(`👤 MEMBER role in: ${group.name}`)
          }
        } else {
          console.log(`❌ User not found in participants for: ${group.name}`)
        }

        // Update group with admin status
        await supabase
          .from('whatsapp_groups')
          .update({
            is_admin: isAdmin,
            is_creator: isCreator,
            participants_count: groupData.participants.length,
            admin_detection_status: 'completed',
            admin_detection_at: new Date().toISOString()
          })
          .eq('id', group.id)

        processed++

        // Rate limiting between requests
        await delay(1200) // 1.2 seconds between group checks

      } catch (error) {
        console.error(`❌ Error processing group ${group.name}:`, error)
        
        // Mark as failed
        await supabase
          .from('whatsapp_groups')
          .update({
            admin_detection_status: 'failed',
            admin_detection_at: new Date().toISOString()
          })
          .eq('id', group.id)
        
        failed++
      }
    }

    console.log(`\n🎯 BACKGROUND ADMIN DETECTION COMPLETE!`)
    console.log(`📊 Processed: ${processed} groups`)
    console.log(`👑 Creator groups: ${creatorFound}`)
    console.log(`⭐ Admin groups: ${adminFound}`)
    console.log(`❌ Failed: ${failed}`)

    // Check if more groups are pending
    const { count: remainingCount } = await supabase
      .from('whatsapp_groups')
      .select('id', { count: 'exact', head: true })
      .eq('admin_detection_status', 'pending')

    const message = remainingCount && remainingCount > 0
      ? `Processed ${processed} groups. ${remainingCount} more groups pending.`
      : `Processed ${processed} groups. All admin detection complete.`

    return new Response(
      JSON.stringify({
        success: true,
        processed: processed,
        admin_groups_found: adminFound,
        creator_groups_found: creatorFound,
        failed: failed,
        remaining_pending: remainingCount || 0,
        message: message,
        batch_size: batchSize
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Background Admin Detection Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})