import React, { useEffect, useMemo, useState } from 'react';
import { getApiBase } from '../utils/runtimeConfig';
import { showToast } from '../utils/alerts';
import { downloadExternalUsersTemplateExcel, downloadExternalUsersTemplateCsv } from '../utils/importTemplates';

export type ExternalUser = {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  department?: string;
  business_id?: number | null;
  status?: string; // invited | active | disabled
  mfa_enabled?: number | boolean;
  created_at?: string;
  last_login?: string;
};

const ExternalUsersManager: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
  const base = (getApiBase() as string) || '';
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<ExternalUser[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [businesses, setBusinesses] = useState<Array<{ id: number; name: string }>>([]);
  const [invDepartment, setInvDepartment] = useState('');
  const [invBusinessId, setInvBusinessId] = useState<number | ''>('');

  const load = async () => {
    setLoading(true);
    try {
      const url = new URL(`${base}/api/external-users`);
      if (q.trim()) url.searchParams.set('q', q.trim());
      if (status) url.searchParams.set('status', status);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const j = await res.json();
      setUsers(Array.isArray(j?.users) ? j.users : []);
    } catch (e) {
      showToast('Failed to load users', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [q, status, limit, offset]);
  // Clear selection when page changes
  useEffect(() => { setSelected(new Set()); }, [q, status, limit, offset]);
  // Load businesses once
  useEffect(() => { (async () => {
    try {
      const res = await fetch(`${base}/api/businesses`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (Array.isArray(j?.businesses)) setBusinesses(j.businesses);
    } catch {}
  })(); }, []);

  const invite = async () => {
    try {
      const email = invEmail.trim().toLowerCase();
      if (!email || !email.includes('@')) { showToast('Enter a valid email', 'warning'); return; }
      const res = await fetch(`${base}/api/external-users/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: invName, phone: invPhone, department: invDepartment || undefined, businessId: invBusinessId === '' ? undefined : invBusinessId })
      });
      if (!res.ok) throw new Error('invite_failed');
      setInvEmail(''); setInvName(''); setInvPhone(''); setInvDepartment(''); setInvBusinessId('');
      showToast('Invite sent', 'success');
      void load();
    } catch { showToast('Invite failed', 'error'); }
  };

  const resend = async (email: string) => {
    try {
      const res = await fetch(`${base}/api/external-users/resend`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error('resend_failed');
      showToast('Invite resent', 'success');
    } catch { showToast('Resend failed', 'error'); }
  };

  const resendSelected = async () => {
    try {
      if (selected.size === 0) { showToast('No users selected', 'info'); return; }
      setBatchBusy(true);
      const emails = Array.from(selected);
      const res = await fetch(`${base}/api/external-users/resend-batch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'resend_batch_failed');
      showToast(`Resent ${j?.processed || emails.length} invite(s)`, 'success');
    } catch { showToast('Batch resend failed', 'error'); }
    finally { setBatchBusy(false); }
  };

  const update = async (id: number, patch: Partial<ExternalUser>) => {
    try {
      const res = await fetch(`${base}/api/external-users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error('update_failed');
      showToast('Saved', 'success');
      void load();
    } catch { showToast('Update failed', 'error'); }
  };

  const remove = async (id: number) => {
    try {
      if (!window.confirm('Delete this external user?')) return;
      const res = await fetch(`${base}/api/external-users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      showToast('Deleted', 'success');
      void load();
    } catch { showToast('Delete failed', 'error'); }
  };

  const inviteSelected = async () => {
    try {
      if (selected.size === 0) { showToast('No users selected', 'info'); return; }
      setBatchBusy(true);
      const picked = users.filter(u => selected.has(u.email.toLowerCase()));
      const payload = picked.map(u => ({ email: u.email, name: u.name || '', phone: u.phone || '', department: u.department || undefined, businessId: u.business_id ?? undefined }));
      const res = await fetch(`${base}/api/external-users/invite-batch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users: payload, updateExisting: true })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'invite_batch_failed');
      const invited = Number(j?.invited || 0);
      const updated = Number(j?.updated || 0);
      const errs = Array.isArray(j?.errors) ? j.errors.length : 0;
      showToast(`Invited ${invited} • updated ${updated}${errs ? ` • errors ${errs}` : ''}`, errs ? 'warning' : 'success');
    } catch { showToast('Batch invite failed', 'error'); }
    finally { setBatchBusy(false); }
  };

  const inviteAllLoaded = async () => {
    try {
      if (users.length === 0) { showToast('No users to invite', 'info'); return; }
      if (!window.confirm(`Invite all ${users.length} loaded user(s)?`)) return;
      setBatchBusy(true);
      const payload = users.map(u => ({ email: u.email, name: u.name || '', phone: u.phone || '', department: u.department || undefined, businessId: u.business_id ?? undefined }));
      const res = await fetch(`${base}/api/external-users/invite-batch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users: payload, updateExisting: true })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'invite_batch_failed');
      const invited = Number(j?.invited || 0);
      const updated = Number(j?.updated || 0);
      const errs = Array.isArray(j?.errors) ? j.errors.length : 0;
      showToast(`Invited ${invited} • updated ${updated}${errs ? ` • errors ${errs}` : ''}`, errs ? 'warning' : 'success');
    } catch { showToast('Batch invite failed', 'error'); }
    finally { setBatchBusy(false); }
  };

  const onBulkUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await fetch(`${base}/api/external-users/bulk-upload`, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'bulk_upload_failed');
      showToast(`Bulk uploaded: ${j?.inserted || 0} inserted, ${j?.updated || 0} updated`, 'success');
      if (Array.isArray(j?.errors) && j.errors.length > 0) {
        const headers = Object.keys(j.errors[0]);
        const lines = [headers.join(',')].concat(j.errors.map((r: any) => headers.map(h => {
          const v = r[h] == null ? '' : String(r[h]);
          const needsQuote = /[",\n]/.test(v);
          const safe = v.replace(/"/g, '""');
          return needsQuote ? `"${safe}"` : safe;
        }).join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'external-users-errors.csv'; a.click(); URL.revokeObjectURL(url);
        showToast(`${j.errors.length} row(s) had issues. Downloaded error report.`, 'warning');
      }
      void load();
    } catch (e) { showToast('Bulk upload failed', 'error'); } finally { setUploading(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <input placeholder="Search email, name, phone" value={q} onChange={e => { setQ(e.target.value); setOffset(0); }} />
        <select value={status} onChange={e => { setStatus(e.target.value); setOffset(0); }}>
          <option value="">All statuses</option>
          <option value="invited">Invited</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <button className="btn ghost sm" onClick={() => setOffset(o => Math.max(0, o - limit))} disabled={offset === 0}>Prev</button>
        <button className="btn ghost sm" onClick={() => setOffset(o => o + limit)}>Next</button>
        <button className="btn ghost sm" onClick={() => void load()}>Refresh</button>
      </div>

      {canEdit && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Invite external user</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <input type="email" placeholder="user@domain.com" value={invEmail} onChange={e => setInvEmail(e.target.value)} />
            <input placeholder="Name (optional)" value={invName} onChange={e => setInvName(e.target.value)} />
            <input placeholder="Phone (optional)" value={invPhone} onChange={e => setInvPhone(e.target.value)} />
            <input placeholder="Department (optional)" value={invDepartment} onChange={e => setInvDepartment(e.target.value)} />
            <select value={invBusinessId === '' ? '' : String(invBusinessId)} onChange={e => setInvBusinessId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Business (optional)</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button className="btn sm" onClick={invite}>Invite</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Bulk upload</div>
            <div className="small muted">Upload External Users from CSV or Excel. You can also invite individuals above.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost xs" onClick={downloadExternalUsersTemplateExcel}>Template (Excel)</button>
            <button className="btn ghost xs" onClick={downloadExternalUsersTemplateCsv}>Template (CSV)</button>
          </div>
        </div>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={e => onBulkUpload(e.target.files?.[0] || null)} disabled={uploading} />
        {uploading && <div className="small muted" style={{ marginTop: 6 }}>Uploading...</div>}
      </div>

      {canEdit && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700 }}>Batch actions</div>
            <button className="btn sm" onClick={inviteSelected} disabled={batchBusy || selected.size === 0}>Invite Selected</button>
            <button className="btn ghost sm" onClick={resendSelected} disabled={batchBusy || selected.size === 0}>Resend Selected</button>
            <button className="btn ghost sm" onClick={inviteAllLoaded} disabled={batchBusy || users.length === 0}>Invite All (loaded)</button>
            {batchBusy && <div className="small muted">Processing…</div>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="small muted">Loading...</div>
      ) : users.length === 0 ? (
        <div className="small muted">No users found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                {canEdit && (
                  <th>
                    <input
                      type="checkbox"
                      checked={users.length > 0 && users.every(u => selected.has(u.email.toLowerCase()))}
                      onChange={e => {
                        const next = new Set<string>();
                        if (e.target.checked) { users.forEach(u => next.add(u.email.toLowerCase())); }
                        setSelected(next);
                      }}
                    />
                  </th>
                )}
                <th>Email</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Department</th>
                <th>Business</th>
                <th>Status</th>
                <th>MFA</th>
                <th>Created</th>
                <th>Last Login</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  {canEdit && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(u.email.toLowerCase())}
                        onChange={e => {
                          const next = new Set(selected);
                          const key = u.email.toLowerCase();
                          if (e.target.checked) next.add(key); else next.delete(key);
                          setSelected(next);
                        }}
                      />
                    </td>
                  )}
                  <td>{u.email}</td>
                  <td>
                    <input value={u.name || ''} onChange={e => setUsers(prev => prev.map(x => x.id===u.id?{...x, name: e.target.value}:x))} disabled={!canEdit} />
                  </td>
                  <td>
                    <input value={u.phone || ''} onChange={e => setUsers(prev => prev.map(x => x.id===u.id?{...x, phone: e.target.value}:x))} disabled={!canEdit} />
                  </td>
                  <td>
                    <input value={u.department || ''} onChange={e => setUsers(prev => prev.map(x => x.id===u.id?{...x, department: e.target.value}:x))} disabled={!canEdit} />
                  </td>
                  <td>
                    <select value={u.business_id == null ? '' : String(u.business_id)} onChange={e => setUsers(prev => prev.map(x => x.id===u.id?{...x, business_id: e.target.value ? Number(e.target.value) : null}:x))} disabled={!canEdit}>
                      <option value="">Unassigned</option>
                      {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={(u.status || '').toLowerCase()} onChange={e => setUsers(prev => prev.map(x => x.id===u.id?{...x, status: e.target.value}:x))} disabled={!canEdit}>
                      <option value="invited">invited</option>
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </td>
                  <td>
                    <input type="checkbox" checked={!!u.mfa_enabled} onChange={e => setUsers(prev => prev.map(x => x.id===u.id?{...x, mfa_enabled: e.target.checked}:x))} disabled={!canEdit} />
                  </td>
                  <td className="small muted">{u.created_at ? new Date(u.created_at).toLocaleString() : ''}</td>
                  <td className="small muted">{u.last_login ? new Date(u.last_login).toLocaleString() : ''}</td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn ghost sm" onClick={() => update(u.id, { name: u.name, phone: u.phone, department: u.department, business_id: u.business_id ?? null, status: u.status, mfa_enabled: !!u.mfa_enabled })}>Save</button>
                        {(u.status || '').toLowerCase() === 'invited' && <button className="btn ghost sm" onClick={() => resend(u.email)}>Resend invite</button>}
                        <button className="btn ghost sm" onClick={() => remove(u.id)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExternalUsersManager;
