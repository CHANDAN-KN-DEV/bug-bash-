import React, { useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useExam } from '../../context/ExamContext';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import {
  FileCode,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Award,
  Sparkles,
} from 'lucide-react';
import { formatDateTime } from '../../lib/utils';

interface SubmissionDiffViewerProps {
  initialStudentId?: string;
}

export const SubmissionDiffViewer: React.FC<SubmissionDiffViewerProps> = ({
  initialStudentId,
}) => {
  const { students, rounds, programs, submissions, attempts } = useExam();

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || students[0]?.id || ''
  );
  const [selectedRoundId, setSelectedRoundId] = useState<string>(rounds[0]?.id || '');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [diffMode, setDiffMode] = useState<'buggy' | 'reference'>('buggy');

  const roundPrograms = programs.filter(p => p.round_id === selectedRoundId);

  // Auto-select first program when round changes
  useEffect(() => {
    if (roundPrograms.length > 0 && !roundPrograms.some(p => p.id === selectedProgramId)) {
      setSelectedProgramId(roundPrograms[0].id);
    }
  }, [selectedRoundId, roundPrograms, selectedProgramId]);

  const activeProgram = programs.find(p => p.id === selectedProgramId) || roundPrograms[0];
  const activeStudent = students.find(s => s.id === selectedStudentId) || students[0];

  // Find student's submission for this program
  const currentSubmission = submissions.find(
    s => s.student_id === selectedStudentId && s.program_id === activeProgram?.id
  );

  const studentCode = currentSubmission?.code || '// No code submitted yet for this program.';
  const buggyCode = activeProgram?.buggy_code || '';
  const referenceSolution = activeProgram?.reference_solution || '// Reference solution not provided.';

  const originalValue = diffMode === 'buggy' ? buggyCode : referenceSolution;
  const originalTitle = diffMode === 'buggy' ? 'Original Buggy Code' : 'Hidden Reference Solution';

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <FileCode className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Submission Diff Viewer</h2>
            <p className="text-xs text-slate-400">
              Side-by-side Monaco code comparison against buggy baseline and reference solution
            </p>
          </div>
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full lg:w-auto">
          {/* Candidate selector */}
          <div className="w-full sm:w-48">
            <Select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              options={students.map(s => ({
                value: s.id,
                label: `${s.roll_no}: ${s.full_name.split(' ')[0]}`,
              }))}
            />
          </div>

          {/* Round selector */}
          <div className="w-full sm:w-40">
            <Select
              value={selectedRoundId}
              onChange={e => setSelectedRoundId(e.target.value)}
              options={rounds.map(r => ({
                value: r.id,
                label: `Round ${r.round_number}`,
              }))}
            />
          </div>

          {/* Program selector */}
          <div className="w-full sm:w-56">
            <Select
              value={selectedProgramId}
              onChange={e => setSelectedProgramId(e.target.value)}
              options={roundPrograms.map((p, idx) => ({
                value: p.id,
                label: `${idx + 1}. ${p.title.replace(/^\d+\.\s*/, '')}`,
              }))}
            />
          </div>
        </div>
      </div>

      {/* Diff Workspace Card */}
      <Card className="border-slate-800 bg-slate-900/40">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="purple" className="font-mono text-[10px] uppercase">
                {activeProgram?.language}
              </Badge>
              <span className="text-xs font-semibold text-slate-400">
                Candidate: <strong className="text-white">{activeStudent?.full_name}</strong> ({activeStudent?.roll_no})
              </span>
            </div>
            <CardTitle className="text-base font-bold text-white">
              {activeProgram?.title}
            </CardTitle>
          </div>

          <div className="flex items-center gap-3">
            {/* Diff mode switcher buttons */}
            <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                onClick={() => setDiffMode('buggy')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  diffMode === 'buggy' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                vs Original Buggy Code
              </button>
              <button
                onClick={() => setDiffMode('reference')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  diffMode === 'reference' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                vs Reference Solution
              </button>
            </div>

            {/* Submission Status Pill */}
            {currentSubmission ? (
              <Badge variant="success" className="gap-1 py-1">
                <CheckCircle2 className="h-3 w-3" />
                Submitted (+{currentSubmission.score || activeProgram?.points} pts)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-400 py-1">
                Not Submitted
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Sub-header labels for Diff sides */}
          <div className="grid grid-cols-2 bg-slate-950/80 px-4 py-2 border-b border-slate-800 text-xs font-mono font-semibold text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              <span>{originalTitle} (Left)</span>
            </div>
            <div className="flex items-center gap-2 pl-4 border-l border-slate-800">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span className="text-indigo-300 font-bold">
                Student Submitted Code ({activeStudent?.roll_no})
              </span>
              {currentSubmission?.submitted_at && (
                <span className="text-[10px] text-slate-500 font-normal ml-auto">
                  Submitted at: {formatDateTime(currentSubmission.submitted_at)}
                </span>
              )}
            </div>
          </div>

          {/* Monaco Side-by-Side Diff Editor */}
          <div className="h-[480px] w-full bg-slate-950">
            <DiffEditor
              height="100%"
              theme="vs-dark"
              language={activeProgram?.language === 'cpp' ? 'cpp' : activeProgram?.language || 'python'}
              original={originalValue}
              modified={studentCode}
              options={{
                fontSize: 13,
                fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
                readOnly: true,
                renderSideBySide: true,
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                diffWordWrap: 'on',
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

