import React, { useEffect, useState } from 'react';
import { Clock3, LogOut, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminHeader, AdminTab } from './AdminHeader';
import { AdminDashboard } from './AdminDashboard';
import { LiveMonitor } from './LiveMonitor';
import { ProgramsManager } from './ProgramsManager';
import { StudentManager } from './StudentManager';
import { AssignmentManager } from './AssignmentManager';
import { RoundControls } from './RoundControls';
import { SubmissionDiffViewer } from './SubmissionDiffViewer';
import { ResultsLeaderboard } from './ResultsLeaderboard';
import { ViolationLogs } from './ViolationLogs';
import { TeamAdministration } from './TeamAdministration';
import { RulesManager } from './RulesManager';
import { useExam } from '../../context/ExamContext';

export const AdminPortal: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('dashboard');
  const [inspectStudentId, setInspectStudentId] = useState<string | undefined>();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const { violations, liveRound } = useExam();
  const { user, logout } = useAuth();

  useEffect(() => {
    const clock = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

  const handleInspectStudent = (studentId: string) => {
    setInspectStudentId(studentId);
    setCurrentTab('diff-viewer');
  };

  return (
    <div className="drift-admin-portal">
      <AdminHeader
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        violationsCount={violations.length}
      />
      <div className="drift-admin-workspace">
        <header className="drift-admin-topbar">
          <div className="drift-admin-topbar-status">
            <span className={`drift-status-pill ${liveRound ? 'is-live' : 'is-idle'}`}>
              <Radio size={14} aria-hidden="true" />
              {liveRound ? `ROUND ${liveRound.round_number} · LIVE` : 'NO LIVE ROUND'}
            </span>
            <span className="drift-admin-round-name">{liveRound?.name || 'Competition control room'}</span>
          </div>
          <div className="drift-admin-topbar-actions">
            <span className="drift-admin-clock"><Clock3 size={14} aria-hidden="true" /><time dateTime={currentTime.toISOString()}>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></span>
            {user && <span className="drift-admin-user">{user.full_name}</span>}
            <button type="button" className="drift-admin-logout" onClick={logout}><LogOut size={15} />Sign out</button>
          </div>
        </header>
        <main className="drift-admin-content">
          {currentTab === 'dashboard' && <AdminDashboard onNavigateTab={setCurrentTab} />}
          {currentTab === 'live-monitor' && <LiveMonitor onInspectStudent={handleInspectStudent} />}
          {currentTab === 'programs' && <ProgramsManager />}
          {currentTab === 'students' && <StudentManager />}
          {currentTab === 'assignments' && <AssignmentManager />}
          {currentTab === 'round-controls' && <RoundControls />}
          {currentTab === 'diff-viewer' && <SubmissionDiffViewer initialStudentId={inspectStudentId} />}
          {currentTab === 'results' && <ResultsLeaderboard />}
          {currentTab === 'violations' && <ViolationLogs />}
          {currentTab === 'teams' && <TeamAdministration />}
          {currentTab === 'rules' && <RulesManager />}
        </main>
      </div>
    </div>
  );
};
