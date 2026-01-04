import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { getApiBase } from '../utils/runtimeConfig';

const VerifyCertificate: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = React.useState<{ loading: boolean; valid?: boolean; data?: any; error?: string }>({ loading: true });

  React.useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        if (!id) { if (mounted) setState({ loading: false, valid: false, error: 'Missing ID' }); return; }
        const api = getApiBase() as string;
        const res = await fetch(`${api}/api/certificates/verify/${encodeURIComponent(id)}`);
        const body = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (res.ok && body && typeof body.valid !== 'undefined') {
          setState({ loading: false, valid: !!body.valid, data: body });
        } else {
          setState({ loading: false, valid: false, error: 'Not found' });
        }
      } catch (e: any) {
        if (!mounted) return;
        setState({ loading: false, valid: false, error: e?.message || 'Verification failed' });
      }
    }
    run();
    return () => { mounted = false; };
  }, [id]);

  return (
    <div style={{ maxWidth: 720, margin: '48px auto', padding: 24 }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        boxShadow: '0 6px 24px rgba(0,0,0,0.06)',
        padding: 24
      }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>Certificate Verification</h1>
        <p style={{ marginTop: 8, color: '#374151' }}>Scan result is shown below. Share this page with your HR or administrator for validation.</p>
        <div style={{ marginTop: 16, padding: 16, background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Certificate ID</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 18, color: '#111827', marginTop: 4 }}>{id}</div>
        </div>
        {state.loading ? (
          <div style={{ marginTop: 16, color: '#6b7280' }}>Verifying certificate...</div>
        ) : state.valid ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ padding: 16, border: '1px solid #d1d5db', borderRadius: 8 }}>
              <div style={{ color: '#065f46', background: '#ecfdf5', padding: '6px 10px', borderRadius: 6, display: 'inline-block', fontSize: 12, fontWeight: 600 }}>VALID</div>
              <div style={{ marginTop: 10, color: '#111827', fontWeight: 600 }}>{state.data?.userName || state.data?.email}</div>
              <div style={{ marginTop: 4, color: '#4b5563', fontSize: 13 }}>Completed on: {state.data?.completedOn || '—'}</div>
              <div style={{ marginTop: 4, color: '#4b5563', fontSize: 13 }}>Batch: {state.data?.batchId || '—'}</div>
              <div style={{ marginTop: 10, color: '#111827', fontWeight: 600 }}>Documents</div>
              <ul style={{ color: '#4b5563' }}>
                {(state.data?.documents || []).map((t: string, i: number) => (<li key={i}>{t}</li>))}
              </ul>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div style={{ padding: 16, border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 8 }}>
              <div style={{ color: '#991b1b', fontWeight: 600 }}>Invalid or Unknown Certificate</div>
              <div style={{ marginTop: 6, color: '#7f1d1d' }}>{state.error || state.data?.message || 'We could not verify this certificate.'}</div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#2563eb' }}>Return to Dashboard</Link>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 16, color: '#6b7280', fontSize: 12 }}>
        Sunbeth • Secure Certificate Link
      </div>
    </div>
  );
};

export default VerifyCertificate;
