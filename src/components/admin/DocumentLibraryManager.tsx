import React, { useEffect, useState } from 'react';
import { getApiBase } from '../../utils/runtimeConfig';
import Modal from '../Modal';

// DocumentLibraryManager: Admin page for managing local documents
const DocumentLibraryManager: React.FC = () => {
  const apiBase = getApiBase() as string;
  const [files, setFiles] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const params = [`page=${page}`, `pageSize=${pageSize}`];
      if (q) params.push(`q=${encodeURIComponent(q)}`);
      const res = await fetch(`${apiBase}/api/library/list?${params.join('&')}`);
      const j = await res.json();
      setFiles(Array.isArray(j?.files) ? j.files : []);
      setTotal(typeof j?.total === 'number' ? j.total : 0);
    } catch {
      setFiles([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!window.confirm('Delete selected files?')) return;
    for (const id of selected) {
      await fetch(`${apiBase}/api/library/delete/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
    setSelected(new Set());
    load();
  };

  // Pagination controls
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <>
      <div style={{ maxWidth: 900, margin: '0 auto', marginTop: 24 }}>
        <div
          className="card document-library-card"
          style={{ borderRadius: 8, padding: 0, overflow: 'hidden' }}
        >
          <div
            className="document-library-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              background: 'var(--card-header-bg, var(--card))',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-1px' }}>
                Document Library
              </h2>
              <div className="small muted" style={{ marginTop: 2 }}>
                Manage all locally stored documents. Files are served from the app server for
                reliability and speed.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="input"
                style={{ minWidth: 180 }}
                placeholder="Search documents..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="btn ghost sm" onClick={load} disabled={loading}>
                Refresh
              </button>
              <button
                className="btn danger sm"
                onClick={deleteSelected}
                disabled={selected.size === 0}
              >
                Delete Selected
              </button>
            </div>
          </div>
          <div
            style={{ maxHeight: 420, overflowY: 'auto', background: 'var(--card-bg, var(--card))' }}
          >
            {loading ? (
              <div className="small muted" style={{ padding: 32, textAlign: 'center' }}>
                Loading documents…
              </div>
            ) : files.length === 0 ? (
              <div className="small muted" style={{ padding: 32, textAlign: 'center' }}>
                No documents found.
              </div>
            ) : (
              files.map((f) => (
                <div
                  key={f.id || f.path}
                  className="document-library-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 2.5fr 2fr 1fr 1.2fr 0.7fr',
                    gap: 8,
                    alignItems: 'center',
                    padding: '10px 8px',
                    borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                    background: selected.has(f.id || f.path)
                      ? 'var(--row-selected-bg, #1a2a2f)'
                      : 'transparent',
                    transition: 'background 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(f.id || f.path)}
                    onChange={() => toggle(f.id || f.path)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                    <span style={{ fontSize: 18, color: 'var(--primary, #6c63ff)' }}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect width="20" height="20" rx="4" fill="#f3f4fa" />
                        <path
                          d="M6 4.5A1.5 1.5 0 0 1 7.5 3h5A1.5 1.5 0 0 1 14 4.5V7h-1.5A1.5 1.5 0 0 0 11 8.5V10H6V4.5Z"
                          fill="#6c63ff"
                        />
                        <path
                          d="M6 10v5.5A1.5 1.5 0 0 0 7.5 17h5a1.5 1.5 0 0 0 1.5-1.5V10H6Z"
                          fill="#b2b1ff"
                        />
                      </svg>
                    </span>
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 220,
                      }}
                    >
                      {f.name}
                    </span>
                  </div>
                  <div
                    className="small muted"
                    style={{
                      fontFamily: 'monospace',
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.path || ''}
                  </div>
                  <div className="small muted" style={{ textAlign: 'right' }}>
                    {f.size ? `${(f.size / 1024).toFixed(1)} KB` : ''}
                  </div>
                  <div className="small muted">
                    {f.uploadedAt ? new Date(f.uploadedAt).toLocaleString() : ''}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button className="btn ghost xs" onClick={() => setPreviewDoc(f)}>
                      Preview
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {/* Pagination Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
            background: 'var(--card-bg, var(--card))',
          }}
        >
          <button
            className="btn ghost sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
            style={{ marginRight: 8 }}
          >
            Prev
          </button>
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn ghost sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!canNext}
            style={{ marginLeft: 8 }}
          >
            Next
          </button>
        </div>
      </div>
      <Modal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.name || 'Preview'}
        width={900}
      >
        {previewDoc ? (
          <iframe
            src={previewDoc.url}
            title={previewDoc.name}
            style={{ width: '100%', height: '80vh', border: 'none' }}
            allow="autoplay"
          />
        ) : null}
      </Modal>
    </>
  );
};

export default DocumentLibraryManager;
