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
          // 🔧 FIXED: Get phone number from /health endpoint immediately
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
                
                // 🎯 FIXED: Extract phone from correct location (user.id)
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
                      phone_number: cleanPhone, // 🎯 STORE PHONE NUMBER
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);

                  if (updateError) {
                    console.error('❌ Error updating profile:', updateError);
                  } else {
                    console.log('✅ Profile updated with connected status and phone:', cleanPhone);
                    
                    // 🚀 NEW: TRIGGER BACKGROUND GROUP SYNC IMMEDIATELY
                    console.log('🔄 Triggering background group sync...');
                    
                    try {
                      // Use setTimeout to make it truly background (non-blocking)
                      setTimeout(async () => {
                        try {
                          console.log('📂 Starting background group sync for user:', userId);
                          
                          const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-whatsapp-groups', {
                            body: { 
                              userId: userId,
                              background: true // Flag to indicate this is background sync
                            }
                          });

                          if (syncError) {
                            console.error('❌ Background sync failed:', syncError);
                          } else {
                            console.log('✅ Background sync completed successfully:', {
                              groupsFound: syncResult?.groups_count || 0,
                              syncTime: syncResult?.sync_time_seconds || 0
                            });
                          }
                        } catch (backgroundError) {
                          console.error('❌ Background sync error:', backgroundError);
                        }
                      }, 2000); // Wait 2 seconds to let connection fully stabilize

                      console.log('🚀 Background sync triggered (running in background)');
                      
                    } catch (triggerError) {
                      console.error('❌ Failed to trigger background sync:', triggerError);
                    }
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
                          phone_number: cleanPhone, // 🎯 STORE PHONE NUMBER
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', profile.id)

                      if (updateError) {
                        console.error('❌ Error updating profile:', updateError)
                      } else {
                        console.log('✅ Profile updated to connected status with phone:', cleanPhone)
                        
                        // 🚀 TRIGGER BACKGROUND SYNC FOR FALLBACK USER TOO
                        setTimeout(async () => {
                          try {
                            console.log('📂 Starting background sync for fallback user:', profile.id);
                            
                            await supabase.functions.invoke('sync-whatsapp-groups', {
                              body: { 
                                userId: profile.id,
                                background: true
                              }
                            });
                            
                            console.log('✅ Fallback background sync triggered');
                          } catch (error) {
                            console.error('❌ Fallback background sync failed:', error);
                          }
                        }, 2000);
                        
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
          action: eventData.action
        })
        
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
        
        if ((action === 'promote' || action === 'demote') && userId) {
          console.log(`🔄 Processing ${action} for ${participants.length} participants`)
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone_number')
            .eq('id', userId)
            .single()
            
          if (profile?.phone_number) {
            const userPhone = profile.phone_number
            console.log('📞 User phone for comparison:', userPhone)
            
            for (const participantPhone of participants) {
              console.log(`🔍 Checking participant: ${participantPhone}`)
              
              if (isPhoneMatch(userPhone, participantPhone)) {
                console.log(`🎯 User's own admin status changed: ${action}`)
                
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
                
                break
              }
            }
          } else {
            console.log('⚠️ No phone number stored for user, cannot check admin status')
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