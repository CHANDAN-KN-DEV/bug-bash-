import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, KeyRound, Search, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPatch, apiPost, apiRequest } from '../../lib/api';

type Team = { id: string; team_name: string; status: 'active' | 'disabled'; created_at: string; rules_version?: string; rules_accepted_at?: string };
type MongoRegistration = {
  _id: string;
  team_name: string;
  status: 'active' | 'disabled';
  created_at: string;
  rules_version?: string;
  rules_accepted_at?: string;
  members: Array<{
    member_number: number;
    full_name: string;
    class_name: string;
    department: string;
    gmail: string;
  }>;
};
type Program = { id: string; round_id: string; title: string; language: string; buggy_code: string; time_limit_ms: number; memory_limit_kb: number; max_runs: number | null };
type Round = { id: string; name: string; round_number: number };
type Member = { id: string; member_number: number; full_name: string; class: string; department: string; gmail: string };
type Submission = { id: string; program_id: string; code: string; score: number; tests_passed: number; tests_total: number; final_status: string; manual_score: number | null; manual_review_notes: string | null; programs?: Array<{ title: string; buggy_code: string }> };
type TeamRun = { id: string; program_id: string; status: string; time_ms: number | null; memory_kb: number | null; created_at: string };
type Violation = { id: string; violation_type: string; details: string; created_at: string };
type Result = { team_name: string; score: number; rank: number };
type TeamResult = { round_id: string; score: number; programs_solved: number; total_time_ms: number };
type TeamAssignment = { id: string; program_id: string; round_id: string; team_id?: string; student_id?: string };
type TestCase = { id: string; input: string; expected_output: string; is_hidden: boolean; points: number; is_required: boolean };
const adminToken = () => {
  const token = localStorage.getItem('bba_auth_token');
  if (!token) throw new Error('Sign in with a MongoDB admin account and try again.');
  return token;
};

export const TeamAdministration: React.FC = () => {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<MongoRegistration[]>([]);
  const [registrationsError, setRegistrationsError] = useState('');
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [leaderboard, setLeaderboard] = useState<Result[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [teamResults, setTeamResults] = useState<TeamResult[]>([]);
  const [runs, setRuns] = useState<TeamRun[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [sessionPolicy, setSessionPolicy] = useState<'block' | 'takeover'>('block');
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [newCase, setNewCase] = useState({ input: '', expected_output: '', is_hidden: true, is_required: true, points: 1 });
  const [resetPassword, setResetPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadBase = useCallback(async () => {
    if (user?.role !== 'admin') {
      setRegistrationsError('Sign in with a MongoDB admin account to view team administration.');
      setRegistrationsLoading(false);
      return;
    }
    try {
      const token = adminToken();
      const [teamResponse, arenaResponse, boardResponse] = await Promise.all([
        apiGet<{ teams: MongoRegistration[] }>('/admin/teams', token),
        apiGet<{ initialized: boolean; state?: { rounds?: Round[]; programs?: Program[]; settings?: { team_session_policy?: 'block' | 'takeover' } } }>('/admin/arena-state', token),
        apiGet<{ leaderboard: Result[] }>('/admin/leaderboard', token),
      ]);
      const registeredTeams = teamResponse.teams || [];
      setRegistrations(registeredTeams);
      setRegistrationsError('');
      setTeams(registeredTeams.map(team => ({
        id: team._id,
        team_name: team.team_name,
        status: team.status,
        created_at: team.created_at,
        rules_version: team.rules_version,
        rules_accepted_at: team.rules_accepted_at,
      })));
      setLeaderboard(boardResponse.leaderboard || []);
      if (arenaResponse.initialized && arenaResponse.state) {
        setRounds(arenaResponse.state.rounds || []);
        setPrograms(arenaResponse.state.programs || []);
        setSessionPolicy(arenaResponse.state.settings?.team_session_policy || 'block');
      } else {
        setRounds([]);
        setPrograms([]);
        setSessionPolicy('block');
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load MongoDB team administration data.';
      setError(message);
      setRegistrationsError(message);
    } finally {
      setRegistrationsLoading(false);
    }
  }, [user]);

  const loadTeam = useCallback(async (teamId: string) => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await apiGet<{
        members: Member[];
        submissions: Submission[];
        runs: TeamRun[];
        violations: Violation[];
        assignments: TeamAssignment[];
        results: TeamResult[];
      }>(`/admin/teams/${encodeURIComponent(teamId)}`, adminToken());
      setMembers(data.members || []);
      setSubmissions(data.submissions || []);
      setTeamAssignments(data.assignments || []);
      setTeamResults(data.results || []);
      setRuns(data.runs || []);
      setViolations(data.violations || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this team’s details.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTestCases = useCallback(async (programId: string) => {
    setSelectedProgramId(programId);
    if (!programId) {
      setTestCases([]);
      return;
    }
    try {
      const { test_cases: cases } = await apiGet<{ test_cases: TestCase[] }>(
        `/admin/programs/${encodeURIComponent(programId)}/test-cases`,
        adminToken(),
      );
      setTestCases(cases || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load compiler test cases.');
    }
  }, []);

  useEffect(() => { void loadBase(); }, [loadBase]);
  useEffect(() => {
    if (selectedId) void loadTeam(selectedId);
  }, [selectedId, loadTeam]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadBase();
      if (selectedId) void loadTeam(selectedId);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [loadBase, loadTeam, selectedId]);

  const selectedTeam = teams.find(team => team.id === selectedId);
  const visibleTeams = useMemo(() => teams.filter(team =>
    (statusFilter === 'all' || team.status === statusFilter) &&
    team.team_name.toLowerCase().includes(query.trim().toLowerCase())
  ), [teams, query, statusFilter]);
  const selectedProgram = programs.find(program => program.id === selectedProgramId);

  const setTeamStatus = async (team: Team) => {
    setError('');
    const status = team.status === 'active' ? 'disabled' : 'active';
    try {
      await apiPatch(`/admin/teams/${encodeURIComponent(team.id)}/status`, { status }, adminToken());
      setTeams(current => current.map(item => item.id === team.id ? { ...item, status } : item));
      setRegistrations(current => current.map(item => item._id === team.id ? { ...item, status } : item));
      setMessage(`Team ${status}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update team status.');
    }
  };

  const allowReentry = async () => {
    if (!selectedId || !selectedRoundId) return;
    try {
      await apiRequest(`/admin/teams/${encodeURIComponent(selectedId)}/rounds/${encodeURIComponent(selectedRoundId)}/session`, {
        method: 'DELETE',
      }, adminToken());
      setMessage('Active device session released. The team can re-enter while the round is still open.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not release the team session.');
    }
  };

  const assignProgram = async (program: Program) => {
    if (!selectedId) return;
    try {
      await apiPost(`/admin/teams/${encodeURIComponent(selectedId)}/assignments`, { program_id: program.id }, adminToken());
      setMessage(`Assigned ${program.title}.`);
      await loadTeam(selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not assign the program.');
    }
  };

  const saveLimits = async () => {
    if (!selectedProgram) return;
    try {
      await apiPatch(`/admin/programs/${encodeURIComponent(selectedProgram.id)}/limits`, {
        time_limit_ms: selectedProgram.time_limit_ms,
        memory_limit_kb: selectedProgram.memory_limit_kb,
        max_runs: selectedProgram.max_runs,
      }, adminToken());
      setMessage('Compiler limits saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save compiler limits.');
    }
  };

  const addTestCase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProgramId) return;
    try {
      await apiPost(`/admin/programs/${encodeURIComponent(selectedProgramId)}/test-cases`, newCase, adminToken());
      setNewCase({ input: '', expected_output: '', is_hidden: true, is_required: true, points: 1 });
      await loadTestCases(selectedProgramId);
      setMessage('Test case added.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the compiler test case.');
    }
  };

  const removeTestCase = async (id: string) => {
    try {
      await apiRequest(`/admin/test-cases/${encodeURIComponent(id)}`, { method: 'DELETE' }, adminToken());
      await loadTestCases(selectedProgramId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove the test case.');
    }
  };

  const saveReview = async (submission: Submission) => {
    const form = document.getElementById(`review-${submission.id}`) as HTMLFormElement | null;
    if (!form) return;
    const score = Number(new FormData(form).get('manual_score'));
    const notes = String(new FormData(form).get('manual_review_notes') || '');
    if (!Number.isFinite(score) || score < 0) {
      setError('Manual score must be a non-negative number.');
      return;
    }
    try {
      await apiPatch(`/admin/submissions/${encodeURIComponent(submission.id)}/review`, {
        manual_score: score,
        manual_review_notes: notes,
      }, adminToken());
      setMessage('Manual review saved.');
      if (selectedId) await loadTeam(selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the manual review.');
    }
  };

  const resetTeamPassword = async () => {
    if (!selectedId || resetPassword.length < 12) {
      setError('Enter a temporary password of at least 12 characters.');
      return;
    }
    try {
      await apiPatch(`/admin/teams/${encodeURIComponent(selectedId)}/password`, { password: resetPassword }, adminToken());
      setResetPassword('');
      setMessage('Password updated. Share the temporary password with the team through a secure channel.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password reset failed.');
    }
  };

  const exportCsv = () => {
    const rows = [['rank', 'team_name', 'score'], ...leaderboard.map(item => [String(item.rank), item.team_name, String(item.score)])];
    const csv = rows.map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bug-bash-team-leaderboard.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateSessionPolicy = async (policy: 'block' | 'takeover') => {
    try {
      await apiPatch('/admin/arena-settings/team-session-policy', { policy }, adminToken());
      setSessionPolicy(policy);
      setMessage(`New team sessions will ${policy === 'block' ? 'block' : 'take over'} an active device.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the active device policy.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Team operations</p><h1 className="mt-1 text-2xl font-extrabold">Teams & compiler</h1></div>
        <label className="text-xs text-slate-400">Active device policy
          <select value={sessionPolicy} onChange={event => void updateSessionPolicy(event.target.value as 'block' | 'takeover')} className="ml-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="block">Block second device</option><option value="takeover">Allow takeover</option></select>
        </label>
      </header>
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">MongoDB team registrations ({registrations.length})</h2>
            <p className="mt-1 text-xs text-slate-400">Team and member contact details from the registration form.</p>
          </div>
          <p className="text-xs text-slate-500">Passwords are stored as secure hashes and are never displayed.</p>
        </div>
        {registrationsError && <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{registrationsError}</p>}
        {registrationsLoading ? <p className="mt-4 text-sm text-slate-400">Loading registrations…</p> :
          registrations.length === 0 && !registrationsError ? <p className="mt-4 text-sm text-slate-400">No MongoDB team registrations yet.</p> :
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {registrations.map(team => (
              <article key={team._id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{team.team_name}</h3>
                    <p className="mt-1 text-xs text-slate-500">Registered {new Date(team.created_at).toLocaleString()}</p>
                    <p className="mt-1 text-xs text-slate-500">{team.rules_version ? `Rules v${team.rules_version} accepted ${team.rules_accepted_at ? new Date(team.rules_accepted_at).toLocaleString() : ''}` : 'Rules acceptance not recorded'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${team.status === 'active' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{team.status}</span>
                </div>
                <ul className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                  {team.members.map(member => (
                    <li key={`${team._id}-${member.member_number}`} className="text-sm">
                      <p className="font-medium text-slate-200">{member.member_number}. {member.full_name}</p>
                      <p className="text-xs text-slate-400">{member.gmail}</p>
                      <p className="text-xs text-slate-500">{member.class_name} · {member.department}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>}
      </section>
      {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Realtime leaderboard</h2><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800"><Download className="h-4 w-4" />Export CSV</button></div>
        <div className="grid gap-2 sm:grid-cols-3">{leaderboard.slice(0, 3).map(item => <div key={`${item.rank}-${item.team_name}`} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm"><span className="text-slate-400">#{item.rank} · {item.team_name}</span><strong>{item.score}</strong></div>)}</div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-indigo-300" /><h2 className="font-bold">Teams ({teams.length})</h2></div>
          <label className="relative mt-4 block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search team name" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" /></label>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option></select>
          <ul className="mt-3 max-h-[34rem] space-y-1 overflow-y-auto">{visibleTeams.map(team => <li key={team.id}><button onClick={() => { setSelectedId(team.id); setMessage(''); setError(''); }} className={`w-full rounded-lg px-3 py-3 text-left ${selectedId === team.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><span className="flex items-center justify-between gap-2 text-sm font-semibold"><span>{team.team_name}</span><span className={`text-[10px] ${team.status === 'active' ? 'text-emerald-300' : 'text-rose-300'}`}>{team.status}</span></span><span className="mt-1 block truncate text-[10px] opacity-60">{team.id}</span></button></li>)}</ul>
        </section>
        <section className="min-w-0 space-y-5">
          {selectedTeam ? <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div><h2 className="text-lg font-bold">{selectedTeam.team_name}</h2><p className="text-xs text-slate-500">Created {new Date(selectedTeam.created_at).toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{selectedTeam.rules_version ? `Rules version ${selectedTeam.rules_version} · accepted ${selectedTeam.rules_accepted_at ? new Date(selectedTeam.rules_accepted_at).toLocaleString() : 'time not recorded'}` : 'Rules acceptance not recorded'}</p></div>
              <button onClick={() => void setTeamStatus(selectedTeam)} className={`rounded-lg px-3 py-2 text-xs font-bold ${selectedTeam.status === 'active' ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{selectedTeam.status === 'active' ? 'Disable team' : 'Enable team'}</button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="flex items-center gap-2 font-bold"><UserRound className="h-4 w-4 text-indigo-300" />Members</h3>
                <div className="mt-3 space-y-2">{members.map(member => <div key={member.id} className="rounded-lg bg-slate-950 p-3 text-sm"><p className="font-semibold">{member.member_number}. {member.full_name}</p><p className="mt-1 text-xs text-slate-400">{member.class} · {member.department} · {member.gmail}</p></div>)}</div>
              </section>
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="font-bold">Assignments & re-entry</h3>
                <label className="mt-3 block text-xs text-slate-400">Assign program<select onChange={event => { const program = programs.find(item => item.id === event.target.value); if (program) void assignProgram(program); }} value="" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Choose a program…</option>{programs.map(program => <option key={program.id} value={program.id}>{program.title} ({rounds.find(round => round.id === program.round_id)?.name})</option>)}</select></label>
                <label className="mt-3 block text-xs text-slate-400">Allow re-entry for round<select value={selectedRoundId} onChange={event => setSelectedRoundId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Choose a round…</option>{rounds.map(round => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>
                <button onClick={() => void allowReentry()} disabled={!selectedRoundId} className="mt-2 w-full rounded-lg border border-indigo-500/40 px-3 py-2 text-xs font-semibold text-indigo-200 disabled:opacity-40">Release active device session</button>
                <div className="mt-4 border-t border-slate-800 pt-3"><h4 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" />Reset team password</h4><div className="mt-2 flex gap-2"><input type="password" autoComplete="new-password" value={resetPassword} onChange={event => setResetPassword(event.target.value)} placeholder="Temporary password (12+ chars)" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" /><button onClick={() => void resetTeamPassword()} className="rounded-lg bg-indigo-600 px-3 text-xs font-bold">Reset</button></div></div>
              </section>
            </div>
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="font-bold">Assigned programs & round results</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">{teamAssignments.map(item => <li key={item.id} className="rounded bg-slate-950 p-3 text-xs"><span className="font-semibold">{programs.find(program => program.id === item.program_id)?.title || 'Program'}</span><span className="ml-2 text-slate-500">{rounds.find(round => round.id === item.round_id)?.name}</span></li>)}</ul>
              {!teamAssignments.length && <p className="mt-2 text-xs text-slate-500">No assignments.</p>}
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">{teamResults.map(result => <li key={result.round_id} className="flex justify-between rounded bg-slate-950 p-3 text-xs"><span>{rounds.find(round => round.id === result.round_id)?.name || 'Round'}</span><span>{result.programs_solved} solved · {result.score} pts · {result.total_time_ms} ms</span></li>)}</ul>
            </section>
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="font-bold">Submissions & manual review</h3>
              <div className="mt-3 space-y-3">{submissions.map(submission => <article key={submission.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{submission.programs?.[0]?.title || 'Program'}</strong><span className="text-slate-400">{submission.tests_passed}/{submission.tests_total} tests · {submission.score} pts · {submission.final_status}</span></div>
                <details className="mt-2"><summary className="cursor-pointer text-xs text-indigo-300">Review code and original</summary><div className="mt-2 grid gap-2 lg:grid-cols-2"><pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-[11px] text-slate-300">{submission.code}</pre><pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-[11px] text-slate-500">{submission.programs?.[0]?.buggy_code || 'Original source is unavailable.'}</pre></div></details>
                <form id={`review-${submission.id}`} className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_auto]"><label className="text-[10px] text-slate-500">Manual score<input name="manual_score" type="number" min="0" defaultValue={submission.manual_score ?? submission.score} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white" /></label><label className="text-[10px] text-slate-500">Review notes<textarea name="manual_review_notes" defaultValue={submission.manual_review_notes || ''} className="mt-1 min-h-9 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white" /></label><button type="button" onClick={() => void saveReview(submission)} className="self-end rounded bg-indigo-600 px-3 py-2 text-xs font-bold">Save review</button></form>
              </article>)}{!submissions.length && <p className="text-sm text-slate-500">No submissions yet.</p>}</div>
            </section>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-4"><h3 className="font-bold">Recent runs</h3><div className="mt-3 max-h-52 space-y-2 overflow-auto">{runs.map(run => <p key={run.id} className="flex justify-between gap-2 rounded bg-slate-950 p-2 text-xs"><span>{programs.find(program => program.id === run.program_id)?.title} · {run.status}</span><span className="text-slate-500">{run.time_ms ?? '—'}ms / {run.memory_kb ?? '—'}KB</span></p>)}</div></section>
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-4"><h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-amber-300" />Violations</h3><div className="mt-3 max-h-52 space-y-2 overflow-auto">{violations.map(item => <p key={item.id} className="rounded bg-slate-950 p-2 text-xs"><strong>{item.violation_type}</strong><span className="ml-2 text-slate-500">{new Date(item.created_at).toLocaleString()}</span><span className="mt-1 block text-slate-400">{item.details}</span></p>)}</div></section>
            </div>
          </> : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">{loading ? 'Loading…' : 'Select a team to inspect details.'}</div>}
        </section>
      </div>
      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <header><h2 className="font-bold">Compiler configuration</h2><p className="text-xs text-slate-500">Tests are kept in the database; hidden inputs/expected outputs are only read by the execution Edge Function.</p></header>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_140px_130px_auto]">
          <label className="text-xs text-slate-400">Program<select value={selectedProgramId} onChange={event => void loadTestCases(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Select a program…</option>{programs.map(program => <option key={program.id} value={program.id}>{program.title}</option>)}</select></label>
          <label className="text-xs text-slate-400">Time (ms)<input type="number" min={100} max={30000} value={selectedProgram?.time_limit_ms || 2000} onChange={event => selectedProgram && setPrograms(current => current.map(item => item.id === selectedProgram.id ? { ...item, time_limit_ms: Number(event.target.value) } : item))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">Memory (KB)<input type="number" min={16384} max={1048576} value={selectedProgram?.memory_limit_kb || 262144} onChange={event => selectedProgram && setPrograms(current => current.map(item => item.id === selectedProgram.id ? { ...item, memory_limit_kb: Number(event.target.value) } : item))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">Max runs<input type="number" min={1} value={selectedProgram?.max_runs ?? ''} onChange={event => selectedProgram && setPrograms(current => current.map(item => item.id === selectedProgram.id ? { ...item, max_runs: event.target.value ? Number(event.target.value) : null } : item))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" placeholder="Unlimited" /></label>
          <button onClick={() => void saveLimits()} disabled={!selectedProgram} className="self-end rounded-lg border border-indigo-500/40 px-3 py-2 text-xs font-bold text-indigo-200 disabled:opacity-40">Save limits</button>
        </div>
        {selectedProgramId && <form onSubmit={addTestCase} className="grid gap-3 border-t border-slate-800 pt-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">Test input<textarea required value={newCase.input} onChange={event => setNewCase(current => ({ ...current, input: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-white" /></label>
          <label className="text-xs text-slate-400">Expected output<textarea required value={newCase.expected_output} onChange={event => setNewCase(current => ({ ...current, expected_output: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-white" /></label>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300"><label><input type="checkbox" checked={newCase.is_hidden} onChange={event => setNewCase(current => ({ ...current, is_hidden: event.target.checked }))} className="mr-2 accent-indigo-500" />Hidden</label><label><input type="checkbox" checked={newCase.is_required} onChange={event => setNewCase(current => ({ ...current, is_required: event.target.checked }))} className="mr-2 accent-indigo-500" />Required to solve</label><label>Points<input type="number" min={0} value={newCase.points} onChange={event => setNewCase(current => ({ ...current, points: Number(event.target.value) }))} className="ml-2 w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1" /></label></div>
          <button type="submit" className="justify-self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold">Add test case</button>
        </form>}
        {!!testCases.length && <ul className="space-y-2">{testCases.map((test, index) => <li key={test.id} className="flex flex-wrap items-center justify-between gap-3 rounded bg-slate-950 p-3 text-xs"><span>Test {index + 1} · {test.is_hidden ? 'Hidden' : 'Visible'} · {test.is_required ? 'Required' : 'Optional'} · {test.points} pts</span><button onClick={() => void removeTestCase(test.id)} className="text-rose-300 hover:text-rose-200">Remove</button></li>)}</ul>}
      </section>
    </div>
  );
};
