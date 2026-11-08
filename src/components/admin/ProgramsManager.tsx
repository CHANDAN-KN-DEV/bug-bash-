import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useExam } from '../../context/ExamContext';
import { Program, CodeLanguage } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Dialog } from '../ui/Dialog';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { useToast } from '../ui/Toast';
import {
  Code2,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  Layers,
  Upload,
  Download,
} from 'lucide-react';

export const ProgramsManager: React.FC = () => {
  const { rounds, programs, createProgram, updateProgram, deleteProgram } = useExam();
  const { success, error: toastError } = useToast();

  const [selectedRoundId, setSelectedRoundId] = useState<string>(rounds[0]?.id || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<CodeLanguage>('python');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(10);
  const [buggyCode, setBuggyCode] = useState('');
  const [referenceSolution, setReferenceSolution] = useState('');
  const [activeCodeTab, setActiveCodeTab] = useState<'buggy' | 'solution'>('buggy');

  const currentRound = rounds.find(r => r.id === selectedRoundId) || rounds[0];
  const roundPrograms = programs.filter(p => p.round_id === currentRound?.id);

  const handleOpenCreate = () => {
    setEditingProgram(null);
    setTitle('');
    setLanguage('python');
    setDescription('');
    setPoints(10);
    setBuggyCode('# Write buggy starter code here\ndef solve():\n    pass');
    setReferenceSolution('# Write reference solution here\ndef solve():\n    pass');
    setActiveCodeTab('buggy');
    setModalOpen(true);
  };

  const handleOpenEdit = (prog: Program) => {
    setEditingProgram(prog);
    setTitle(prog.title);
    setLanguage(prog.language);
    setDescription(prog.description);
    setPoints(prog.points);
    setBuggyCode(prog.buggy_code);
    setReferenceSolution(prog.reference_solution || '');
    setActiveCodeTab('buggy');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !buggyCode.trim()) {
      toastError('Validation Error', 'Title and Buggy Code are mandatory.');
      return;
    }

    try {
      if (editingProgram) {
        await updateProgram({
          ...editingProgram,
          title,
          language,
          description,
          points,
          buggy_code: buggyCode,
          reference_solution: referenceSolution,
        });
        success('Program Updated', `${title} was updated successfully.`);
      } else {
        await createProgram({
          round_id: currentRound.id,
          title,
          language,
          description,
          points,
          buggy_code: buggyCode,
          reference_solution: referenceSolution,
        });
        success('Program Created', `${title} was added to ${currentRound.name}.`);
      }
      setModalOpen(false);
    } catch (e: any) {
      toastError('Failed to Save', e.message);
    }
  };

  const handleDelete = async (prog: Program) => {
    if (confirm(`Are you sure you want to delete "${prog.title}"?`)) {
      await deleteProgram(prog.id);
      success('Program Deleted', `${prog.title} has been removed.`);
    }
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(roundPrograms, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${currentRound.name.replace(/\s+/g, '_')}_programs.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Code2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Programs & Bug Repository</h2>
            <p className="text-xs text-slate-400">
              Manage buggy source code, descriptions, points, and hidden reference solutions
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Round Selector Tabs */}
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
            onClick={handleExportJson}
            className="gap-1.5 text-xs text-slate-300"
            title="Export Programs JSON"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Program
          </Button>
        </div>
      </div>

      {/* Program Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roundPrograms.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            No programs created for this round yet. Click "Add Program" above.
          </div>
        ) : (
          roundPrograms.map((prog, idx) => (
            <Card key={prog.id} className="border-slate-800 bg-slate-900/50 flex flex-col justify-between hover:border-slate-700 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="purple" className="text-[10px] font-mono">
                    {prog.language.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-bold text-amber-400">{prog.points} Points</span>
                </div>
                <CardTitle className="text-sm font-bold text-white line-clamp-1">
                  {idx + 1}. {prog.title.replace(/^\d+\.\s*/, '')}
                </CardTitle>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                  {prog.description}
                </p>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800/80 font-mono text-[11px] text-slate-300 max-h-24 overflow-hidden relative">
                  <pre className="whitespace-pre-wrap">{prog.buggy_code.slice(0, 140)}...</pre>
                  <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-950 to-transparent" />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Reference Solution Hidden
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(prog)}
                      className="h-7 w-7 text-slate-400 hover:text-white"
                      title="Edit Program"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(prog)}
                      className="h-7 w-7 text-slate-400 hover:text-rose-400"
                      title="Delete Program"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* CREATE / EDIT PROGRAM MODAL WITH MONACO EDITOR */}
      <Dialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingProgram ? 'Edit Buggy Program' : 'Create New Buggy Program'}
        description={`Configure problem statement, code templates, and reference solution for ${currentRound.name}.`}
        className="max-w-4xl max-h-[90vh] flex flex-col"
      >
        <div className="flex-1 overflow-y-auto space-y-4 pt-2 pr-1">
          {/* Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Program Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Binary Search Off-by-One"
              />
            </div>
            <div>
              <Select
                label="Language"
                value={language}
                onChange={e => setLanguage(e.target.value as CodeLanguage)}
                options={[
                  { value: 'c', label: 'C' },
                  { value: 'python', label: 'Python 3' },
                  { value: 'javascript', label: 'JavaScript (Node)' },
                  { value: 'cpp', label: 'C++' },
                  { value: 'java', label: 'Java' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <Input
                label="Bug Description & Objectives"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the defect and what the candidate needs to fix..."
              />
            </div>
            <div>
              <Input
                type="number"
                label="Points"
                value={points}
                onChange={e => setPoints(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Monaco Code Tabs: Buggy Code vs Reference Solution */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center rounded-lg bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('buggy')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold ${
                    activeCodeTab === 'buggy' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Buggy Starter Code (Shown to Candidate)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('solution')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold ${
                    activeCodeTab === 'solution' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Reference Solution (Hidden / Admin Only)
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Language: {language}</span>
            </div>

            <div className="h-64 rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
              {activeCodeTab === 'buggy' ? (
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language={language === 'cpp' ? 'cpp' : language}
                  value={buggyCode}
                  onChange={v => setBuggyCode(v || '')}
                  options={{
                    fontSize: 13,
                    fontFamily: "'Fira Code', Consolas, monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              ) : (
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language={language === 'cpp' ? 'cpp' : language}
                  value={referenceSolution}
                  onChange={v => setReferenceSolution(v || '')}
                  options={{
                    fontSize: 13,
                    fontFamily: "'Fira Code', Consolas, monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-4 shrink-0">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold" onClick={handleSave}>
            Save Program
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
