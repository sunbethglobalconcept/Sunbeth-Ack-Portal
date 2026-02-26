/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
/* eslint-disable max-lines */
/* eslint-disable max-depth */
import React, { useEffect, useRef, useState } from 'react';
import Modal from '../Modal';
import { getApiBase, isSQLiteEnabled } from '../../utils/runtimeConfig';
import { confirmDialog, showToast } from '../../utils/alerts';
import { getDocumentsByBatch } from '../../services/dbService';
import { generateUserCompletionPdf } from '../../services/notificationService';
import { Link } from 'react-router-dom';

type BatchRow = { toba_batchid: string; toba_name: string; toba_startdate?: string; toba_duedate?: string; toba_status?: string };

const apiBase = () => (getApiBase() as string) || '';
const sqliteOn = () => isSQLiteEnabled() && !!apiBase();

const ManageBatches: React.FC<{ canEdit: boolean; onEdit: (id: string) => void; onClone: (id: string) => void }>
  = ({ canEdit, onEdit, onClone }) => {
  const [items, setItems] = useState<Array<BatchRow>>([]);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Record<string, { name: string; startDate: string; dueDate: string; status: string; description: string }>>({});
  const [recOpen, setRecOpen] = useState<{ open: boolean; forBatch?: string; rows: any[]; error?: boolean; docs?: string[] }>({ open: false, rows: [] });
  const [recLoading, setRecLoading] = useState(false);
  const [recDownloadingEmail, setRecDownloadingEmail] = useState<string | null>(null);
  const [recZipBusy, setRecZipBusy] = useState(false);
  const [recUploadStatus, setRecUploadStatus] = useState<Record<string, { uploaded: boolean; webUrl?: string }>>({});
  const recReqRef = useRef(0);

  const load = async () => {
    if (!sqliteOn()) return;
    try {
      const res = await fetch(`${apiBase()}/api/batches`);
      const j = await res.json();
      setItems(Array.isArray(j) ? j : []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  };
  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!canEdit || !sqliteOn()) return;
    const ok = await confirmDialog('Delete this batch?', 'This will remove its documents, recipients, and acknowledgements.', 'Delete', 'Cancel', { icon: 'warning' as any });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/api/batches/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      await load();
      showToast('Batch deleted', 'success');
    } catch {
      showToast('Failed to delete batch', 'error');
    } finally { setBusy(false); }
  };

  const openRecipients = async (id: string) => {
    const reqId = ++recReqRef.current;
    setRecOpen({ open: true, forBatch: id, rows: [], error: false, docs: [] });
    setRecLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      // Load recipients (scoped preferred)
      let rows: any[] = [];
      const scoped = await fetch(`${apiBase()}/api/batches/${encodeURIComponent(id)}/recipients`, { signal: controller.signal });
      if (scoped.ok) {
        const r = await scoped.json();
        rows = Array.isArray(r) ? r : [];
      } else {
        const res = await fetch(`${apiBase()}/api/recipients?batchId=${encodeURIComponent(id)}&limit=200`, { signal: controller.signal });
        if (!res.ok) throw new Error('recipients_failed');
        const j = await res.json();
        rows = Array.isArray(j) ? j : [];
      }

      // Load completions and merge by email (case-insensitive)
      let completedMap: Record<string, any> = {};
      try {
        const compRes = await fetch(`${apiBase()}/api/batches/${encodeURIComponent(id)}/completions`, { signal: controller.signal });
        if (compRes.ok) {
          const comps = await compRes.json();
          const list = Array.isArray(comps) ? comps : (Array.isArray(comps?.rows) ? comps.rows : []);
          completedMap = (list as any[]).reduce((acc, c) => { acc[String(c.email || '').toLowerCase()] = c; return acc; }, {} as Record<string, any>);
        }
      } catch { /* best-effort */ }

      // Load document titles for this batch (for PDF payload)
      let docs: string[] = [];
      try {
        const docRows = await getDocumentsByBatch(String(id));
        docs = (Array.isArray(docRows) ? docRows : []).map((d: any) => String(d.toba_title || d.title || 'Document'));
      } catch { /* ignore */ }

      // Merge completion status into rows
      const merged = rows.map((r: any) => {
        const key = String(r.email || r.user || '').toLowerCase();
        const c = completedMap[key];
        return { ...r, completed: !!c?.completed, completionAt: c?.completionAt, department: r.department || c?.department, jobTitle: r.jobTitle || c?.jobTitle, location: r.location || c?.location, businessName: r.businessName || c?.businessName, primaryGroup: r.primaryGroup || c?.primaryGroup };
      });

      if (reqId === recReqRef.current) setRecOpen({ open: true, forBatch: id, rows: merged, error: false, docs });

      // Fetch SharePoint upload status for completed rows
      const statusMap: Record<string, { uploaded: boolean; webUrl?: string }> = {};
      const completedRows = merged.filter((r: any) => !!r.completed);
      for (const r of completedRows) {
        const email = String(r.email || r.user || '').toLowerCase();
        try {
          const u = await fetch(`${apiBase()}/api/sharepoint/upload-status?batchId=${encodeURIComponent(String(id))}&email=${encodeURIComponent(email)}`);
          if (u.ok) {
            const j = await u.json();
            statusMap[email] = { uploaded: !!j.uploaded, webUrl: j.webUrl };
          }
        } catch { /* best-effort */ }
      }
      if (reqId === recReqRef.current) setRecUploadStatus(statusMap);
    } catch {
      if (reqId === recReqRef.current) {
        setRecOpen({ open: true, forBatch: id, rows: [], error: true, docs: [] });
        showToast('Failed to load recipients (timeout or network)', 'error');
      }
    } finally {
      clearTimeout(timer);
      if (reqId === recReqRef.current) setRecLoading(false);
    }
  };

  const downloadRecipientPdf = async (row: any) => {
    const batchId = recOpen.forBatch;
    if (!batchId) return;
    const batch = items.find(b => String(b.toba_batchid) === String(batchId));
    const batchName = String(batch?.toba_name || `Batch ${batchId}`);
    const docs = recOpen.docs || [];
    const email = String(row.email || row.user || '').toString();
    const userName = String(row.displayName || email);
    setRecDownloadingEmail(email);
    try {
      const file = await generateUserCompletionPdf({
        batchName,
        userEmail: email,
        userName,
        completedOn: row.completionAt || new Date().toISOString(),
        documents: docs,
        department: row.department,
        jobTitle: row.jobTitle,
        location: row.location,
        businessName: row.businessName,
        primaryGroup: row.primaryGroup,
      });
      const byteCharacters = atob(file.contentBytes);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: file.contentType || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name || `${email.replace(/[^a-z0-9._-]/gi, '_')}-document-ack.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(`Failed to download PDF for ${row.email}`, 'error');
    } finally {
      setRecDownloadingEmail(null);
    }
  };

  const downloadAllRecipientPdfsZip = async () => {
    const batchId = recOpen.forBatch; if (!batchId) return;
    const batch = items.find(b => String(b.toba_batchid) === String(batchId));
    const batchName = String(batch?.toba_name || `Batch ${batchId}`);
    const docs = recOpen.docs || [];
    const completedRows = (recOpen.rows || []).filter((r: any) => !!r.completed);
    if (completedRows.length === 0) { showToast('No completed users to export', 'info'); return; }
    setRecZipBusy(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const folder = zip.folder(batchName.replace(/[^a-z0-9._-]+/gi, '-'));
      for (const r of completedRows) {
        const email = String(r.email || r.user || 'user');
        const userName = String(r.displayName || email);
        const file = await generateUserCompletionPdf({
          batchName,
          userEmail: email,
          userName,
          completedOn: r.completionAt || new Date().toISOString(),
          documents: docs,
          department: r.department,
          jobTitle: r.jobTitle,
          location: r.location,
          businessName: r.businessName,
          primaryGroup: r.primaryGroup,
        });
        const byteCharacters = atob(file.contentBytes);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const fname = (file.name || `${email.replace(/[^a-z0-9._-]/gi, '_')}-document-ack.pdf`).replace(/[\\/]+/g, '-');
        folder?.file(fname, byteArray);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      const safeBatch = batchName.replace(/[^a-z0-9._-]+/gi, '-');
      a.download = `${safeBatch}-user-completion-pdfs.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast('Failed to create ZIP', 'error');
    } finally { setRecZipBusy(false); }
  };

  const uploadRecipientToSharePoint = async (row: any) => {
    const batchId = recOpen.forBatch; if (!batchId) return;
    const batch = items.find(b => String(b.toba_batchid) === String(batchId));
    const batchName = String(batch?.toba_name || `Batch ${batchId}`);
    const docs = recOpen.docs || [];
    const email = String(row.email || row.user || '').toString();
    const userName = String(row.displayName || email);
    setRecDownloadingEmail(email);
    try {
      const file = await generateUserCompletionPdf({
        batchName,
        userEmail: email,
        userName,
        completedOn: row.completionAt || new Date().toISOString(),
        documents: docs,
        department: row.department,
        jobTitle: row.jobTitle,
        location: row.location,
        businessName: row.businessName,
        primaryGroup: row.primaryGroup,
      });
      const fname = (file.name || `${batchName.replace(/[^a-z0-9\-_. ]/gi,'_')}-${email.replace(/[^a-z0-9\-_. ]/gi,'_')}.pdf`).replace(/[\\/]+/g, '-');
      const payload = {
        businessName: row.businessName,
        department: row.department,
        userEmail: email,
        contentBytes: file.contentBytes,
        fileName: fname,
        batchId: Number(batchId)
      };
      const res = await fetch(`${apiBase()}/api/sharepoint/upload-completion-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('upload_failed');
      const j = await res.json();
      const emailKey = email.toLowerCase();
      setRecUploadStatus(prev => ({ ...prev, [emailKey]: { uploaded: true, webUrl: j.webUrl } }));
      showToast(`Uploaded to SharePoint${j.alreadyUploaded ? ' (existing)' : ''}`, 'success');
    } catch {
      showToast(`Failed to upload PDF for ${row.email}`, 'error');
    } finally {
      setRecDownloadingEmail(null);
    }
  };

  const uploadAllMissingToSharePoint = async () => {
    const batchId = recOpen.forBatch; if (!batchId) return;
    const rows = (recOpen.rows || []).filter((r: any) => !!r.completed);
    const missing = rows.filter((r: any) => !recUploadStatus[String(r.email || r.user || '').toLowerCase()]?.uploaded);
    if (missing.length === 0) { showToast('No missing uploads', 'info'); return; }
    setRecZipBusy(true);
    try {
      for (const r of missing) {
        await uploadRecipientToSharePoint(r);
      }
      showToast('Uploaded all missing to SharePoint', 'success');
    } catch {
      showToast('Bulk upload encountered errors', 'warning');
    } finally { setRecZipBusy(false); }
  };

  const save = async (id: string) => {
    const row = editing[id]; if (!row) return;
    setBusy(true);
    try {
      const payload = {
        name: row.name,
        startDate: row.startDate || null,
        dueDate: row.dueDate || null,
        status: row.status ? Number(row.status) : 1,
        description: row.description || null
      };
      const res = await fetch(`${apiBase()}/api/batches/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('update_failed');
      setEditing(prev => { const p = { ...prev }; delete p[id]; return p; });
      await load();
      showToast('Batch updated', 'success');
    } catch {
      showToast('Failed to update batch', 'error');
    } finally { setBusy(false); }
  };

  if (!sqliteOn()) return <div className="small muted">Enable SQLite to manage batches.</div>;
  return (
    <>
      <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6 }} className="batch-list">
        {loadError ? (
          <div className="small muted" style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span>Could not load batches.</span>
            <button className="btn ghost sm" onClick={load}>Retry</button>
          </div>
        ) : items.length === 0 ? (
          <div className="small muted" style={{ padding: 8 }}>No batches.</div>
        ) : items.map(b => {
          const row = editing[b.toba_batchid];
          const isEditing = !!row;
          return (
            <div key={b.toba_batchid} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 0.9fr 0.7fr 1.4fr auto', gap: 8, alignItems: 'center', padding: 8, borderBottom: '1px solid #f5f5f5' }}>
              {isEditing ? (
                <>
                  <input defaultValue={b.toba_name} onChange={e => setEditing(prev => ({ ...prev, [b.toba_batchid]: { ...(prev[b.toba_batchid] || {}), name: e.target.value } }))} />
                  <input type="date" defaultValue={b.toba_startdate || ''} onChange={e => setEditing(prev => ({ ...prev, [b.toba_batchid]: { ...(prev[b.toba_batchid] || {}), startDate: e.target.value } }))} />
                  <input type="date" defaultValue={b.toba_duedate || ''} onChange={e => setEditing(prev => ({ ...prev, [b.toba_batchid]: { ...(prev[b.toba_batchid] || {}), dueDate: e.target.value } }))} />
                  <select defaultValue={b.toba_status || '1'} onChange={e => setEditing(prev => ({ ...prev, [b.toba_batchid]: { ...(prev[b.toba_batchid] || {}), status: e.target.value } }))}>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                  <input placeholder="Description" onChange={e => setEditing(prev => ({ ...prev, [b.toba_batchid]: { ...(prev[b.toba_batchid] || {}), description: e.target.value } }))} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn ghost sm" onClick={() => setEditing(prev => { const p = { ...prev }; delete p[b.toba_batchid]; return p; })}>Cancel</button>
                    <button className="btn sm" onClick={() => save(b.toba_batchid)} disabled={!canEdit || busy}>Save</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.toba_name}</div>
                  <div className="small muted">{b.toba_startdate || '—'}</div>
                  <div className="small muted">{b.toba_duedate || '—'}</div>
                  <span className="badge" style={{ background: (b.toba_status || '1') === '1' ? '#d4edda' : '#e2e3e5', color: (b.toba_status || '1') === '1' ? '#155724' : '#383d41' }}>{(b.toba_status || '1') === '1' ? 'Active' : 'Inactive'}</span>
                  <div className="small muted" />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} className="batch-actions">
                    <Link to={`/admin/batch/${b.toba_batchid}`}><button className="btn ghost sm">View</button></Link>
                    <button className="btn ghost sm" onClick={() => openRecipients(b.toba_batchid)}>Recipients</button>
                    {/* <button className="btn ghost sm" onClick={() => onEdit(b.toba_batchid)} disabled={!canEdit}>Edit</button> */}
                    <button className="btn ghost sm" onClick={() => onClone(b.toba_batchid)} disabled={!canEdit}>Clone</button>
                    <button className="btn ghost sm" onClick={() => del(b.toba_batchid)} disabled={!canEdit || busy}>Delete</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {/* Recipients Modal */}
      <Modal open={recOpen.open} onClose={() => { recReqRef.current++; setRecOpen({ open: false, rows: [] }); setRecLoading(false); }} title={`Recipients for Batch ${recOpen.forBatch || ''}`} width={820}>
        {recLoading ? (
          <div className="small muted">Loading…</div>
        ) : recOpen.rows.length === 0 ? (
          <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{recOpen.error ? 'Could not load recipients.' : 'No recipients found.'}</span>
            {recOpen.forBatch && (
              <button className="btn ghost sm" disabled={recLoading} onClick={() => openRecipients(recOpen.forBatch as string)}>Retry</button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 8px 0' }}>
              <div className="small muted">{(recOpen.rows || []).filter((r: any) => !!r.completed).length} completed</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost sm" onClick={uploadAllMissingToSharePoint} disabled={recZipBusy || (recOpen.rows || []).every((r: any) => !r.completed)}>
                  {recZipBusy ? 'Uploading…' : 'Upload All Missing'}
                </button>
                <button className="btn sm" onClick={downloadAllRecipientPdfsZip} disabled={recZipBusy || (recOpen.rows || []).every((r: any) => !r.completed)}>
                  {recZipBusy ? 'Preparing ZIP…' : 'Download All (ZIP)'}
                </button>
              </div>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'grid', gap: 8 }}>
            {recOpen.rows.map((r: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{r.displayName || r.email}</div>
                  <div className="small muted">{r.email}</div>
                </div>
                <div className="small muted">{r.department || '—'}</div>
                <div className="small muted">{r.jobTitle || '—'}</div>
                <div className="small muted">{r.primaryGroup || '—'}</div>
                <div style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {r.completed ? (
                    <>
                      <button className="btn ghost sm" disabled={!!recUploadStatus[String(r.email || r.user || '').toLowerCase()]?.uploaded || recDownloadingEmail === r.email} onClick={() => uploadRecipientToSharePoint(r)}>
                        {recUploadStatus[String(r.email || r.user || '').toLowerCase()]?.uploaded ? 'Uploaded' : (recDownloadingEmail === r.email ? 'Uploading…' : 'Upload to SharePoint')}
                      </button>
                      <button className="btn sm" disabled={recDownloadingEmail === r.email} onClick={() => downloadRecipientPdf(r)}>
                        {recDownloadingEmail === r.email ? 'Preparing…' : 'Download PDF'}
                      </button>
                    </>
                  ) : (
                    <span className="small muted">Pending</span>
                  )}
                </div>
              </div>
            ))}
            </div>
          </>
        )}
      </Modal>
    </>
  );
};

export default ManageBatches;
