import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const internalEmail = async (name: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalize(name)));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return `team-${hash}@teams.bugbash.internal`;
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Registration service is not configured' }, 500);

  let payload: {
    team_name?: string;
    password?: string;
    members?: Array<{ full_name?: string; class_name?: string; department?: string; gmail?: string }>;
  };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Invalid request body' }, 400);
  }

  const teamName = typeof payload.team_name === 'string' ? payload.team_name.trim().replace(/\s+/g, ' ') : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const members = Array.isArray(payload.members) ? payload.members : [];
  if (teamName.length < 3 || teamName.length > 30 || password.length < 8 || password.length > 128 ||
      members.length < 1 || members.length > 2) {
    return json({ error: 'Invalid registration details' }, 400);
  }
  const memberErrors = members.some(member => {
    if (!member || typeof member !== 'object') return true;
    return typeof member.full_name !== 'string' || member.full_name.trim().length < 2 ||
      member.full_name.trim().length > 100 ||
      typeof member.class_name !== 'string' || !member.class_name.trim() || member.class_name.length > 100 ||
      typeof member.department !== 'string' || !member.department.trim() || member.department.length > 100 ||
      typeof member.gmail !== 'string' || member.gmail.length > 254 ||
      !/^[^\s@]+@gmail\.com$/i.test(member.gmail.trim());
  });
  const normalizedGmails = members.map(member =>
    typeof member?.gmail === 'string' ? member.gmail.trim().toLowerCase() : ''
  );
  if (memberErrors || new Set(normalizedGmails).size !== normalizedGmails.length) {
    return json({ error: 'Invalid registration details' }, 400);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: available, error: availabilityError } = await service.rpc('team_name_available', { p_team_name: teamName });
  if (availabilityError) return json({ error: 'Registration service is unavailable' }, 503);
  if (!available) return json({ error: 'Team name already taken' }, 409);

  const email = await internalEmail(teamName);
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: 'team' },
  });
  if (createError || !created.user) {
    return json({ error: 'Registration could not be completed' }, 409);
  }

  const toMemberRecord = (member: NonNullable<typeof payload.members>[number]) => ({
    full_name: member.full_name!.trim(),
    class: member.class_name!.trim(),
    department: member.department!.trim(),
    gmail: member.gmail!.trim().toLowerCase(),
  });

  const { error: insertError } = await service.rpc('register_team_identity', {
    p_user_id: created.user.id,
    p_internal_email: email,
    p_team_name: teamName,
    p_member_1: toMemberRecord(members[0]),
    p_member_2: members[1] ? toMemberRecord(members[1]) : null,
  });

  if (insertError) {
    const { error: rollbackError } = await service.auth.admin.deleteUser(created.user.id);
    if (rollbackError) {
      console.error('Registration rollback could not delete the new Auth identity:', rollbackError.message);
      return json({ error: 'Registration failed; administrator cleanup is required' }, 500);
    }
    const duplicate = /duplicate key|unique constraint/i.test(insertError.message);
    return json({ error: duplicate ? 'Team name or member email already registered' : 'Registration could not be completed' }, duplicate ? 409 : 400);
  }

  return json({ registered: true });
});
