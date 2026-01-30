/* eslint-disable max-lines-per-function, complexity */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExternalAuth } from '../context/ExternalAuthContext';
import { getDocumentsByBatch, getAcknowledgedDocIds, getBatches } from '../services/dbService';
import { generateUserCompletionPdf } from '../services/notificationService';
import { getApiBase } from '../utils/runtimeConfig';
import type { Doc } from '../types/models';

const CompletedBatch: React.FC = () => {
  const { id } = useParams();
  const { token, account } = useAuth();
  const { user: externalUser } = useExternalAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [ackIds, setAckIds] = useState<string[]>([]);
  const [batchName, setBatchName] = useState<string>('');
  const [downloading, setDownloading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientRow, setRecipientRow] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
  const list = await getDocumentsByBatch(id);
      setDocs(list);
      const a = await getAcknowledgedDocIds(id, token ?? undefined, account?.username || undefined);
      setAckIds(a);
    })();
  }, [id, token, account?.username]);

  // Fetch batch name for nicer certificate filename and payload
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const email = (account?.username || externalUser?.email || undefined);
        const batches = await getBatches(token ?? undefined, email);
        const match = Array.isArray(batches) ? batches.find((b: any) => String(b.toba_batchid || b.id) === String(id)) : null;
        if (match && (match.toba_name || match.name)) setBatchName(String(match.toba_name || match.name));
        else setBatchName(`Batch ${id}`);
      } catch { setBatchName(`Batch ${id}`); }
    })();
  }, [id, token, account?.username, externalUser?.email]);

  // Load recipient metadata for department/business enrichment
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const base = getApiBase();
        if (!base) return; // best-effort only when API base is configured
        const email = String((account?.username || externalUser?.email || '')).toLowerCase();
        const recs = await fetch(`${base}/api/batches/${encodeURIComponent(String(id))}/recipients`).then(r => r.json()).catch(() => []);
        const row = (Array.isArray(recs) ? recs : []).find((r: any) => String(r.email || r.user || '').toLowerCase() === email) || null;
        setRecipientRow(row);
      } catch { setRecipientRow(null); }
    })();
  }, [id, token, account?.username, externalUser?.email]);

  const ackedDocs = useMemo(() => {
    const list = Array.isArray(docs) ? docs : [];
    const ids = Array.isArray(ackIds) ? ackIds : [];
    return list.filter(d => ids.includes(d.toba_documentid));
  }, [docs, ackIds]);

  const handleDownloadCompletedPdf = async () => {
    if (!id) return;
    setError(null);
    setDownloading(true);
    try {
      const email = (account?.username || externalUser?.email || '').toString();
      const userName = (account?.name || externalUser?.name || email || '').toString();
      const titles = ackedDocs.map(d => d.toba_title).filter(Boolean);
      const dept = recipientRow?.department || undefined;
      const jobTitle = recipientRow?.jobTitle || undefined;
      const location = recipientRow?.location || undefined;
      let bizName = recipientRow?.businessName || undefined;
      // Resolve business name from businessId if missing (needed for SharePoint upload)
      if (!bizName && recipientRow?.businessId) {
        try {
          const base = getApiBase();
          const list = base ? await fetch(`${base}/api/businesses`, { cache: 'no-store' }).then(r => r.json()).catch(() => []) : [];
          const match = (Array.isArray(list) ? list : []).find((b: any) => String(b.id ?? b.businessId ?? b.ID ?? b.toba_businessid) === String(recipientRow.businessId));
          bizName = match ? String(match.name || match.Title || match.title || match.code || 'Business') : bizName;
        } catch { /* noop */ }
      }
      const payload = {
        batchName: batchName || `Batch ${id}`,
        userEmail: email,
        userName,
        completedOn: new Date().toISOString(),
        documents: titles,
        department: dept,
        jobTitle,
        location,
        businessName: bizName,
      };
      const file = await generateUserCompletionPdf(payload);
      // Convert base64 to Blob and trigger download
      const byteCharacters = atob(file.contentBytes);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: file.contentType || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeBatch = (batchName || `Batch ${id}`).replace(/[^a-z0-9-_]+/gi, '-');
      a.download = file.name || `acknowledgement-${safeBatch}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(`Failed to download acknowledgement PDF: ${e?.message || e}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadToSharePoint = async () => {
    if (!id) return;
    setError(null);
    setUploading(true);
    try {
      const email = (account?.username || externalUser?.email || '').toString();
      const userName = (account?.name || externalUser?.name || email || '').toString();
      const titles = ackedDocs.map(d => d.toba_title).filter(Boolean);
      const dept = recipientRow?.department || undefined;
      const jobTitle = recipientRow?.jobTitle || undefined;
      const location = recipientRow?.location || undefined;
      let bizName = recipientRow?.businessName || undefined;
      if (!bizName && recipientRow?.businessId) {
        try {
          const base = getApiBase();
          const list = base ? await fetch(`${base}/api/businesses`, { cache: 'no-store' }).then(r => r.json()).catch(() => []) : [];
          const match = (Array.isArray(list) ? list : []).find((b: any) => String(b.id ?? b.businessId ?? b.ID ?? b.toba_businessid) === String(recipientRow.businessId));
          bizName = match ? String(match.name || match.Title || match.title || match.code || 'Business') : bizName;
        } catch { /* noop */ }
      }
      const payload = {
        batchName: batchName || `Batch ${id}`,
        userEmail: email,
        userName,
        completedOn: new Date().toISOString(),
        documents: titles,
        department: dept,
        jobTitle,
        location,
        businessName: bizName,
      };
      console.info('[CompletedBatch] Generating PDF for SharePoint upload', { email, businessName: bizName, department: dept });
      const file = await generateUserCompletionPdf(payload);
      const base = getApiBase();
      if (!base) throw new Error('API base not configured');
      const body = {
        businessName: bizName || 'Business',
        department: dept || 'Department',
        userEmail: email,
        contentBytes: file.contentBytes,
        fileName: file.name,
      };
      console.info('[CompletedBatch] Uploading to SharePoint', { endpoint: '/api/sharepoint/upload-completion-pdf', ...body, contentBytesLength: body.contentBytes.length });
      const resp = await fetch(`${base}/api/sharepoint/upload-completion-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let json: any = null;
      try { json = await resp.json(); } catch { /* ignore parse error */ }
      console.info('[CompletedBatch] Upload result', { status: resp.status, body: json });
      if (!resp.ok) throw new Error(json?.error || `Upload failed (${resp.status})`);
      alert('Uploaded to SharePoint successfully.');
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('[CompletedBatch] Upload failed', msg);
      setError(`Upload to SharePoint failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="title">Completed Documents</div>
            <div className="muted small">You can still view previously acknowledged documents.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn sm" onClick={() => handleDownloadCompletedPdf()} disabled={downloading || ackedDocs.length === 0}>
              {downloading ? 'Preparing…' : 'Download PDF'}
            </button>
            <button className="btn sm" onClick={() => handleUploadToSharePoint()} disabled={uploading || ackedDocs.length === 0}>
              {uploading ? 'Uploading…' : 'Upload to SharePoint'}
            </button>
            <Link to="/"><button className="btn ghost sm">← Back to Dashboard</button></Link>
          </div>
        </div>
        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #f4f4f4' }} />

        {error && <div className="muted" style={{ padding: 12, color: '#b02a37' }}>{error}</div>}

        {ackedDocs.length === 0 ? (
          <div className="muted" style={{ padding: 12 }}>No acknowledged documents found.</div>
        ) : (
          <div className="doc-list">
            {ackedDocs.map((d, i) => (
              <div key={d.toba_documentid} className="doc-row">
                <div className="doc-meta">
                  <div className="doc-icon">PDF</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{i + 1}. {d.toba_title}</div>
                    <div className="muted small">{d.toba_version || ''}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {/* open the same reader in view mode; we can add a view-only flag later */}
                  <Link to={`/document/${d.toba_documentid}?batchId=${id}`}><button className="btn sm">View</button></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompletedBatch;
