import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, LockKeyhole, Terminal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminLogin: React.FC = () => {
  const { isAuthenticated, role, loginWithCredentials } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && role === 'admin') navigate('/admin/dashboard', { replace: true });
  }, [isAuthenticated, role, navigate]);

  if (isAuthenticated && role !== 'admin') return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginWithCredentials(email, password, 'admin');
      if (!result.success) {
        setError('Invalid admin credentials.');
        return;
      }
      navigate('/admin/dashboard', { replace: true });
    } catch {
      setError('Admin sign in is unavailable. Try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="drift-admin-login-page drift-static-auth-page">
      <img className="drift-static-sky" src="/driftlab-sky.svg" alt="" aria-hidden="true" />
      <img className="drift-admin-login-jelly" src="/driftlab-jellyfish.svg" alt="" aria-hidden="true" />
      <div className="drift-admin-login-layout">
        <div className="drift-admin-login-art" aria-hidden="true">
          <p>BUG BASH ARENA</p>
          <h2>ONE BUG.<br />ONE FIX.<br />ONE ARENA.</h2>
        </div>
        <section className="drift-admin-login-card">
          <Link to="/" className="drift-wordmark" aria-label="Bug Bash Arena home">
            <span className="drift-mark"><Terminal aria-hidden="true" /></span>
            <span>Bug Bash Arena<svg viewBox="0 0 150 10" aria-hidden="true"><path d="M2 7c26-10 42 5 69-2s47-2 77-3" /></svg></span>
          </Link>
          <div className="drift-admin-access-label"><LockKeyhole size={15} aria-hidden="true" />AUTHORIZED ADMINISTRATORS ONLY</div>
          <div className="drift-admin-login-title">
            <div><p className="drift-kicker">ADMINISTRATOR PORTAL</p><h1>ADMIN ACCESS</h1></div>
            <span className="drift-admin-pill">ADMIN</span>
          </div>
          <p className="drift-login-copy">Sign in with your administrator credentials.</p>
          {error && <p role="alert" className="drift-message drift-message-error">{error}</p>}
          <form className="drift-login-form" onSubmit={submit}>
            <label className="drift-field">Admin email
              <input className="drift-input" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <label className="drift-field">Password
              <input className="drift-input" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            <button type="submit" disabled={loading} className="drift-primary-button drift-full-button">
              {loading ? <Loader2 className="animate-spin" size={16} /> : <>Sign in securely<ArrowRight size={16} /></>}
            </button>
          </form>
          <Link className="drift-admin-back-link" to="/"><span>[Back to the arena]</span></Link>
        </section>
      </div>
    </main>
  );
};
