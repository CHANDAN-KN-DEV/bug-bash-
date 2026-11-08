import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const compilerIds: Record<string, string> = {
  c: 'gcc-15',
  cpp: 'g++-15',
  java: 'openjdk-25',
  python: 'python-3.14',
  python3: 'python-3.14',
  javascript: 'nodejs-24',
};
const truncate = (value: unknown, length = 16000) => typeof value === 'string' ? value.slice(0, length) : '';

type CompilerResponse = {
  output?: string | null;
  error?: string | null;
  status?: string;
  exit_code?: number | null;
  time?: number | string | null;
  memory?: number | string | null;
};
type Program = { id: string; round_id: string; language: string; time_limit_ms: number; memory_limit_kb: number; max_runs: number | null };
type TestCase = { id: string; input: string; expected_output: string; points: number; is_required: boolean; is_hidden: boolean };

const normalizeOutput = (value: string) => value.replace(/\r\n/g, '\n').trimEnd();

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Authentication required' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const onlineCompilerApiKey = Deno.env.get('ONLINECOMPILER_API_KEY');
  if (!url || !serviceKey || !onlineCompilerApiKey) return json({ error: 'Secure execution service is not configured' }, 503);

  let body: { attempt_id?: string; program_id?: string; source_code?: string; stdin?: string; mode?: string; session_id?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid execution request' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Invalid execution request' }, 400);
  }
  const { attempt_id: attemptId, program_id: programId, session_id: sessionId } = body;
  const sourceCode = typeof body.source_code === 'string' ? body.source_code : '';
  const stdin = typeof body.stdin === 'string' ? body.stdin : '';
  const mode = body.mode || 'run';
  if (typeof attemptId !== 'string' || typeof programId !== 'string' || typeof sessionId !== 'string' ||
      !['run', 'submit'].includes(mode) ||
      new TextEncoder().encode(sourceCode).byteLength > 65536 ||
      new TextEncoder().encode(stdin).byteLength > 16384) {
    return json({ error: 'Invalid execution request or code/input size limit exceeded' }, 400);
  }

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await service.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);
  const teamId = authData.user.id;

  const [{ data: team }, { data: attempt }, { data: program }] = await Promise.all([
    service.from('teams').select('id,status').eq('id', teamId).maybeSingle(),
    service.from('round_attempts').select('id,team_id,round_id,ends_at,status').eq('id', attemptId).eq('team_id', teamId).maybeSingle(),
    service.from('programs').select('id,round_id,language,time_limit_ms,memory_limit_kb,max_runs').eq('id', programId).maybeSingle(),
  ]);
  if (!team || team.status !== 'active' || !attempt || !program || attempt.status !== 'in_progress' ||
      Date.parse(attempt.ends_at) <= Date.now() || attempt.round_id !== program.round_id) {
    return json({ error: 'Round is no longer active or the program is unavailable' }, 403);
  }
  const [{ data: liveRound }, { data: assignment }, { data: session }] = await Promise.all([
    service.from('rounds').select('status').eq('id', attempt.round_id).maybeSingle(),
    service.from('assignments').select('id').eq('team_id', teamId).eq('program_id', programId).maybeSingle(),
    service.from('team_sessions').select('session_id,last_seen_at').eq('team_id', teamId).eq('round_id', attempt.round_id).maybeSingle(),
  ]);
  if (liveRound?.status !== 'live' || !assignment || !session || session.session_id !== sessionId ||
      Date.parse(session.last_seen_at) < Date.now() - 60000) {
    return json({ error: 'Round is no longer active or this team session is not authorized' }, 403);
  }
  const compiler = compilerIds[program.language.toLowerCase()];
  if (!compiler) return json({ error: 'This program language is not enabled for secure execution' }, 400);

  let submitTests: TestCase[] = [];
  if (mode === 'submit') {
    const { data: tests, error: testError } = await service.from('test_cases')
      .select('id,input,expected_output,points,is_required,is_hidden')
      .eq('program_id', programId)
      .order('created_at');
    if (testError) return json({ error: 'Test cases could not be loaded' }, 503);
    if (!tests?.length) return json({ error: 'No test cases are configured for this program' }, 400);
    submitTests = tests as TestCase[];
  }

  const { data: runId, error: reserveError } = await service.rpc('reserve_team_code_run', {
    p_team_id: teamId,
    p_attempt_id: attemptId,
    p_program_id: programId,
    p_session_id: sessionId,
    p_source_code: sourceCode,
    p_stdin: stdin,
    p_mode: mode,
  });
  if (reserveError || !runId) return json({ error: reserveError?.message || 'Run limit reached or the round has expired' }, 403);

  const execute = async (input: string): Promise<CompilerResponse> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000);
    try {
      const response = await fetch('https://api.onlinecompiler.io/api/run-code-sync/', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: onlineCompilerApiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          compiler,
          code: sourceCode,
          input,
          time_limit: Math.max(0.1, Math.min(program.time_limit_ms / 1000, 30)),
        }),
      });
      const responseText = await response.text();
      if (new TextEncoder().encode(responseText).byteLength > 256 * 1024) {
        throw new Error('OnlineCompiler response exceeded the size limit');
      }
      const result = JSON.parse(responseText) as CompilerResponse;
      if (!response.ok) throw new Error(`OnlineCompiler request failed (${response.status})`);
      return result;
    } finally {
      clearTimeout(timeout);
    }
  };

  const presentRun = (result: CompilerResponse, passed?: number, total?: number) => ({
    id: runId,
    status: Number(result.exit_code) === 0 ? 'Finished' : 'Error',
    stdout: truncate(result.output),
    stderr: truncate(result.error),
    compile_errors: truncate(result.error),
    time_ms: Math.round((Number.parseFloat(String(result.time || 0)) || 0) * 1000),
    memory_kb: Number.parseInt(String(result.memory || 0), 10) || 0,
    tests_passed: passed,
    tests_total: total,
  });

  try {
    let response: Record<string, unknown>;
    if (mode === 'run') {
      const result = await execute(stdin);
      if (Date.parse(attempt.ends_at) <= Date.now()) {
        await service.from('code_runs').update({ status: 'time_over' }).eq('id', runId);
        return json({ error: 'Round expired before the run completed' }, 403);
      }
      const run = presentRun(result);
      const { error: saveRunError } = await service.from('code_runs').update(run).eq('id', runId);
      if (saveRunError) throw saveRunError;
      response = { run };
    } else {
      const results: Array<Record<string, unknown>> = [];
      let firstVisibleResponse: CompilerResponse | null = null;
      for (const test of submitTests) {
        if (Date.parse(attempt.ends_at) <= Date.now()) {
          const { error: expiryUpdateError } = await service.from('code_runs')
            .update({ status: 'time_over' }).eq('id', runId);
          if (expiryUpdateError) throw expiryUpdateError;
          return json({ error: 'Round expired before submission completed' }, 403);
        }
        const result = await execute(test.input);
        if (!test.is_hidden && !firstVisibleResponse) firstVisibleResponse = result;
        const passed = Number(result.exit_code) === 0 &&
          normalizeOutput(result.output || '') === normalizeOutput(test.expected_output);
        results.push({ test_case_id: test.id, passed, points: test.points, is_required: test.is_required });
      }
      if (Date.parse(attempt.ends_at) <= Date.now()) {
        const { error: expiryUpdateError } = await service.from('code_runs')
          .update({ status: 'time_over' }).eq('id', runId);
        if (expiryUpdateError) throw expiryUpdateError;
        return json({ error: 'Round expired before submission completed' }, 403);
      }
      const passedCount = results.filter(result => result.passed).length;
      const totalCount = results.length;
      const requiredTests = results.filter(result => result.is_required);
      const solved = requiredTests.length > 0 && requiredTests.every(result => result.passed);
      const score = results.reduce((sum, result) => sum + (result.passed ? Number(result.points) : 0), 0);
      const visibleRun = presentRun(firstVisibleResponse || {});
      const run = {
        ...visibleRun,
        status: solved ? 'Accepted' : 'Tests Failed',
        tests_passed: passedCount,
        tests_total: totalCount,
      };
      const { error: saveRunError } = await service.from('code_runs').update(run).eq('id', runId);
      if (saveRunError) throw saveRunError;

      const { error: submissionError } = await service.from('submissions').upsert({
        attempt_id: attemptId,
        program_id: programId,
        student_id: teamId,
        team_id: teamId,
        code: sourceCode,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        score,
        tests_passed: passedCount,
        tests_total: totalCount,
        final_status: solved ? 'solved' : 'incomplete',
      }, { onConflict: 'attempt_id,program_id' });
      if (submissionError) throw submissionError;

      const { data: submissions } = await service.from('submissions')
        .select('score,final_status')
        .eq('team_id', teamId)
        .eq('attempt_id', attemptId);
      const { data: programRuns } = await service.from('code_runs')
        .select('time_ms')
        .eq('team_id', teamId)
        .eq('attempt_id', attemptId);
      const solvedPrograms = (submissions || []).filter(submission => submission.final_status === 'solved').length;
      const totalScore = (submissions || []).reduce((sum, submission) => sum + Number(submission.score || 0), 0);
      const totalTime = (programRuns || []).reduce((sum, item) => sum + Number(item.time_ms || 0), 0);
      const { error: resultError } = await service.from('results').upsert({
        team_id: teamId,
        round_id: attempt.round_id,
        programs_solved: solvedPrograms,
        score: totalScore,
        total_time_ms: totalTime,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'team_id,round_id' });
      if (resultError) throw resultError;
      response = { run, tests_passed: passedCount, tests_total: totalCount, score, final_status: solved ? 'solved' : 'incomplete' };
    }
    return json(response);
  } catch (error) {
    await service.from('code_runs').update({ status: 'engine_error' }).eq('id', runId);
    console.error('OnlineCompiler execution failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'OnlineCompiler could not execute the program. Try again shortly.' }, 502);
  }
});
