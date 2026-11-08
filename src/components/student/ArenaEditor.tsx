import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  Save,
  HelpCircle,
  Flag,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { Round, RoundAttempt, Program, CodeLanguage } from '../../types';
import { useExam } from '../../context/ExamContext';
import { useAuth } from '../../context/AuthContext';
import { useServerTimer } from '../../hooks/useServerTimer';
import { useExamSecurity } from '../../hooks/useExamSecurity';

interface ArenaEditorProps {
  round: Round;
  attempt: RoundAttempt;
  programs: Program[];
  onFinishRound: () => void;
  onTerminated: () => void;
}

export const ArenaEditor: React.FC<ArenaEditorProps> = ({
  round,
  attempt,
  programs,
  onFinishRound,
  onTerminated,
}) => {
  const { user } = useAuth();
  const { saveDraft, submitProgram, finishRound, drafts, submissions } = useExam();
  const { success, warning, error: toastError } = useToast();

  const [activeProgramIndex, setActiveProgramIndex] = useState(0);
  const activeProgram = programs[activeProgramIndex] || programs[0];

  // Editor code buffer per program: programId -> code
  const [codeBuffers, setCodeBuffers] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [showDescription, setShowDescription] = useState(true);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [timeOverModalOpen, setTimeOverModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Initialize code buffers from submissions or drafts or original buggy code
  useEffect(() => {
    const initialBuffers: Record<string, string> = {};
    programs.forEach(prog => {
      // 1. check submission
      const sub = submissions.find(s => s.attempt_id === attempt.id && s.program_id === prog.id);
      if (sub) {
        initialBuffers[prog.id] = sub.code;
        return;
      }
      // 2. check draft
      const draft = drafts.find(d => d.attempt_id === attempt.id && d.program_id === prog.id);
      if (draft) {
        initialBuffers[prog.id] = draft.code;
        return;
      }
      // 3. fallback to buggy code
      initialBuffers[prog.id] = prog.buggy_code;
    });
    setCodeBuffers(initialBuffers);
  }, [programs, attempt.id, submissions, drafts]);

  const currentCode = codeBuffers[activeProgram?.id] ?? activeProgram?.buggy_code ?? '';

  // Timer Hook (Source of truth: attempt.ends_at)
  const handleTimeExpired = useCallback(async () => {
    setTimeOverModalOpen(true);
    // Auto submit all current drafts
    for (const prog of programs) {
      const code = codeBuffers[prog.id];
      if (code) {
        await saveDraft(attempt.id, prog.id, code);
      }
    }
  }, [attempt.id, programs, codeBuffers, saveDraft]);

  const { formattedTime, isExpired, timerStatus } = useServerTimer({
    endsAt: attempt.ends_at,
    onTimeExpired: handleTimeExpired,
    enabled: attempt.status === 'in_progress',
  });

  // Security Hook
  const { isFullscreen, enterFullscreen, exitFullscreen, warningAlert } = useExamSecurity({
    isActive: attempt.status === 'in_progress' && !isExpired,
    onTerminated,
    onDraftSaveNeeded: () => {
      if (activeProgram && currentCode) {
        saveDraft(attempt.id, activeProgram.id, currentCode);
      }
    },
  });

  // Debounced Autosave (saves 3s after typing)
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCodeChange = (newVal: string | undefined) => {
    if (newVal === undefined || isExpired) return;

    setCodeBuffers(prev => ({ ...prev, [activeProgram.id]: newVal }));
    setSaveStatus('dirty');

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await saveDraft(attempt.id, activeProgram.id, newVal);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('dirty');
      }
    }, 2500);
  };

  // Submit current program
  const handleSubmitCurrent = async () => {
    if (!activeProgram || submitting || isExpired) return;
    setSubmitting(true);
    try {
      const res = await submitProgram(attempt.id, activeProgram.id, currentCode);
      if (res.success) {
        success('Program Submitted', `${activeProgram.title} solution recorded successfully!`);
      } else {
        toastError('Submission Failed', res.error || 'Could not submit');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Reset to original buggy code
  const handleResetBuggy = () => {
    if (!activeProgram) return;
    setCodeBuffers(prev => ({ ...prev, [activeProgram.id]: activeProgram.buggy_code }));
    saveDraft(attempt.id, activeProgram.id, activeProgram.buggy_code);
    setResetModalOpen(false);
    warning('Code Reset', 'Restored to original buggy code template.');
  };

  // Explicit Finish Round
  const handleConfirmFinish = async () => {
    setFinishModalOpen(false);
    await finishRound(attempt.id);
    onFinishRound();
  };

  // Map language to Monaco language id
  const getMonacoLanguage = (lang: CodeLanguage): string => {
    switch (lang) {
      case 'c':
        return 'c';
      case 'python':
        return 'python';
      case 'javascript':
        return 'javascript';
      case 'cpp':
        return 'cpp';
      case 'java':
        return 'java';
      default:
        return 'plaintext';
    }
  };

  // Program status helper
  const getProgramStatus = (progId: string): 'submitted' | 'in_progress' | 'not_started' => {
    const sub = submissions.find(s => s.attempt_id === attempt.id && s.program_id === progId);
    if (sub) return 'submitted';
    const draft = drafts.find(d => d.attempt_id === attempt.id && d.program_id === progId);
    if (draft && draft.code !== programs.find(p => p.id === progId)?.buggy_code) return 'in_progress';
    if (codeBuffers[progId] && codeBuffers[progId] !== programs.find(p => p.id === progId)?.buggy_code) {
      return 'in_progress';
    }
    return 'not_started';
  };

  const solvedCount = programs.filter(p => getProgramStatus(p.id) === 'submitted').length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden select-none">
      {/* ARENA TOP BAR */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-slate-100 shrink-0">
        {/* Left: Round & Student info */}
        <div className="flex items-center gap-3">
          <Badge variant="purple" className="font-bold">
            Round {round.round_number}
          </Badge>
          <span className="font-semibold text-sm hidden md:inline text-white truncate max-w-xs">
            {round.name}
          </span>
          <div className="h-4 w-px bg-slate-800 hidden md:block" />
          <span className="text-xs text-slate-400 hidden lg:inline">
            Candidate: <strong>{user?.roll_no}</strong> ({user?.full_name})
          </span>
        </div>

        {/* Center: Large Countdown Timer */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border font-mono font-bold tracking-wider text-base sm:text-lg shadow-inner ${
              timerStatus === 'danger'
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                : timerStatus === 'warning'
                ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                : 'bg-slate-950/80 border-indigo-500/40 text-indigo-200'
            }`}
          >
            <Clock className={`h-4 w-4 ${timerStatus === 'danger' ? 'text-rose-400' : 'text-indigo-400'}`} />
            <span>{formattedTime}</span>
          </div>

          {/* Autosave Status */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 ml-2">
            <Save className={`h-3.5 w-3.5 ${saveStatus === 'saving' ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
            <span>
              {saveStatus === 'saving' ? 'Autosaving...' : saveStatus === 'dirty' ? 'Unsaved' : 'Autosaved'}
            </span>
          </div>
        </div>

        {/* Right: Progress, Fullscreen & Finish button */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-slate-400">Solved:</span>
            <span className="font-bold text-emerald-400">{solvedCount} / {programs.length}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            className="text-slate-400 hover:text-white"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setFinishModalOpen(true)}
            className="gap-1.5 font-bold"
          >
            <Flag className="h-3.5 w-3.5" />
            Finish Round
          </Button>
        </div>
      </div>

      {/* Floating Warning Alert Banner if temporary warning occurred */}
      {warningAlert?.visible && (
        <div className="bg-amber-500/90 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{warningAlert.message}</span>
          </div>
        </div>
      )}

      {/* MAIN ARENA WORKSPACE (SIDEBAR + EDITOR) */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR: PROGRAM LIST */}
        <div className="w-64 sm:w-72 border-r border-slate-800 bg-slate-900/90 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs uppercase font-bold tracking-wider text-slate-400">
            <span>Assigned Tasks</span>
            <span className="text-[11px] text-indigo-400">{programs.length} Programs</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
            {programs.map((prog, idx) => {
              const status = getProgramStatus(prog.id);
              const isSelected = idx === activeProgramIndex;

              return (
                <button
                  key={prog.id}
                  onClick={() => setActiveProgramIndex(idx)}
                  className={`w-full text-left p-2.5 rounded-lg transition-all flex flex-col gap-1 border ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-sm'
                      : 'border-transparent hover:bg-slate-800/70 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate max-w-[170px]">
                      {idx + 1}. {prog.title.replace(/^\d+\.\s*/, '')}
                    </span>
                    {status === 'submitted' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : status === 'in_progress' ? (
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" title="Draft in progress" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-slate-600 shrink-0" title="Not started" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="uppercase text-slate-400 font-mono">{prog.language}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-amber-400/90">{prog.points} pts</span>
                    <span className="text-slate-600">•</span>
                    <span className={status === 'submitted' ? 'text-emerald-400' : 'text-slate-400'}>
                      {status === 'submitted' ? 'Submitted' : status === 'in_progress' ? 'Draft' : 'New'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sidebar Footer Stats */}
          <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between items-center bg-slate-950/40">
            <span>Overall Progress</span>
            <span className="font-bold text-white">
              {Math.round((solvedCount / Math.max(1, programs.length)) * 100)}%
            </span>
          </div>
        </div>

        {/* RIGHT AREA: PROBLEM DESCRIPTION + MONACO CODE EDITOR */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {/* Active Program Toolbar */}
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm text-white">
                {activeProgramIndex + 1}. {activeProgram?.title.replace(/^\d+\.\s*/, '')}
              </span>
              <Badge variant="outline" className="font-mono uppercase text-[10px]">
                {activeProgram?.language}
              </Badge>
              <Badge variant="purple" className="text-[10px]">
                {activeProgram?.points} Points
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDescription(prev => !prev)}
                className="gap-1 text-slate-300 hover:text-white text-xs h-7"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {showDescription ? 'Hide Clues' : 'Show Clues'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetModalOpen(true)}
                className="gap-1 text-slate-300 hover:text-rose-400 text-xs h-7"
                title="Reset to original buggy template"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset Code
              </Button>

              <Button
                variant="success"
                size="sm"
                onClick={handleSubmitCurrent}
                loading={submitting}
                disabled={isExpired}
                className="gap-1 text-xs h-7 font-bold px-3 shadow-md shadow-emerald-600/20"
              >
                <Send className="h-3.5 w-3.5" />
                Submit Program
              </Button>
            </div>
          </div>

          {/* Collapsible Problem Description & Clues Drawer */}
          {showDescription && (
            <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-800 text-xs text-slate-300 flex items-start gap-3 shrink-0">
              <div className="h-6 w-6 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <HelpCircle className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-white">Bug Diagnosis & Objective:</p>
                <p className="text-slate-300 leading-relaxed font-sans">{activeProgram?.description}</p>
              </div>
            </div>
          )}

          {/* Monaco Code Editor Workspace */}
          <div className="flex-1 relative overflow-hidden">
            <Editor
              height="100%"
              theme="vs-dark"
              language={getMonacoLanguage(activeProgram?.language || 'python')}
              value={currentCode}
              onChange={handleCodeChange}
              options={{
                fontSize: 14,
                fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
                fontLigatures: true,
                tabSize: 4,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                lineNumbers: 'on',
                readOnly: isExpired || attempt.status !== 'in_progress',
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
        </div>
      </div>

      {/* CONFIRM FINISH ROUND MODAL */}
      <Dialog
        open={finishModalOpen}
        onOpenChange={setFinishModalOpen}
        title="Finish This Round?"
        description="Are you sure you want to conclude your attempt for this round?"
      >
        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Programs Submitted:</span>
              <strong className="text-emerald-400">{solvedCount} of {programs.length}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Unsubmitted Programs:</span>
              <strong className="text-amber-400">{programs.length - solvedCount} remaining</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Time Remaining:</span>
              <strong className="text-indigo-400">{formattedTime}</strong>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Once submitted, your final score and completion time will be locked, and you cannot re-enter this round.
          </p>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setFinishModalOpen(false)}>
              Keep Working
            </Button>
            <Button variant="destructive" onClick={handleConfirmFinish}>
              Yes, Finish Round
            </Button>
          </div>
        </div>
      </Dialog>

      {/* RESET CODE CONFIRMATION MODAL */}
      <Dialog
        open={resetModalOpen}
        onOpenChange={setResetModalOpen}
        title="Reset to Buggy Code?"
        description="This will overwrite your current changes with the original buggy source code."
      >
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={() => setResetModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleResetBuggy}>
            Yes, Reset Code
          </Button>
        </div>
      </Dialog>

      {/* TIME EXPIRED MODAL */}
      <Dialog
        open={timeOverModalOpen}
        onOpenChange={setTimeOverModalOpen}
        title="Time Limit Reached!"
        description="The countdown timer for this round has ended."
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-300">
            The server has locked the code editor and automatically recorded all your saved drafts.
          </p>
          <div className="flex justify-end">
            <Button
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
              onClick={() => {
                setTimeOverModalOpen(false);
                onFinishRound();
              }}
            >
              View Results Summary
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
