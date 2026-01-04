/* eslint-disable max-lines-per-function, complexity */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth as useAuthCtx } from '../../context/AuthContext';
import { getUsers, getOrganizationStructure, type GraphUser } from '../../services/graphUserService';
import { getBusinesses } from '../../services/dbService';
import { apiPut } from '../../services/api';
import { getApiBase, isSQLiteEnabled } from '../../utils/runtimeConfig';
import ExternalUsersManager from '../ExternalUsersManager';
import { showToast } from '../../utils/alerts';

const UsersManagement: React.FC<{ canManageExternal: boolean }> = ({ canManageExternal }) => {
  const { getToken, account } = useAuthCtx();
  const sqliteEnabled = isSQLiteEnabled();
  const [org, setOrg] = useState<{ departments: string[]; jobTitles: string[]; locations: string[] }>({ departments: [], jobTitles: [], locations: [] });
  const [orgLoaded, setOrgLoaded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<{ department?: string; jobTitle?: string; location?: string }>({});
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<GraphUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [businesses, setBusinesses] = useState<Array<{ id: string | number; name: string }>>([]);
  const [assignBizId, setAssignBizId] = useState<string>('');
  const [maxPages, setMaxPages] = useState(1);

  // Lazy-load org structure when filters are first opened
  useEffect(() => {
    (async () => {
      if (!filtersOpen || orgLoaded) return;
      try {
        const tk = await getToken?.(['User.Read.All']);
        if (!tk) return;
        const o = await getOrganizationStructure(tk);
        setOrg(o);
        setOrgLoaded(true);
      } catch { /* ignore */ }
    })();
  }, [filtersOpen, orgLoaded, getToken]);

  // Lazy-load businesses when assignment UI is used
  const businessesLoadedRef = useRef(false);
  const ensureBusinesses = useCallback(async () => {
    if (businessesLoadedRef.current) return;
    try {
      if (!sqliteEnabled) return;
      const list = await getBusinesses();
      const mapped = Array.isArray(list) ? list.map((b: any) => ({ id: b.id, name: b.name || b.code || String(b.id) })) : [];
      setBusinesses(mapped);
      businessesLoadedRef.current = true;
    } catch {
      setBusinesses([]);
      businessesLoadedRef.current = true;
    }
  }, [sqliteEnabled]);

  // Debounce search input to reduce calls
  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(h);
  }, [query]);

  const loadUsers = useCallback(async () => {
    setError(null);
    const hasFilters = !!(filters.department || filters.jobTitle || filters.location);
    const hasQuery = !!(debouncedQuery && debouncedQuery.trim().length >= 2);
    if (!hasFilters && !hasQuery) {
      // Guard: do not fetch or show loading when nothing to query
      setLoading(false);
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const tk = await getToken?.(['User.Read.All']);
      if (!tk) { setUsers([]); return; }
      const list = await getUsers(tk, { search: debouncedQuery, department: filters.department, jobTitle: filters.jobTitle, location: filters.location, top: 100, maxPages });
      // Deduplicate across pages by email
      const byEmail = new Map<string, GraphUser>();
      for (const u of list) {
        const email = (u.mail || u.userPrincipalName || u.id || '').toString().toLowerCase();
        if (!email) continue;
        if (!byEmail.has(email)) byEmail.set(email, u);
      }
      setUsers(Array.from(byEmail.values()));
    } catch (e: any) {
      setError(e?.message || 'Failed to load users');
      setUsers([]);
    } finally { setLoading(false); }
  }, [getToken, debouncedQuery, filters.department, filters.jobTitle, filters.location, maxPages]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(users.map(u => (u.mail || u.userPrincipalName || u.id || '').toString().toLowerCase()).filter(Boolean)));
    else setSelected(new Set());
  };
  const toggleOne = (email: string, checked: boolean) => {
    setSelected(prev => { const n = new Set(prev); if (checked) n.add(email.toLowerCase()); else n.delete(email.toLowerCase()); return n; });
  };

  const base = (getApiBase() as string) || '';
  const canAssign = useMemo(() => sqliteEnabled && base && selected.size > 0 && !!assignBizId, [sqliteEnabled, base, selected, assignBizId]);

  const assignBusiness = async () => {
    if (!canAssign) return;
    const bid = assignBizId;
    try {
      let okCount = 0; let failCount = 0;
      for (const em of selected) {
        try {
          await apiPut(`/api/users/${encodeURIComponent(em)}/business`, { businessId: bid });
          okCount++;
        } catch { failCount++; }
      }
      if (okCount > 0) showToast(`Assigned business to ${okCount} user(s)`, 'success');
      if (failCount > 0) showToast(`Failed to assign ${failCount} user(s)`, 'warning');
    } catch { showToast('Assignment failed', 'error'); }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Internal Users */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Internal Users (Microsoft Entra ID)</div>
        <div className="small muted" style={{ marginBottom: 12 }}>Search employees and assign businesses. Open filters for advanced narrowing.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
          <input placeholder="Search name or email" value={query} onChange={e => setQuery(e.target.value)} />
          <button className="btn ghost sm" onClick={() => setFiltersOpen(v => !v)} aria-expanded={filtersOpen} aria-controls="userFiltersPanel">{filtersOpen ? 'Hide Filters' : 'Show Filters'}</button>
        </div>
        {filtersOpen && (
          <div id="userFiltersPanel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <select value={filters.department || ''} onChange={e => setFilters(f => ({ ...f, department: e.target.value || undefined }))}>
              <option value="">All Departments</option>
              {org.departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filters.jobTitle || ''} onChange={e => setFilters(f => ({ ...f, jobTitle: e.target.value || undefined }))}>
              <option value="">All Job Titles</option>
              {org.jobTitles.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
            <select value={filters.location || ''} onChange={e => setFilters(f => ({ ...f, location: e.target.value || undefined }))}>
              <option value="">All Locations</option>
              {org.locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <label htmlFor="assignBiz" className="small">Assign Business</label>
          <select id="assignBiz" value={assignBizId} onFocus={() => { void ensureBusinesses(); }} onChange={e => setAssignBizId(e.target.value)}>
            <option value="">Select business…</option>
            {businesses.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </select>
          <button className="btn sm" onClick={assignBusiness} disabled={!canAssign}>Apply to Selected</button>
          <div className="small muted" style={{ marginLeft: 8 }}>Signed in as: {account?.username}</div>
        </div>
        <div className="table" style={{ overflow: 'auto', maxHeight: 360, border: '1px solid #eee', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: 36, padding: 8 }}>
                  <input type="checkbox" checked={users.length>0 && users.every(u => selected.has((u.mail||u.userPrincipalName||u.id||'').toLowerCase()))} onChange={e => toggleAll(e.target.checked)} />
                </th>
                <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Email</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Department</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Job Title</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Location</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 12 }}>Loading users…</td></tr>
              ) : error ? (
                <tr><td colSpan={6} style={{ padding: 12, color: 'red' }}>{error}</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 12 }} className="small muted">{(filters.department || filters.jobTitle || filters.location) ? 'No users match your filters.' : 'Type at least 2 characters to search users.'}</td></tr>
              ) : (
                users.map(u => {
                  const email = (u.mail || u.userPrincipalName || '').toLowerCase();
                  return (
                    <tr key={u.id || email} style={{ borderTop: '1px solid #f2f2f2' }}>
                      <td style={{ padding: 8 }}>
                        <input type="checkbox" checked={selected.has(email)} onChange={e => toggleOne(email, e.target.checked)} />
                      </td>
                      <td style={{ padding: 8 }}>{u.displayName || email}</td>
                      <td style={{ padding: 8 }}>{email}</td>
                      <td style={{ padding: 8 }}>{u.department || ''}</td>
                      <td style={{ padding: 8 }}>{u.jobTitle || ''}</td>
                      <td style={{ padding: 8 }}>{(u as any).officeLocation || ''}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Load more for large directories */}
        {!loading && !error && users.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn ghost sm" onClick={() => setMaxPages(p => Math.min(50, p + 1))}>Load more</button>
          </div>
        )}
      </div>

      {/* External Users */}
      {canManageExternal && (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>External Users (Guests)</div>
          <div className="small muted" style={{ marginBottom: 8 }}>Invite, bulk upload, update, disable, or delete external users.</div>
          <ExternalUsersManager canEdit={true} />
        </div>
      )}
    </div>
  );
};

export default UsersManagement;
