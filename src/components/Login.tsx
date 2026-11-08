import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import {
  Terminal,
  ShieldCheck,
  User,
  ArrowRight,
  Sparkles,
  KeyRound,
  Mail,
  Lock,
} from 'lucide-react';
import { INITIAL_ADMIN, INITIAL_STUDENTS } from '../lib/demoData';

export const Login: React.FC = () => {
  const { loginWithCredentials, loginAs, isBackendLive } = useAuth();
  const { students } = useExam();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await loginWithCredentials(email, password);
      if (!res.success) {
        setErrorMsg(res.error || 'Login failed. Check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background radial gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-xl shadow-indigo-600/30">
            <Terminal className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Bug Bash <span className="text-indigo-400">Arena</span>
          </h1>
          <p className="text-xs text-slate-400">
            Timed Bug-Finding Competition Platform
          </p>

          <div className="pt-1">
            {isBackendLive ? (
              <Badge variant="success" className="text-[10px]">
                Connected to MongoDB API
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[10px]">
                MongoDB API unavailable
              </Badge>
            )}
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Sign In to Arena</CardTitle>
            <CardDescription className="text-xs">
              Enter your competition credentials or use one-click persona access below.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300 animate-in fade-in">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                label="Email / Roll Number"
                type="text"
                placeholder="admin@bugbash.arena or alice@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />

              <Button
                type="submit"
                loading={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 mt-2 shadow-lg shadow-indigo-600/20"
              >
                Sign In
              </Button>
            </form>

            {/* Quick One-Click Evaluator Buttons */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Instant Evaluator Demo Access</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {/* Admin button */}
                <button
                  type="button"
                  onClick={() => loginAs(INITIAL_ADMIN)}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-indigo-500/30 bg-indigo-950/30 hover:bg-indigo-900/40 text-left transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-indigo-600/30 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Chief Proctor (Admin Panel)</p>
                      <p className="text-[10px] text-slate-400">admin@bugbash.arena</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Candidate buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => loginAs(INITIAL_STUDENTS[0])}
                    className="p-2 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900 text-left transition-all"
                  >
                    <p className="text-xs font-semibold text-white">Alice Chen</p>
                    <p className="text-[10px] text-emerald-400 font-mono">In Progress</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => loginAs(INITIAL_STUDENTS[1])}
                    className="p-2 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900 text-left transition-all"
                  >
                    <p className="text-xs font-semibold text-white">Bob Smith</p>
                    <p className="text-[10px] text-indigo-400 font-mono">Completed 10/10</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => loginAs(INITIAL_STUDENTS[2])}
                    className="p-2 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900 text-left transition-all"
                  >
                    <p className="text-xs font-semibold text-white">Charlie Davis</p>
                    <p className="text-[10px] text-rose-400 font-mono">Terminated Demo</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => loginAs(INITIAL_STUDENTS[4])}
                    className="p-2 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900 text-left transition-all"
                  >
                    <p className="text-xs font-semibold text-white">Ethan Hunt</p>
                    <p className="text-[10px] text-slate-400 font-mono">Ready to Start</p>
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500">
          Bug Bash Arena — Production-ready programming competition platform
        </p>
        <nav aria-label="Portal sign in" className="flex justify-center gap-5 text-xs">
          <a className="text-indigo-300 hover:text-indigo-200 underline-offset-4 hover:underline" href="/team/login">Team login</a>
          <a className="text-slate-400 hover:text-slate-200 underline-offset-4 hover:underline" href="/register">Register a team</a>
          <a className="text-slate-400 hover:text-slate-200 underline-offset-4 hover:underline" href="/admin/login">Admin login</a>
        </nav>
      </div>
    </div>
  );
};
