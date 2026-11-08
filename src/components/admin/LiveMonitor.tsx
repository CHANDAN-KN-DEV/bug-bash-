import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Select } from '../ui/Select';
import { useToast } from '../ui/Toast';
import {
  Activity,
  ShieldAlert,
  Clock,
  RotateCcw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Search,
} from 'lucide-react';
import { formatSeconds, formatDateTime } from '../../lib/utils';
import { Profile } from '../../types';

interface LiveMonitorProps {
  onInspectStudent?: (studentId: string) => void;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({ onInspectStudent }) => {
  const { rounds, liveRound, getStudentProgressList, reallowStudent } = useExam();
  const { success } = useToast();

  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    liveRound?.id || rounds[0]?.id || ''
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [reallowModalOpen, setReallowModalOpen] = useState(false);
  const [targetStudent, setTargetStudent] = useState<{ id: string; name: string; attemptId: string } | null>(null);
  const [extraMinutes, setExtraMinutes] = useState(10);

  const currentRound = rounds.find(r => r.id === selectedRoundId) || liveRound || rounds[0];
  const progressList = getStudentProgressList(currentRound?.id);

  const filteredList = progressList.filter(
    p =>
      p.student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.student.roll_no.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenReallow = (student: Profile, attemptId: string) => {
    setTargetStudent({ id: student.id, name: student.full_name, attemptId });
    setReallowModalOpen(true);
  };

  const handleConfirmReallow = async () => {
    if (!targetStudent?.attemptId) return;
    await reallowStudent(targetStudent.attemptId, extraMinutes);
    success('Student Re-allowed', `${targetStudent.name}'s attempt was unlocked with +${extraMinutes} minutes.`);
    setReallowModalOpen(false);
    setTargetStudent(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Round Filter & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Live Proctor Monitor</h2>
              {currentRound?.status === 'live' && (
                <Badge variant="success" className="gap-1 text-[10px] py-0">
                  <Radio className="h-2.5 w-2.5 animate-pulse" />
                  Live Realtime
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Per-candidate status, countdown clocks, and instant security re-allow controls
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Round Selector */}
          <div className="w-48">
            <Select
              value={selectedRoundId}
              onChange={e => setSelectedRoundId(e.target.value)}
              options={rounds.map(r => ({
                value: r.id,
                label: `Round ${r.round_number}: ${r.status.toUpperCase()}`,
              }))}
            />
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search candidate..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/80 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Realtime Candidate Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Attempt Status</TableHead>
            <TableHead>Programs Solved</TableHead>
            <TableHead>Time Remaining</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead>Violations</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-slate-400 text-xs">
                No candidates found for this round.
              </TableCell>
            </TableRow>
          ) : (
            filteredList.map(prog => {
              const attempt = prog.attempt;
              const status = attempt?.status || 'not_started';
              const isTerminated = status === 'terminated';

              return (
                <TableRow key={prog.student.id}>
                  {/* Candidate Info */}
                  <TableCell>
                    <div>
                      <p className="font-semibold text-white text-sm">{prog.student.full_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{prog.student.roll_no}</p>
                    </div>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell>
                    {status === 'in_progress' && (
                      <Badge variant="warning" className="gap-1 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        In Progress
                      </Badge>
                    )}
                    {status === 'completed' && (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </Badge>
                    )}
                    {status === 'terminated' && (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Terminated
                      </Badge>
                    )}
                    {status === 'time_over' && (
                      <Badge variant="secondary">Time Over</Badge>
                    )}
                    {status === 'not_started' && (
                      <Badge variant="outline">Not Started</Badge>
                    )}
                  </TableCell>

                  {/* Programs Solved */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {prog.submittedCount} / {prog.assignedCount || 10}
                      </span>
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{
                            width: `${Math.round(
                              (prog.submittedCount / Math.max(1, prog.assignedCount || 10)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </TableCell>

                  {/* Time Remaining */}
                  <TableCell>
                    {status === 'in_progress' ? (
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-indigo-300">
                        <Clock className="h-3.5 w-3.5 text-indigo-400" />
                        <span>{formatSeconds(prog.timeRemainingSeconds)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </TableCell>

                  {/* Last Active */}
                  <TableCell className="text-xs text-slate-400">
                    {formatDateTime(prog.lastActive)}
                  </TableCell>

                  {/* Violations Count */}
                  <TableCell>
                    {prog.violationsCount > 0 ? (
                      <Badge variant="destructive" className="font-bold text-xs">
                        {prog.violationsCount} Alert{prog.violationsCount > 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">0</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isTerminated && attempt && (
                        <Button
                          size="sm"
                          variant="warning"
                          onClick={() => handleOpenReallow(prog.student, attempt.id)}
                          className="gap-1 text-xs h-7 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                          title="Re-allow locked student"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Re-allow
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onInspectStudent?.(prog.student.id)}
                        className="gap-1 text-xs h-7 text-indigo-400 hover:text-white"
                        title="View submitted code"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* RE-ALLOW STUDENT MODAL */}
      <Dialog
        open={reallowModalOpen}
        onOpenChange={setReallowModalOpen}
        title="Re-Allow Terminated Candidate"
        description={`Grant re-entry to ${targetStudent?.name} for ${currentRound.name}.`}
      >
        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              This will reset security violation locks for this attempt and allow the candidate to resume coding.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-slate-300">
              Additional Time Allotment (Minutes)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={extraMinutes}
              onChange={e => setExtraMinutes(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400">
              Adds time to their countdown clock from now.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setReallowModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
              onClick={handleConfirmReallow}
            >
              Confirm & Unlock Attempt
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
