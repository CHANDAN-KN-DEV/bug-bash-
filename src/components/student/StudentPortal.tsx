import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useExam } from '../../context/ExamContext';
import { Round, RoundAttempt } from '../../types';
import { StudentDashboard } from './StudentDashboard';
import { PreRoundInstructions } from './PreRoundInstructions';
import { ArenaEditor } from './ArenaEditor';
import { CompletionSummary } from './CompletionSummary';
import { TerminationScreen } from './TerminationScreen';
import { useToast } from '../ui/Toast';

type StudentView = 'dashboard' | 'instructions' | 'arena' | 'summary' | 'terminated';

export const StudentPortal: React.FC = () => {
  const { user } = useAuth();
  const {
    startRoundAttempt,
    getAttemptForStudent,
    getAssignedProgramsForStudent,
    submissions,
  } = useExam();
  const { error: toastError } = useToast();

  const [currentView, setCurrentView] = useState<StudentView>('dashboard');
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);

  const activeAttempt: RoundAttempt | null =
    user && selectedRound ? getAttemptForStudent(user.id, selectedRound.id) || null : null;

  const assignedPrograms =
    user && selectedRound ? getAssignedProgramsForStudent(user.id, selectedRound.id) : [];

  const studentSubmissions =
    user && activeAttempt
      ? submissions.filter(s => s.student_id === user.id && s.attempt_id === activeAttempt.id)
      : [];

  const handleSelectRound = (round: Round) => {
    setSelectedRound(round);
    const existing = user ? getAttemptForStudent(user.id, round.id) : null;

    if (existing?.status === 'in_progress') {
      setCurrentView('arena');
    } else if (existing?.status === 'completed' || existing?.status === 'time_over') {
      setCurrentView('summary');
    } else if (existing?.status === 'terminated') {
      setCurrentView('terminated');
    } else {
      setCurrentView('instructions');
    }
  };

  const handleStartRound = async () => {
    if (!selectedRound) return;
    const res = await startRoundAttempt(selectedRound.id);
    if (res.success) {
      setCurrentView('arena');
    } else {
      toastError('Could not start round', res.error || 'Round attempt failed to start.');
    }
  };

  const handleReturnDashboard = () => {
    setCurrentView('dashboard');
    setSelectedRound(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex flex-col">
      {currentView === 'dashboard' && (
        <StudentDashboard
          onSelectRound={handleSelectRound}
          onViewSummary={round => {
            setSelectedRound(round);
            setCurrentView('summary');
          }}
          onViewTerminated={round => {
            setSelectedRound(round);
            setCurrentView('terminated');
          }}
        />
      )}

      {currentView === 'instructions' && selectedRound && (
        <PreRoundInstructions
          round={selectedRound}
          onStartRound={handleStartRound}
          onBack={handleReturnDashboard}
        />
      )}

      {currentView === 'arena' && selectedRound && activeAttempt && (
        <ArenaEditor
          round={selectedRound}
          attempt={activeAttempt}
          programs={assignedPrograms}
          onFinishRound={() => setCurrentView('summary')}
          onTerminated={() => setCurrentView('terminated')}
        />
      )}

      {currentView === 'summary' && selectedRound && activeAttempt && (
        <CompletionSummary
          round={selectedRound}
          attempt={activeAttempt}
          programs={assignedPrograms}
          submissions={studentSubmissions}
          onReturnDashboard={handleReturnDashboard}
        />
      )}

      {currentView === 'terminated' && selectedRound && activeAttempt && (
        <TerminationScreen
          round={selectedRound}
          attempt={activeAttempt}
          onReturnDashboard={handleReturnDashboard}
        />
      )}
    </div>
  );
};

