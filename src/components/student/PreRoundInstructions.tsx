import React, { useState } from 'react';
import { Round } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  ShieldAlert,
  Clock,
  Code2,
  Maximize2,
  AlertTriangle,
  Play,
  CheckCircle,
  Eye,
} from 'lucide-react';
import { useExam } from '../../context/ExamContext';
import { useAuth } from '../../context/AuthContext';

interface PreRoundInstructionsProps {
  round: Round;
  onStartRound: () => void;
  onBack: () => void;
}

export const PreRoundInstructions: React.FC<PreRoundInstructionsProps> = ({
  round,
  onStartRound,
  onBack,
}) => {
  const { user } = useAuth();
  const { settings, getAssignedProgramsForStudent } = useExam();
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);

  const assignedPrograms = user ? getAssignedProgramsForStudent(user.id, round.id) : [];

  const handleStart = async () => {
    setStarting(true);
    try {
      if (settings.require_fullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      onStartRound();
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
      // Proceed even if browser blocked fullscreen prompt
      onStartRound();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/40 p-6 sm:p-8 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="purple">Round {round.round_number}</Badge>
              <Badge variant="success">Status: Ready</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {round.name}
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              {round.description}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/80 px-4 py-3 rounded-xl border border-slate-800 shrink-0">
            <div className="flex items-center gap-2 text-indigo-400">
              <Clock className="h-5 w-5" />
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Time Limit</p>
                <p className="text-xl font-bold text-white">{round.duration_minutes} Mins</p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="flex items-center gap-2 text-emerald-400">
              <Code2 className="h-5 w-5" />
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Programs</p>
                <p className="text-xl font-bold text-white">{assignedPrograms.length || 10}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rules and Guidelines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rules Card */}
        <Card className="border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2 text-indigo-400">
              <Code2 className="h-5 w-5" />
              <CardTitle>Competition Rules</CardTitle>
            </div>
            <CardDescription>Carefully review the arena instructions before launching your timer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-emerald-400 mt-1 shrink-0" />
              <span>
                <strong>Independent Timer:</strong> Your personal countdown timer begins only when you click the <em>"Enter Fullscreen & Start Round"</em> button.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-emerald-400 mt-1 shrink-0" />
              <span>
                <strong>Continuous Autosave:</strong> Your draft code is safely autosaved every 3 seconds to the server.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-emerald-400 mt-1 shrink-0" />
              <span>
                <strong>Per-Program Submission:</strong> Click "Submit Program" for each fixed bug. You can re-submit improved solutions until the timer runs out.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-emerald-400 mt-1 shrink-0" />
              <span>
                <strong>Automatic Submission on Expiry:</strong> If time runs out, the server automatically submits your latest drafts.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Security / Anti-Cheating Policy Card */}
        <Card className="border-rose-900/40 bg-gradient-to-b from-rose-950/20 to-slate-900">
          <CardHeader>
            <div className="flex items-center gap-2 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle className="text-rose-200">Anti-Cheating Policy</CardTitle>
            </div>
            <CardDescription className="text-rose-300/70">
              Realtime exam integrity monitoring is active throughout this round.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <Maximize2 className="h-4 w-4 text-rose-400 mt-1 shrink-0" />
              <span>
                <strong>Mandatory Fullscreen:</strong> The exam arena must remain in full screen. Exiting fullscreen logs an immediate security violation.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Eye className="h-4 w-4 text-rose-400 mt-1 shrink-0" />
              <span>
                <strong>Tab & Window Tracking:</strong> Switching browser tabs, minimizing, or losing window focus is detected and logged in real-time.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-1 shrink-0" />
              <span>
                <strong>Termination Policy:</strong> {settings.strict_mode ? 'In strict mode, a single violation terminates your round immediately.' : `You are allowed a maximum of ${settings.max_warnings} warnings before automatic termination.`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation & Launch action */}
      <Card className="border-slate-800 bg-slate-900/40">
        <CardContent className="pt-6 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="h-5 w-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
            />
            <span className="text-sm font-medium text-slate-200">
              I understand and agree to the competition rules and anti-cheating regulations. I am ready to begin.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={onBack} className="text-slate-400 hover:text-white w-full sm:w-auto">
              Return to Dashboard
            </Button>

            <Button
              size="lg"
              disabled={!agreed || starting}
              loading={starting}
              onClick={handleStart}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 px-8 shadow-lg shadow-indigo-600/30"
            >
              <Play className="h-5 w-5 fill-current" />
              Enter Fullscreen & Start Round
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

