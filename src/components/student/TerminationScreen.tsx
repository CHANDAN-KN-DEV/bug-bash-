import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowLeft, Clock, FileCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { RoundAttempt, Round } from '../../types';
import { formatFullDateTime } from '../../lib/utils';

interface TerminationScreenProps {
  round: Round;
  attempt: RoundAttempt;
  onReturnDashboard: () => void;
}

export const TerminationScreen: React.FC<TerminationScreenProps> = ({
  round,
  attempt,
  onReturnDashboard,
}) => {
  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-rose-600/40 bg-slate-900/95 p-8 shadow-2xl backdrop-blur-md text-center space-y-6 animate-in zoom-in-95">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <ShieldAlert className="h-10 w-10 animate-bounce" />
        </div>

        <div className="space-y-2">
          <span className="inline-block rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-400 border border-rose-500/30">
            Security Violation Detected
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Round Attempt Terminated
          </h1>
          <p className="text-sm text-slate-300 max-w-md mx-auto">
            Your session for <strong>{round.name}</strong> was locked due to an anti-cheating policy violation.
          </p>
        </div>

        {/* Violation details box */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-left space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Reason</p>
              <p className="text-sm font-medium text-rose-300">
                {attempt.termination_reason || 'Proctor security policy violation'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2 border-t border-slate-800">
            <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400">
              <span>Timestamp: </span>
              <strong className="text-slate-200">{formatFullDateTime(new Date().toISOString())}</strong>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2 border-t border-slate-800">
            <FileCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-300">
              All code drafts autosaved prior to termination have been securely recorded on the server.
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
          If you believe this was triggered in error, please immediately notify the Chief Proctor or Lab Invigilator. The administrator can review the violation log and grant re-entry if permitted.
        </div>

        <Button
          onClick={onReturnDashboard}
          variant="outline"
          className="w-full gap-2 border-slate-700 hover:bg-slate-800 text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Student Dashboard
        </Button>
      </div>
    </div>
  );
};

