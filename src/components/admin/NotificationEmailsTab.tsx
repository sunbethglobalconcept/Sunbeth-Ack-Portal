import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBase } from '../../utils/runtimeConfig';

const GlobalEmailsSection: React.FC = () => {
  const apiBase = (getApiBase() as string) || '';
  const [emails, setEmails] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/notification-emails`);
      const j = await res.json();
      setEmails(Array.isArray(j?.emails) ? j.emails : []);
    } catch {
      setStatus('Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);
  useEffect(() => { void loadEmails(); }, [loadEmails]);

  const saveEmails = useCallback(async (next: string[]) => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/notification-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: next })
      });
      if (!res.ok) throw new Error('Save failed');
      setEmails(next);
      setStatus('Saved!');
    } catch {
      setStatus('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [apiBase]);

  const addEmail = useCallback(() => {
    const val = input.trim().toLowerCase();
    if (!val || !val.includes('@') || emails.includes(val)) return;
    const next = [...emails, val];
    setEmails(next);
    setInput('');
    void saveEmails(next);
  }, [emails, input, saveEmails]);

  const removeEmail = useCallback((email: string) => {
    const next = emails.filter((e) => e !== email);
    setEmails(next);
    void saveEmails(next);
  }, [emails, saveEmails]);

  return (
    <div>
      <h4 style={{ margin: '0 0 8px 0' }}>Global Recipients</h4>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="admin@domain.com"
          style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
          disabled={saving}
        />
        <button className="btn sm" onClick={addEmail} disabled={saving || !input.trim() || !input.includes('@') || emails.includes(input.trim().toLowerCase())}>Add</button>
      </div>
      {loading ? (
        <div className="small muted">Loading...</div>
      ) : emails.length === 0 ? (
        <div className="small muted">No notification emails set.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {emails.map((email) => (
            <li key={email} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ flex: 1 }}>{email}</span>
              <button className="btn ghost sm" onClick={() => removeEmail(email)} disabled={saving}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {status && <div className="small muted" style={{ marginTop: 8 }}>{status}</div>}
    </div>
  );
};

const BusinessAdminsSection: React.FC = () => {
  const apiBase = (getApiBase() as string) || '';
  const [bizLoading, setBizLoading] = useState(false);
  const [bizSaving, setBizSaving] = useState(false);
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>('');
  const [bizAdmins, setBizAdmins] = useState<string[]>([]);
  const [bizInput, setBizInput] = useState('');
  const [bizStatus, setBizStatus] = useState<string | null>(null);

  const loadBusinesses = useCallback(async () => {
    setBizLoading(true);
    setBizStatus(null);
    try {
      // Prefer public active list which exists across adapters
      const res = await fetch(`${apiBase}/api/businesses/active`);
      const j = await res.json();
      const items: Array<{ id: string; name: string }> = Array.isArray(j?.businesses)
        ? j.businesses.map((b: any) => ({ id: String(b.id ?? b.toba_businessid ?? b.code ?? ''), name: String(b.name ?? b.toba_name ?? b.code ?? 'Business') }))
        : [];
      setBusinesses(items);
      if (items.length > 0) setSelectedBizId((prev) => prev || items[0].id);
    } catch {
      setBizStatus('Failed to load businesses');
    } finally {
      setBizLoading(false);
    }
  }, [apiBase]);
  useEffect(() => { void loadBusinesses(); }, [loadBusinesses]);

  const loadBizAdmins = useCallback(async (bizId: string) => {
    if (!bizId) { setBizAdmins([]); return; }
    setBizLoading(true);
    setBizStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/businesses/${encodeURIComponent(bizId)}/admins`);
      const j = await res.json();
      setBizAdmins(Array.isArray(j?.emails) ? j.emails : []);
    } catch {
      setBizStatus('Failed to load business admins');
      setBizAdmins([]);
    } finally {
      setBizLoading(false);
    }
  }, [apiBase]);
  useEffect(() => { if (selectedBizId) void loadBizAdmins(selectedBizId); }, [selectedBizId, loadBizAdmins]);

  const saveBizAdmins = useCallback(async (bizId: string, next: string[]) => {
    if (!bizId) return;
    setBizSaving(true);
    setBizStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/businesses/${encodeURIComponent(bizId)}/admins`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: next })
      });
      if (!res.ok) throw new Error('Save failed');
      setBizAdmins(next);
      setBizStatus('Saved!');
    } catch {
      setBizStatus('Failed to save');
    } finally {
      setBizSaving(false);
    }
  }, [apiBase]);

  const canAddBiz = useMemo(() => {
    const v = bizInput.trim().toLowerCase();
    return !!selectedBizId && !!v && v.includes('@') && !bizAdmins.includes(v);
  }, [bizInput, selectedBizId, bizAdmins]);

  const addBizEmail = useCallback(() => {
    const val = bizInput.trim().toLowerCase();
    if (!selectedBizId || !val || !val.includes('@') || bizAdmins.includes(val)) return;
    const next = [...bizAdmins, val];
    setBizAdmins(next);
    setBizInput('');
    void saveBizAdmins(selectedBizId, next);
  }, [bizInput, bizAdmins, selectedBizId, saveBizAdmins]);

  const removeBizEmail = useCallback((email: string) => {
    if (!selectedBizId) return;
    const next = bizAdmins.filter((e) => e !== email);
    setBizAdmins(next);
    void saveBizAdmins(selectedBizId, next);
  }, [bizAdmins, selectedBizId, saveBizAdmins]);

  return (
    <div>
      <h4 style={{ margin: '0 0 8px 0' }}>Per-Business Admins</h4>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select
          value={selectedBizId}
          onChange={(e) => setSelectedBizId(e.target.value)}
          style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
          disabled={bizLoading || businesses.length === 0}
        >
          {businesses.length === 0 ? <option value="">No businesses</option> : null}
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <button className="btn ghost sm" onClick={() => selectedBizId && loadBizAdmins(selectedBizId)} disabled={bizLoading}>
          Refresh
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="email"
          value={bizInput}
          onChange={(e) => setBizInput(e.target.value)}
          placeholder="biz-admin@domain.com"
          style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
          disabled={bizSaving || !selectedBizId}
        />
        <button className="btn sm" onClick={addBizEmail} disabled={bizSaving || !canAddBiz}>Add</button>
      </div>
      {bizLoading ? (
        <div className="small muted">Loading...</div>
      ) : bizAdmins.length === 0 ? (
        <div className="small muted">No admins set for this business.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {bizAdmins.map((email) => (
            <li key={email} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ flex: 1 }}>{email}</span>
              <button className="btn ghost sm" onClick={() => removeBizEmail(email)} disabled={bizSaving}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {bizStatus && <div className="small muted" style={{ marginTop: 8 }}>{bizStatus}</div>}
    </div>
  );
};

export const NotificationEmailsTab: React.FC = () => {
  return (
    <div className="card" style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 18 }}>Notification Emails</h3>
      <div className="small muted" style={{ marginBottom: 12 }}>
        Global recipients will receive admin notifications (batch completions, nudges, etc). You can also configure per-business admins below. Changes are saved instantly.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <GlobalEmailsSection />
        <BusinessAdminsSection />
      </div>
    </div>
  );
};
