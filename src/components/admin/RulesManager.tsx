import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Send } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';

type RuleVersion = {
  version: string;
  content: string;
  is_active: boolean;
  updated_at: string;
  accepted_teams: number;
};

const getAdminToken = () => {
  const token = localStorage.getItem('bba_auth_token');
  if (!token) throw new Error('Sign in with an administrator account to edit competition rules.');
  return token;
};

export const RulesManager: React.FC = () => {
  const [versions, setVersions] = useState<RuleVersion[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    setError('');
    try {
      const { rules } = await apiGet<{ rules: RuleVersion[] }>('/admin/rules', getAdminToken());
      setVersions(rules);
      setContent(rules.find(rule => rule.is_active)?.content || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load competition rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRules(); }, []);

  const publish = async () => {
    setPublishing(true);
    setError('');
    setMessage('');
    try {
      const { version } = await apiPost<{ version: string }>('/admin/rules', { content }, getAdminToken());
      setMessage(`Rules version ${version} is now active. New registrations must accept this version.`);
      await loadRules();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish competition rules.');
    } finally {
      setPublishing(false);
    }
  };

  const activeVersion = versions.find(rule => rule.is_active);

  return (
    <section className="drift-admin-rules">
      <header className="drift-admin-heading">
        <p>ARENA CONFIGURATION · CONTENT CONTROL</p>
        <h1>Competition rules</h1>
        <span>Edit the active version, then publish to create a new immutable version. Existing team acceptances are retained.</span>
      </header>
      {error && <p className="drift-message drift-message-error" role="alert"><AlertCircle size={17} />{error}</p>}
      {message && <p className="drift-message drift-message-success" role="status"><CheckCircle2 size={17} />{message}</p>}
      {loading ? <p className="drift-loading"><Loader2 className="animate-spin" size={18} />Loading rule versions…</p> : <>
        <div className="drift-rule-admin-grid">
          <section className="drift-rule-editor">
            <div className="drift-rule-editor-heading"><FileText size={18} /><h2>Active version {activeVersion?.version ?? '—'}</h2></div>
            <label htmlFor="competition-rules-markdown">Rules in Markdown</label>
            <textarea id="competition-rules-markdown" value={content} onChange={event => setContent(event.target.value)} rows={25} spellCheck={false} aria-describedby="rules-editor-help" />
            <p id="rules-editor-help">Use headings beginning with ## and numbered lists. Publishing makes a new version and updates the version shown to future registrations.</p>
            <button type="button" onClick={() => void publish()} disabled={publishing || content.trim().length < 100}>
              {publishing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              {publishing ? 'Publishing…' : 'Publish new version'}
            </button>
          </section>
          <aside className="drift-rule-history">
            <h2>Published versions</h2>
            <ul>{versions.map(rule => <li key={rule.version}>
              <div><strong>Version {rule.version}</strong>{rule.is_active && <span className="drift-active-tag">ACTIVE</span>}</div>
              <p>{new Date(rule.updated_at).toLocaleString()}</p>
              <span>{rule.accepted_teams} team{rule.accepted_teams === 1 ? '' : 's'} accepted</span>
              {!rule.is_active && <button type="button" onClick={() => setContent(rule.content)}>Load into editor</button>}
            </li>)}</ul>
          </aside>
        </div>
      </>}
    </section>
  );
};
