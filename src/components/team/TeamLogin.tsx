import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Terminal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const TeamLogin: React.FC = () => {
  const { isAuthenticated, role, loginWithCredentials } = useAuth();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && role === 'team') return <Navigate to="/team/dashboard" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginWithCredentials(teamName.trim(), password, 'team');
      if (!result.success) {
        setError(result.error || 'Invalid team name or password.');
        return;
      }
      navigate('/team/dashboard', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="drift-team-login-page drift-static-auth-page">
      <img className="drift-static-sky" src="/driftlab-sky.svg" alt="" aria-hidden="true" />
      <img className="drift-team-login-jelly" src="/driftlab-jellyfish.svg" alt="" aria-hidden="true" />
      <div className="drift-team-login-content">
        <section className="drift-login-card drift-team-login-card">
          <Link to="/" className="drift-wordmark" aria-label="Bug Bash Arena home">
            <span className="drift-mark"><Terminal aria-hidden="true" /></span>
            <span>Bug Bash Arena<svg viewBox="0 0 150 10" aria-hidden="true"><path d="M2 7c26-10 42 5 69-2s47-2 77-3" /></svg></span>
          </Link>
          <p className="drift-kicker">TEAM PORTAL</p>
          <h1>TEAM LOGIN</h1>
          <p className="drift-login-copy">Sign in with the team name and password you registered.</p>
          {error && <p role="alert" className="drift-message drift-message-error">{error}</p>}
          <form className="drift-login-form" onSubmit={submit}>
            <label className="drift-field">Team name
              <input required autoComplete="username" value={teamName} onChange={event => setTeamName(event.target.value)} className="drift-input" />
            </label>
            <label className="drift-field">Password
              <input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="drift-input" />
            </label>
            <button type="submit" disabled={loading} className="drift-primary-button drift-full-button">
              {loading ? <Loader2 className="animate-spin" size={16} /> : <>Sign in<ArrowRight size={16} /></>}
            </button>
          </form>
          <p className="drift-login-foot">New team? <Link to="/register" className="drift-inline-link">Register here</Link></p>
          <Link to="/admin/login" className="drift-admin-entry">Administrator sign in</Link>
        </section>
        <div className="drift-team-login-caption">
          <p>BUG BASH ARENA</p>
          <h2>FIND THE FAULT.<br />FIX THE FUTURE.</h2>
        </div>
      </div>
    </main>
  );
};
