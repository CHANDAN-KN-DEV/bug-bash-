import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, CheckCircle2, Clock, XCircle, ArrowLeft, Award } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Round, RoundAttempt, Program, Submission } from '../../types';
import { calculateTimeTaken } from '../../lib/utils';

interface CompletionSummaryProps {
  round: Round;
  attempt: RoundAttempt;
  programs: Program[];
  submissions: Submission[];
  onReturnDashboard: () => void;
}

export const CompletionSummary: React.FC<CompletionSummaryProps> = ({
  round,
  attempt,
  programs,
  submissions,
  onReturnDashboard,
}) => {
  const solvedCount = submissions.filter(s => s.status === 'submitted').length;
  const totalScore = submissions.reduce((acc, curr) => acc + (curr.score || 10), 0);
  const timeTaken = calculateTimeTaken(attempt.started_at, attempt.completed_at || attempt.ends_at);

  useEffect(() => {
    // Fire celebration confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 space-y-6 animate-in zoom-in-95">
      {/* Hero Card */}
      <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/80 via-slate-900 to-indigo-950/40 p-8 text-center backdrop-blur-md shadow-2xl space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400">
          <Trophy className="h-10 w-10 text-amber-400" />
        </div>

        <div>
          <Badge variant="purple" className="mb-2">Round Concluded</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Congratulations on Completing {round.name}!
          </h1>
          <p className="text-sm text-slate-300 mt-2 max-w-lg mx-auto">
            Your final answers have been securely evaluated and recorded in the competition registry.
          </p>
        </div>

        {/* Stats highlight */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800/80 max-w-lg mx-auto">
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <p className="text-xs uppercase font-semibold text-slate-400">Programs Solved</p>
            <p className="text-2xl font-black text-emerald-400">
              {solvedCount} <span className="text-sm text-slate-400">/ {programs.length}</span>
            </p>
          </div>

          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <p className="text-xs uppercase font-semibold text-slate-400">Total Score</p>
            <p className="text-2xl font-black text-amber-400">
              {totalScore} <span className="text-sm text-slate-400">pts</span>
            </p>
          </div>

          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <p className="text-xs uppercase font-semibold text-slate-400">Time Taken</p>
            <p className="text-2xl font-black text-indigo-400">
              {timeTaken}
            </p>
          </div>
        </div>
      </div>

      {/* Program Breakdown List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-400" />
            Submission Summary
          </h3>
          <span className="text-xs text-slate-400">{solvedCount} of {programs.length} submitted</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {programs.map(prog => {
            const sub = submissions.find(s => s.program_id === prog.id);
            const isSolved = sub && sub.status === 'submitted';

            return (
              <div key={prog.id} className="py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  {isSolved ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-slate-600 shrink-0" />
                  )}
                  <div>
                    <p className={`font-medium ${isSolved ? 'text-white' : 'text-slate-400'}`}>
                      {prog.title}
                    </p>
                    <span className="text-xs text-slate-500 uppercase">{prog.language}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={isSolved ? 'success' : 'outline'} className="text-xs">
                    {isSolved ? 'Submitted' : 'Incomplete'}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-300 w-12 text-right">
                    {isSolved ? `+${sub?.score || prog.points} pts` : '0 pts'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={onReturnDashboard}
          className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};

