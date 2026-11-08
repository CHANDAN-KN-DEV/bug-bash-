import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import {
  ShieldAlert,
  Search,
  RotateCcw,
  AlertTriangle,
  Monitor,
  Maximize2,
  Copy,
  Clock,
} from 'lucide-react';
import { formatFullDateTime } from '../../lib/utils';
import { ViolationType } from '../../types';

export const ViolationLogs: React.FC = () => {
  const { violations, reallowStudent } = useExam();
  const { success } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [reallowModalOpen, setReallowModalOpen] = useState(false);
  const [targetAttemptId, setTargetAttemptId] = useState<string | null>(null);
  const [targetStudentName, setTargetStudentName] = useState<string>('');
  const [extraMinutes, setExtraMinutes] = useState(10);

  const filteredViolations = violations.filter(v => {
    const matchesSearch =
      (v.student_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.student_roll || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.details || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || v.violation_type === filterType;
    return matchesSearch && matchesType;
  });

  const getViolationBadge = (type: ViolationType) => {
    switch (type) {
      case 'tab_switch':
        return (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            <Monitor className="h-3 w-3" />
            Tab Switch
          </Badge>
        );
      case 'window_blur':
        return (
          <Badge variant="warning" className="gap-1 text-[10px]">
            <Monitor className="h-3 w-3" />
            Window Blur
          </Badge>
        );
      case 'fullscreen_exit':
        return (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            <Maximize2 className="h-3 w-3" />
            Fullscreen Exit
          </Badge>
        );
      case 'clipboard_action':
        return (
          <Badge variant="warning" className="gap-1 text-[10px]">
            <Copy className="h-3 w-3" />
            Clipboard Block
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const handleOpenReallow = (attemptId?: string, studentName?: string) => {
    if (!attemptId) return;
    setTargetAttemptId(attemptId);
    setTargetStudentName(studentName || 'Candidate');
    setReallowModalOpen(true);
  };

  const handleConfirmReallow = async () => {
    if (!targetAttemptId) return;
    await reallowStudent(targetAttemptId, extraMinutes);
    success('Candidate Re-Allowed', `${targetStudentName} has been unlocked with +${extraMinutes} mins.`);
    setReallowModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Security & Violation Audit Log</h2>
            <p className="text-xs text-slate-400">
              Audit trail of detected tab switches, window blurs, and fullscreen departures
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Filter by Type */}
          <div className="w-44">
            <Select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              options={[
                { value: 'all', label: 'All Violation Types' },
                { value: 'tab_switch', label: 'Tab Switch' },
                { value: 'window_blur', label: 'Window Blur' },
                { value: 'fullscreen_exit', label: 'Fullscreen Exit' },
                { value: 'clipboard_action', label: 'Clipboard Action' },
              ]}
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

      {/* Violations Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Round</TableHead>
            <TableHead>Violation Type</TableHead>
            <TableHead>Incident Details</TableHead>
            <TableHead>Timestamp</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredViolations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-slate-400 text-xs">
                No security violations found matching filters.
              </TableCell>
            </TableRow>
          ) : (
            filteredViolations.map(v => (
              <TableRow key={v.id}>
                <TableCell>
                  <div>
                    <p className="font-semibold text-white text-sm">
                      {v.student_name || 'Candidate'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">
                      {v.student_roll || 'ID'}
                    </p>
                  </div>
                </TableCell>

                <TableCell className="text-xs text-slate-300">
                  {v.round_name || 'Round 1'}
                </TableCell>

                <TableCell>{getViolationBadge(v.violation_type)}</TableCell>

                <TableCell className="text-xs text-slate-300 max-w-xs truncate">
                  {v.details || 'Integrity anomaly detected'}
                </TableCell>

                <TableCell className="text-xs text-slate-400 font-mono whitespace-nowrap">
                  {formatFullDateTime(v.created_at)}
                </TableCell>

                <TableCell className="text-right">
                  {v.attempt_id && (
                    <Button
                      size="sm"
                      variant="warning"
                      onClick={() => handleOpenReallow(v.attempt_id, v.student_name)}
                      className="gap-1 text-xs h-7 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Re-allow
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* RE-ALLOW MODAL */}
      <Dialog
        open={reallowModalOpen}
        onOpenChange={setReallowModalOpen}
        title="Re-allow Candidate"
        description={`Grant re-entry to ${targetStudentName}.`}
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-slate-300">
              Additional Time (Minutes)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={extraMinutes}
              onChange={e => setExtraMinutes(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setReallowModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
              onClick={handleConfirmReallow}
            >
              Confirm Unlock
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

