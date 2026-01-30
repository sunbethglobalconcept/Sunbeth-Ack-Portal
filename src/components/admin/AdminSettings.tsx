/* eslint-disable max-lines-per-function, complexity, max-lines */
import React, { useEffect, useState } from 'react';
import { useAuth as useAuthCtx } from '../../context/AuthContext';
import { useFeatureFlags } from '../../context/FeatureFlagsContext';
import { useRBAC } from '../../context/RBACContext';
import { isPoliciesEnabled, isCertificateAttachmentEnabled, setCertificateAttachmentEnabled, isAcknowledgedAttachmentsEnabled, setAcknowledgedAttachmentsEnabled } from '../../utils/runtimeConfig';
import Alerts, { alertError, alertWarning, showToast } from '../../utils/alerts';
import { getPrefs as getTourPrefs, setGlobalEnabled as setToursGlobalEnabled, setTourEnabled as setTourEnabledPref, TourId } from '../tours/TourPrefs';
import { getApiBase } from '../../utils/runtimeConfig';

type AdminSettingsProps = { canEdit: boolean };

const AdminSettings: React.FC<AdminSettingsProps> = ({ canEdit }) => {
  const { refresh: refreshFlags } = useFeatureFlags();
  const { account } = useAuthCtx();
  const { isSuperAdmin } = useRBAC();
  const storageKey = 'admin_settings';
  const [settings, setSettings] = useState({
    enableUpload: false,
    requireSig: false,
    autoReminder: true,
    reminderDays: 3,
    allowBulkAssignment: true,
    requireApproval: false
  });

  // External support flag (server-backed)
  const [extEnabled, setExtEnabled] = useState<boolean>(false);
  const [extLoading, setExtLoading] = useState<boolean>(false);
  const [extSaving, setExtSaving] = useState<boolean>(false);
  const apiBase = (getApiBase() as string) || '';

  // Legal consent document
  const policiesEnabled = isPoliciesEnabled();
  const [legalDoc, setLegalDoc] = useState<{ fileId: number | null; url: string | null; name: string | null; allowPreview: boolean; allowDeny: boolean; uploadCompletionPdf: boolean }>({ fileId: null, url: null, name: null, allowPreview: false, allowDeny: false, uploadCompletionPdf: false });
  const [legalBusy, setLegalBusy] = useState<boolean>(false);
  const [reminderBusy, setReminderBusy] = useState<boolean>(false);
  const [reminderPreview, setReminderPreview] = useState<{ actionable: number; skippedRecent: number; error?: string; enabled?: boolean } | null>(null);
  const [certAttachEnabled, setCertAttachEnabled] = useState<boolean>(() => isCertificateAttachmentEnabled());
  const [ackDocsAttachEnabled, setAckDocsAttachEnabled] = useState<boolean>(() => isAcknowledgedAttachmentsEnabled());
  // SharePoint settings (Site + Library)
  const [spSiteName, setSpSiteName] = useState<string>('');
  const [spLibraryName, setSpLibraryName] = useState<string>('');
  const [spLoading, setSpLoading] = useState<boolean>(false);
  const [spSaving, setSpSaving] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const obj = JSON.parse(raw);
        setSettings(prev => ({ ...prev, ...obj }));
      }
  } catch { /* ignore */ }
  }, []);

  // Load reminder settings from backend
  useEffect(() => {
    (async () => {
      if (!apiBase) return;
      try {
        const res = await fetch(`${apiBase}/api/settings/reminders`, { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json().catch(() => ({}));
        setSettings(prev => ({ ...prev, autoReminder: !!j.autoReminder, reminderDays: Number(j.reminderDays) || prev.reminderDays }));
      } catch { /* ignore */ }
    })();
  }, [apiBase]);

  useEffect(() => {
    void refreshReminderPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.reminderDays, apiBase]);

  // Load external support flag
  useEffect(() => {
    (async () => {
      try {
        setExtLoading(true);
        if (!apiBase) { setExtEnabled(false); return; }
        const res = await fetch(`${apiBase}/api/settings/external-support`, { cache: 'no-store' });
        const j = await res.json();
        setExtEnabled(!!j?.enabled);
      } catch {
        setExtEnabled(false);
      } finally {
        setExtLoading(false);
      }
    })();
  }, [apiBase]);

  // Load current legal consent document
  useEffect(() => {
    (async () => {
      try {
        if (!apiBase) return;
        const res = await fetch(`${apiBase}/api/settings/legal-consent`, { cache: 'no-store' });
        const j = await res.json();
        setLegalDoc({ fileId: j?.fileId ?? null, url: j?.url ? (apiBase + j.url) : null, name: j?.name ?? null, allowPreview: !!j?.allowPreview, allowDeny: !!j?.allowDeny, uploadCompletionPdf: !!j?.uploadCompletionPdf });
  } catch { /* ignore */ }
    })();
  }, [apiBase]);

  // Load SharePoint settings (public settings API, same pattern as external/legal)
  useEffect(() => {
    (async () => {
      try {
        if (!apiBase) return;
        setSpLoading(true);
        try {
          const res = await fetch(`${apiBase}/api/settings/sharepoint`, { cache: 'no-store' });
          if (res.ok) {
            const j = await res.json().catch(() => ({}));
            setSpSiteName(String(j?.siteName || ''));
            setSpLibraryName(String(j?.libraryName || ''));
          }
        } catch { /* ignore */ }
      } catch { /* ignore */ }
      finally { setSpLoading(false); }
    })();
  }, [apiBase]);

  const saveSharePointSettings = async () => {
    if (!canEdit || !apiBase) return;
    setSpSaving(true);
    try {
      const body = { siteName: spSiteName, libraryName: spLibraryName };
      const res = await fetch(`${apiBase}/api/settings/sharepoint`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('save_failed');
      showToast('SharePoint settings saved', 'success');
    } catch {
      showToast('Failed to save SharePoint settings', 'error');
    } finally {
      setSpSaving(false);
    }
  };

  const apply = () => {
    if (!canEdit) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
      Alerts.toast('Settings saved');
    } catch (e) {
      console.warn(e);
    }
  };

  const applyAndPersist = async () => {
    if (!canEdit) return;
    apply();
    if (!apiBase) return;
    try {
      const res = await fetch(`${apiBase}/api/settings/reminders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoReminder: settings.autoReminder, reminderDays: settings.reminderDays })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Failed to save reminder settings');
      }
      Alerts.toast('Reminder settings saved');
      await refreshReminderPreview();
    } catch (e) {
      alertWarning('Reminder settings not saved', (e as any)?.message || 'Unknown error');
    }
  };

  const saveExternalSupport = async (value: boolean) => {
    if (!canEdit || !apiBase) return;
    setExtSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/external-support`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: value }) });
      if (!res.ok) throw new Error('save_failed');
      setExtEnabled(value);
  try { await refreshFlags(); } catch { /* ignore */ }
      Alerts.toast(`External user support ${value ? 'enabled' : 'disabled'}`);
    } catch {
      Alerts.toast('Failed to save external support setting');
    } finally {
      setExtSaving(false);
    }
  };

  const runRemindersNow = async () => {
    if (!canEdit || !apiBase) {
      alertWarning('Not allowed', 'You need edit permissions and API base configured to run reminders.');
      return;
    }
    setReminderBusy(true);
    try {
      const body = { days: settings.reminderDays || 3 };
      const res = await fetch(`${apiBase}/api/reminders/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Run failed (${res.status}): ${text}`);
      }
      const j = await res.json().catch(() => ({}));
      Alerts.toast(`Reminders sent: ${j?.sent ?? 0}`);
      await refreshReminderPreview();
    } catch (e: any) {
      alertError('Reminder run failed', e?.message || 'Unknown error');
    } finally {
      setReminderBusy(false);
    }
  };

  const refreshReminderPreview = async () => {
    if (!apiBase) return;
    try {
      const res = await fetch(`${apiBase}/api/reminders/preview?days=${encodeURIComponent(settings.reminderDays || 3)}`);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const cleaned = text ? text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
        throw new Error(cleaned || `status ${res.status}`);
      }
      const j = await res.json().catch(() => ({}));
      setReminderPreview({ actionable: Number(j?.actionable || 0), skippedRecent: Number(j?.skippedRecent || 0), enabled: j?.enabled !== false });
    } catch (e: any) {
      setReminderPreview({ actionable: 0, skippedRecent: 0, error: e?.message || 'Preview failed' });
    }
  };

  return (
    <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>System Settings</h3>
      {/* Tours & Guides */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Tours & Guides</div>
            <div className="small muted">Enable/disable in-app tours globally or per section.</div>
          </div>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              defaultChecked={getTourPrefs().globalEnabled}
              disabled={!canEdit}
              onChange={e => {
                setToursGlobalEnabled(e.target.checked);
                showToast(`Tours ${e.target.checked ? 'enabled' : 'disabled'}`);
              }}
            />
            <span>{getTourPrefs().globalEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))', gap: 8 }}>
          {(([
            ['App Welcome', 'appWelcome'],
            ['User Guide', 'userGuide'],
            ['Overview', 'overview'],
            ['Analytics', 'analytics'],
            ['Batch', 'batch'],
            ['Manage', 'manage'],
            ['Policies', 'policies'],
            ['Settings', 'settings'],
            ['RBAC', 'rbac']
          ] as unknown) as [string, TourId][]).map(([label, id]) => {
            const pref = getTourPrefs();
            return (
              <label key={id} className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  defaultChecked={pref.enabled[id] !== false}
                  disabled={!canEdit || pref.globalEnabled === false}
                  onChange={e => {
                    setTourEnabledPref(id, e.target.checked);
                  }}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>
      {/* External Support Toggle */}
      {/* Policies UI Toggle (build-time flag surfaced to super admins) */}
      {isSuperAdmin && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Policies UI</div>
              <div className="small muted">Feature-flagged; controlled by REACT_APP_POLICIES_ENABLED at build time.</div>
            </div>
            <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={policiesEnabled} disabled />
              <span>{policiesEnabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
        </div>
      )}
      {/* Certificate PDF attachment toggle (local override) */}
      {isSuperAdmin && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Certificate PDF Attachments</div>
              <div className="small muted">When off, completion emails omit the PDF attachment (verification link still included).</div>
            </div>
            <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={certAttachEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setCertAttachEnabled(val);
                  setCertificateAttachmentEnabled(val);
                  showToast(`Certificate attachments ${val ? 'enabled' : 'disabled'}`);
                }}
                disabled={!canEdit}
              />
              <span>{certAttachEnabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
        </div>
      )}
      {/* Acknowledged Documents attachments toggle (local override) */}
      {isSuperAdmin && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Attach Acknowledged Documents</div>
              <div className="small muted">When off, user completion emails will not include the original acknowledged documents as attachments.</div>
            </div>
            <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={ackDocsAttachEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setAckDocsAttachEnabled(val);
                  setAcknowledgedAttachmentsEnabled(val);
                  showToast(`Acknowledged document attachments ${val ? 'enabled' : 'disabled'}`);
                }}
                disabled={!canEdit}
              />
              <span>{ackDocsAttachEnabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
        </div>
      )}
      {/* SharePoint Library Configuration */}
      {isSuperAdmin && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>SharePoint Upload Destination</div>
              <div className="small muted">Configure the Site and Document Library used for completion PDF uploads.</div>
              {spLoading ? (
                <div className="small muted" style={{ marginTop: 6 }}>Loading…</div>
              ) : (!spSiteName || !spLibraryName ? (
                <div className="small muted" style={{ marginTop: 6 }}>Not configured</div>
              ) : (
                <div className="small" style={{ marginTop: 6 }}>Site: {spSiteName} · Library: {spLibraryName}</div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Site name (e.g., Human Resource Group)"
              value={spSiteName}
              onChange={(e) => setSpSiteName(e.target.value)}
              disabled={!canEdit || spLoading}
            />
            <input
              type="text"
              placeholder="Library name (e.g., EML - Employee Management Library)"
              value={spLibraryName}
              onChange={(e) => setSpLibraryName(e.target.value)}
              disabled={!canEdit || spLoading}
            />
            <button className="btn sm" onClick={saveSharePointSettings} disabled={!canEdit || spSaving}>
              {spSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
      <div className="card external-support-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>External User Support</div>
            <div className="small muted">When disabled, external login, onboarding, and related UI/routes are hidden.</div>
          </div>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!!extEnabled} disabled={extLoading || extSaving || !canEdit} onChange={e => saveExternalSupport(e.target.checked)} />
            <span>{extEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
      </div>
      {/* Legal Consent Document */}
      <div className="card legal-consent-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Legal Consent Document</div>
            <div className="small muted">PDF shown to users from the consent dialog. Applies globally.</div>
            {legalDoc?.url ? (
              <div className="small" style={{ marginTop: 6 }}>
                Current: <a href={legalDoc.url} target="_blank" rel="noreferrer">{legalDoc.name || 'document.pdf'} ↗</a>
              </div>
            ) : (
              <div className="small muted" style={{ marginTop: 6 }}>Not set</div>
            )}
          </div>
          <div>
            <label className="btn sm" style={{ cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : .6 }}>
              {legalBusy ? 'Uploading…' : (legalDoc?.fileId ? 'Replace PDF' : 'Upload PDF')}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={!canEdit || legalBusy} onChange={async (e) => {
                try {
                  const file = e.target.files && e.target.files[0];
                  if (!file || !apiBase) return;
                  setLegalBusy(true);
                  const fd = new FormData();
                  fd.append('file', file);
                  const up = await fetch(`${apiBase}/api/files/upload`, { method: 'POST', body: fd });
                  const uj = await up.json();
                  if (!up.ok || !uj?.id) { showToast('Upload failed', 'error'); return; }
                  const put = await fetch(`${apiBase}/api/settings/legal-consent`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: uj.id, allowPreview: legalDoc.allowPreview, allowDeny: legalDoc.allowDeny, uploadCompletionPdf: legalDoc.uploadCompletionPdf }) });
                  if (!put.ok) { showToast('Save failed', 'error'); return; }
                  setLegalDoc({ fileId: uj.id, url: `${apiBase}/api/files/${uj.id}`, name: file.name, allowPreview: legalDoc.allowPreview, allowDeny: legalDoc.allowDeny, uploadCompletionPdf: legalDoc.uploadCompletionPdf });
                  showToast('Legal document saved', 'success');
                } catch {
                  showToast('Upload failed', 'error');
                } finally {
                  setLegalBusy(false);
                  try { (e.target as HTMLInputElement).value = ''; } catch { /* ignore */ }
                }
              }} />
            </label>
            {legalDoc?.fileId && (
              <button className="btn ghost sm" style={{ marginLeft: 8 }} disabled={!canEdit || legalBusy} onClick={async () => {
                try {
                  if (!apiBase) return;
                  setLegalBusy(true);
                  const put = await fetch(`${apiBase}/api/settings/legal-consent`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: null, allowPreview: legalDoc.allowPreview, allowDeny: legalDoc.allowDeny, uploadCompletionPdf: legalDoc.uploadCompletionPdf }) });
                  if (!put.ok) { showToast('Failed to clear', 'error'); return; }
                  setLegalDoc({ fileId: null, url: null, name: null, allowPreview: legalDoc.allowPreview, allowDeny: legalDoc.allowDeny, uploadCompletionPdf: legalDoc.uploadCompletionPdf });
                  showToast('Cleared legal document', 'success');
                } catch { showToast('Failed to clear', 'error'); }
                finally { setLegalBusy(false); }
              }}>Clear</button>
            )}
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={legalDoc.allowPreview} disabled={!canEdit} onChange={(e) => setLegalDoc(prev => ({ ...prev, allowPreview: e.target.checked }))} />
            <span>Allow Preview PDF in dialog</span>
          </label>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={legalDoc.allowDeny} disabled={!canEdit} onChange={(e) => setLegalDoc(prev => ({ ...prev, allowDeny: e.target.checked }))} />
            <span>Show Deny button</span>
          </label>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={legalDoc.uploadCompletionPdf} disabled={!canEdit} onChange={(e) => setLegalDoc(prev => ({ ...prev, uploadCompletionPdf: e.target.checked }))} />
            <span>Upload completion email PDF to SharePoint (when configured)</span>
          </label>
          {canEdit && (
            <button className="btn sm" disabled={legalBusy} onClick={async () => {
              try {
                if (!apiBase) return;
                setLegalBusy(true);
                const body = { fileId: legalDoc.fileId, allowPreview: legalDoc.allowPreview, allowDeny: legalDoc.allowDeny, uploadCompletionPdf: legalDoc.uploadCompletionPdf };
                const put = await fetch(`${apiBase}/api/settings/legal-consent`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                if (!put.ok) { showToast('Save failed', 'error'); return; }
                showToast('Consent settings saved', 'success');
              } catch { showToast('Save failed', 'error'); }
              finally { setLegalBusy(false); }
            }}>Save consent settings</button>
          )}
        </div>
      </div>

      <div className="grid settings-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={settings.enableUpload} onChange={e => setSettings({...settings, enableUpload: e.target.checked})} disabled={!canEdit} />
          <span className="small">Enable document upload</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={settings.requireSig} onChange={e => setSettings({...settings, requireSig: e.target.checked})} disabled={!canEdit} />
          <span className="small">Require digital signatures</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={settings.autoReminder} onChange={e => setSettings({...settings, autoReminder: e.target.checked})} disabled={!canEdit} />
          <span className="small">Auto-send reminders</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={settings.allowBulkAssignment} onChange={e => setSettings({...settings, allowBulkAssignment: e.target.checked})} disabled={!canEdit} />
          <span className="small">Allow bulk assignments</span>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="small">Reminder frequency:</span>
        <select value={settings.reminderDays} onChange={e => setSettings({...settings, reminderDays: parseInt(e.target.value)})} disabled={!canEdit}>
          <option value={1}>Daily</option>
          <option value={3}>Every 3 days</option>
          <option value={7}>Weekly</option>
          <option value={14}>Bi-weekly</option>
        </select>
      </div>

      {reminderPreview && !reminderPreview.error && (
        <div className="small" style={{ color: reminderPreview.enabled === false ? '#b42318' : reminderPreview.actionable > 0 ? '#111' : '#475467' }}>
          {reminderPreview.enabled === false
            ? 'Auto reminders are disabled in settings.'
            : reminderPreview.actionable > 0
              ? `Reminders pending: ${reminderPreview.actionable}. Recently throttled: ${reminderPreview.skippedRecent}.`
              : 'All recipients are up to date; no reminders need to be sent right now.'}
        </div>
      )}
      {reminderPreview?.error && (
        <div className="small" style={{ color: '#b42318' }}>Reminder preview unavailable: {reminderPreview.error}</div>
      )}

      <div className="settings-actions" style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {canEdit && <button className="btn" onClick={applyAndPersist}>Save Settings</button>}
        {!canEdit && <span className="small muted">Read-only access</span>}
        {canEdit && <button className="btn secondary" disabled={reminderBusy || (!!reminderPreview && (reminderPreview.enabled === false || reminderPreview.actionable === 0))} onClick={runRemindersNow} title="Send reminders to recipients who have not acknowledged and are near due date">{reminderBusy ? 'Running…' : 'Send reminders now'}</button>}
      </div>
    </div>
  );
};

export default AdminSettings;
