import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Modal from '../Modal';
import { UserGroupSelector } from './UserGroupSelector';
import { GraphUser, GraphGroup, getGroupMembers } from '../../services/graphUserService';
import { getGraphToken } from '../../services/authTokens';
import { getApiBase, isSQLiteEnabled } from '../../utils/runtimeConfig';
import { showToast } from '../../utils/alerts';
import { useRBAC } from '../../context/RBACContext';
import { sendEmail, buildBatchEmail, type NotificationRecipient } from '../../services/notificationService';

type CompletionRow = {
  email: string;
  displayName?: string;
  department?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  primaryGroup?: string | null;
  acknowledged?: number;
  total?: number;
  completed?: boolean;
  completionAt?: string | null;
};

type InviteSelection = {
  users: GraphUser[];
  groups: GraphGroup[];
};

type RecipientPayload = {
  email: string;
  displayName?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  primaryGroup?: string | null;
};

const BatchDetailAdmin: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isSuperAdmin, perms } = useRBAC();
  const rawApiBase = (getApiBase() as string) || '';
  const apiBase = rawApiBase.replace(/\/$/, '');
  const sqliteReady = isSQLiteEnabled() && !!apiBase;
  const canEditBatch = isSuperAdmin || !!perms?.editBatch;
  const canSendReminders = isSuperAdmin || !!perms?.sendNotifications;

  const [batch, setBatch] = useState<any>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [dueDateInput, setDueDateInput] = useState('');
  const [savingDue, setSavingDue] = useState(false);

  const [rows, setRows] = useState<CompletionRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [recipientsRefreshKey, setRecipientsRefreshKey] = useState(0);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSelection, setInviteSelection] = useState<InviteSelection>({ users: [], groups: [] });
  const [inviteSelectorKey, setInviteSelectorKey] = useState(0);
  const [addingRecipients, setAddingRecipients] = useState(false);

  useEffect(() => {
    if (!sqliteReady || !id) return;
    let cancelled = false;
    (async () => {
      setBatchLoading(true);
      setBatchError(null);
      try {
        const res = await fetch(`${apiBase}/api/batches`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load batches (${res.status})`);
        const payload = await res.json();
        const candidates: any[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.batches)
            ? payload.batches
            : [];
        const found = candidates.find((b: any) => {
          const batchId = String(b?.toba_batchid || b?.id || b?.batchId || b?.ID || '');
          return batchId && batchId === String(id);
        });
        if (!cancelled) {
          if (!found) {
            setBatch(null);
            setBatchError('Batch not found.');
          } else {
            setBatch(found);
            setBatchError(null);
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          setBatch(null);
          setBatchError(error?.message || 'Failed to load batch.');
        }
      } finally {
        if (!cancelled) setBatchLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, id, sqliteReady, recipientsRefreshKey]);

  useEffect(() => {
    if (!batch) {
      setDueDateInput('');
      return;
    }
    const target = batch?.toba_duedate || batch?.dueDate || '';
    setDueDateInput(String(target || ''));
  }, [batch]);

  useEffect(() => {
    if (!sqliteReady || !id) return;
    let cancelled = false;
    (async () => {
      setRowsLoading(true);
      setRowsError(null);
      try {
        const res = await fetch(`${apiBase}/api/batches/${encodeURIComponent(id)}/completions`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load recipients (${res.status})`);
        const payload = await res.json();
        const items: CompletionRow[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.rows)
            ? payload.rows
            : [];
        if (!cancelled) setRows(items);
      } catch (error: any) {
        if (!cancelled) {
          setRows([]);
          setRowsError(error?.message || 'Failed to load recipients.');
        }
      } finally {
        if (!cancelled) setRowsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, id, sqliteReady, recipientsRefreshKey]);

  const incompleteRows = useMemo(
    () => rows.filter((r) => !r.completed),
    [rows]
  );
  const totalDocs = rows.length > 0 ? rows[0].total || 0 : 0;
  const completedCount = rows.filter((r) => !!r.completed).length;
  const incompleteCount = rows.length - completedCount;
  const outstandingDocs = rows.reduce((acc, r) => {
    const total = Math.max(0, r.total || 0);
    const acked = Math.max(0, r.acknowledged || 0);
    return acc + Math.max(0, total - acked);
  }, 0);

  const sendBatchNotificationEmail = async (): Promise<number> => {
    if (!batch || !id || incompleteRows.length === 0) return 0;
    const recipients: NotificationRecipient[] = [];
    for (const row of incompleteRows) {
      const email = (row.email || '').trim();
      if (!email) continue;
      recipients.push({ address: email, name: row.displayName || undefined });
    }
    if (recipients.length === 0) return 0;

    const portalUrl = `${window.location.origin}/batch/${id}`;
    const { subject, bodyHtml } = buildBatchEmail({
      appUrl: portalUrl,
      batchName,
      startDate: batch?.toba_startdate || batch?.startDate || undefined,
      dueDate: dueDateInput || batch?.toba_duedate || batch?.dueDate || undefined,
      description: batchDescription || undefined,
    });
    await sendEmail(recipients, subject, bodyHtml);
    return recipients.length;
  };

  const handleSaveDueDate = async () => {
    if (!id || !sqliteReady) return;
    if (!canEditBatch) {
      showToast('Edit permission required to update due date.', 'warning');
      return;
    }
    setSavingDue(true);
    try {
      const payload = {
        dueDate: dueDateInput || null,
        startDate: batch?.toba_startdate || batch?.startDate || null,
        name: batch?.toba_name || batch?.name || null,
        status: batch?.toba_status != null ? Number(batch.toba_status) : batch?.status != null ? Number(batch.status) : undefined,
        description: batch?.toba_description || batch?.description || null,
      };
      const res = await fetch(`${apiBase}/api/batches/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to save due date (${res.status})`);
      setBatch((prev: any) => (prev ? { ...prev, toba_duedate: dueDateInput || null, dueDate: dueDateInput || null } : prev));
      showToast('Due date updated', 'success');
      await handleSendReminders();
    } catch (error: any) {
      showToast(error?.message || 'Failed to update due date', 'error');
    } finally {
      setSavingDue(false);
    }
  };

  const handleSendReminders = async () => {
    if (!id || !sqliteReady || incompleteCount === 0) return;
    if (!canSendReminders) {
      showToast('Send notifications permission required.', 'warning');
      return;
    }
    setSendingReminder(true);
    setReminderMessage(null);
    let graphSent = 0;
    try {
      graphSent = await sendBatchNotificationEmail();
    } catch (error: any) {
      showToast(error?.message || 'Notification email failed', 'error');
    }
    try {
      const res = await fetch(`${apiBase}/api/reminders/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: String(id), ignoreDueWindow: true, force: true }),
      });
      if (!res.ok) throw new Error(`Reminder send failed (${res.status})`);
      const result = await res.json().catch(() => ({}));
      const sent = Number(result.sent ?? 0);
      const skipped = Number(result.skippedRecent ?? 0);
      const graphInfo = graphSent > 0 ? `Graph notification email sent to ${graphSent} recipient${graphSent === 1 ? '' : 's'}.` : 'No notification email was sent.';
      setReminderMessage(
        `Sent ${sent} reminder${sent === 1 ? '' : 's'} (${skipped} skipped due to throttling). ${graphInfo}`
      );
      showToast(`Reminders sent to ${sent} recipient${sent === 1 ? '' : 's'}`, 'success');
    } catch (error: any) {
      setReminderMessage(null);
      showToast(error?.message || 'Failed to send reminders', 'error');
    } finally {
      setSendingReminder(false);
    }
  };

  const notifyNewRecipients = async (list: RecipientPayload[]): Promise<number> => {
    if (!batch || !id) return 0;
    const recipients = list
      .map((row): NotificationRecipient | null => {
        const email = (row.email || '').trim();
        if (!email) return null;
        return { address: email, name: row.displayName || undefined };
      })
      .filter((entry): entry is NotificationRecipient => entry !== null);
    if (recipients.length === 0) return 0;

    const portalUrl = `${window.location.origin}/batch/${id}`;
    const { subject, bodyHtml } = buildBatchEmail({
      appUrl: portalUrl,
      batchName,
      startDate: batch?.toba_startdate || batch?.startDate || undefined,
      dueDate: dueDateInput || batch?.toba_duedate || batch?.dueDate || undefined,
      description: batchDescription || undefined,
    });
    await sendEmail(recipients, subject, bodyHtml);
    return recipients.length;
  };

  const resetInviteSelection = () => {
    setInviteSelection({ users: [], groups: [] });
    setInviteSelectorKey((prev) => prev + 1);
  };
  const handleInviteModalOpen = () => {
    resetInviteSelection();
    setInviteModalOpen(true);
  };
  const handleInviteModalClose = () => {
    setInviteModalOpen(false);
    resetInviteSelection();
  };
  const handleInviteMoreRecipients = async () => {
    if (!id || !sqliteReady) return;
    if (!canEditBatch) {
      showToast('Edit permission required to add recipients.', 'warning');
      return;
    }
    if (inviteSelection.users.length === 0 && inviteSelection.groups.length === 0) {
      showToast('Select at least one user or group before inviting.', 'info');
      return;
    }
    setAddingRecipients(true);
    try {
      const recipientsMap = new Map<string, RecipientPayload>();
      const addRecipient = (
        rawEmail?: string | null,
        name?: string | null,
        extras?: Omit<RecipientPayload, 'email'>
      ) => {
        const email = String(rawEmail || '').trim();
        if (!email || !email.includes('@')) return;
        const key = email.toLowerCase();
        if (recipientsMap.has(key)) return;
        recipientsMap.set(key, {
          email,
          displayName: name || undefined,
          department: extras?.department || undefined,
          jobTitle: extras?.jobTitle || undefined,
          location: extras?.location || undefined,
          primaryGroup: extras?.primaryGroup || undefined,
        });
      };

      inviteSelection.users.forEach((user) => {
        addRecipient(user.mail || user.userPrincipalName, user.displayName, {
          department: user.department || undefined,
          jobTitle: user.jobTitle || undefined,
          location: user.officeLocation || undefined,
        });
      });

      if (inviteSelection.groups.length > 0) {
        let token: string;
        try {
          token = await getGraphToken(['Group.Read.All', 'User.Read']);
        } catch {
          showToast('Graph permissions required to resolve group members.', 'warning');
          return;
        }
        await Promise.all(
          inviteSelection.groups.map(async (group) => {
            try {
              const members = await getGroupMembers(token, group.id);
              members.forEach((member) => {
                addRecipient(member.mail || member.userPrincipalName, member.displayName, {
                  department: member.department || undefined,
                  jobTitle: member.jobTitle || undefined,
                  location: member.officeLocation || undefined,
                  primaryGroup: group.displayName || undefined,
                });
              });
            } catch {
              showToast(
                `Failed to load members for ${group.displayName || group.id}.`,
                'warning'
              );
            }
          })
        );
      }

      const payload = Array.from(recipientsMap.values());
      if (payload.length === 0) {
        showToast('No valid email addresses were selected.', 'warning');
        return;
      }

      const res = await fetch(
        `${apiBase}/api/batches/${encodeURIComponent(id)}/recipients`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients: payload }),
        }
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `Recipients request failed (${res.status})`);
      }
      const result = await res.json().catch(() => null);
      const inserted = Number(result?.inserted ?? payload.length);
      const skipped = Number(result?.skipped ?? 0);
      let notified = 0;
      try {
        notified = await notifyNewRecipients(payload);
      } catch (notifyError: any) {
        showToast(
          notifyError?.message || 'Recipient invite email failed (check Graph permissions).',
          'warning'
        );
      }
      let message = `Added ${inserted} recipient${inserted === 1 ? '' : 's'}`;
      if (skipped) message += ` • ${skipped} skipped`;
      if (notified) message += ` • notified ${notified} ${notified === 1 ? 'user' : 'users'}`;
      showToast(message, 'success');
      setRecipientsRefreshKey((prev) => prev + 1);
      handleInviteModalClose();
    } catch (error: any) {
      showToast(error?.message || 'Failed to add recipients.', 'error');
    } finally {
      setAddingRecipients(false);
    }
  };

  const inviteModal = (
    <Modal
      open={inviteModalOpen}
      onClose={handleInviteModalClose}
      title="Assign to Users & Groups"
      width={800}
      className="users-groups-modal"
    >
      <UserGroupSelector
        key={`invite-selector-${inviteSelectorKey}`}
        onSelectionChange={(selection) =>
          setInviteSelection({
            users: Array.isArray(selection.users) ? selection.users : [],
            groups: Array.isArray(selection.groups) ? selection.groups : [],
          })
        }
      />
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div className="small muted">
          Selected: {inviteSelection.users.length} user{inviteSelection.users.length === 1 ? '' : 's'},{' '}
          {inviteSelection.groups.length} group{inviteSelection.groups.length === 1 ? '' : 's'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" type="button" onClick={handleInviteModalClose}>
            Cancel
          </button>
          <button
            className="btn sm"
            type="button"
            onClick={handleInviteMoreRecipients}
            disabled={
              addingRecipients ||
              !canEditBatch ||
              (inviteSelection.users.length === 0 && inviteSelection.groups.length === 0)
            }
          >
            {addingRecipients ? 'Inviting...' : 'Invite selected'}
          </button>
        </div>
      </div>
    </Modal>
  );

  const batchName = batch?.toba_name || batch?.name || `Batch ${id}`;
  const statusValue = String(batch?.toba_status ?? batch?.status ?? '1');
  const statusLabel = statusValue === '1' ? 'Active' : 'Inactive';
  const startDate = batch?.toba_startdate || batch?.startDate || 'Not set';
  const batchDescription = batch?.toba_description || batch?.description || '';

  if (!sqliteReady) {
    return <div className="small muted">Enable SQLite (REACT_APP_ENABLE_SQLITE + API base) to view batch details.</div>;
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div className="title">{batchName}</div>
            <div className="muted small">Batch overview & controls</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to="/admin"><button className="btn ghost sm">Back to admin</button></Link>
            <Link to={`/admin/batch/${id}/completions`}><button className="btn ghost sm">View completions</button></Link>
            <button
              className="btn ghost sm"
              type="button"
              onClick={handleInviteModalOpen}
              disabled={!canEditBatch}
              title={!canEditBatch ? 'Edit permission required to modify recipients' : undefined}
            >
              Invite more recipients
            </button>
          </div>
        </div>
        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #f4f4f4' }} />

        {batchError ? (
          <div className="muted" style={{ padding: 12 }}>{batchError}</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <div>
                <div className="small muted">Status</div>
                <div className="badge" style={{ background: statusLabel === 'Active' ? '#d4edda' : '#e2e3e5', color: statusLabel === 'Active' ? '#155724' : '#383d41' }}>{statusLabel}</div>
              </div>
              <div>
                <div className="small muted">Start date</div>
                <div style={{ fontWeight: 600 }}>{startDate || 'Not set'}</div>
              </div>
              <div>
                <div className="small muted">Due date</div>
                <div style={{ fontWeight: 600 }}>{dueDateInput || 'Not set'}</div>
              </div>
              <div>
                <div className="small muted">Documents assigned</div>
                <div style={{ fontWeight: 600 }}>{totalDocs || '0'}</div>
              </div>
              <div>
                <div className="small muted">Recipients completed</div>
                <div style={{ fontWeight: 600 }}>{completedCount}/{rows.length || '0'}</div>
              </div>
              <div>
                <div className="small muted">Incomplete recipients</div>
                <div style={{ fontWeight: 600 }}>{incompleteCount || '0'}</div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
                <div className="small muted" style={{ marginBottom: 4 }}>Extend end date</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    id="admin-batch-due-date"
                    type="date"
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    disabled={!canEditBatch || savingDue}
                    style={{ minWidth: 180 }}
                  />
                  <button className="btn sm" onClick={handleSaveDueDate} disabled={!canEditBatch || savingDue}>
                    {savingDue ? 'Saving…' : 'Save due date'}
                  </button>
                </div>
                {!canEditBatch && (
                  <div className="muted small" style={{ marginTop: 6 }}>Edit permission required to change the due date.</div>
                )}
              </div>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
                <div className="small muted" style={{ marginBottom: 4 }}>Notify incomplete users</div>
                <button
                  className="btn sm"
                  onClick={handleSendReminders}
                  disabled={!canSendReminders || sendingReminder || incompleteCount === 0}
                  style={{ width: '100%' }}
                >
                  {sendingReminder
                    ? 'Sending reminders…'
                    : `Send reminder to ${incompleteCount || 0} recipient${incompleteCount === 1 ? '' : 's'}`}
                </button>
                <div className="muted small" style={{ marginTop: 6 }}>
                  {incompleteCount ? `${outstandingDocs} outstanding acknowledgement${outstandingDocs === 1 ? '' : 's'}` : 'All recipients completed.'}
                </div>
                {!canSendReminders && (
                  <div className="muted small" style={{ marginTop: 6 }}>Send notifications permission required.</div>
                )}
                {reminderMessage && (
                  <div className="muted small" style={{ marginTop: 4 }}>{reminderMessage}</div>
                )}
              </div>
            </div>
          </>
        )}

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="title">Incomplete recipients</div>
              <div className="muted small">
                {rowsLoading ? 'Loading…' : `${incompleteCount} of ${rows.length || 0} recipients have outstanding acknowledgements.`}
              </div>
            </div>
            <Link to={`/admin/batch/${id}/completions`}><button className="btn ghost sm">View completed users</button></Link>
          </div>
          <div style={{ marginTop: 12 }}>
            {rowsLoading ? (
              <div className="muted">Loading recipients…</div>
            ) : rowsError ? (
              <div className="muted" style={{ color: '#b02a37' }}>{rowsError}</div>
            ) : (
              <>
                {incompleteRows.length === 0 ? (
                  <div className="muted">No pending recipients. Everyone is complete.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {incompleteRows.map((row, index) => {
                      const progressText = `${row.acknowledged || 0}/${row.total || 0} acknowledged`;
                      const tags = [row.department, row.jobTitle, row.location].filter(Boolean);
                      const lastSeen = row.completionAt ? `Last ack ${new Date(row.completionAt).toLocaleString()}` : 'No acknowledgements yet';
                      return (
                        <div key={`${row.email}-${index}`} className="doc-row" style={{ padding: 10, border: '1px solid #f2f2f2', borderRadius: 6 }}>
                          <div className="doc-meta" style={{ alignItems: 'center' }}>
                            <div className="doc-icon">USR</div>
                            <div>
                              <div style={{ fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span>{row.displayName || row.email}</span>
                                <span className="badge" style={{ background: '#fff3cd', color: '#856404' }}>{progressText}</span>
                              </div>
                              <div className="muted small">{row.email}</div>
                              <div className="muted small">{tags.join(' • ')}</div>
                              <div className="muted small">{lastSeen}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {inviteModal}
    </div>
  );
};

export default BatchDetailAdmin;
