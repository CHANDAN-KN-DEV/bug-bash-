import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  ShieldAlert,
  User,
  LogOut,
  ChevronDown,
  Terminal,
  Database,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { INITIAL_ADMIN } from '../lib/demoData';

interface NavbarProps {
  onOpenQuickSwitch?: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const { user, role, logout, loginAs, isBackendLive } = useAuth();
  const { students, resetAllDemoData } = useExam();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className={`drift-app-nav sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md ${role === 'admin' ? 'is-admin' : ''}`}>
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-md shadow-indigo-600/30">
            <Terminal className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                BUG BASH <span className="text-indigo-400">ARENA</span>
              </span>
              <Badge variant="outline" className="text-[10px] py-0 border-indigo-500/40 text-indigo-300">
                v2.0
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Timed Bug-Finding Competition Platform</p>
          </div>
        </div>

        {/* Center / Mode indicator */}
        <div className="hidden md:flex items-center gap-2">
          {isBackendLive ? (
            <Badge variant="success" className="gap-1.5 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              MongoDB API Live
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1.5 py-1">
              <Database className="h-3 w-3" />
              MongoDB API unavailable
            </Badge>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Quick Switch Persona Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(prev => !prev)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-600 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline font-medium">Quick Switch:</span>
              <span className="font-semibold text-white">{user ? user.full_name.split(' ')[0] : 'Select User'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95"
                onClick={() => setDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Switch Persona (Evaluator Mode)
                </div>

                <button
                  onClick={() => loginAs(INITIAL_ADMIN)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-indigo-400" />
                    <div>
                      <p className="font-semibold text-white">Chief Proctor (Admin)</p>
                      <p className="text-[10px] text-slate-400">admin@bugbash.arena</p>
                    </div>
                  </div>
                  <Badge variant="purple" className="text-[10px]">Admin</Badge>
                </button>

                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Students
                </div>

                {students.slice(0, 4).map(st => (
                  <button
                    key={st.id}
                    onClick={() => loginAs(st)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-emerald-400" />
                      <div>
                        <p className="font-medium text-slate-200">{st.full_name}</p>
                        <p className="text-[10px] text-slate-400">{st.roll_no}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{st.roll_no}</Badge>
                  </button>
                ))}

                <div className="mt-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => resetAllDemoData()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset Competition State
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Current User Pill & Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-semibold text-white leading-tight">{user.full_name}</p>
                <p className="text-[10px] text-slate-400">
                  {role === 'admin' ? 'Chief Proctor' : `Roll No: ${user.roll_no}`}
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-slate-400 hover:text-rose-400"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
