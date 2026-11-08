import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { editor as MonacoEditor } from 'monaco-editor';
import { LogOut, Play, Send, ShieldAlert, TimerReset, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useExamSecurity } from '../../hooks/useExamSecurity';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { registerDriftlabMonacoTheme } from '../../lib/driftlabMonacoTheme';

type RoundRow = { id: string; round_number: number; name: string; description: string; duration_minutes: number; status: string };
type ProgramRow = { id: string; round_id: string; title: string; language: string; description: string; buggy_code: string; points: number; time_limit_ms: number };
type AttemptRow = { id: string; round_id: string; ends_at: string; started_at: string; status: string; warnings_count: number };
type VisibleTestResult = { test_number: number; passed: boolean; expected_output: string; actual_output: string; error: string };
type RunRow = { id: string; status: string; stdout: string | null; stderr: string | null; compile_errors: string | null; time_ms: number | null; memory_kb: number | null; created_at: string; tests_passed?: number; tests_total?: number; visible_test_results?: VisibleTestResult[] };
type ProgramSubmission = { program_id: string; final_status: string; tests_passed: number; tests_total: number; score: number };
type GradingFeedback = { tests_passed: number; tests_total: number; final_status: string; visible_test_results: VisibleTestResult[] };
type MemberRow = { member_number: number; full_name: string; class: string; department: string };

const languageForEditor: Record<string, string> = { c: 'c', cpp: 'cpp', java: 'java', python: 'python', python3: 'python', javascript: 'javascript' };
const errorLine = /(?::|line\s+)(\d+)(?::|\b)/i;

export const TeamDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, ProgramSubmission>>({});
  const [gradingFeedback, setGradingFeedback] = useState<Record<string, GradingFeedback>>({});
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [selectedRound, setSelectedRound] = useState<RoundRow | null>(null);
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<ProgramRow | null>(null);
  const [source, setSource] = useState('');
  const [stdin, setStdin] = useState('');
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [activeOutputTab, setActiveOutputTab] = useState<'output' | 'errors' | 'input'>('output');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<RunRow | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const sessionIdRef = useRef<string>('');
  const finalizedAttemptRef = useRef<string | null>(null);
  const attemptRef = useRef<AttemptRow | null>(null);
  const timerEnabled = Boolean(attempt && attempt.status === 'in_progress' && secondsRemaining > 0);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('bba_auth_token');
      const overview = await apiGet<{
        team: { team_name: string; status: string };
        members: MemberRow[];
        rounds: RoundRow[];
        attempts: AttemptRow[];
      }>('/team/overview', token);
      if (overview.team.status !== 'active') {
        setError('This team account is disabled. Contact an administrator.');
        return;
      }
      setError('');
      setTeamName(overview.team.team_name || user.full_name);
      setMembers(overview.members);
      setRounds(overview.rounds);
      setAttempts(overview.attempts);
      const activeAttempt = attemptRef.current;
      const latestAttempt = overview.attempts.find(row => row.id === activeAttempt?.id);
      if (activeAttempt && latestAttempt && activeAttempt.status !== latestAttempt.status) {
        setSelectedRound(null);
        setAttempt(null);
        sessionIdRef.current = '';
      }
    } catch (cause) {
      console.error('Unable to load team arena from MongoDB:', cause);
      setError(cause instanceof Error
        ? `Unable to load the team arena: ${cause.message}`
        : 'Unable to load the team arena. Check that the MongoDB API is running, then refresh.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { attemptRef.current = attempt; }, [attempt]);
  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => { void refresh(); }, 5000);
    return () => window.clearInterval(interval);
  }, [user, refresh]);

  const openRound = async (round: RoundRow) => {
    void security.enterFullscreen();
    setError('');
    setLoading(true);
    try {
      const token = localStorage.getItem('bba_auth_token');
      const data = await apiGet<{
        round: RoundRow;
        programs: ProgramRow[];
        attempt: AttemptRow | null;
        submissions: ProgramSubmission[];
      }>(
        `/team/rounds/${encodeURIComponent(round.id)}`,
        token,
      );
      const existing = data.attempt || attempts.find(row => row.round_id === round.id) || null;
      setSelectedRound(data.round);
      setAttempt(existing || null);
      if (existing?.status === 'in_progress' && user) {
        const key = `bba-round-session:${user.id}:${round.id}`;
        const sessionId = sessionStorage.getItem(key) || crypto.randomUUID();
        sessionStorage.setItem(key, sessionId);
        sessionIdRef.current = sessionId;
        await apiPost(`/team/rounds/${encodeURIComponent(round.id)}/session`, { session_id: sessionId }, token);
      }
      setPrograms(data.programs);
      setSubmissions(Object.fromEntries(data.submissions.map(row => [row.program_id, row])));
      setGradingFeedback({});
      setSelectedProgram(data.programs[0] || null);
      setSource(data.programs[0]?.buggy_code || '');
      if (existing?.ends_at) setSecondsRemaining(Math.max(0, Math.floor((Date.parse(existing.ends_at) - Date.now()) / 1000)));
    } catch (cause) {
      console.error('Unable to open team round:', cause);
      setError(cause instanceof Error ? cause.message : 'Could not load this round.');
    } finally {
      setLoading(false);
    }
  };

  const beginRound = async () => {
    if (!selectedRound || !user) return;
    void security.enterFullscreen();
    setBusy(true);
    setError('');
    try {
      const key = `bba-round-session:${user.id}:${selectedRound.id}`;
      const sessionId = sessionStorage.getItem(key) || crypto.randomUUID();
      sessionStorage.setItem(key, sessionId);
      sessionIdRef.current = sessionId;
      const token = localStorage.getItem('bba_auth_token');
      const { attempt: started } = await apiPost<{ attempt: AttemptRow }>(
        `/team/rounds/${encodeURIComponent(selectedRound.id)}/start`,
        { session_id: sessionId },
        token,
      );
      setAttempt(started);
      setSecondsRemaining(Math.max(0, Math.floor((Date.parse(started.ends_at) - Date.now()) / 1000)));
      setAttempts(current => [...current.filter(row => row.round_id !== started.round_id), started]);
    } catch (cause) {
      console.error('Could not start team round:', cause);
      setError(cause instanceof Error ? cause.message : 'This round could not be started.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;
    const tick = () => setSecondsRemaining(Math.max(0, Math.floor((Date.parse(attempt.ends_at) - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    const heartbeat = sessionIdRef.current
      ? window.setInterval(() => {
          void apiPost(
            `/team/rounds/${encodeURIComponent(attempt.round_id)}/heartbeat`,
            { session_id: sessionIdRef.current },
            localStorage.getItem('bba_auth_token'),
          ).catch(() => setError('This session is no longer active on this device.'));
        }, 20_000)
      : undefined;
    return () => {
      window.clearInterval(timer);
      if (heartbeat) window.clearInterval(heartbeat);
    };
  }, [attempt]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress' || secondsRemaining > 0 ||
        finalizedAttemptRef.current === attempt.id) return;
    finalizedAttemptRef.current = attempt.id;
    void apiPost<{ attempt: AttemptRow }>(
      `/team/attempts/${encodeURIComponent(attempt.id)}/finalize`,
      {},
      localStorage.getItem('bba_auth_token'),
    ).then(({ attempt: completed }) => {
      if (!completed) {
        setError('Time Over. Some unsaved code may not have been submitted.');
        return;
      }
      setAttempt(completed);
      setAttempts(current => current.map(item => item.id === completed.id ? completed : item));
    }).catch(() => setError('Time Over. Some unsaved code may not have been submitted.'));
  }, [attempt, secondsRemaining]);

  useEffect(() => {
    if (!attempt || !user || !selectedProgram) return;
    let active = true;
    const loadDraftAndRuns = async () => {
      try {
        const workspace = await apiGet<{ draft: { code: string } | null; runs: RunRow[] }>(
          `/team/attempts/${encodeURIComponent(attempt.id)}/programs/${encodeURIComponent(selectedProgram.id)}/workspace?session_id=${encodeURIComponent(sessionIdRef.current)}`,
          localStorage.getItem('bba_auth_token'),
        );
        if (!active) return;
        if (workspace.draft) setSource(workspace.draft.code);
        setRuns(workspace.runs);
      } catch (cause) {
        if (active) {
          console.error('Unable to load saved team work from MongoDB:', cause);
          setError(cause instanceof Error ? cause.message : 'Unable to load saved work.');
        }
      }
    };
    void loadDraftAndRuns();
    return () => {
      active = false;
    };
  }, [attempt, selectedProgram, user]);

  useEffect(() => {
    const activeEditor = editorRef.current;
    const monaco = monacoRef.current;
    const model = activeEditor?.getModel();
    if (!activeEditor || !monaco || !model) return;
    const text = output?.compile_errors || '';
    const match = text.match(errorLine);
    monaco.editor.setModelMarkers(model, 'compiler', match ? [{
      startLineNumber: Number(match[1]),
      endLineNumber: Number(match[1]),
      startColumn: 1,
      endColumn: 1000,
      message: text,
      severity: monaco.MarkerSeverity.Error,
    }] : []);
  }, [output]);

  useEffect(() => {
    if (!attempt || !selectedProgram || !user || attempt.status !== 'in_progress') return;
    const save = window.setTimeout(() => {
      void apiPut(
        `/team/attempts/${encodeURIComponent(attempt.id)}/programs/${encodeURIComponent(selectedProgram.id)}/draft`,
        { code: source, session_id: sessionIdRef.current },
        localStorage.getItem('bba_auth_token'),
      ).catch(saveError => console.error('Team draft autosave to MongoDB failed:', saveError));
    }, 900);
    return () => window.clearTimeout(save);
  }, [attempt, selectedProgram, source, user]);

  const requestRun = async (submit: boolean) => {
    if (!attempt || !selectedProgram || secondsRemaining <= 0) return;
    setBusy(true);
    setError('');
    setOutput(null);
    if (submit) {
      setGradingFeedback(current => {
        const next = { ...current };
        delete next[selectedProgram.id];
        return next;
      });
    }
    try {
      const data = await apiPost<{
        run: RunRow;
        tests_passed?: number;
        tests_total?: number;
        visible_test_results?: VisibleTestResult[];
        final_status?: string;
        score?: number;
        submission_recorded?: boolean;
      }>('/team/execute', {
          attempt_id: attempt.id,
          program_id: selectedProgram.id,
          source_code: source,
          stdin,
          mode: submit ? 'submit' : 'run',
          session_id: sessionIdRef.current,
      }, localStorage.getItem('bba_auth_token'));
      setOutput(data.run);
      setRuns(current => [data.run, ...current.filter(row => row.id !== data.run.id)].slice(0, 10));
      setActiveOutputTab(data.run.compile_errors ? 'errors' : 'output');
      if (submit) {
        const passed = data.tests_passed || 0;
        const total = data.tests_total || 0;
        const finalStatus = data.final_status || 'incomplete';
        setGradingFeedback(current => ({
          ...current,
          [selectedProgram.id]: {
            tests_passed: passed,
            tests_total: total,
            final_status: finalStatus,
            visible_test_results: data.visible_test_results || [],
          },
        }));
        if (data.submission_recorded && finalStatus === 'solved') {
          setSubmissions(current => ({
            ...current,
            [selectedProgram.id]: {
              program_id: selectedProgram.id,
              final_status: finalStatus,
              tests_passed: passed,
              tests_total: total,
              score: data.score || 0,
            },
          }));
        }
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Execution failed';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const onEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerDriftlabMonacoTheme(monaco);
  };

  const security = useExamSecurity({
    isActive: timerEnabled,
    confirmFullscreenExit: true,
    onTerminated: () => {
      setError('The round was terminated after a security violation.');
      if (attempt) {
        void apiPost(
          `/team/attempts/${encodeURIComponent(attempt.id)}/finalize`,
          {},
          localStorage.getItem('bba_auth_token'),
        ).then(() => refresh());
      }
    },
    onDraftSaveNeeded: () => {
      if (attempt && selectedProgram) {
        void apiPut(
          `/team/attempts/${encodeURIComponent(attempt.id)}/programs/${encodeURIComponent(selectedProgram.id)}/draft`,
          { code: source, session_id: sessionIdRef.current },
          localStorage.getItem('bba_auth_token'),
        ).catch(saveError => console.error('Unable to save team draft before termination:', saveError));
      }
    },
  });

  const formattedTime = useMemo(() => `${String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:${String(secondsRemaining % 60).padStart(2, '0')}`, [secondsRemaining]);
  const activePrograms = useMemo(() => programs.filter(program => program.round_id === selectedRound?.id), [programs, selectedRound]);
  const closeRound = () => {
    setSelectedRound(null);
    setAttempt(null);
    setSelectedProgram(null);
  };

  if (loading && rounds.length === 0) return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading team arena…</main>;

  return (
    <main className={`drift-team-dashboard min-h-screen bg-slate-950 text-slate-100 ${selectedRound ? 'is-round' : ''}`}>
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600">{selectedRound ? <img className="drift-round-mark" src="/driftlab-jellyfish.svg" alt="" aria-hidden="true" /> : <Users className="h-5 w-5" />}</span><div><p className="text-sm font-extrabold">BUG BASH <span className="text-indigo-300">ARENA</span></p><p className="text-[11px] text-slate-500">Team portal</p></div></div>
        <div className="flex items-center gap-3"><span className="hidden text-sm font-semibold text-slate-300 sm:block">{teamName}</span><button onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"><LogOut className="h-4 w-4" />Sign out</button></div>
      </header>
      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        {error && <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}
        {!selectedRound ? (
          <div className="space-y-8">
            <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-indigo-950/40 p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Competition workspace</p>
              <h1 className="mt-2 text-3xl font-extrabold">{teamName || 'Your team'}</h1>
              <p className="mt-2 text-sm text-slate-400">Members share the same rounds, timer, code, runs, submissions, and results.</p>
              <div className="mt-5 flex flex-wrap gap-2">{members.map(member => <span key={member.member_number} className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300">{member.full_name} · {member.department}</span>)}</div>
            </section>
            <section>
              <h2 className="mb-4 text-lg font-bold">Competition rounds</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {rounds.map(round => {
                  const saved = attempts.find(row => row.round_id === round.id);
                  return <article key={round.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Round {round.round_number}</p>
                    <h3 className="mt-2 font-bold">{round.name}</h3>
                    <p className="mt-2 min-h-10 text-sm text-slate-400">{round.description}</p>
                    <p className="mt-4 text-xs text-slate-500">{saved?.status ? `Attempt: ${saved.status.replace('_', ' ')}` : `${round.duration_minutes} minutes`}</p>
                    <button onClick={() => void openRound(round)} className="mt-4 w-full rounded-lg border border-indigo-500/50 px-4 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/10">Open round</button>
                  </article>;
                })}
              </div>
            </section>
            {attempts.length > 0 && <section><h2 className="mb-3 text-lg font-bold">Team round history</h2><ul className="space-y-2">{attempts.map(row => <li key={row.id} className="flex justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm"><span>{rounds.find(round => round.id === row.round_id)?.name}</span><span className="text-slate-400">{row.status}</span></li>)}</ul></section>}
          </div>
        ) : !attempt || attempt.status !== 'in_progress' ? (
          <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-7">
            <button onClick={closeRound} className="mb-5 text-sm text-slate-400 hover:text-white">← All rounds</button>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Round {selectedRound.round_number}</p>
            <h1 className="mt-2 text-2xl font-bold">{selectedRound.name}</h1>
            <p className="mt-3 text-sm text-slate-400">{selectedRound.description}</p>
            <p className="mt-5 text-sm text-slate-300">{programs.length} assigned programs · {selectedRound.duration_minutes} minute shared timer</p>
            {attempt && <p className="mt-2 text-xs text-amber-300">{attempt.status === 'time_over' ? 'Time Over — saved drafts were submitted.' : `Previous attempt status: ${attempt.status}. Ask an administrator to allow re-entry.`}</p>}
            <button onClick={() => void beginRound()} disabled={busy || selectedRound.status !== 'live' || Boolean(attempt)} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-bold hover:bg-indigo-500 disabled:opacity-50">{busy ? 'Starting…' : selectedRound.status !== 'live' ? 'Round is not live' : attempt ? 'Attempt already used' : 'Start shared round'}</button>
          </section>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <div><button onClick={closeRound} className="text-xs text-slate-500 hover:text-white">← Rounds</button><h1 className="mt-1 text-sm font-bold">{selectedRound.name} <span className="font-normal text-slate-500">/ {teamName}</span></h1></div>
              <div className={`drift-round-timer flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-lg font-bold ${secondsRemaining <= 60 ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-950 text-emerald-300'}`}><TimerReset className="h-4 w-4" />{formattedTime}</div>
              <button onClick={() => void (security.isFullscreen ? security.exitFullscreen() : security.enterFullscreen())} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">{security.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</button>
            </div>
            {security.warningAlert?.visible && <p role="status" className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200"><ShieldAlert className="h-4 w-4" />{security.warningAlert.message}</p>}
            <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
              <aside className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-3">
                <h2 className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-500">Assigned programs</h2>
                {activePrograms.map(program => {
                  const submission = submissions[program.id];
                  const feedback = gradingFeedback[program.id];
                  const solved = submission?.final_status === 'solved' && !feedback;
                  return <button key={program.id} onClick={() => { setSelectedProgram(program); setSource(program.buggy_code); setOutput(null); }} className={`w-full rounded-lg p-3 text-left text-sm ${selectedProgram?.id === program.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><span className="block font-semibold">{program.title}</span><span className="mt-1 block text-xs opacity-70">{program.points} pts · {program.language}</span>{feedback ? <span className={`mt-2 block text-xs font-semibold ${feedback.final_status === 'solved' ? 'text-emerald-300' : 'text-amber-300'}`}>{feedback.final_status === 'solved' ? 'Corrected' : 'Not submitted · Needs fixes'} · {feedback.tests_passed}/{feedback.tests_total} tests</span> : submission && <span className={`mt-2 block text-xs font-semibold ${solved ? 'text-emerald-300' : 'text-amber-300'}`}>{solved ? 'Corrected' : `Needs fixes · ${submission.tests_passed}/${submission.tests_total} tests`}</span>}</button>;
                })}
                {!activePrograms.length && <p className="p-3 text-sm text-slate-500">No programs are assigned to your team.</p>}
              </aside>
              {selectedProgram && (
                <section className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                  <div className="border-b border-slate-800 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">{selectedProgram.title}</h2><p className="mt-1 text-xs text-slate-400">{selectedProgram.description}</p></div><div className="flex items-center gap-2"><span className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">{selectedProgram.language.toUpperCase()} · locked</span>{gradingFeedback[selectedProgram.id] ? <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${gradingFeedback[selectedProgram.id].final_status === 'solved' ? 'border-emerald-500/30 text-emerald-300' : 'border-amber-500/30 text-amber-300'}`}>{gradingFeedback[selectedProgram.id].final_status === 'solved' ? 'Corrected' : 'Not submitted · Needs fixes'}</span> : submissions[selectedProgram.id]?.final_status === 'solved' && <span className="rounded-md border border-emerald-500/30 px-2 py-1 text-xs font-semibold text-emerald-300">Corrected</span>}</div></div></div>
                  <div className="h-[390px]"><Editor height="100%" language={languageForEditor[selectedProgram.language] || 'plaintext'} value={source} onChange={value => setSource(value || '')} onMount={onEditorMount} theme="driftlab-ink" options={{ readOnly: !timerEnabled || busy, minimap: { enabled: false }, fontSize: 14, automaticLayout: true, scrollBeyondLastLine: false, fontFamily: '"JetBrains Mono", "Fira Code", monospace' }} /></div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 p-3">
                    <button onClick={() => void requestRun(false)} disabled={!timerEnabled || busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-40"><Play className="h-4 w-4" />Run <kbd className="rounded border border-slate-600 px-1 text-[10px]">Ctrl/⌘ Enter</kbd></button>
                    <button onClick={() => void requestRun(true)} disabled={!timerEnabled || busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"><Send className="h-4 w-4" />Submit Program</button>
                    <span className="ml-auto text-xs text-slate-500">Time limit {selectedProgram.time_limit_ms} ms</span>
                  </div>
                  {gradingFeedback[selectedProgram.id] && <section aria-live="polite" className={`border-t p-4 ${gradingFeedback[selectedProgram.id].final_status === 'solved' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
                    <h3 className={`text-sm font-bold ${gradingFeedback[selectedProgram.id].final_status === 'solved' ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {gradingFeedback[selectedProgram.id].final_status === 'solved'
                        ? `Program corrected and submitted · ${gradingFeedback[selectedProgram.id].tests_passed}/${gradingFeedback[selectedProgram.id].tests_total} checks passed`
                        : `Not submitted · ${gradingFeedback[selectedProgram.id].tests_passed}/${gradingFeedback[selectedProgram.id].tests_total} checks passed. Fix the errors below and submit again.`}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {gradingFeedback[selectedProgram.id].visible_test_results.map(test => <article key={test.test_number} className={`rounded-lg border p-3 text-xs ${test.passed ? 'border-emerald-500/20 bg-slate-950/70' : 'border-rose-500/30 bg-slate-950/70'}`}>
                        <p className={`font-semibold ${test.passed ? 'text-emerald-300' : 'text-rose-300'}`}>Visible check {test.test_number}: {test.passed ? 'Passed' : 'Failed'}</p>
                        {!test.passed && <>
                          {test.error && <pre className="mt-2 whitespace-pre-wrap text-rose-200">{test.error}</pre>}
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div><p className="text-slate-500">Expected output</p><pre className="mt-1 whitespace-pre-wrap text-slate-300">{test.expected_output || '(empty)'}</pre></div>
                            <div><p className="text-slate-500">Your output</p><pre className="mt-1 whitespace-pre-wrap text-slate-300">{test.actual_output || '(empty)'}</pre></div>
                          </div>
                          {!test.error && <p className="mt-2 text-rose-200">The output does not match the expected result.</p>}
                        </>}
                      </article>)}
                      {!gradingFeedback[selectedProgram.id].visible_test_results.length && <p className="text-xs text-slate-400">No public check details are available for this result.</p>}
                    </div>
                  </section>}
                  <div className="border-t border-slate-800">
                    <div className="flex gap-1 border-b border-slate-800 px-3 pt-2">
                      {(['output', 'errors', 'input'] as const).map(tab => <button key={tab} onClick={() => setActiveOutputTab(tab)} className={`rounded-t-md px-3 py-2 text-xs font-semibold ${activeOutputTab === tab ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{tab === 'errors' ? 'Compile Errors' : tab[0].toUpperCase() + tab.slice(1)}</button>)}
                      <span className="ml-auto self-center text-[10px] text-slate-500">Last 10 runs</span>
                    </div>
                    {activeOutputTab === 'input' ? <textarea value={stdin} onChange={event => setStdin(event.target.value)} disabled={!timerEnabled} placeholder="Custom standard input…" className="h-28 w-full resize-y bg-slate-950 p-3 font-mono text-xs text-slate-200 outline-none disabled:opacity-50" /> :
                      <div className="min-h-28 max-h-48 overflow-auto bg-slate-950 p-3 font-mono text-xs">
                        {activeOutputTab === 'errors' ? <pre className="whitespace-pre-wrap text-rose-300">{output?.compile_errors || output?.stderr || 'No compile errors.'}</pre> :
                          <><pre className="whitespace-pre-wrap text-slate-200">{output?.stdout || 'Run your program to see output.'}</pre>{output && <p className="mt-3 border-t border-slate-800 pt-2 text-slate-500">Status: {output.status} · {output.time_ms ?? '—'} ms · {output.memory_kb ?? '—'} KB</p>}</>}
                      </div>}
                    {runs.length > 0 && <div className="border-t border-slate-800 px-3 py-2"><div className="flex flex-wrap gap-2">{runs.slice(0, 10).map((run, index) => <button key={run.id} onClick={() => {
                      setOutput(run);
                      setActiveOutputTab(run.compile_errors ? 'errors' : 'output');
                      if (typeof run.tests_passed === 'number' && typeof run.tests_total === 'number') {
                        setGradingFeedback(current => ({
                          ...current,
                          [selectedProgram.id]: {
                            tests_passed: run.tests_passed || 0,
                            tests_total: run.tests_total || 0,
                            final_status: run.status === 'Accepted' ? 'solved' : 'incomplete',
                            visible_test_results: run.visible_test_results || [],
                          },
                        }));
                      }
                    }} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:border-indigo-400">#{index + 1} {run.status}</button>)}</div></div>}
                  </div>
                  <div className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">Code runs through OnlineCompiler.io from the server. The API key is never sent to this browser.</div>
                </section>
              )}
            </div>
            {secondsRemaining === 0 && <p role="status" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">Time Over — run and submit are disabled. Saved drafts remain available to the administrator.</p>}
          </div>
        )}
      </div>
      {security.fullscreenExitPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation">
          <section role="alertdialog" aria-modal="true" aria-labelledby="fullscreen-exit-title" aria-describedby="fullscreen-exit-description" className="w-full max-w-md rounded-xl border border-amber-400/40 bg-slate-900 p-6 shadow-2xl">
            <h2 id="fullscreen-exit-title" className="text-lg font-bold text-amber-200">Exit fullscreen?</h2>
            <p id="fullscreen-exit-description" className="mt-2 text-sm text-slate-300">Leaving fullscreen will record a security warning. You can return to fullscreen or confirm that you want to exit.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => void security.respondToFullscreenExit(false)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Stay fullscreen</button>
              <button onClick={() => void security.respondToFullscreenExit(true)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Exit anyway</button>
            </div>
          </section>
        </div>
      )}
      <KeyboardRunShortcut enabled={timerEnabled && !busy} onRun={() => void requestRun(false)} />
    </main>
  );
};

const KeyboardRunShortcut: React.FC<{ enabled: boolean; onRun: () => void }> = ({ enabled, onRun }) => {
  const onRunRef = useRef(onRun);
  useEffect(() => { onRunRef.current = onRun; }, [onRun]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (enabled && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onRunRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
  return null;
};
