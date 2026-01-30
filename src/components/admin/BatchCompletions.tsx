/* eslint-disable max-lines-per-function, complexity */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiBase } from '../../utils/runtimeConfig';
import { getDocumentsByBatch } from '../../services/dbService';
import { generateUserCompletionPdf } from '../../services/notificationService';

/** Row returned by /api/batches/:id/completions */
type CompletionRow = {
  email: string;
  displayName?: string;
  department?: string;
  jobTitle?: string;
  location?: string;
  primaryGroup?: string;
  businessId?: string | number;
  businessName?: string;
  acknowledged?: number; // count
  total?: number; // count
  completed?: boolean;
  completionAt?: string;
};

const BatchCompletions: React.FC = () => {
  const { id } = useParams();
  const [rows, setRows] = useState<CompletionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [downloadingEmail, setDownloadingEmail] = useState<string | null>(null);
  const [batchName, setBatchName] = useState<string>('');
  const [docTitles, setDocTitles] = useState<string[]>([]);

  const base = (getApiBase() || '').replace(/\/$/, '');

  useEffect(() => {
    if (!id) return;
    setLoading(true); setError(null);
    (async () => {
      try {
        const res = await fetch(`${base}/api/batches/${encodeURIComponent(String(id))}/completions`);
        if (!res.ok) throw new Error(`load_failed_${res.status}`);
        const j = await res.json();
        const items = Array.isArray(j) ? j : (Array.isArray(j?.rows) ? j.rows : []);
        const completed = (items as CompletionRow[]).filter(r => !!r.completed);
        setRows(completed);
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally { setLoading(false); }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // Load documents to list titles in generated PDFs
        const docs = await getDocumentsByBatch(String(id));
        setDocTitles((Array.isArray(docs) ? docs : []).map((d: any) => String(d.toba_title || d.title || 'Document')));
      } catch { setDocTitles([]); }
    })();
  }, [id]);

  // Fetch batch details just for name (optional, best-effort)
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`${base}/api/batches`);
        const j = await res.json();
        const match = (Array.isArray(j) ? j : []).find((b: any) => String(b.toba_batchid || b.id) === String(id));
        setBatchName(String(match?.toba_name || match?.name || `Batch ${id}`));
      } catch { setBatchName(`Batch ${id}`); }
    })();
  }, [id]);

  const hasRows = rows && rows.length > 0;

  const handleDownloadOne = async (r: CompletionRow) => {
    if (!id) return;
    setError(null);
    setDownloadingEmail(r.email);
    try {
      const payload = {
        batchName: batchName || `Batch ${id}`,
        userEmail: r.email,
        userName: r.displayName || r.email,
        completedOn: r.completionAt || new Date().toISOString(),
        documents: docTitles,
        department: r.department,
        jobTitle: r.jobTitle,
        location: r.location,
        businessName: r.businessName,
        primaryGroup: r.primaryGroup,
      };
      const file = await generateUserCompletionPdf(payload);
      const byteCharacters = atob(file.contentBytes);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: file.contentType || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name || `${(r.email || 'user').replace(/[^a-z0-9._-]/gi, '_')}-document-ack.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(`Failed to download PDF for ${r.email}: ${e?.message || e}`);
    } finally {
      setDownloadingEmail(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!id || !hasRows) return;
    setBusyAll(true); setError(null);
    try {
      // Lazy import jszip (keeps build light if unused)
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const folder = zip.folder((batchName || `batch-${id}`).toString().replace(/[^a-z0-9._-]+/gi, '-'));

      for (const r of rows) {
        const payload = {
          batchName: batchName || `Batch ${id}`,
          userEmail: r.email,
          userName: r.displayName || r.email,
          completedOn: r.completionAt || new Date().toISOString(),
          documents: docTitles,
          department: r.department,
          jobTitle: r.jobTitle,
          location: r.location,
          businessName: r.businessName,
          primaryGroup: r.primaryGroup,
        };
        const file = await generateUserCompletionPdf(payload);
        // decode base64
        const byteCharacters = atob(file.contentBytes);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const filename = (file.name || `${(r.email || 'user').replace(/[^a-z0-9._-]/gi, '_')}-document-ack.pdf`).replace(/\/+|\\+/g, '-');
        folder?.file(filename, byteArray);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      const safeBatch = (batchName || `batch-${id}`).replace(/[^a-z0-9._-]+/gi, '-');
      a.download = `${safeBatch}-user-completion-pdfs.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(`Failed to create ZIP: ${e?.message || e}`);
    } finally {
      setBusyAll(false);
    }
  };

  const header = useMemo(() => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div className="title">Completed Users</div>
        <div className="muted small">Download user-completion PDFs for this batch.</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn sm" onClick={handleDownloadAll} disabled={!hasRows || busyAll}>
          {busyAll ? 'Preparing ZIP…' : 'Download All (ZIP)'}
        </button>
        <Link to="/admin"><button className="btn ghost sm">← Admin</button></Link>
      </div>
    </div>
  ), [hasRows, busyAll, batchName, id]);

  return (
    <div className="container">
      <div className="card">
        {header}
        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #f4f4f4' }} />

        {loading ? (
          <div className="muted" style={{ padding: 12 }}>Loading…</div>
        ) : error ? (
          <div className="muted" style={{ padding: 12, color: '#b02a37' }}>{error}</div>
        ) : !hasRows ? (
          <div className="muted" style={{ padding: 12 }}>No completed users yet.</div>
        ) : (
          <div className="doc-list">
            {rows.map((r, i) => (
              <div key={`${r.email}-${i}`} className="doc-row">
                <div className="doc-meta">
                  <div className="doc-icon">USR</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.displayName || r.email}</div>
                    <div className="muted small">{r.email}</div>
                    <div className="muted small">{[r.department, r.jobTitle, r.location, r.businessName].filter(Boolean).join(' • ')}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn sm" onClick={() => handleDownloadOne(r)} disabled={downloadingEmail === r.email}>
                    {downloadingEmail === r.email ? 'Preparing…' : 'Download PDF'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchCompletions;
