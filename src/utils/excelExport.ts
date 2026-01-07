/* eslint-disable max-lines, complexity, max-lines-per-function */
import * as XLSX from 'xlsx';

type ExportOpts = { year?: number | string, adminEmail?: string };

/**
 * Export a single, management-ready acknowledgement sheet (business + user + batch + document).
 */
export const exportAnalyticsExcel = async (opts: ExportOpts = {}) => {
  const getApiBases = () => {
    const envBase = (process.env.REACT_APP_API_BASE || '').replace(/\/$/, '');
    const hinted = (typeof window !== 'undefined' && ((window as any).__API_BASE__ || (window as any).API_BASE))
      ? String((window as any).__API_BASE__ || (window as any).API_BASE).replace(/\/$/, '')
      : '';
    const local = 'http://127.0.0.1:4000';
    return Array.from(new Set([envBase, hinted, local].filter(Boolean)));
  };
  const tryFetchJson = async (path: string) => {
    const bases = getApiBases();
    let lastErr: any = null;
    for (const b of bases) {
      try {
        const r = await fetch(`${b}${path}`);
        if (r.ok) return await r.json();
      } catch (e) { lastErr = e; }
    }
    if (lastErr) throw lastErr;
    throw new Error('All API base candidates failed: ' + bases.join(', '));
  };
  const getFirebaseRtdUrl = () => (process.env.REACT_APP_FIREBASE_RTD_URL || 'https://sunbeth-ack-portal-default-rtdb.firebaseio.com').replace(/\/$/, '');
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
  const fetchBatches = async () => {
    try {
      const res = await tryFetchJson('/api/batches');
      return Array.isArray(res) ? res : [];
    } catch (e) {
      console.warn('batches_fetch_failed', e);
      return [];
    }
  };
  const fetchConsents = async () => {
    // Prefer admin export; fallback to RTDB if not accessible
    try {
      const res = await tryFetchJson('/api/admin/consents/export?limit=5000');
      const items = Array.isArray((res as any)?.items)
        ? (res as any).items
        : Array.isArray((res as any)?.consents)
          ? (res as any).consents
          : Array.isArray(res)
            ? (res as any)
            : [];
      return items;
    } catch (e) {
      console.warn('consents_export_api_failed', e);
    }
    try {
      const url = `${getFirebaseRtdUrl()}/tables/consents.json`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`rtdb_consents_fetch_failed_${r.status}`);
      const json = await r.json();
      const items = Array.isArray(json) ? json : (json && typeof json === 'object' ? Object.values(json) : []);
      return items;
    } catch (e2) {
      console.warn('consents_export_fallback_failed', e2);
      return [];
    }
  };
  const year = String((opts.year ?? new Date().getFullYear()));
  const adminEmail = String(opts.adminEmail || '').trim().toLowerCase(); // kept for potential auth headers
  const wb = XLSX.utils.book_new();

  // Recipients map to enrich ack rows (job title, location, etc.)
  const recipients = await tryFetchJson('/api/recipients').catch(() => []);
  const recKey = (batchId: any, email: any) => `${String(batchId)}::${String(email || '').toLowerCase()}`;
  const recMap = new Map(
    (Array.isArray(recipients) ? recipients : []).map((r: any) => [
      recKey(r.batchId, r.email || r.user),
      {
        displayName: r.displayName || '',
        department: r.department || '',
        primaryGroup: r.primaryGroup || '',
        jobTitle: r.jobTitle || '',
        location: r.location || '',
        businessId: r.businessId != null ? String(r.businessId) : ''
      }
    ])
  );
  // Business lookup for consents export enrichment
  const [apiBusinesses, fbBusinesses, userBusinesses] = await Promise.all([
    tryFetchJson('/api/businesses').catch(() => []),
    fetchFirebaseBusinesses(),
    fetchUserBusinesses(),
  ]);
  const bizMap = new Map(
    ([...(Array.isArray(apiBusinesses) ? apiBusinesses : []), ...(Array.isArray(fbBusinesses) ? fbBusinesses : [])]).map((b: any) => [
      String(b.id || b.businessId || b.business_id || b.businessid || b.toba_businessid || ''),
      String(b.name || b.business_name || b.code || b.displayName || b.legal_name || b.business || ''),
    ])
  );
  const userBizMap = new Map<string, string>();
  for (const ub of Array.isArray(userBusinesses) ? userBusinesses : []) {
    const email = String(ub.email || '').trim().toLowerCase();
    const bid = String(ub.businessId || ub.business_id || '').trim();
    if (email && bid) userBizMap.set(email, bid);
  }
  // Batch lookup for consents export enrichment
  const batches = await fetchBatches();
  const batchMap = new Map(
    (Array.isArray(batches) ? batches : []).map((b: any) => [String(b.id || b.toba_batchid || b.batchId || ''), String(b.name || b.toba_name || '')])
  );

  // Add Acknowledgements sheet (robust, business + user + batch + document)
  try {
    const ackRes = await tryFetchJson('/api/ack-report?limit=5000');
    const rows = Array.isArray((ackRes as any)?.items) ? (ackRes as any).items : Array.isArray(ackRes) ? ackRes : [];
    const sourceRows = rows.length > 0 ? rows : [];
    const norm = (sourceRows as any[]).map((r: any) => ({
      year: String(year),
      ackId: String(r.ackId || ''),
      acknowledged: r.acknowledged ?? '',
      acknowledgedAt: String(r.acknowledgedAt || ''),
      businessId: r.businessId != null ? String(r.businessId) : (recMap.get(recKey(r.batchId, r.email))?.businessId || ''),
      businessName: String(r.businessName || bizMap.get(String(r.businessId || recMap.get(recKey(r.batchId, r.email))?.businessId || '')) || ''),
      batchId: String(r.batchId || ''),
      batchName: String(r.batchName || ''),
      batchCreatedAt: String(r.batchCreatedAt || ''),
      dueDate: String(r.dueDate || ''),
      documentId: String(r.documentId || ''),
      documentTitle: String(r.documentTitle || ''),
      documentVersion: r.documentVersion != null ? Number(r.documentVersion) : '',
      documentSource: String(r.documentSource || ''),
      documentUrl: String(r.documentUrl || ''),
      email: String(r.email || ''),
      displayName: String(r.displayName || recMap.get(recKey(r.batchId, r.email))?.displayName || ''),
      department: r.department || recMap.get(recKey(r.batchId, r.email))?.department || '',
      primaryGroup: r.primaryGroup || recMap.get(recKey(r.batchId, r.email))?.primaryGroup || '',
      jobTitle: recMap.get(recKey(r.batchId, r.email))?.jobTitle || '',
      location: recMap.get(recKey(r.batchId, r.email))?.location || ''
    }));
    const wsAcks = XLSX.utils.json_to_sheet(norm);
    XLSX.utils.book_append_sheet(wb, wsAcks, 'Acknowledgements');
  } catch (e) {
    // Non-fatal if acks export is unavailable or user lacks permission
    console.warn('Acknowledgements export failed or unavailable', e);
  }

  // Consents sheet (row-level, includes batch, department, business, year)
  try {
    const consents = await fetchConsents();
    const consRows = Array.isArray(consents) ? consents : [];
    const normCons = consRows.map((c: any) => {
      const email = String(c.email || c.user || '');
      const batchId = c.batchId || c.batch_id;
      const rec = (recMap.get(recKey(batchId, email)) || {}) as any;
      const businessIdRaw = c.businessId ?? c.business_id ?? rec.businessId ?? rec.business_id ?? (email ? userBizMap.get(email.toLowerCase()) : '');
      const businessId = businessIdRaw != null ? String(businessIdRaw) : '';
      const businessName = c.businessName || c.business || (businessId ? bizMap.get(businessId) || '' : '');
      const consentedAt = c.consentedAt || c.consented_at || c.createdAt || c.created_at || '';
      const version = c.version ?? c.legalVersion ?? c.legal_version ?? '';
      const batchName = c.batchName || c.batch_name || c.toba_name || batchMap.get(String(batchId || '')) || '';
      const department = c.department || rec.department || '';
      const receiptId = c.receiptId || c.receipt_id || c.id || '';
      const yearFromTs = consentedAt ? String(new Date(consentedAt).getFullYear()) : year;
      return {
        year: yearFromTs,
        businessName,
        email,
        batchName: String(batchName), 
        consentedAt: String(consentedAt),       
        batchId: String(batchId || ''),        
        department: String(department),
        businessId,      
        version: version === null ? '' : String(version),
        receiptId: String(receiptId),
      };
    });
    const wsCons = XLSX.utils.json_to_sheet(normCons);
    XLSX.utils.book_append_sheet(wb, wsCons, 'Consents');
  } catch (e) {
    console.warn('Consents export failed or unavailable', e);
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sunbeth-acknowledgements-${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
