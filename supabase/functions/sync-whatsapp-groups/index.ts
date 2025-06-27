// Refactored sync script for WhatsApp groups to improve clarity, modularity, and performance

// Import Supabase client for database operations
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Define CORS headers for API responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

// Generate multiple phone number formats to enable flexible matching
function createPhoneVariations(phone) {
  const variations = new Set();
  const cleaned = phone.replace(/@(?:c\.us|s\.whatsapp\.net)/, '').replace(/[^\d]/g, '');

  variations.add(cleaned);
  variations.add(`+${cleaned}`);
  if (cleaned.startsWith('972')) {
    const local = cleaned.slice(3);
    variations.add(local);
    variations.add(`0${local}`);
    variations.add(`+972${local}`);
  }
  if (cleaned.startsWith('0')) {
    const intl = `972${cleaned.slice(1)}`;
    variations.add(intl);
    variations.add(`+${intl}`);
  }
  ['@c.us', '@s.whatsapp.net'].forEach(suffix => {
    variations.forEach(v => variations.add(`${v}${suffix}`));
  });
  return Array.from(variations).filter(v => v.length >= 8);
}

// Compare two phone numbers across their normalized variations
function isPhoneMatch(phone1, phone2) {
  const v1 = createPhoneVariations(phone1);
  const v2 = createPhoneVariations(phone2);
  return v1.some(p => v2.includes(p));
}

// Retrieve the authenticated user's phone number using the WHAPI token
async function getUserPhone(token) {
  const res = await fetch(`https://gate.whapi.cloud/users/profile`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('User profile fetch failed');
  const data = await res.json();
  return data.phone || data.id || data.jid || data.wid || data?.me?.phone || data?.user?.phone;
}

// Fetch detailed group information including participants and roles
async function fetchGroupDetails(groupId, token) {
  let retries = 0;
  while (retries <= 2) {
    const res = await fetch(`https://gate.whapi.cloud/groups/${groupId}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (res.ok) return await res.json();
    if (res.status === 429) await new Promise(r => setTimeout(r, 2000));
    else break;
    retries++;
  }
  return null;
}

// Main HTTP handler for syncing WhatsApp group data
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400, headers: corsHeaders });

    // Initialize Supabase client and validate WHAPI instance connection
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: profile, error } = await supabase.from('profiles').select('whapi_token, instance_status').eq('id', userId).single();
    if (error || !profile?.whapi_token || profile.instance_status !== 'connected')
      return new Response(JSON.stringify({ error: 'Invalid or disconnected instance' }), { status: 400, headers: corsHeaders });

    // Resolve user's normalized phone number
    const userPhone = await getUserPhone(profile.whapi_token);
    const cleanedUserPhone = userPhone.replace(/[^\d]/g, '');

    // Fetch all group IDs that user is part of
    const groupRes = await fetch(`https://gate.whapi.cloud/groups`, {
      headers: { 'Authorization': `Bearer ${profile.whapi_token}`, 'Content-Type': 'application/json' }
    });
    const groupsData = await groupRes.json();
    const allGroups = Array.isArray(groupsData) ? groupsData : groupsData.groups || groupsData.data || [];

    const groupsToInsert = [];
    let adminCount = 0, totalMembers = 0;

    // Process each group for participant and admin status
    for (const group of allGroups) {
      const details = await fetchGroupDetails(group.id, profile.whapi_token);
      const participants = details?.participants || [];
      const adminsRaw = details?.admins || [];
      const ownerRaw = details?.owner;
      const creatorRaw = details?.creator;
      const groupName = group.name || group.subject || group.id;

      let isAdmin = false;

      // Normalize admins, owner, and creator entries
      const admins = adminsRaw.map(a => typeof a === 'string' ? a : a?.id || a?.phone);
      const owner = typeof ownerRaw === 'string' ? ownerRaw : ownerRaw?.id || ownerRaw?.phone;
      const creator = typeof creatorRaw === 'string' ? creatorRaw : creatorRaw?.id || creatorRaw?.phone;

      // Combine all entities for matching
      const compare = [participants, admins, [owner], [creator]].flat().filter(Boolean);

      for (const member of compare) {
        const phone = typeof member === 'string' ? member : member.id || member.phone;
        const role = (member.rank || member.role || '').toLowerCase();

        if (isPhoneMatch(cleanedUserPhone, phone)) {
          if (
            ['admin', 'creator', 'owner'].includes(role) ||
            admins.some(admin => isPhoneMatch(cleanedUserPhone, admin)) ||
            isPhoneMatch(cleanedUserPhone, owner) ||
            isPhoneMatch(cleanedUserPhone, creator)
          ) {
            isAdmin = true;
            break;
          }
        }
      }

      // Build group object for insertion
      groupsToInsert.push({
        user_id: userId,
        group_id: group.id,
        name: groupName,
        description: group.description || null,
        participants_count: participants.length || details?.size || 0,
        is_admin: isAdmin,
        avatar_url: group.avatar_url || group.picture || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (isAdmin) adminCount++;
      totalMembers += participants.length || 0;
      await new Promise(r => setTimeout(r, 100)); // Rate limit handling
    }

    // Update Supabase with synced groups
    await supabase.from('whatsapp_groups').delete().eq('user_id', userId);
    await supabase.from('whatsapp_groups').insert(groupsToInsert);

    // Return response with summary statistics
    return new Response(JSON.stringify({
      success: true,
      groups_count: groupsToInsert.length,
      admin_groups_count: adminCount,
      member_groups_count: groupsToInsert.length - adminCount,
      total_members: totalMembers,
      user_phone: userPhone,
      message: `Successfully synced ${groupsToInsert.length} groups (${adminCount} admin groups)`
    }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: err.message }), { status: 500, headers: corsHeaders });
  }
});
