/* eslint-disable complexity, max-lines-per-function */
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface ConsentRow {
  email?: string;
  batchId?: string;
  batchName?: string;
  consentedAt?: string;
  receiptId?: string;
  version?: number | string | null;
  businessId?: string | number | null;
  businessName?: string;
  department?: string;
  year?: string;
}

const getApiBases = () => {
  const envBase = (process.env.REACT_APP_API_BASE || '').replace(/\/$/, '');
  const hinted =
    typeof window !== 'undefined' && ((window as any).__API_BASE__ || (window as any).API_BASE)
      ? String((window as any).__API_BASE__ || (window as any).API_BASE).replace(/\/$/, '')
      : '';
  const local = 'http://127.0.0.1:4000';
  return Array.from(new Set([envBase, hinted, local].filter(Boolean)));
};

const getFirebaseRtdUrl = () =>
  (process.env.REACT_APP_FIREBASE_RTD_URL || 'https://sunbeth-ack-portal-default-rtdb.firebaseio.com').replace(/\/$/, '');

const fetchFirebaseBusinesses = async () => {
  try {
    const url = `${getFirebaseRtdUrl()}/tables/businesses.json`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`firebase_businesses_fetch_failed_${r.status}`);
    const json = await r.json();
    const arr = Array.isArray(json) ? json : (json && typeof json === 'object' ? Object.values(json) : []);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('firebase_businesses_fetch_failed', e);
    return [];
  }
};

const fetchUserBusinesses = async () => {
  try {
    const url = `${getFirebaseRtdUrl()}/tables/user_businesses.json`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`user_businesses_fetch_failed_${r.status}`);
    const json = await r.json();
    const arr = Array.isArray(json) ? json : (json && typeof json === 'object' ? Object.values(json) : []);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('user_businesses_fetch_failed', e);
    return [];
  }
};

const tryFetchJson = async (path: string) => {
  const bases = getApiBases();
  let lastErr: any = null;
  for (const b of bases) {
    try {
      const r = await fetch(`${b}${path}`);
      if (r.ok) return await r.json();
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  throw new Error('All API bases failed');
};

const normalizeRows = (res: any): ConsentRow[] => {
  const items = Array.isArray(res?.items)
    ? res.items
    : Array.isArray(res?.consents)
      ? res.consents
      : Array.isArray(res)
        ? res
        : [];
  return items.map((r: any) => ({
    email: r.email || '',
    batchId: r.batchId || r.batch_id || '',
    batchName: r.batchName || r.batch_name || r.toba_name || '',
    consentedAt: r.consentedAt || r.consented_at || r.createdAt || r.created_at || '',
    receiptId: r.receiptId || r.receipt_id || '',
    version: r.version ?? r.legalVersion ?? r.legal_version ?? null,
    businessId: r.businessId ?? r.business_id ?? null,
    businessName: r.businessName || r.business || r.business_name || '',
    department: r.department || '',
    year: r.year ?? null,
  }));
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

const buildRecipientKey = (batchId?: string | number | null, email?: string) => {
  const b = String(batchId ?? '').trim();
  const e = String(email ?? '').trim().toLowerCase();
  return b && e ? `${b}|${e}` : '';
};

const fetchRecipientsIndex = async () => {
  try {
    const res = await tryFetchJson('/api/recipients?limit=5000');
    const arr = Array.isArray(res) ? res : [];
    const map = new Map<string, any>();
    for (const r of arr) {
      const key = buildRecipientKey(r.batchId || r.batch_id, r.email || r.user);
      if (key) map.set(key, r);
    }
    return map;
  } catch (e) {
    console.warn('recipients_fetch_failed', e);
    return new Map<string, any>();
  }
};

const fetchBatchesIndex = async () => {
  try {
    const res = await tryFetchJson('/api/batches');
    const arr = Array.isArray(res) ? res : [];
    return new Map<string, string>(
      arr.map((b: any) => [String(b.id || b.toba_batchid || b.batchId || ''), String(b.name || b.toba_name || '')])
    );
  } catch (e) {
    console.warn('batches_fetch_failed', e);
    return new Map<string, string>();
  }
};

const fetchBusinessesIndex = async () => {
  try {
    const [apiBiz, fbBiz] = await Promise.all([
      tryFetchJson('/api/businesses').catch(() => []),
      fetchFirebaseBusinesses(),
    ]);
    const arr = [
      ...(Array.isArray(apiBiz) ? apiBiz : []),
      ...(Array.isArray(fbBiz) ? fbBiz : []),
    ];
    return new Map<string, string>(arr.map((b: any) => [
      String(b.id || b.businessId || b.business_id || b.businessid || b.toba_businessid || ''),
      String(b.name || b.business_name || b.code || b.displayName || b.legal_name || '')
    ]));
  } catch (e) {
    console.warn('businesses_fetch_failed', e);
    return new Map<string, string>();
  }
};

const enrichRows = async (rows: ConsentRow[]): Promise<ConsentRow[]> => {
  if (!rows.length) return [];
  const [recipientsIndex, batchesIndex, businessesIndex, userBiz] = await Promise.all([
    fetchRecipientsIndex(),
    fetchBatchesIndex(),
    fetchBusinessesIndex(),
    fetchUserBusinesses(),
  ]);

  const userBizMap = new Map<string, string>();
  for (const ub of Array.isArray(userBiz) ? userBiz : []) {
    const email = String(ub.email || '').trim().toLowerCase();
    const bid = String(ub.businessId || ub.business_id || '').trim();
    if (email && bid) userBizMap.set(email, bid);
  }

  const enriched = [...rows]
    .sort((a, b) => String(b.consentedAt || '').localeCompare(String(a.consentedAt || '')))
    .map((r) => {
      const key = buildRecipientKey(r.batchId, r.email);
      const rec = key ? recipientsIndex.get(key) || {} : {};
      const email = String(r.email || '').trim().toLowerCase();
      const businessId = r.businessId
        ?? rec.businessId
        ?? rec.business_id
        ?? (email ? userBizMap.get(email) || null : null);
      const businessName = r.businessName
        || (businessId != null ? businessesIndex.get(String(businessId)) || '' : '')
        || '';
      const department = r.department || rec.department || '';
      const batchName = r.batchName || batchesIndex.get(String(r.batchId || '')) || '';
      const year = r.year || (r.consentedAt ? String(new Date(r.consentedAt).getFullYear()) : '');

      return {
        ...r,
        department,
        businessId,
        businessName,
        batchName,
        year,
      };
    });

  // Sort by business name (asc), then department (asc), then newest consent first
  enriched.sort((a, b) => {
    const bizCmp = String(a.businessName || '').localeCompare(String(b.businessName || ''));
    if (bizCmp !== 0) return bizCmp;
    const deptCmp = String(a.department || '').localeCompare(String(b.department || ''));
    if (deptCmp !== 0) return deptCmp;
    return String(b.consentedAt || '').localeCompare(String(a.consentedAt || ''));
  });

  return enriched;
};

const ConsentTable: React.FC<{ rows: ConsentRow[] }> = ({ rows }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ backgroundColor: '#f8f9fa' }}>
          <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Employee</th>
          <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Batch</th>
          <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Department</th>
          <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Business</th>
          <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Year</th>
          <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Consented On</th>
          <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Version</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => {
          const key = r.receiptId || `${r.email || 'user'}-${r.batchId || 'batch'}-${r.consentedAt || idx}-${idx}`;
          return (
            <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: 10, fontWeight: 600 }}>{r.email || '—'}</td>
              <td style={{ padding: 10 }}>
                <div style={{ fontWeight: 600 }}>{r.batchName || '—'}</div>
                <div className="small muted">{r.batchId ? `Batch ${r.batchId}` : ''}</div>
              </td>
              <td style={{ padding: 10 }}>{r.department || '—'}</td>
              <td style={{ padding: 10 }}>{r.businessName || '—'}</td>
              <td style={{ padding: 10 }}>{r.year || '—'}</td>
              <td style={{ padding: 10 }}>{formatDate(r.consentedAt)}</td>
              <td style={{ padding: 10 }}>{r.version != null ? String(r.version) : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default function EmployeeConsentReport() {
  const { account } = useAuth();
  const [emailFilter, setEmailFilter] = useState('');
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFirebaseConsents = useCallback(async (): Promise<{ rows: ConsentRow[]; total: number }> => {
    try {
      const base = getFirebaseRtdUrl();
      const url = `${base}/tables/consents.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`firebase_fetch_failed_${res.status}`);
      const json = await res.json();
      if (!json) return { rows: [], total: 0 };
      const arr: any[] = Array.isArray(json)
        ? json
        : typeof json === 'object'
          ? Object.values(json)
          : [];
      const normalized = arr
        .map((r: any) => ({
          email: r.email || r.user || '',
          batchId: r.batchId || r.batch_id || '',
          consentedAt: r.consentedAt || r.consented_at || r.createdAt || r.created_at || '',
          receiptId: r.receiptId || r.receipt_id || r.id || '',
          version: r.version ?? r.legalVersion ?? r.legal_version ?? null,
          businessId: r.businessId ?? r.business_id ?? null,
        }))
        .filter((r) => {
          if (!emailFilter.trim()) return true;
          return (r.email || '').toLowerCase().includes(emailFilter.trim().toLowerCase());
        });
      // Sort newest first and apply local pagination
      normalized.sort((a, b) => String(b.consentedAt || '').localeCompare(String(a.consentedAt || '')));
      const start = (page - 1) * pageSize;
      const paged = normalized.slice(start, start + pageSize);
      return { rows: paged, total: normalized.length };
    } catch (e) {
      setError((e as any)?.message || 'Failed to load consents');
      return { rows: [], total: 0 };
    }
  }, [emailFilter, page, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      const adminEmail = account?.username || '';
      if (adminEmail) qs.set('adminEmail', adminEmail);
      if (emailFilter.trim()) qs.set('email', emailFilter.trim());
      qs.set('limit', String(pageSize));
      qs.set('offset', String((page - 1) * pageSize));
      const res = await tryFetchJson(`/api/admin/consents/export?${qs.toString()}`);
      const normalized = normalizeRows(res);
      const totalFromApi = Number(res?.total ?? res?.items?.length ?? res?.consents?.length ?? 0);

      let nextRows = normalized;
      let nextTotal = totalFromApi;

      // If API returned nothing, fallback to Firebase RTDB directly
      if (!totalFromApi) {
        const fb = await fetchFirebaseConsents();
        nextRows = fb.rows;
        nextTotal = fb.total;
      }

      const enriched = await enrichRows(nextRows);
      setRows(enriched);
      setTotal(nextTotal);
    } catch (e: any) {
      // Fallback to Firebase if admin API is forbidden/unavailable
      const fb = await fetchFirebaseConsents();
      if (fb.total > 0) {
        const enriched = await enrichRows(fb.rows);
        setRows(enriched);
        setTotal(fb.total);
      } else {
        setError(e?.message || 'Failed to load consents');
        setRows([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [account?.username, emailFilter, page, pageSize, fetchFirebaseConsents]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Employee Consent Report</h3>
          <div className="small muted">Row-level consents with batch, department, business, and year.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="consent-email-filter" className="small">Email filter:</label>
          <input
            id="consent-email-filter"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            placeholder="user@company.com"
            style={{ minWidth: 200 }}
          />
          <button className="btn ghost sm" onClick={load}>Refresh</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="small muted">{total ? `${total.toLocaleString()} records` : 'No records'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>◀ Prev</button>
          <span className="small muted">Page {page}</span>
          <button className="btn ghost sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next ▶</button>
        </div>
      </div>

      {loading && <div className="small muted">Loading consent records...</div>}
      {error && <div style={{ color: '#dc3545' }}>{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="small muted">No consent records found for this selection.</div>
      )}
      {!loading && !error && rows.length > 0 && <ConsentTable rows={rows} />}
    </div>
  );
}
