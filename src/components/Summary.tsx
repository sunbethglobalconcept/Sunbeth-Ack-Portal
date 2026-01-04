import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { sendAcknowledgement } from '../services/flowService';
import { alertSuccess, alertError } from '../utils/alerts';
import { getUserProgress } from '../services/dbService';
import { useAuth } from '../context/AuthContext';

const Summary: React.FC = () => {
  const { token, account } = useAuth();
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  const batchId = qs.get('batchId') || undefined;
  const [percent, setPercent] = useState<number | null>(null);
  const [nudgeStatus, setNudgeStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');
  const handleNudge = async () => {
    if (!batchId || !account) return;
    setNudgeStatus('sending');
    try {
      // Fetch documents; use the first document to trigger notify (avoid bulk duplicate acks)
      const docs = await import('../services/dbService').then(m => m.getDocumentsByBatch(batchId));
      if (!Array.isArray(docs) || docs.length === 0) throw new Error('No documents found for batch');
      const first = docs[0];
      await sendAcknowledgement({
        batchId,
        documentId: first.toba_documentid || first.id || first.documentId,
        userDisplay: account.name,
        userEmail: account.username,
        userPrincipalName: account.username,
        email: account.username,
        ackmethod: 'Notify Admin (manual)'
      });
      setNudgeStatus('sent');
      await alertSuccess('Notification Sent', 'The admin has been notified that you have completed your batch.');
    } catch (err) {
      setNudgeStatus('error');
      await alertError('Notification Failed', 'There was a problem sending the notification. Please try again.');
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      if (!batchId) return; // no specific batch context
      try {
        const p = await getUserProgress(batchId, token ?? undefined, undefined, account?.username || undefined);
        if (active) setPercent(p.percent);
      } catch {
        if (active) setPercent(null);
      }
    })();
    return () => { active = false; };
  }, [batchId, token, account?.username]);

  const isComplete = percent !== null && percent >= 100;

  // Auto-notify admin once when completion is detected (no manual click required)
  useEffect(() => {
    if (!isComplete || !batchId || !account?.username) return;
    const key = `sunbeth:autoNotified:${batchId}:${String(account.username).toLowerCase()}`;
    let cancelled = false;
    (async () => {
      try {
        if (localStorage.getItem(key) === '1') return;
      } catch {}
      try {
        setNudgeStatus((s) => (s === 'sent' ? s : 'sending'));
        const docs = await import('../services/dbService').then(m => m.getDocumentsByBatch(batchId));
        if (!Array.isArray(docs) || docs.length === 0) throw new Error('No documents found for batch');
        const first = docs[0];
        await sendAcknowledgement({
          batchId,
          documentId: first.toba_documentid || first.id || first.documentId,
          userDisplay: account.name,
          userEmail: account.username,
          userPrincipalName: account.username,
          email: account.username,
          ackmethod: 'Notify Admin (auto)'
        });
        if (!cancelled) {
          setNudgeStatus('sent');
          try { localStorage.setItem(key, '1'); } catch {}
        }
      } catch {
        if (!cancelled) setNudgeStatus('idle');
      }
    })();
    return () => { cancelled = true; };
  }, [isComplete, batchId, account?.username, account?.name]);

  return (
    <div className="container">
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="title">{isComplete ? '✅ Batch Completed' : 'In Progress'}</div>
        <div style={{ fontWeight: 700, color: 'var(--primary)', marginTop: 8 }}>{batchId || '—'}</div>
        <div className="small muted" style={{ marginTop: 8 }}>
          {isComplete ? 'All documents acknowledged.' : (percent === null ? 'Checking progress…' : `${percent}% acknowledged. Keep going!`)}
        </div>
        <div style={{ height: 14 }} />
        {isComplete && (
          <div style={{ marginBottom: 12 }}>
            <button
              className="btn sm"
              onClick={handleNudge}
              disabled={nudgeStatus==='sending' || nudgeStatus==='sent'}
              title="Admin is notified automatically. Use only if needed."
              style={{ opacity: 0.55 }}
            >
              {nudgeStatus === 'idle' && 'Notify Admin (Optional)'}
              {nudgeStatus === 'sending' && 'Sending...'}
              {nudgeStatus === 'sent' && 'Notification Sent!'}
              {nudgeStatus === 'error' && 'Error, Try Again'}
            </button>
          </div>
        )}
        <Link to="/"><button className="btn">Return to Dashboard</button></Link>
      </div>
    </div>
  );
};
export default Summary;
