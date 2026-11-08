import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Code2,
  FileCode,
  FileText,
  GitBranch,
  LayoutDashboard,
  ShieldAlert,
  Sliders,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type AdminTab =
  | 'dashboard'
  | 'live-monitor'
  | 'programs'
  | 'students'
  | 'assignments'
  | 'round-controls'
  | 'diff-viewer'
  | 'results'
  | 'violations'
  | 'teams'
  | 'rules';

interface AdminHeaderProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  violationsCount?: number;
}

const primaryTabs: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'teams', label: 'Teams', icon: UsersRound },
  { id: 'programs', label: 'Programs', icon: Code2 },
  { id: 'round-controls', label: 'Rounds', icon: Sliders },
  { id: 'live-monitor', label: 'Monitor', icon: Activity },
  { id: 'results', label: 'Leaderboard', icon: Trophy },
  { id: 'rules', label: 'Rules', icon: FileText },
];

const managementTabs: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
  { id: 'students', label: 'Students', icon: Users },
  { id: 'assignments', label: 'Assignments', icon: GitBranch },
  { id: 'diff-viewer', label: 'Diff Viewer', icon: FileCode },
  { id: 'violations', label: 'Violations Log', icon: ShieldAlert },
];

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentTab,
  onTabChange,
  violationsCount = 0,
}) => (
  <aside className="drift-admin-sidebar" aria-label="Administrator navigation">
    <Link to="/admin/dashboard" className="drift-admin-brand">
      <span className="drift-admin-brand-mark"><img src="/driftlab-jellyfish.svg" alt="" /></span>
      <span className="drift-admin-brand-name">
        Bug Bash Arena
        <svg viewBox="0 0 150 10" aria-hidden="true"><path d="M2 7c26-10 42 5 69-2s47-2 77-3" /></svg>
      </span>
    </Link>
    <p className="drift-admin-sidebar-label">ARENA CONTROL</p>
    <nav className="drift-admin-nav" aria-label="Admin sections">
      {primaryTabs.map(tab => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onTabChange(tab.id)}
            className={cn('drift-admin-nav-link', isActive && 'is-active')}
          >
            <Icon size={16} aria-hidden="true" />
            <span>[{tab.label}]</span>
          </button>
        );
      })}
    </nav>
    <details className="drift-admin-more">
      <summary>More tools</summary>
      <nav className="drift-admin-nav" aria-label="Additional admin tools">
        {managementTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(tab.id)}
              className={cn('drift-admin-nav-link', isActive && 'is-active')}
            >
              <Icon size={16} aria-hidden="true" />
              <span>[{tab.label}]</span>
              {tab.id === 'violations' && violationsCount > 0 && <small>{violationsCount}</small>}
            </button>
          );
        })}
      </nav>
    </details>
    {violationsCount > 0 && (
      <p className="drift-admin-sidebar-alert"><ShieldAlert size={14} />{violationsCount} violation{violationsCount === 1 ? '' : 's'} recorded</p>
    )}
  </aside>
);
