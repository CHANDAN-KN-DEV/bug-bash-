import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Password reset service is unavailable' }, 503);

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Administrator access required' }, 401);
  let payload: { team_id?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Invalid request' }, 400);
  }
  if (typeof payload.team_id !== 'string' || typeof payload.password !== 'string' ||
      payload.password.length < 12 || payload.password.length > 128) {
    return json({ error: 'Password must be 12–128 characters' }, 400);
  }

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await service.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Administrator access required' }, 401);
  const { data: profile } = await service.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  if (profile?.role !== 'admin') return json({ error: 'Administrator access required' }, 403);
  const { data: team } = await service.from('teams').select('id').eq('id', payload.team_id).maybeSingle();
  if (!team) return json({ error: 'Team not found' }, 404);
  const { error } = await service.auth.admin.updateUserById(team.id, { password: payload.password });
  if (error) return json({ error: 'Password reset could not be completed' }, 400);
  return json({ reset: true });
});
