import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/Table';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import {
  Trophy,
  Download,
  Printer,
  Medal,
  Clock,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { formatDateTime, calculateTimeTaken } from '../../lib/utils';

export const ResultsLeaderboard: React.FC = () => {
  const { students, rounds, attempts, submissions, assignments } = useExam();
  const [selectedRoundId, setSelectedRoundId] = useState<string>(rounds[0]?.id || '');

  const currentRound = rounds.find(r => r.id === selectedRoundId) || rounds[0];

  // Calculate results for all students in this round
  const results = students.map(student => {
    const attempt = attempts.find(a => a.student_id === student.id && a.round_id === currentRound.id);
    const studentSubs = submissions.filter(
      s => s.student_id === student.id && (attempt ? s.attempt_id === attempt.id : true) && s.status === 'submitted'
    );
    const assignedProgs = assignments.filter(a => a.student_id === student.id && a.round_id === currentRound.id);

    const solvedCount = studentSubs.length;
    const score = studentSubs.reduce((acc, curr) => acc + (curr.score || 10), 0);
    const timeTaken = calculateTimeTaken(attempt?.started_at, attempt?.completed_at || attempt?.ends_at);

    // Numeric seconds for sorting (lower is better for ties)
    let totalSecondsTaken = 999999;
    if (attempt?.started_at) {
      const endMs = attempt.completed_at ? new Date(attempt.completed_at).getTime() : Date.now();
      totalSecondsTaken = Math.floor((endMs - new Date(attempt.started_at).getTime()) / 1000);
    }

    return {
      student,
      attempt,
      solvedCount,
      assignedCount: assignedProgs.length || 10,
      score,
      timeTaken,
      totalSecondsTaken,
      startedAt: attempt?.started_at,
      completedAt: attempt?.completed_at,
      status: attempt?.status || 'not_started',
    };
  });

  // Sort by Score descending, then totalSecondsTaken ascending
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.totalSecondsTaken - b.totalSecondsTaken;
  });

  // Export to CSV
  const handleExportCsv = () => {
    const headers = 'Rank,Roll No,Full Name,Email,Score,Solved Programs,Time Taken,Started At,Completed At,Status\n';
    const rows = results
      .map(
        (r, idx) =>
          `${idx + 1},${r.student.roll_no},"${r.student.full_name}",${r.student.email},${r.score},${r.solvedCount}/${r.assignedCount},"${r.timeTaken}","${r.startedAt || '—'}","${r.completedAt || '—'}",${r.status}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bug_bash_leaderboard_round_${currentRound.round_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Results & Official Leaderboard</h2>
            <p className="text-xs text-slate-400">
              Rankings determined by total score (bugs resolved) and completion time
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Round Selector */}
          <div className="w-44">
            <Select
              value={selectedRoundId}
              onChange={e => setSelectedRoundId(e.target.value)}
              options={rounds.map(r => ({
                value: r.id,
                label: `Round ${r.round_number}: ${r.name.slice(0, 16)}...`,
              }))}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs text-slate-300"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </Button>

          <Button
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {results.slice(0, 3).map((r, idx) => {
          const podiumColors = [
            'border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-slate-900', // Gold
            'border-slate-400/50 bg-gradient-to-b from-slate-400/10 to-slate-900', // Silver
            'border-amber-700/50 bg-gradient-to-b from-amber-800/10 to-slate-900', // Bronze
          ];

          const medalIcons = ['🥇 Rank 1', '🥈 Rank 2', '🥉 Rank 3'];

          return (
            <div
              key={r.student.id}
              className={`rounded-xl border p-4 shadow-lg text-center space-y-2 ${podiumColors[idx]}`}
            >
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-slate-300">
                {medalIcons[idx]}
              </span>
              <p className="font-extrabold text-lg text-white">{r.student.full_name}</p>
              <p className="text-xs font-mono text-slate-400">{r.student.roll_no}</p>

              <div className="flex items-center justify-center gap-3 pt-2 text-xs">
                <span className="font-black text-emerald-400 text-sm">{r.score} pts</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300">{r.solvedCount} Solved</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-indigo-300">{r.timeTaken}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Leaderboard Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Candidate</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Programs Solved</TableHead>
            <TableHead>Duration Taken</TableHead>
            <TableHead>Started At</TableHead>
            <TableHead>Completed At</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r, idx) => (
            <TableRow key={r.student.id}>
              <TableCell className="font-bold text-white">
                {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
              </TableCell>

              <TableCell>
                <div>
                  <p className="font-semibold text-white">{r.student.full_name}</p>
                  <p className="text-xs text-slate-400 font-mono">{r.student.roll_no}</p>
                </div>
              </TableCell>

              <TableCell>
                <span className="font-extrabold text-amber-400 text-sm">{r.score} pts</span>
              </TableCell>

              <TableCell>
                <span className="font-semibold text-emerald-400">
                  {r.solvedCount} / {r.assignedCount}
                </span>
              </TableCell>

              <TableCell className="font-mono text-xs text-indigo-300">
                {r.timeTaken}
              </TableCell>

              <TableCell className="text-xs text-slate-400 font-mono">
                {formatDateTime(r.startedAt)}
              </TableCell>

              <TableCell className="text-xs text-slate-400 font-mono">
                {formatDateTime(r.completedAt)}
              </TableCell>

              <TableCell>
                <Badge
                  variant={
                    r.status === 'completed'
                      ? 'success'
                      : r.status === 'in_progress'
                      ? 'warning'
                      : r.status === 'terminated'
                      ? 'destructive'
                      : 'outline'
                  }
                  className="text-[10px] uppercase font-mono"
                >
                  {r.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

