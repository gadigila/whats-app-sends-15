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
    console.log('📨 WHAPI Webhook - Processing Event')
    
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

    // Handle different event types
    switch (eventType) {
      case 'ready':
        console.log('🎉 WhatsApp connected successfully!');
        console.log('📊 Device info:', eventData.device);

        if (userId) {
          // Get phone number from /health endpoint immediately
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('whapi_token')
            .eq('id', userId)
            .single();

          if (!profileError && profile?.whapi_token) {
            console.log('📱 Fetching phone number from /health...');
            
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
                console.log('📊 Health data received:', JSON.stringify(healthData, null, 2));
                
                // Extract phone from correct location (user.id)
                let phoneNumber = null;
                
                if (healthData?.user?.id) {
                  phoneNumber = healthData.user.id;
                  console.log('📱 Found phone in user.id:', phoneNumber);
                } else if (healthData?.me?.phone) {
                  phoneNumber = healthData.me.phone;
                  console.log('📱 Found phone in me.phone:', phoneNumber);
                } else if (healthData?.phone) {
                  phoneNumber = healthData.phone;
                  console.log('📱 Found phone in phone field:', phoneNumber);
                }

                // Clean phone number (remove + and ensure 972 format)
                if (phoneNumber) {
                  const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
                  console.log('📱 Cleaned phone number:', cleanPhone);
                  
                  // Update profile with connected status AND phone number
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                      instance_status: 'connected',
                      phone_number: cleanPhone,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);

                  if (updateError) {
                    console.error('❌ Error updating profile:', updateError);
                  } else {
                    console.log('✅ Profile updated with connected status and phone:', cleanPhone);
                    
                    // 🚀 NEW: TRIGGER BACKGROUND GROUP COLLECTION (Phase 1)
                    console.log('🔄 Triggering background group collection...');
                    
                    const backgroundCollectionUrl = `${supabaseUrl}/functions/v1/background-group-collection`;
                    
                    // Don't await this - truly fire and forget
                    fetch(backgroundCollectionUrl, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ 
                        userId: userId
                      })
                    }).then(async (response) => {
                      if (response.ok) {
                        const result = await response.json();
                        console.log('✅ Background collection completed successfully:', {
                          groupsCollected: result?.groups_collected || 0,
                          collectionTime: result?.collection_time_seconds || 0
                        });
                      } else {
                        console.error('❌ Background collection failed:', response.status, await response.text());
                      }
                    }).catch((error) => {
                      console.error('❌ Background collection error:', error);
                    });

                    console.log('🚀 Background collection triggered (running in background)');
                  }
                } else {
                  console.log('⚠️ No phone number found in health response');
                  
                  // Still update to connected, but without phone
                  await supabase
                    .from('profiles')
                    .update({
                      instance_status: 'connected',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);
                }
              } else {
                console.log('⚠️ Health endpoint failed:', healthResponse.status);
                
                // Still update to connected
                await supabase
                  .from('profiles')
                  .update({
                    instance_status: 'connected',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', userId);
              }
            } catch (healthError) {
              console.error('❌ Error calling health endpoint:', healthError);
              
              // Still update to connected
              await supabase
                .from('profiles')
                .update({
                  instance_status: 'connected',
                  updated_at: new Date().toISOString()
                })
                .eq('id', userId);
            }
          }
        } else {
          // FALLBACK: Try to find user by checking all waiting profiles
          console.log('⚠️ No userId in webhook URL, trying fallback method')
          
          const phoneNumber = eventData.phone
          if (phoneNumber) {
            const { data: waitingProfiles, error: findError } = await supabase
              .from('profiles')
              .select('id, instance_id, whapi_token')
              .in('instance_status', ['unauthorized', 'initializing', 'qr', 'active'])

            if (findError) {
              console.error('❌ Error finding waiting profiles:', findError)
            } else if (waitingProfiles && waitingProfiles.length > 0) {
              console.log(`📊 Found ${waitingProfiles.length} profiles waiting for connection`)
              
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
                    const healthPhone = healthData?.user?.id || healthData?.me?.phone || healthData?.phone;
                    
                    if (healthPhone && isPhoneMatch(healthPhone, phoneNumber)) {
                      console.log(`✅ Updating profile ${profile.id} to connected`)
                      
                      const cleanPhone = healthPhone.replace(/[^\d]/g, '');
                      
                      const { error: updateError } = await supabase
                        .from('profiles')
                        .update({
                          instance_status: 'connected',
                          phone_number: cleanPhone,
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', profile.id)

                      if (updateError) {
                        console.error('❌ Error updating profile:', updateError)
                      } else {
                        console.log('✅ Profile updated to connected status with phone:', cleanPhone)
                        
                        // 🚀 TRIGGER BACKGROUND COLLECTION FOR FALLBACK USER TOO
                        const backgroundCollectionUrl = `${supabaseUrl}/functions/v1/background-group-collection`;
                        
                        fetch(backgroundCollectionUrl, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ 
                            userId: profile.id
                          })
                        }).then(() => {
                          console.log('✅ Fallback background collection triggered');
                        }).catch((error) => {
                          console.error('❌ Fallback background collection failed:', error);
                        });
                        
                        break
                      }
                    }
                  }
                } catch (error) {
                  console.log(`⚠️ Error checking profile ${profile.id}:`, error.message)
                }
                
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

      case 'messages':
        console.log('💬 Message received:', {
          from: eventData.from,
          type: eventData.type || 'text',
          fromMe: eventData.from_me || false
        })
        break

      case 'statuses':
        console.log('📊 Message status update:', {
          messageId: eventData.id,
          status: eventData.status
        })
        break

      case 'groups':
        console.log('👥 Group event:', {
          groupId: eventData.id,
          action: eventData.action,
          groupName: eventData.name || 'Unknown'
        })
        
        if (userId && eventData.id) {
          const groupId = eventData.id
          const action = eventData.action
          
          if (action === 'add' || action === 'create') {
            console.log('🆕 User added to new group or group created:', groupId)
            
            // Add new group to database immediately
            try {
              const { error: insertError } = await supabase
                .from('whatsapp_groups')
                .upsert({
                  user_id: userId,
                  group_id: groupId,
                  name: eventData.name || eventData.subject || `Group ${groupId}`,
                  description: eventData.description || null,
                  participants_count: eventData.participants?.length || 0,
                  is_admin: false, // Will be determined later
                  is_creator: false, // Will be determined later  
                  admin_status: 'unknown', // Needs admin check
                  avatar_url: eventData.chat_pic || null,
                  last_synced_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'user_id,group_id',
                  ignoreDuplicates: false
                })

              if (insertError) {
                console.error('❌ Failed to add new group:', insertError)
              } else {
                console.log('✅ New group added to database:', groupId)
              }
            } catch (error) {
              console.error('❌ Error processing new group:', error)
            }
          }
          
          if (action === 'remove' || action === 'delete') {
            console.log('🗑️ User removed from group or group deleted:', groupId)
            
            // Remove group from database
            try {
              await supabase
                .from('whatsapp_groups')
                .delete()
                .eq('user_id', userId)
                .eq('group_id', groupId)
                
              console.log('✅ Removed group from database:', groupId)
            } catch (error) {
              console.error('❌ Error removing group:', error)
            }
          }
        }
        break

      case 'groups_participants':
        console.log('👥 Group participant change:', {
          groupId: eventData.id,
          action: eventData.action,
          participants: eventData.participants?.length || 0
        })
        
        const groupId = eventData.id || eventData.group_id
        const action = eventData.action
        const participants = eventData.participants || []
        
        if ((action === 'promote' || action === 'demote') && userId && groupId) {
          console.log(`🔄 Processing ${action} for ${participants.length} participants in group ${groupId}`)
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone_number')
            .eq('id', userId)
            .single()
            
          if (profile?.phone_number) {
            const userPhone = profile.phone_number
            
            // Check if the user's admin status changed
            for (const participantPhone of participants) {
              if (isPhoneMatch(userPhone, participantPhone)) {
                console.log(`🎯 User's admin status changed: ${action} in group ${groupId}`)
                
                // Mark group for admin status recheck
                await supabase
                  .from('whatsapp_groups')
                  .update({
                    admin_status: 'unknown', // Force recheck
                    updated_at: new Date().toISOString()
                  })
                  .eq('user_id', userId)
                  .eq('group_id', groupId)
                
                console.log(`✅ Marked group ${groupId} for admin status recheck`)
                break
              }
            }
          }
        }
        break

      case 'chats':
        console.log('💬 Chat event:', {
          chatId: eventData.id,
          action: eventData.action
        })
        break

      case 'contacts':
        console.log('📞 Contact event:', {
          contactId: eventData.id,
          action: eventData.action
        })
        break

      default:
        console.log(`⚠️ Unknown webhook event: ${eventType}`)
        console.log('📊 Event data:', JSON.stringify(eventData, null, 2))
        break
    }

    return new Response(
      JSON.stringify({ 
        received: true, 
        processed: eventType,
        userId: userId,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: corsHeaders 
      }
    )

  } catch (error) {
    console.error('💥 Webhook Error:', error)
    
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