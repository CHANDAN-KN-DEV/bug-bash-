import React from 'react';
import { useExam } from '../../context/ExamContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Users,
  Code2,
  ShieldAlert,
  Activity,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Clock,
  Radio,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AdminTab } from './AdminHeader';
import { formatDateTime } from '../../lib/utils';

interface AdminDashboardProps {
  onNavigateTab: (tab: AdminTab) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { rounds, liveRound, students, attempts, submissions, violations } = useExam();

  const inProgressCount = attempts.filter(a => a.status === 'in_progress').length;
  const completedCount = attempts.filter(a => a.status === 'completed').length;
  const terminatedCount = attempts.filter(a => a.status === 'terminated').length;
  const totalSubmissions = submissions.filter(s => s.status === 'submitted').length;

  // Chart data: Solved programs per student
  const studentSolvedData = students.map(st => {
    const solved = submissions.filter(s => s.student_id === st.id && s.status === 'submitted').length;
    return {
      name: st.full_name.split(' ')[0],
      roll_no: st.roll_no,
      solved,
    };
  });

  // Chart data: Attempt status breakdown
  const statusPieData = [
    { name: 'In Progress', value: inProgressCount || 1, color: '#c76596' },
    { name: 'Completed', value: completedCount || 0, color: '#4b946f' },
    { name: 'Terminated', value: terminatedCount || 0, color: '#b94f58' },
    { name: 'Not Started', value: Math.max(0, students.length - inProgressCount - completedCount - terminatedCount), color: '#4b4856' },
  ].filter(d => d.value > 0);

  return (
    <div className="drift-admin-overview space-y-6">
      <section className="drift-admin-overview-hero">
        <img src="/driftlab-jellyfish.svg" alt="" aria-hidden="true" />
        <div>
          <p>BUG BASH ARENA · ADMIN OVERVIEW</p>
          <h1>THE ARENA<br />AT A GLANCE</h1>
          <span>{liveRound ? `${liveRound.name} is live now.` : 'Competition operations and live activity.'}</span>
        </div>
        <span className={`drift-status-pill ${liveRound ? 'is-live' : 'is-idle'}`}>
          <Radio size={14} aria-hidden="true" />
          {liveRound ? `ROUND ${liveRound.round_number} · LIVE` : 'NO LIVE ROUND'}
        </span>
      </section>
      {/* Top Live KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Round */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase text-slate-400">Active Competition</span>
            <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {liveRound ? `Round ${liveRound.round_number}` : 'None Live'}
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              {liveRound ? liveRound.name : 'All rounds paused or draft'}
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Live Candidates */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase text-slate-400">In Arena Now</span>
            <Activity className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {inProgressCount}{' '}
              <span className="text-sm font-normal text-slate-400">/ {students.length} Candidates</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="success" className="text-[10px] py-0">
                {completedCount} Completed
              </Badge>
              {terminatedCount > 0 && (
                <Badge variant="destructive" className="text-[10px] py-0">
                  {terminatedCount} Terminated
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Submissions */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase text-slate-400">Bugs Resolved</span>
            <Code2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{totalSubmissions}</div>
            <p className="text-xs text-slate-400 mt-1">Total code solutions logged</p>
          </CardContent>
        </Card>

        {/* KPI 4: Violations */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase text-slate-400">Security Violations</span>
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">{violations.length}</div>
            <p className="text-xs text-slate-400 mt-1">Tab switches & blur events</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Programs Solved per Candidate */}
        <Card className="lg:col-span-2 border-slate-800 bg-slate-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Programs Solved per Candidate</CardTitle>
                <CardDescription>Live count of resolved bugs across current attempt</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab('results')}
                className="gap-1 text-xs text-indigo-400"
              >
                Leaderboard <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentSolvedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#f3f0ff', borderColor: 'rgba(11,11,16,.2)', borderRadius: '12px', fontSize: '12px', color: '#0b0b10' }}
                    labelStyle={{ color: '#0b0b10', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="solved" fill="#c76596" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Participation & Status Pie */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-base">Candidate Status</CardTitle>
            <CardDescription>Current attempt breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#f3f0ff', borderColor: 'rgba(11,11,16,.2)', borderRadius: '12px', fontSize: '12px', color: '#0b0b10' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-300">
              {statusPieData.map(item => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}:</span>
                  <span className="font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Activity & Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Violations Feed */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                Live Integrity Alerts
              </CardTitle>
              <CardDescription>Recent anti-cheating incidents logged by browser engine</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab('violations')}
              className="gap-1 text-xs text-rose-400"
            >
              All Logs <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {violations.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No integrity violations recorded.</p>
            ) : (
              <div className="space-y-2.5 divide-y divide-slate-800/60">
                {violations.slice(0, 4).map(v => (
                  <div key={v.id} className="pt-2 flex items-start justify-between text-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-white">
                          {v.student_name || 'Candidate'} ({v.student_roll || 'ID'})
                        </p>
                        <p className="text-slate-400 text-[11px]">{v.details}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {formatDateTime(v.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Competition Controls & Jump Links */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-base">Quick Proctor Actions</CardTitle>
            <CardDescription>Direct navigation to essential administration modules</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigateTab('live-monitor')}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900 hover:border-indigo-500/50 hover:bg-indigo-950/20 text-left transition-all"
            >
              <Activity className="h-5 w-5 text-indigo-400 mb-2" />
              <p className="font-bold text-sm text-white">Live Student Monitor</p>
              <p className="text-xs text-slate-400 mt-0.5">Real-time candidate countdowns & re-allow actions</p>
            </button>

            <button
              onClick={() => onNavigateTab('round-controls')}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900 hover:border-amber-500/50 hover:bg-amber-950/20 text-left transition-all"
            >
              <Clock className="h-5 w-5 text-amber-400 mb-2" />
              <p className="font-bold text-sm text-white">Round & Timer Controls</p>
              <p className="text-xs text-slate-400 mt-0.5">Configure 30m limit, start or stop rounds</p>
            </button>

            <button
              onClick={() => onNavigateTab('diff-viewer')}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-left transition-all"
            >
              <Code2 className="h-5 w-5 text-emerald-400 mb-2" />
              <p className="font-bold text-sm text-white">Submission Diff Viewer</p>
              <p className="text-xs text-slate-400 mt-0.5">Side-by-side Monaco code comparisons</p>
            </button>

            <button
              onClick={() => onNavigateTab('assignments')}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900 hover:border-purple-500/50 hover:bg-purple-950/20 text-left transition-all"
            >
              <Users className="h-5 w-5 text-purple-400 mb-2" />
              <p className="font-bold text-sm text-white">Assignment Matrix</p>
              <p className="text-xs text-slate-400 mt-0.5">Bulk random or manual program distribution</p>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
