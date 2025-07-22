import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function for phone number matching
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
    console.log('📨 WHAPI Webhook - Optimized for Native Notifications')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Extract user ID from URL
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')

    const webhookData = await req.json()
    const eventType = webhookData.type
    const eventData = webhookData.data || {}

    console.log('📊 Webhook Event:', {
      type: eventType,
      userId: userId,
      timestamp: new Date().toISOString()
    })

    // ✅ OPTIMIZED: Only handle events we actually subscribed to
    switch (eventType) {
      case 'ready':
        console.log('🎉 WhatsApp Connected Successfully!')
        await handleReadyEvent(supabase, userId, eventData)
        break

      case 'auth_failure':
        console.log('❌ WhatsApp Authentication Failed')
        await handleAuthFailure(supabase, userId, eventData)
        break

      case 'groups':
        console.log('👥 Group Event:', eventData.action)
        await handleGroupEvent(supabase, userId, eventData)
        break

      case 'statuses':
        console.log('📊 Message Status Update')
        await handleStatusEvent(supabase, userId, eventData)
        break

      // ✅ REMOVED: 'messages' case since we no longer subscribe to it
      // This preserves WhatsApp native notifications!

      default:
        console.log(`⚠️ Unexpected webhook event: ${eventType}`)
        break
    }

    return new Response(
      JSON.stringify({ 
        received: true, 
        processed: eventType,
        optimization: 'Native notifications preserved'
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 Webhook Error:', error)
    
    return new Response(
      JSON.stringify({ 
        received: true, 
        error: 'Processing failed',
        details: error.message 
      }),
      { status: 200, headers: corsHeaders }
    )
  }
})

// ✅ IMPROVED: Separate handler functions for better organization
async function handleReadyEvent(supabase: any, userId: string | null, eventData: any) {
  if (!userId) {
    console.log('⚠️ No userId provided, attempting fallback identification')
    return await handleReadyFallback(supabase, eventData)
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('whapi_token')
      .eq('id', userId)
      .single()

    if (error || !profile?.whapi_token) {
      console.error('❌ Profile not found:', error)
      return
    }

    // Get phone number from health endpoint
    const phoneNumber = await getPhoneFromHealth(profile.whapi_token)
    
    const updateData: any = {
      instance_status: 'connected',
      updated_at: new Date().toISOString()
    }

    if (phoneNumber) {
      updateData.phone_number = phoneNumber
      console.log('📱 Phone number captured:', phoneNumber)
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Profile update failed:', updateError)
    } else {
      console.log('✅ Profile updated successfully')
    }

  } catch (error) {
    console.error('❌ Error handling ready event:', error)
  }
}

async function handleReadyFallback(supabase: any, eventData: any) {
  const phoneNumber = eventData.phone
  if (!phoneNumber) return

  try {
    const { data: waitingProfiles } = await supabase
      .from('profiles')
      .select('id, whapi_token')
      .in('instance_status', ['unauthorized', 'initializing', 'qr'])

    if (!waitingProfiles?.length) return

    for (const profile of waitingProfiles) {
      const healthPhone = await getPhoneFromHealth(profile.whapi_token)
      
      if (healthPhone && isPhoneMatch(healthPhone, phoneNumber)) {
        await supabase
          .from('profiles')
          .update({
            instance_status: 'connected',
            phone_number: healthPhone.replace(/[^\d]/g, ''),
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id)

        console.log('✅ Fallback identification successful for:', profile.id)
        break
      }
    }
  } catch (error) {
    console.error('❌ Fallback identification failed:', error)
  }
}

async function handleAuthFailure(supabase: any, userId: string | null, eventData: any) {
  if (!userId) return

  try {
    await supabase
      .from('profiles')
      .update({
        instance_status: 'unauthorized',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    console.log('✅ Auth failure status updated')
  } catch (error) {
    console.error('❌ Error updating auth failure:', error)
  }
}

async function handleGroupEvent(supabase: any, userId: string | null, eventData: any) {
  if (!userId || eventData.action !== 'add') return

  try {
    // Trigger group sync for new group
    await supabase.functions.invoke('sync-whatsapp-groups', {
      body: { userId }
    })
    console.log('✅ Group sync triggered')
  } catch (error) {
    console.error('❌ Group sync failed:', error)
  }
}

async function handleStatusEvent(supabase: any, userId: string | null, eventData: any) {
  // ✅ FIXED: Only track status for messages we actually sent
  // Since we don't store individual message IDs, we'll just log for now
  console.log('📊 Status for message:', {
    messageId: eventData.id,
    status: eventData.status,
    userId: userId
  })
  
  // TODO: If you want to track individual message delivery,
  // you'll need to modify your scheduled_messages table to store message IDs
}

async function getPhoneFromHealth(token: string): Promise<string | null> {
  try {
    const response = await fetch(`https://gate.whapi.cloud/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) return null

    const healthData = await response.json()
    
    // Try multiple possible phone number locations
    const phoneNumber = healthData?.user?.id || 
                       healthData?.me?.phone || 
                       healthData?.phone

    return phoneNumber ? phoneNumber.replace(/[^\d]/g, '') : null
  } catch (error) {
    console.error('❌ Health check failed:', error)
    return null
  }
}