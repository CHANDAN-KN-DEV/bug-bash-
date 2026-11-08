import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, ShieldCheck, Users } from 'lucide-react';
import { DriftHero } from '../DriftHero';
import { apiGet, apiPost } from '../../lib/api';
import { RulesReader, type CompetitionRule } from './RulesReader';

type Member = { full_name: string; class_name: string; department: string; gmail: string };
const emptyMember: Member = { full_name: '', class_name: '', department: '', gmail: '' };
const steps = ['Team account', 'Member 1', 'Member 2', 'Rules', 'Review'];

const passwordScore = (password: string) =>
  [password.length >= 8, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;

const validateMember = (member: Member, label: string) => {
  const errors: string[] = [];
  if (member.full_name.trim().length < 2) errors.push(`${label}: enter a full name.`);
  if (!member.class_name.trim()) errors.push(`${label}: class is required.`);
  if (!member.department.trim()) errors.push(`${label}: department is required.`);
  if (!/^[^\s@]+@gmail\.com$/i.test(member.gmail.trim())) errors.push(`${label}: use a valid @gmail.com address.`);
  return errors;
};

export const TeamRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [member1, setMember1] = useState<Member>(emptyMember);
  const [member2, setMember2] = useState<Member>(emptyMember);
  const [solo, setSolo] = useState(false);
  const [teamNameAvailable, setTeamNameAvailable] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [activeRules, setActiveRules] = useState<CompetitionRule | null>(null);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesRead, setRulesRead] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const score = useMemo(() => passwordScore(password), [password]);

  useEffect(() => {
    let active = true;
    void apiGet<{ rule: CompetitionRule }>('/rules/active')
      .then(({ rule }) => {
        if (!active) return;
        setActiveRules(rule);
        setFormError('');
      })
      .catch(cause => {
        if (!active) return;
        setFormError(cause instanceof Error ? cause.message : 'Competition rules are unavailable.');
      })
      .finally(() => { if (active) setRulesLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const name = teamName.trim();
    if (name.length < 3 || name.length > 30) {
      setTeamNameAvailable(null);
      setCheckingName(false);
      return;
    }
    let active = true;
    setCheckingName(true);
    const timer = window.setTimeout(async () => {
      try {
        const { available } = await apiPost<{ available: boolean }>('/teams/name-availability', { team_name: name });
        if (!active) return;
        setCheckingName(false);
        setFormError('');
        setTeamNameAvailable(available);
      } catch {
        if (!active) return;
        setCheckingName(false);
        setTeamNameAvailable(null);
        setFormError('Team-name verification is unavailable. Check that the MongoDB API is running.');
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [teamName]);

  const validateStep = () => {
    const errors: string[] = [];
    if (step === 0) {
      if (teamName.trim().length < 3 || teamName.trim().length > 30) errors.push('Team name must be 3–30 characters.');
      if (teamNameAvailable !== true) errors.push(teamNameAvailable === false ? 'That team name is already taken.' : 'Wait for team-name availability to be confirmed.');
      if (password.length < 8) errors.push('Password must be at least 8 characters.');
      if (password !== confirmPassword) errors.push('Passwords do not match.');
    } else if (step === 1) {
      errors.push(...validateMember(member1, 'Member 1'));
    } else if (step === 2 && !solo) {
      errors.push(...validateMember(member2, 'Member 2'));
      if (member2.gmail.trim().toLowerCase() === member1.gmail.trim().toLowerCase()) errors.push('Members must use different Gmail addresses.');
    } else if (step === 3) {
      if (!activeRules) errors.push('Current competition rules are unavailable. Reload the page before continuing.');
      else if (!rulesRead) errors.push('Scroll to the end of the rules before continuing.');
      else if (!rulesAccepted) errors.push('All team members must accept the competition rules.');
    }
    setFieldErrors(errors);
    return errors.length === 0;
  };

  const next = () => {
    if (validateStep()) {
      setFieldErrors([]);
      setStep(current => Math.min(current + 1, steps.length - 1));
    }
  };

  const register = async () => {
    setFormError('');
    setLoading(true);
    try {
      await apiPost('/teams/register', {
        team_name: teamName.trim(),
        password,
        members: solo ? [member1] : [member1, member2],
        rules_version: activeRules?.version,
        rules_accepted: rulesAccepted,
      });
      setRegistered(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Registration service is unavailable. Try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const updateMember = (which: 1 | 2, key: keyof Member, value: string) => {
    const setter = which === 1 ? setMember1 : setMember2;
    setter(member => ({ ...member, [key]: value }));
  };

  const inputClass = 'drift-input mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30';
  const memberForm = (member: Member, number: 1 | 2) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {([
        ['full_name', 'Full name', 'text'],
        ['class_name', 'Class', 'text'],
        ['department', 'Department', 'text'],
        ['gmail', 'Gmail address', 'email'],
      ] as const).map(([field, label, type]) => (
        <label key={field} className="text-sm font-medium text-slate-300">
          {label}
          <input
            className={inputClass}
            type={type}
            autoComplete={field === 'gmail' ? 'email' : 'off'}
            value={member[field]}
            onChange={event => updateMember(number, field, event.target.value)}
            required={!solo || number === 1}
          />
        </label>
      ))}
    </div>
  );

  if (registered) {
    return (
      <main className="drift-registration-success">
        <section>
          <CheckCircle2 className="mx-auto h-14 w-14" aria-hidden="true" />
          <p className="drift-kicker">REGISTRATION COMPLETE</p>
          <h1>TEAM REGISTERED</h1>
          <p>Your team account is ready. Sign in with your team name and password.</p>
          <button onClick={() => navigate('/team/login')} className="drift-primary-button">Continue to team login</button>
        </section>
      </main>
    );
  }

  return (
    <main className="drift-register-page">
      <DriftHero className="drift-register-hero">
        <div className="drift-register-shell">
          <header className="drift-public-nav">
            <Link to="/" className="drift-wordmark" aria-label="Bug Bash Arena home"><span className="drift-mark"><Users aria-hidden="true" /></span><span>Bug Bash Arena<svg viewBox="0 0 150 10" aria-hidden="true"><path d="M2 7c26-10 42 5 69-2s47-2 77-3" /></svg></span></Link>
            <Link to="/team/login" className="drift-bracket-link">[Already registered? Sign in]</Link>
          </header>
          <div className="drift-registration-layout">
            <section className="drift-registration-main">
              <div className="drift-hero-copy">
                <p className="drift-kicker">23 NOVEMBER 2026 · RAJARAJESWARI COLLEGE OF ENGINEERING</p>
                <h1><span>BUG</span><span>BASH</span><span>ARENA</span></h1>
                <p>Find the fault. Fix the future.</p>
              </div>
              <section className="drift-registration-card" aria-label="Team registration">
                <div className="drift-registration-card-head">
                  <p>TEAM REGISTRATION · STEP {step + 1} / {steps.length}</p>
                  <h2>{step === 3 ? 'Rules & regulations' : step === 4 ? 'Review and submit' : 'Build your arena team'}</h2>
                  <span>One account, one shared timer, up to two members.</span>
                  <ol aria-label="Registration progress" className="drift-stepper">
                    {steps.map((label, index) => (
                      <li key={label} aria-current={index === step ? 'step' : undefined}>
                        <span className={index <= step ? 'is-current' : ''}>{String(index + 1).padStart(2, '0')}</span>
                        <small>{label}</small>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="drift-registration-form">
                  {formError && <p role="alert" className="drift-message drift-message-error">{formError}</p>}
                  {fieldErrors.length > 0 && <div role="alert" className="drift-message drift-message-error"><ul>{fieldErrors.map(message => <li key={message}>{message}</li>)}</ul></div>}
                  {step === 0 && (
                    <div className="space-y-5">
                      <label className="drift-field">Team name
                        <input className={inputClass} minLength={3} maxLength={30} value={teamName} onChange={event => setTeamName(event.target.value)} aria-describedby="team-name-help team-name-status" />
                      </label>
                      <p id="team-name-help" className="drift-help">3–30 characters. Availability is checked as you type.</p>
                      <p id="team-name-status" aria-live="polite" className="drift-help">
                        {checkingName ? 'Checking availability…' : teamNameAvailable === true ? '✓ Available' : teamNameAvailable === false ? 'Already taken' : 'Enter a team name to check availability.'}
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="drift-field">Password
                          <input className={inputClass} type={showPassword ? 'text' : 'password'} minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} />
                        </label>
                        <label className="drift-field">Confirm password
                          <input className={inputClass} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
                        </label>
                      </div>
                      <label className="drift-checkbox"><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />Show password</label>
                      <div aria-label={`Password strength ${score} of 4`} className="drift-password-meter">
                        {[0, 1, 2, 3].map(level => <span key={level} className={level < score ? (score < 3 ? 'is-warning' : 'is-success') : ''} />)}
                        <span className="sr-only">{['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][score]}</span>
                      </div>
                    </div>
                  )}
                  {step === 1 && <div className="space-y-5"><h3 className="drift-section-title">MEMBER 1 <span>*</span></h3>{memberForm(member1, 1)}</div>}
                  {step === 2 && (
                    <div className="space-y-5">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div><h3 className="drift-section-title">MEMBER 2 <span>(OPTIONAL)</span></h3><p className="drift-help">Add a teammate or continue as an individual.</p></div>
                        <label className="drift-checkbox"><input type="checkbox" checked={solo} onChange={event => { setSolo(event.target.checked); setFieldErrors([]); }} />Participating individually</label>
                      </div>
                      {!solo && memberForm(member2, 2)}
                    </div>
                  )}
                  {step === 3 && (
                    <div className="space-y-4">
                      <div className="drift-rules-toolbar">
                        <p>{activeRules ? `VERSION ${activeRules.version} · CURRENTLY ACTIVE` : rulesLoading ? 'LOADING ACTIVE RULES…' : 'RULES UNAVAILABLE'}</p>
                        <button type="button" className="drift-secondary-button" onClick={() => window.print()} disabled={!activeRules}><FileText size={15} />Print / Download PDF</button>
                      </div>
                      {activeRules && <RulesReader rule={activeRules} onReachedBottom={() => setRulesRead(true)} />}
                      {!rulesLoading && !activeRules && <p role="alert" className="drift-message drift-message-error">Could not load active competition rules. Please refresh and try again.</p>}
                      <label className={`drift-consent ${!rulesRead ? 'is-locked' : ''}`}>
                        <input type="checkbox" disabled={!rulesRead} checked={rulesAccepted} onChange={event => setRulesAccepted(event.target.checked)} />
                        <span>We, all team members, have read and agree to these rules.</span>
                      </label>
                      {!rulesRead && <p className="drift-help">Scroll through the complete rules to enable team consent.</p>}
                    </div>
                  )}
                  {step === 4 && (
                    <div className="space-y-5">
                      <h3 className="drift-section-title">REVIEW AND SUBMIT</h3>
                      <dl className="drift-review-grid">
                        <div><dt>TEAM</dt><dd>{teamName}</dd></div>
                        <div><dt>MEMBERS</dt><dd>{solo ? '1 — participating individually' : '2 members'}</dd></div>
                        <div><dt>MEMBER 1</dt><dd>{member1.full_name} · {member1.gmail}</dd></div>
                        {!solo && <div><dt>MEMBER 2</dt><dd>{member2.full_name} · {member2.gmail}</dd></div>}
                        <div><dt>RULES ACCEPTED</dt><dd>Version {activeRules?.version}</dd></div>
                      </dl>
                      <p className="drift-info-note"><ShieldCheck size={17} />Your password is securely hashed by the MongoDB API and never displayed.</p>
                    </div>
                  )}
                  <div className="drift-registration-actions">
                    <button type="button" onClick={() => { setFieldErrors([]); setStep(current => Math.max(0, current - 1)); }} disabled={step === 0 || loading} className="drift-secondary-button"><ChevronLeft size={16} />Back</button>
                    {step < 4 ? (
                      <button type="button" onClick={next} disabled={(checkingName && step === 0) || (step === 3 && rulesLoading)} className="drift-primary-button">Continue<ChevronRight size={16} /></button>
                    ) : (
                      <button type="button" onClick={register} disabled={loading || !teamNameAvailable || !rulesAccepted || !activeRules} className="drift-primary-button">{loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}{loading ? 'Creating account…' : 'Create team account'}</button>
                    )}
                  </div>
                </div>
              </section>
            </section>
            <aside className="drift-key-rules">
              <p>BEFORE YOU ENTER</p>
              <h2>Key rules</h2>
              <ul>
                <li><Users size={16} />One team account · one or two enrolled students</li>
                <li><CalendarDays size={16} />Three timed rounds · 30 minutes each</li>
                <li><ShieldCheck size={16} />Fullscreen competition · no outside help or AI</li>
                <li><CheckCircle2 size={16} />Solved means every required test passes</li>
              </ul>
              <button type="button" className="drift-bracket-button" onClick={() => { setFieldErrors([]); setStep(3); }}>[Read full rules →]</button>
              <p className="drift-help">All team members must agree before the account can be submitted.</p>
            </aside>
          </div>
          <footer className="drift-registration-footer">RAJARAJESWARI COLLEGE OF ENGINEERING <span>·</span> COMPETITION RULES V{activeRules?.version || '—'}</footer>
        </div>
      </DriftHero>
    </main>
  );
};
