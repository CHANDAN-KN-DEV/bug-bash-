import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const normalizedName = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const digest = async (value: string) => {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Invalid team name or password' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) return json({ error: 'Authentication service is unavailable' }, 503);

  let payload: { team_name?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid team name or password' }, 401);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Invalid team name or password' }, 401);
  }
  const teamName = typeof payload.team_name === 'string' ? normalizedName(payload.team_name) : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (!teamName || !password || password.length > 1024) return json({ error: 'Invalid team name or password' }, 401);

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const fingerprints = [await digest(`name:${teamName}`), await digest(`ip:${teamName}:${ip}`)];
  const allowResults = await Promise.all(fingerprints.map(p_fingerprint =>
    service.rpc('allow_team_login', { p_fingerprint })
  ));
  if (allowResults.some(result => result.error)) return json({ error: 'Authentication service is unavailable' }, 503);
  if (allowResults.some(result => !result.data)) return json({ error: 'Invalid team name or password' }, 401);

  const { data: team } = await service.from('teams')
    .select('id,team_name_normalized,status')
    .eq('team_name_normalized', teamName)
    .maybeSingle();
  if (!team || team.status !== 'active') {
    const failureResults = await Promise.all(fingerprints.map(p_fingerprint =>
      service.rpc('record_team_login_failure', { p_fingerprint })
    ));
    if (failureResults.some(result => result.error)) return json({ error: 'Authentication service is unavailable' }, 503);
    return json({ error: 'Invalid team name or password' }, 401);
  }

  const email = `team-${await digest(teamName)}@teams.bugbash.internal`;
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session || data.user.id !== team.id) {
    const failureResults = await Promise.all(fingerprints.map(p_fingerprint =>
      service.rpc('record_team_login_failure', { p_fingerprint })
    ));
    if (failureResults.some(result => result.error)) return json({ error: 'Authentication service is unavailable' }, 503);
    return json({ error: 'Invalid team name or password' }, 401);
  }
  const clearResults = await Promise.all(fingerprints.map(p_fingerprint =>
    service.rpc('clear_team_login_failures', { p_fingerprint })
  ));
  if (clearResults.some(result => result.error)) console.error('Could not clear team login rate-limit counters.');
  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
  });
});
