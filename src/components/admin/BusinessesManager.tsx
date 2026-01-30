import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBase } from '../../utils/runtimeConfig';
import { getGraphToken } from '../../services/authTokens';
import { getUsers, type GraphUser } from '../../services/graphUserService';
import { createBusiness, updateBusiness, deleteBusiness } from '../../services/dbService';
import { confirmDialog, showToast } from '../../utils/alerts';

type Biz = { id: string | number; name: string; code?: string; isActive?: boolean; description?: string };

const resolveBizId = (b: any): string | number => {
  const raw = b.id ?? b.ID ?? b.businessId ?? b.business_id ?? b.toba_businessid ?? '';
  const s = String(raw).trim();
  const n = Number(s);
  return Number.isFinite(n) && s !== '' ? n : s;
};

const resolveBizName = (b: any): string =>
  String(b.name ?? b.displayName ?? b.toba_name ?? b.Title ?? b.code ?? 'Business');

const resolveBizCode = (b: any): string | undefined => {
  const c = b.code ?? b.toba_code ?? b.Code ?? b.CODE;
  return c != null ? String(c) : undefined;
};

const resolveBizActive = (b: any): boolean | undefined => {
  const v = b.isActive ?? b.active ?? b.toba_status;
  if (v == null) return undefined;
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  return isNaN(n) ? undefined : n === 1;
};

const mapBusinesses = (raw: any): Biz[] => {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.businesses)
      ? raw.businesses
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
  return (arr as any[])
    .map((b) => ({ id: resolveBizId(b), name: resolveBizName(b), code: resolveBizCode(b), isActive: resolveBizActive(b) }))
    .filter((b) => !!b.id);
};

const EmailChips: React.FC<{ items: string[]; onRemove: (email: string) => void; emptyLabel: string; disabled?: boolean }>
  = ({ items, onRemove, emptyLabel, disabled }) => (
  items.length === 0 ? <span className="small muted">{emptyLabel}</span> : (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((e) => (
        <span key={e} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {e}
          <button className="btn ghost sm" onClick={() => onRemove(e)} aria-label={`Remove ${e}`} disabled={disabled}>×</button>
        </span>
      ))}
    </div>
  )
);

const GraphUserSearch: React.FC<{
  onPick: (user: GraphUser, target: 'admin' | 'cc') => void;
  disabled?: boolean;
}>
  = ({ onPick, disabled }) => {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<GraphUser[]>([]);
  const search = useCallback(async () => {
    if (!q.trim()) { setRows([]); return; }
    setBusy(true);
    try {
      const token = await getGraphToken(['User.ReadBasic.All']);
      const users = await getUsers(token, { search: q.trim(), top: 8, maxPages: 1 });
      setRows(users);
    } catch {
      setRows([]);
    } finally { setBusy(false); }
  }, [q]);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users (name/email)"
               className="input" disabled={disabled} />
        <button className="btn ghost sm" onClick={search} disabled={disabled || busy}>Search</button>
      </div>
      {busy ? <div className="small muted">Searching…</div> : rows.length > 0 ? (
        <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
          {rows.map((u) => (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{u.displayName || u.userPrincipalName}</div>
                <div className="small muted">{u.mail || u.userPrincipalName}</div>
              </div>
              <div className="small muted">{u.jobTitle || '—'}</div>
              <button className="btn sm" onClick={() => onPick(u, 'admin')} disabled={disabled}>Add Admin</button>
              <button className="btn ghost sm" onClick={() => onPick(u, 'cc')} disabled={disabled}>Add CC</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const AdminSection: React.FC<{
  admins: string[];
  input: string;
  onInput: (v: string) => void;
  onAdd: () => void;
  onRemove: (email: string) => void;
  saving: boolean;
  canEdit: boolean;
}> = ({ admins, input, onInput, onAdd, onRemove, saving, canEdit }) => (
  <div>
    <div className="small muted" style={{ marginBottom: 6 }}>Admins</div>
    <EmailChips items={admins} onRemove={onRemove} emptyLabel="No admins yet" disabled={saving || !canEdit} />
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <input className="input" value={input} onChange={(e) => onInput(e.target.value)} placeholder="add admin email" disabled={saving || !canEdit} />
      <button className="btn sm" onClick={onAdd} disabled={saving || !canEdit}>Add</button>
    </div>
  </div>
);

const CcSection: React.FC<{
  cc: string[];
  input: string;
  onInput: (v: string) => void;
  onAdd: () => void;
  onRemove: (email: string) => void;
  saving: boolean;
  canEdit: boolean;
}> = ({ cc, input, onInput, onAdd, onRemove, saving, canEdit }) => (
  <div>
    <div className="small muted" style={{ marginBottom: 6 }}>CC (optional)</div>
    <EmailChips items={cc} onRemove={onRemove} emptyLabel="No CC yet" disabled={saving || !canEdit} />
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <input className="input" value={input} onChange={(e) => onInput(e.target.value)} placeholder="add cc email" disabled={saving || !canEdit} />
      <button className="btn ghost sm" onClick={onAdd} disabled={saving || !canEdit}>Add</button>
    </div>
  </div>
);

const GraphAddSection: React.FC<{ onPick: (u: GraphUser, target: 'admin' | 'cc') => void; saving: boolean; canEdit: boolean }>
  = ({ onPick, saving, canEdit }) => (
  <div>
    <div className="small muted" style={{ marginBottom: 6 }}>Add from Microsoft Graph</div>
    <GraphUserSearch onPick={onPick} disabled={saving || !canEdit} />
  </div>
);

const useBusinessRecipients = (bizId: string | number, apiBase: string) => {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [inputAdmin, setInputAdmin] = useState('');
  const [inputCc, setInputCc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/businesses/${encodeURIComponent(String(bizId))}/admins`);
      const j = await res.json();
      setAdmins(Array.isArray(j?.emails) ? j.emails : []);
      setCc(Array.isArray(j?.cc) ? j.cc : []);
    } catch {
      setAdmins([]); setCc([]);
    } finally { setLoading(false); }
  }, [apiBase, bizId]);
  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (nextAdmins: string[], nextCc: string[]) => {
    setSaving(true);
    try {
      await fetch(`${apiBase}/api/businesses/${encodeURIComponent(String(bizId))}/admins`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails: nextAdmins, cc: nextCc })
      }).then((r) => { if (!r.ok) throw new Error('save_failed'); });
      setAdmins(nextAdmins); setCc(nextCc);
    } finally { setSaving(false); }
  }, [apiBase, bizId]);

  const addAdmin = useCallback(() => {
    const v = inputAdmin.trim().toLowerCase(); if (!v || !v.includes('@') || admins.includes(v)) return;
    setInputAdmin(''); void save([...admins, v], cc);
  }, [inputAdmin, admins, cc, save]);

  const addCc = useCallback(() => {
    const v = inputCc.trim().toLowerCase(); if (!v || !v.includes('@') || cc.includes(v)) return;
    setInputCc(''); void save(admins, [...cc, v]);
  }, [inputCc, admins, cc, save]);

  const removeAdmin = useCallback((e: string) => { void save(admins.filter((x) => x !== e), cc); }, [admins, cc, save]);
  const removeCc = useCallback((e: string) => { void save(admins, cc.filter((x) => x !== e)); }, [admins, cc, save]);

  const onPick = useCallback((u: GraphUser, target: 'admin' | 'cc') => {
    const addr = String(u.mail || u.userPrincipalName || '').toLowerCase(); if (!addr) return;
    if (target === 'admin') { if (admins.includes(addr)) return; void save([...admins, addr], cc); }
    else { if (cc.includes(addr)) return; void save(admins, [...cc, addr]); }
  }, [admins, cc, save]);

  return { saving, loading, admins, cc, inputAdmin, setInputAdmin, inputCc, setInputCc, addAdmin, addCc, removeAdmin, removeCc, onPick };
};

const BusinessRow: React.FC<{ biz: Biz; canEdit: boolean; onSaved: () => void; onDeleted: () => void }> = ({ biz, canEdit, onSaved, onDeleted }) => {
  const apiBase = (getApiBase() as string) || '';
  const { saving, loading, admins, cc, inputAdmin, setInputAdmin, inputCc, setInputCc, addAdmin, addCc, removeAdmin, removeCc, onPick } =
    useBusinessRecipients(biz.id, apiBase);
  const initials = useMemo(() => (biz.name || 'B').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase(), [biz.name]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(biz.name || '');
  const [editCode, setEditCode] = useState(biz.code || '');
  const [editActive, setEditActive] = useState<boolean>(biz.isActive ?? true);
  const [busy, setBusy] = useState(false);

  const onSaveEdit = useCallback(async () => {
    if (!canEdit) return;
    const payload: any = { name: editName.trim() };
    if (editCode.trim()) payload.code = editCode.trim();
    payload.isActive = !!editActive;
    setBusy(true);
    try {
      const idNum = Number(biz.id);
      await updateBusiness(Number.isFinite(idNum) ? idNum : String(biz.id), payload);
      setIsEditing(false);
      showToast('Business updated', 'success');
      onSaved();
    } catch {
      showToast('Failed to update business', 'error');
    } finally { setBusy(false); }
  }, [canEdit, editName, editCode, editActive, biz.id, onSaved]);

  const onDelete = useCallback(async () => {
    if (!canEdit) return;
    const ok = await confirmDialog('Delete this business?', 'This will unassign it from any recipients mapped to it.', 'Delete', 'Cancel', { icon: 'warning' as any });
    if (!ok) return;
    setBusy(true);
    try {
      const idNum = Number(biz.id);
      await deleteBusiness(Number.isFinite(idNum) ? idNum : String(biz.id));
      showToast('Business deleted', 'success');
      onDeleted();
    }
    catch { showToast('Failed to delete business', 'error'); }
    finally { setBusy(false); }
  }, [canEdit, biz.id, onDeleted]);

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 14, borderRadius: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eef2ff', color: '#2a36a4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
            {initials}
          </div>
          {isEditing ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="input" style={{ width: 220 }} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Business name" />
                <input className="input" style={{ width: 160 }} value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="Code" />
                <label className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={!!editActive} onChange={(e) => setEditActive(e.target.checked)} /> Active
                </label>
              </div>
              <div className="small muted">{admins.length} admin{admins.length !== 1 ? 's' : ''} · {cc.length} cc</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{biz.name}</div>
              {biz.code ? <span className="badge" style={{ background: '#f3f4f6', color: '#374151' }}>{biz.code}</span> : null}
              <span className="badge" style={{ background: biz.isActive ? '#ecfdf5' : '#fef2f2', color: biz.isActive ? '#065f46' : '#991b1b' }}>
                {biz.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading ? <div className="small muted">Loading…</div> : null}
          {canEdit && (
            isEditing ? (
              <>
                <button className="btn sm" onClick={onSaveEdit} disabled={busy || saving}>Save</button>
                <button className="btn ghost sm" onClick={() => { setIsEditing(false); setEditName(biz.name || ''); setEditCode(biz.code || ''); setEditActive(biz.isActive ?? true); }} disabled={busy || saving}>Cancel</button>
              </>
            ) : (
              <>
                <button className="btn ghost sm" onClick={() => setIsEditing(true)} disabled={busy || saving}>Edit</button>
                <button className="btn ghost sm" onClick={onDelete} disabled={busy || saving}>Delete</button>
              </>
            )
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <AdminSection
          admins={admins}
          input={inputAdmin}
          onInput={setInputAdmin}
          onAdd={addAdmin}
          onRemove={removeAdmin}
          saving={saving}
          canEdit={canEdit}
        />
        <CcSection
          cc={cc}
          input={inputCc}
          onInput={setInputCc}
          onAdd={addCc}
          onRemove={removeCc}
          saving={saving}
          canEdit={canEdit}
        />
      </div>
      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
        <GraphAddSection onPick={onPick} saving={saving} canEdit={canEdit} />
      </div>
    </div>
  );
};

type BusinessesManagerProps = { canEdit?: boolean };

const BusinessesManager: React.FC<BusinessesManagerProps> = ({ canEdit = true }) => {
  const apiBase = (getApiBase() as string) || '';
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Biz[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Prefer the stable active endpoint; fallback to full list if needed
      let j: any = [];
      try {
        const resActive = await fetch(`${apiBase}/api/businesses/active`);
        if (resActive.ok) {
          j = await resActive.json();
        } else {
          const res = await fetch(`${apiBase}/api/businesses`);
          j = await res.json();
        }
      } catch {
        try {
          const res = await fetch(`${apiBase}/api/businesses`);
          j = await res.json();
        } catch {
          j = [];
        }
      }
      const mapped = mapBusinesses(j);
      setItems(mapped);
      if (!selectedId && mapped.length > 0) setSelectedId(mapped[0].id);
    } catch {
      setItems([]);
    } finally { setLoading(false); }
  }, [apiBase, selectedId]);
  useEffect(() => { void load(); }, [load]);

  const header = useMemo(() => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Businesses</h3>
        <span className="small muted">{items.length} total</span>
        {canEdit && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="input" style={{ width: 200 }} placeholder="New business name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="input" style={{ width: 140 }} placeholder="Code (optional)" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            <button className="btn sm" disabled={adding || !newName.trim()} onClick={async () => {
              if (!newName.trim()) return;
              setAdding(true);
              try {
                await createBusiness({ name: newName.trim(), code: newCode.trim() || undefined, isActive: true });
                setNewName(''); setNewCode('');
                showToast('Business created', 'success');
                await load();
                // Select the newly created business (best-effort: pick first by name)
                const next = items.find(b => b.name.toLowerCase() === newName.trim().toLowerCase());
                if (next) setSelectedId(next.id);
              } catch { showToast('Failed to create business', 'error'); }
              finally { setAdding(false); }
            }}>Add</button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="segmented" style={{ display: 'inline-flex', gap: 6 }}>
          <button className={`btn ghost sm ${status==='all' ? 'active' : ''}`} onClick={() => setStatus('all')}>All</button>
          <button className={`btn ghost sm ${status==='active' ? 'active' : ''}`} onClick={() => setStatus('active')}>Active</button>
          <button className={`btn ghost sm ${status==='inactive' ? 'active' : ''}`} onClick={() => setStatus('inactive')}>Inactive</button>
        </div>
        <input className="input" placeholder="Search by name" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn ghost sm" onClick={load} disabled={loading}>Refresh</button>
      </div>
    </div>
  ), [load, loading, items, filter, canEdit, newName, newCode, adding, status]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let base = items;
    if (status === 'active') base = items.filter(b => b.isActive !== false);
    else if (status === 'inactive') base = items.filter(b => b.isActive === false);
    if (!q) return base;
    return base.filter((b) => b.name.toLowerCase().includes(q));
  }, [items, filter, status]);

  return (
    <div>
      {header}
      {loading ? (
        <div className="small muted">Loading businesses…</div>
      ) : filtered.length === 0 ? (
        <div className="small muted">No businesses.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
          <div className="card" style={{ padding: 10, borderRadius: 12, maxHeight: 520, overflow: 'auto' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {filtered.map((b) => {
                const active = (selectedId === b.id);
                return (
                  <button
                    key={String(b.id)}
                    className="btn ghost"
                    style={{ justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: active ? '#f3f4f6' : 'transparent' }}
                    onClick={() => setSelectedId(b.id)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge" style={{ background: '#eef2ff', color: '#2a36a4' }}>{String(b.name).slice(0,1).toUpperCase()}</span>
                      <span style={{ fontWeight: 600 }}>{b.name}</span>
                      {b.code ? <span className="small muted">({b.code})</span> : null}
                    </span>
                    <span className="small" style={{ color: b.isActive ? '#065f46' : '#991b1b' }}>{b.isActive ? 'Active' : 'Inactive'}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            {(() => {
              const sel = filtered.find(b => b.id === selectedId) || filtered[0];
              return sel ? (
                <BusinessRow key={String(sel.id)} biz={sel} canEdit={canEdit} onSaved={load} onDeleted={async () => { await load(); setSelectedId(filtered[1]?.id || null); }} />
              ) : (
                <div className="small muted">Select a business to manage details.</div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessesManager;
