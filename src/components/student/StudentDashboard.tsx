import React from 'react';
import { useExam } from '../../context/ExamContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Code2,
  Clock,
  CheckCircle2,
  Lock,
  Play,
  ArrowRight,
  ShieldAlert,
  Award,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { Round } from '../../types';

interface StudentDashboardProps {
  onSelectRound: (round: Round) => void;
  onViewSummary: (round: Round) => void;
  onViewTerminated: (round: Round) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onSelectRound,
  onViewSummary,
  onViewTerminated,
}) => {
  const { user } = useAuth();
  const { rounds, getAttemptForStudent, getAssignedProgramsForStudent, submissions } = useExam();

  const getRoundStatusDetails = (round: Round) => {
    if (!user) return { status: 'locked', label: 'Locked', badgeVariant: 'outline' as const };

    const attempt = getAttemptForStudent(user.id, round.id);

    if (attempt) {
      if (attempt.status === 'completed') {
        return { status: 'completed', label: 'Completed', badgeVariant: 'success' as const };
      }
      if (attempt.status === 'terminated') {
        return { status: 'terminated', label: 'Terminated', badgeVariant: 'destructive' as const };
      }
      if (attempt.status === 'time_over') {
        return { status: 'completed', label: 'Time Over', badgeVariant: 'secondary' as const };
      }
      if (attempt.status === 'in_progress') {
        return { status: 'in_progress', label: 'In Progress', badgeVariant: 'warning' as const };
      }
    }

    if (round.status === 'live') {
      return { status: 'ready', label: 'Live Now', badgeVariant: 'success' as const };
    }
    if (round.status === 'ready') {
      return { status: 'ready', label: 'Ready', badgeVariant: 'warning' as const };
    }
    return { status: 'locked', label: 'Locked by Admin', badgeVariant: 'outline' as const };
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 sm:p-8 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Student Arena Portal
            </span>
            <span className="text-slate-600">•</span>
            <Badge variant="outline" className="font-mono text-xs">
              {user?.roll_no}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome, {user?.full_name}!
          </h1>
          <p className="text-sm text-slate-300 max-w-xl">
            Inspect buggy codebases, diagnose logic traps, and submit fixes against the countdown clock. Each round features an independent timer starting on your command.
          </p>
        </div>

        {/* Global Summary Box */}
        <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8 text-amber-400" />
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">Total Solved</p>
              <p className="text-xl font-bold text-white">
                {submissions.filter(s => s.student_id === user?.id && s.status === 'submitted').length}
                <span className="text-xs text-slate-400 font-normal ml-1">Programs</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rounds Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Code2 className="h-5 w-5 text-indigo-400" />
            Competition Rounds
          </h2>
          <span className="text-xs text-slate-400">3 Structured Rounds</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rounds.map(round => {
            const { status, label, badgeVariant } = getRoundStatusDetails(round);
            const assignedProgs = user ? getAssignedProgramsForStudent(user.id, round.id) : [];
            const attempt = user ? getAttemptForStudent(user.id, round.id) : null;
            const solvedCount = submissions.filter(
              s => s.student_id === user?.id && (attempt ? s.attempt_id === attempt.id : false) && s.status === 'submitted'
            ).length;

            return (
              <Card
                key={round.id}
                className={`flex flex-col justify-between transition-all ${
                  status === 'in_progress'
                    ? 'border-indigo-500/60 bg-indigo-950/20 ring-1 ring-indigo-500/30'
                    : status === 'terminated'
                    ? 'border-rose-900/60 bg-rose-950/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Round {round.round_number}
                    </span>
                    <Badge variant={badgeVariant}>{label}</Badge>
                  </div>
                  <CardTitle className="text-lg">{round.name}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-1">
                    {round.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-indigo-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Time Limit</p>
                        <p className="font-bold text-white">{round.duration_minutes} Mins</p>
                      </div>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Tasks</p>
                        <p className="font-bold text-white">
                          {status === 'completed' || status === 'in_progress'
                            ? `${solvedCount}/${assignedProgs.length || (round.round_number === 1 ? 10 : round.round_number === 2 ? 5 : 2)} Solved`
                            : `${assignedProgs.length || (round.round_number === 1 ? 10 : round.round_number === 2 ? 5 : 2)} Programs`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {status === 'terminated' && (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>Attempt terminated due to security violation.</span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2">
                  {status === 'in_progress' && (
                    <Button
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2"
                      onClick={() => onSelectRound(round)}
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Resume Live Arena
                    </Button>
                  )}

                  {status === 'ready' && (
                    <Button
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 shadow-md shadow-indigo-600/20"
                      onClick={() => onSelectRound(round)}
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Start Round
                    </Button>
                  )}

                  {status === 'completed' && (
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-slate-700 text-slate-200 hover:bg-slate-800"
                      onClick={() => onViewSummary(round)}
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      View Results
                    </Button>
                  )}

                  {status === 'terminated' && (
                    <Button
                      variant="destructive"
                      className="w-full gap-2"
                      onClick={() => onViewTerminated(round)}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Inspect Violation
                    </Button>
                  )}

                  {status === 'locked' && (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full gap-2 border-slate-800 text-slate-500 bg-slate-900/40"
                    >
                      <Lock className="h-4 w-4" />
                      Locked
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Proctoring Notice / Limitations Box */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-xs text-slate-400 space-y-2">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Proctoring Notice & Browser Security Advisory
        </div>
        <p className="leading-relaxed">
          The competition arena operates under strict security integrity rules. Tab switching, loss of focus, and exiting fullscreen are detected in real-time. Code drafts are continuously mirrored to the server. Note that web browser sandboxes cannot detect external hardware, dual-monitor desktop feeds, or secondary devices. Physical proctors monitor laboratory sessions concurrently.
        </p>
      </div>
    </div>
  );
};

