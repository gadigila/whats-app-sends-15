import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function - MOVED OUTSIDE
function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  // Remove all non-digits
  const clean1 = phone1.replace(/[^\d]/g, '');
  const clean2 = phone2.replace(/[^\d]/g, '');
  
  // Direct match
  if (clean1 === clean2) return true;
  
  // Israeli format matching (972 vs 0 prefix)
  if (clean1.startsWith('972') && clean2.startsWith('0')) {
    return clean1.substring(3) === clean2.substring(1);
  }
  
  if (clean2.startsWith('972') && clean1.startsWith('0')) {
    return clean2.substring(3) === clean1.substring(1);
  }
  
  // Match last 9 digits (Israeli mobile numbers)
  if (clean1.length >= 9 && clean2.length >= 9) {
    return clean1.slice(-9) === clean2.slice(-9);
  }
  
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('📨 WHAPI Webhook - Processing Event with Phone Capture')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // EXTRACT USER ID FROM URL
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    console.log('🔍 Webhook for user:', userId)

    const webhookData = await req.json()
    console.log('📊 Webhook received:', {
      type: webhookData.type,
      hasData: !!webhookData.data,
      userId: userId,
      timestamp: new Date().toISOString()
    })

    const eventType = webhookData.type
    const eventData = webhookData.data || {}

    // Handle different event types - OPTIMIZED TO AVOID NOTIFICATION INTERFERENCE
    switch (eventType) {
      case 'ready':
        console.log('🎉 WhatsApp connected successfully!')
        console.log('📱 Phone from webhook:', eventData.phone)
        console.log('📊 Device info:', eventData.device)
        
        // DIRECT UPDATE USING USER ID FROM URL
        if (userId) {
          console.log(`✅ Processing connection for user ${userId}`)
          
          // 🆕 ENHANCED: Multi-method phone capture
          let capturedPhone = null
          
          // Method 1: Try to get phone from webhook data
          if (eventData.phone && eventData.phone.match(/^972\d{9}$/)) {
            capturedPhone = eventData.phone
            console.log('📱 Phone from webhook data:', capturedPhone)
          }
          
          // Method 2: If no phone in webhook, get user token and try API calls
          if (!capturedPhone) {
            console.log('📱 No phone in webhook, trying API detection...')
            
            const { data: profile } = await supabase
              .from('profiles')
              .select('whapi_token')
              .eq('id', userId)
              .single()
            
            if (profile?.whapi_token) {
              // Try health endpoint first
              try {
                console.log('📊 Checking health endpoint for phone...')
                const healthResponse = await fetch('https://gate.whapi.cloud/health', {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${profile.whapi_token}`,
                    'Content-Type': 'application/json'
                  }
                })

                if (healthResponse.ok) {
                  const healthData = await healthResponse.json()
                  console.log('📊 Health data:', healthData)
                  
                  if (healthData.me?.phone) {
                    capturedPhone = healthData.me.phone
                    console.log('📱 Phone from health.me.phone:', capturedPhone)
                  } else if (healthData.phone) {
                    capturedPhone = healthData.phone
                    console.log('📱 Phone from health.phone:', capturedPhone)
                  } else if (healthData.me?.id && healthData.me.id.match(/^972\d{9}$/)) {
                    capturedPhone = healthData.me.id
                    console.log('📱 Phone from health.me.id:', capturedPhone)
                  }
                }
              } catch (error) {
                console.log('⚠️ Health endpoint failed:', error.message)
              }
              
              // Method 3: If health fails, try group analysis
              if (!capturedPhone) {
                console.log('📊 Trying group analysis...')
                try {
                  const groupsResponse = await fetch('https://gate.whapi.cloud/groups?count=30', {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${profile.whapi_token}`,
                      'Content-Type': 'application/json'
                    }
                  })

                  if (groupsResponse.ok) {
                    const groupsData = await groupsResponse.json()
                    const groups = groupsData.groups || []
                    
                    // Advanced phone detection - prioritize creators
                    const phoneStats = new Map()
                    for (const group of groups) {
                      if (group.participants) {
                        for (const participant of group.participants) {
                          if (participant.id?.match(/^972\d{9}$/)) {
                            const stats = phoneStats.get(participant.id) || { creator: 0, admin: 0 }
                            
                            if (participant.rank === 'creator') {
                              stats.creator++
                            } else if (participant.rank === 'admin') {
                              stats.admin++
                            }
                            
                            phoneStats.set(participant.id, stats)
                          }
                        }
                      }
                    }
                    
                    // Find best candidate - prioritize creators
                    let bestPhone = null
                    let bestScore = 0
                    
                    for (const [phone, stats] of phoneStats.entries()) {
                      const score = stats.creator * 3 + stats.admin * 1
                      if (score > bestScore) {
                        bestScore = score
                        bestPhone = phone
                      }
                    }
                    
                    if (bestPhone && bestScore >= 3) { // At least creator in 1 group
                      capturedPhone = bestPhone
                      console.log(`📱 Phone from group analysis: ${capturedPhone} (score: ${bestScore})`)
                    }
                  }
                } catch (error) {
                  console.log('⚠️ Group analysis failed:', error.message)
                }
              }
            }
          }
          
          // Update profile with connection status AND phone
          const updateData: any = {
            instance_status: 'connected',
            updated_at: new Date().toISOString()
          }
          
          if (capturedPhone) {
            const cleanPhone = capturedPhone.replace(/\D/g, '')
            if (cleanPhone.match(/^972\d{9}$/)) {
              updateData.user_phone = cleanPhone
              updateData.phone_detected_at = new Date().toISOString()
              console.log('✅ Storing phone in database:', cleanPhone)
            } else {
              console.log('⚠️ Invalid phone format:', capturedPhone)
            }
          } else {
            console.log('⚠️ Could not detect phone number from any method')
          }
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId)

          if (updateError) {
            console.error('❌ Error updating profile:', updateError)
          } else {
            console.log('✅ Profile updated successfully')
            console.log('📱 Phone capture result:', capturedPhone ? 'SUCCESS' : 'FAILED')
          }
        } else {
          // FALLBACK: Try to find user by phone number
          console.log('⚠️ No userId in webhook URL, trying fallback method')
          
          const phoneNumber = eventData.phone
          if (phoneNumber) {
            // Find users with matching tokens and update to connected
            const { data: waitingProfiles, error: findError } = await supabase
              .from('profiles')
              .select('id, instance_id, whapi_token')
              .in('instance_status', ['unauthorized', 'initializing', 'qr', 'active'])

            if (findError) {
              console.error('❌ Error finding waiting profiles:', findError)
            } else if (waitingProfiles && waitingProfiles.length > 0) {
              console.log(`📊 Found ${waitingProfiles.length} profiles waiting for connection`)
              
              // Check which token this event belongs to
              for (const profile of waitingProfiles) {
                try {
                  const healthResponse = await fetch(`https://gate.whapi.cloud/health`, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${profile.whapi_token}`,
                      'Content-Type': 'application/json'
                    }
                  })
                  
                  if (healthResponse.ok) {
                    const healthData = await healthResponse.json()
                    if (healthData.status === 'connected' && healthData.me?.phone === phoneNumber) {
                      console.log(`✅ Updating profile ${profile.id} to connected`)
                      
                      const { error: updateError } = await supabase
                        .from('profiles')
                        .update({
                          instance_status: 'connected',
                          user_phone: phoneNumber.replace(/\D/g, ''),
                          phone_detected_at: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', profile.id)

                      if (updateError) {
                        console.error('❌ Error updating profile:', updateError)
                      } else {
                        console.log('✅ Profile updated to connected status')
                        break // Found the right profile, stop checking others
                      }
                    }
                  }
                } catch (error) {
                  console.log(`⚠️ Error checking profile ${profile.id}:`, error.message)
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 50))
              }
            }
          }
        }
        break

      case 'auth_failure':
        console.log('❌ WhatsApp authentication failed')
        console.log('🔍 Reason:', eventData.reason || eventData.error || 'Unknown')
        
        if (userId) {
          await supabase
            .from('profiles')
            .update({
              instance_status: 'unauthorized',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
        }
        break

      case 'groups':
        console.log('👥 Group event:', {
          groupId: eventData.id,
          action: eventData.action
        })
        
        // Handle group creation (when user is added to new groups)
        if (eventData.action === 'add' && userId) {
          console.log('🆕 User added to new group, triggering sync...')
          
          try {
            const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
              body: { userId }
            })
            
            if (error) {
              console.error('❌ Failed to trigger group sync:', error)
            } else {
              console.log('✅ Group sync triggered successfully')
            }
          } catch (syncError) {
            console.error('❌ Failed to sync new group:', syncError)
          }
        }
        break

      case 'groups_participants':
        console.log('👥 Group participant change detected:', {
          groupId: eventData.id,
          action: eventData.action,
          participants: eventData.participants
        })
        
        const groupId = eventData.id || eventData.group_id
        const action = eventData.action
        const participants = eventData.participants || []
        
        // Handle admin promotions/demotions
        if ((action === 'promote' || action === 'demote') && userId) {
          console.log(`🔄 Processing ${action} for ${participants.length} participants`)
          
          // Get user's phone number from profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('whapi_token, user_phone')
            .eq('id', userId)
            .single()
            
          if (profile?.whapi_token) {
            try {
              // Use cached phone first, fallback to API
              let userPhone = profile.user_phone
              
              if (!userPhone) {
                // Get user's phone number from API
                const profileResponse = await fetch(`https://gate.whapi.cloud/users/profile`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${profile.whapi_token}`,
                    'Content-Type': 'application/json'
                  }
                })
                
                if (profileResponse.ok) {
                  const profileData = await profileResponse.json()
                  userPhone = profileData.phone || profileData.id
                }
              }
              
              if (userPhone) {
                console.log('📞 User phone for comparison:', userPhone)
                
                // Check if the promoted/demoted user is the current user
                for (const participantPhone of participants) {
                  console.log(`🔍 Checking participant: ${participantPhone}`)
                  
                  if (isPhoneMatch(userPhone, participantPhone)) {
                    console.log(`🎯 User's own admin status changed: ${action}`)
                    
                    // Update the group's admin status in database
                    const isAdmin = action === 'promote'
                    
                    const { error: updateError } = await supabase
                      .from('whatsapp_groups')
                      .update({
                        is_admin: isAdmin,
                        updated_at: new Date().toISOString()
                      })
                      .eq('user_id', userId)
                      .eq('group_id', groupId)
                    
                    if (updateError) {
                      console.error('❌ Failed to update admin status:', updateError)
                    } else {
                      console.log(`✅ Updated admin status: ${isAdmin} for group ${groupId}`)
                    }
                    
                    break // Found the user, stop checking other participants
                  }
                }
              }
            } catch (error) {
              console.error('❌ Error getting user profile:', error)
            }
          }
        }
        break

      // ✅ REMOVED: These cases were causing notification interference
      // case 'messages': - REMOVED to fix notifications
      // case 'statuses': - REMOVED to fix notifications  
      // case 'chats': - REMOVED to fix notifications
      // case 'contacts': - REMOVED to fix notifications

      default:
        console.log(`⚠️ Unhandled webhook event: ${eventType}`)
        break
    }

    // Always return 200 OK to WHAPI within 30 seconds
    return new Response(
      JSON.stringify({ 
        received: true, 
        processed: eventType,
        userId: userId,
        timestamp: new Date().toISOString(),
        phone_capture_enabled: true
      }),
      { 
        status: 200, 
        headers: corsHeaders 
      }
    )

  } catch (error) {
    console.error('💥 Webhook Error:', error)
    
    // Still return 200 to avoid WHAPI retries for malformed data
    return new Response(
      JSON.stringify({ 
        received: true, 
        error: 'Processing failed',
        details: error.message 
      }),
      { 
        status: 200, 
        headers: corsHeaders 
      }
    )
  }
})