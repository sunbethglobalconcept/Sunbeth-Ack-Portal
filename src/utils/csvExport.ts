const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
const toCsv = (rows: any[], headers: string[]): string => {
  const head = headers.map(esc).join(',');
  const body = rows.map(r => headers.map(h => esc(r[h])).join(',')).join('\n');
  return head + '\n' + body;
};

const triggerDownload = (filename: string, content: string, mime = 'text/csv;charset=utf-8;') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
};

type ExportOpts = { year?: number | string, adminEmail?: string };

/**
 * Export a single CSV with full acknowledgement detail (business + user + batch + document).
 */
export const exportAnalyticsCsvFull = async (opts: ExportOpts = {}) => {
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
  const year = String((opts.year ?? new Date().getFullYear()));
  const adminEmail = String(opts.adminEmail || '').trim().toLowerCase();
  // Recipient map to enrich acknowledgement rows
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

  // Acknowledgements (single CSV: business + user + batch + document)
  try {
    const ackRes = await tryFetchJson('/api/ack-report?limit=5000');
    const rows = Array.isArray((ackRes as any)?.items) ? (ackRes as any).items : Array.isArray(ackRes) ? ackRes : [];
    const headersList = [
      'year','ackId','acknowledged','acknowledgedAt','businessId','businessName','batchId','batchName','batchCreatedAt','dueDate','documentId','documentTitle','documentVersion','documentSource','documentUrl','email','displayName','department','primaryGroup','jobTitle','location'
    ];
    const csv = toCsv(rows.map((r: any) => ({
      year: String(year),
      ackId: String(r.ackId || ''),
      acknowledged: r.acknowledged ?? '',
      acknowledgedAt: String(r.acknowledgedAt || ''),
      businessId: r.businessId != null ? String(r.businessId) : (recMap.get(recKey(r.batchId, r.email))?.businessId || ''),
      businessName: String(r.businessName || ''),
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
    })), headersList);
    triggerDownload(`acknowledgements-${year}.csv`, csv);
    return;
  } catch (e) {
    console.warn('Acknowledgements export failed or unavailable', e);
  }

  // Even if empty or failed, download a headers-only CSV to make the action predictable
  const headersList = [
    'year','ackId','acknowledged','acknowledgedAt','businessId','businessName','batchId','batchName','batchCreatedAt','dueDate','documentId','documentTitle','documentVersion','documentSource','documentUrl','email','displayName','department','primaryGroup','jobTitle','location'
  ];
  const csv = toCsv([], headersList);
  triggerDownload(`acknowledgements-${year}.csv`, csv);
};
