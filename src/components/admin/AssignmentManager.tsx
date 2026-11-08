import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { Assignment } from '../../types';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/Table';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import {
  GitBranch,
  Shuffle,
  CheckSquare,
  Square,
  Users,
  Code2,
  Sparkles,
} from 'lucide-react';

export const AssignmentManager: React.FC = () => {
  const { rounds, programs, students, assignments, assignProgramsToStudents, bulkRandomAssign } = useExam();
  const { success } = useToast();

  const [selectedRoundId, setSelectedRoundId] = useState<string>(rounds[0]?.id || '');
  const [randomModalOpen, setRandomModalOpen] = useState(false);
  const [programsCount, setProgramsCount] = useState(5);

  const currentRound = rounds.find(r => r.id === selectedRoundId) || rounds[0];
  const roundPrograms = programs.filter(p => p.round_id === currentRound?.id);

  // Check if a student is assigned to a program
  const isAssigned = (studentId: string, programId: string): boolean => {
    return assignments.some(a => a.student_id === studentId && a.program_id === programId);
  };

  // Toggle single assignment
  const handleToggle = async (studentId: string, programId: string) => {
    let nextAssignments: Assignment[];
    if (isAssigned(studentId, programId)) {
      nextAssignments = assignments.filter(
        a => !(a.student_id === studentId && a.program_id === programId)
      );
    } else {
      nextAssignments = [
        ...assignments,
        {
          id: `assign-${studentId.slice(-4)}-${programId.slice(-4)}-${Date.now()}`,
          student_id: studentId,
          program_id: programId,
          round_id: currentRound.id,
        },
      ];
    }
    await assignProgramsToStudents(nextAssignments);
  };

  // Assign all programs in this round to all students
  const handleAssignAllToAll = async () => {
    const nextAssignments = assignments.filter(a => a.round_id !== currentRound.id);
    students.forEach(st => {
      roundPrograms.forEach(p => {
        nextAssignments.push({
          id: `assign-${st.id.slice(-4)}-${p.id.slice(-4)}-${Date.now()}`,
          student_id: st.id,
          program_id: p.id,
          round_id: currentRound.id,
        });
      });
    });
    await assignProgramsToStudents(nextAssignments);
    success('Assigned All', `All ${roundPrograms.length} programs assigned to all candidates.`);
  };

  // Clear all assignments for this round
  const handleClearAll = async () => {
    const nextAssignments = assignments.filter(a => a.round_id !== currentRound.id);
    await assignProgramsToStudents(nextAssignments);
    success('Cleared Assignments', `All assignments for ${currentRound.name} removed.`);
  };

  // Bulk Random Assignment
  const handleConfirmRandom = async () => {
    await bulkRandomAssign(currentRound.id, programsCount);
    success('Randomized Distribution', `Assigned ${programsCount} random programs to each candidate.`);
    setRandomModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Program Assignment Matrix</h2>
            <p className="text-xs text-slate-400">
              Distribute specific programs to individual candidates manually or via randomized bulk assignment
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Round Selector */}
          <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800">
            {rounds.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRoundId(r.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  selectedRoundId === r.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Round {r.round_number}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAssignAllToAll}
            className="gap-1.5 text-xs text-slate-300"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Assign All
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="gap-1.5 text-xs text-rose-400 hover:text-rose-300"
          >
            <Square className="h-3.5 w-3.5" />
            Clear
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setProgramsCount(Math.min(roundPrograms.length, 5));
              setRandomModalOpen(true);
            }}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Randomize
          </Button>
        </div>
      </div>

      {/* Assignment Matrix Table */}
      <div className="rounded-xl border border-slate-800 overflow-x-auto bg-slate-900/40">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
            <tr>
              <th className="p-3 sticky left-0 bg-slate-950 z-10 w-48 border-r border-slate-800">
                Candidate
              </th>
              {roundPrograms.map((prog, idx) => (
                <th key={prog.id} className="p-3 text-center whitespace-nowrap min-w-[110px]">
                  <div className="font-bold text-slate-200">Task {idx + 1}</div>
                  <span className="text-[10px] text-slate-500 uppercase">{prog.language}</span>
                </th>
              ))}
              <th className="p-3 text-center font-bold text-white border-l border-slate-800">
                Assigned
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {students.map(st => {
              const assignedCount = roundPrograms.filter(p => isAssigned(st.id, p.id)).length;

              return (
                <tr key={st.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 sticky left-0 bg-slate-950/95 z-10 border-r border-slate-800 font-medium text-white">
                    <div>
                      <span className="font-semibold">{st.full_name}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">{st.roll_no}</span>
                    </div>
                  </td>

                  {roundPrograms.map(prog => {
                    const checked = isAssigned(st.id, prog.id);
                    return (
                      <td key={prog.id} className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(st.id, prog.id)}
                          className={`h-6 w-6 rounded-md inline-flex items-center justify-center transition-all ${
                            checked
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-800/80 text-slate-600 hover:bg-slate-700'
                          }`}
                        >
                          {checked && <CheckSquare className="h-4 w-4" />}
                        </button>
                      </td>
                    );
                  })}

                  <td className="p-3 text-center font-bold text-indigo-400 border-l border-slate-800">
                    {assignedCount} / {roundPrograms.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* RANDOM ASSIGNMENT MODAL */}
      <Dialog
        open={randomModalOpen}
        onOpenChange={setRandomModalOpen}
        title="Randomized Program Distribution"
        description={`Randomly distribute a subset of programs to each candidate for ${currentRound.name}.`}
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-slate-300">
              Programs Count per Candidate
            </label>
            <input
              type="number"
              min={1}
              max={roundPrograms.length}
              value={programsCount}
              onChange={e => setProgramsCount(Math.min(roundPrograms.length, Math.max(1, Number(e.target.value))))}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400">
              Available pool: <strong>{roundPrograms.length}</strong> programs in this round.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setRandomModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold" onClick={handleConfirmRandom}>
              Randomize & Apply
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

