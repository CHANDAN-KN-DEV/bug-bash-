import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { RoundStatus, Round } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import {
  Sliders,
  Play,
  Pause,
  CheckCircle,
  Square,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Maximize2,
  Copy,
} from 'lucide-react';

export const RoundControls: React.FC = () => {
  const { rounds, settings, updateRoundStatus, updateRoundDuration, updateSettings } = useExam();
  const { success } = useToast();

  const [durations, setDurations] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    rounds.forEach(r => {
      init[r.id] = r.duration_minutes;
    });
    return init;
  });

  const handleStatusChange = async (round: Round, newStatus: RoundStatus) => {
    await updateRoundStatus(round.id, newStatus);
    success('Round State Updated', `${round.name} is now ${newStatus.toUpperCase()}`);
  };

  const handleDurationSave = async (roundId: string) => {
    const mins = durations[roundId] || 30;
    await updateRoundDuration(roundId, mins);
    success('Duration Updated', `Round duration set to ${mins} minutes.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
          <Sliders className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Round State & Integrity Settings</h2>
          <p className="text-xs text-slate-400">
            Control competition progression, configure countdown time limits, and tune anti-cheating policies
          </p>
        </div>
      </div>

      {/* Rounds Control Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {rounds.map(round => {
          const isLive = round.status === 'live';
          const isCompleted = round.status === 'completed';
          const isReady = round.status === 'ready';
          const isStopped = round.status === 'stopped';

          return (
            <Card
              key={round.id}
              className={`border-slate-800 ${
                isLive
                  ? 'border-indigo-500/50 bg-indigo-950/20 shadow-lg shadow-indigo-600/10'
                  : 'bg-slate-900/50'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="purple">Round {round.round_number}</Badge>
                  <Badge
                    variant={
                      isLive ? 'success' : isReady ? 'warning' : isCompleted ? 'secondary' : 'outline'
                    }
                    className="uppercase font-mono text-[10px]"
                  >
                    {round.status}
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-white mt-1">
                  {round.name}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-2">
                  {round.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Duration Config */}
                <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-indigo-400" />
                      Time Limit (Minutes)
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDurationSave(round.id)}
                      className="h-6 text-[11px] text-indigo-400 hover:text-white px-2"
                    >
                      Save
                    </Button>
                  </div>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={durations[round.id] ?? round.duration_minutes}
                    onChange={e =>
                      setDurations(prev => ({ ...prev, [round.id]: Number(e.target.value) }))
                    }
                    className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* State Transition Actions */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Transition State
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {!isLive ? (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(round, 'live')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Go Live
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="warning"
                        onClick={() => handleStatusChange(round, 'stopped')}
                        className="font-bold text-xs gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950"
                      >
                        <Pause className="h-3.5 w-3.5 fill-current" />
                        Pause/Stop
                      </Button>
                    )}

                    {round.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(round, 'ready')}
                        className="text-xs text-slate-300"
                      >
                        Set Ready
                      </Button>
                    )}

                    {(isLive || isStopped || isReady) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStatusChange(round, 'completed')}
                        className="text-xs gap-1.5"
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        Conclude
                      </Button>
                    )}

                    {isCompleted && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStatusChange(round, 'draft')}
                        className="text-xs text-slate-400"
                      >
                        Reset to Draft
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Global Security / Anti-Cheating Settings */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center gap-2 text-rose-400">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle className="text-base text-white">Anti-Cheating Policy Enforcement</CardTitle>
          </div>
          <CardDescription>
            Configure automatic termination criteria, grace tolerance delays, and clipboard restrictions
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strict Mode vs Warning Mode */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Strict Termination Mode</p>
                  <p className="text-xs text-slate-400">
                    Immediately terminate round attempt on the very first tab-switch or window blur.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.strict_mode}
                  onChange={e => updateSettings({ strict_mode: e.target.checked })}
                  className="h-5 w-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {!settings.strict_mode && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-300">Max Warnings Before Termination:</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={settings.max_warnings}
                    onChange={e => updateSettings({ max_warnings: Number(e.target.value) })}
                    className="h-8 w-20 rounded border border-slate-700 bg-slate-900 px-2 text-center text-white"
                  />
                </div>
              )}
            </div>

            {/* Fullscreen & Clipboard toggles */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Require Mandatory Fullscreen</p>
                  <p className="text-xs text-slate-400">
                    Logs security violation if the student leaves fullscreen mode.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.require_fullscreen}
                  onChange={e => updateSettings({ require_fullscreen: e.target.checked })}
                  className="h-5 w-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Block Copy, Cut & Paste</p>
                  <p className="text-xs text-slate-400">
                    Prevents pasting external code snippets inside the Monaco editor.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.block_copy_paste}
                  onChange={e => updateSettings({ block_copy_paste: e.target.checked })}
                  className="h-5 w-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Grace delay slider */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">False-Positive Grace Delay</p>
              <p className="text-xs text-slate-400">
                Short tolerance (1–3s) allowing students to dismiss transient browser alerts or OS notifications before logging a violation.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={settings.grace_period_seconds}
                onChange={e => updateSettings({ grace_period_seconds: Number(e.target.value) })}
                className="w-32 accent-indigo-500"
              />
              <span className="font-mono text-xs font-bold text-indigo-400 w-12 text-right">
                {settings.grace_period_seconds}s
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

