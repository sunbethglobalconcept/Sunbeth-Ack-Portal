import { warn } from '../diagnostics/logger';
import { getApiBase, getCompletionCcEmails, getCompletionBccEmails, getAdminEmails, getHrEmails } from '../utils/runtimeConfig';
import { buildUserCompletionEmail, sendEmail, sendEmailWithAttachmentChunks, fetchAsBase64, generateCertificatePdf, generateAdminCompletionPdf, generateUserCompletionPdf } from './notificationService';
import { buildUserCompletionCertificate } from './emailTemplates';
import { getGraphToken } from './authTokens';

/**
 * Send a user acknowledgement event.
 *
 * Posts to SQLite API if enabled, and/or to Flow webhook if configured.
 */
export const sendAcknowledgement = async (payload: any): Promise<void> => {
  await processAcknowledgement(payload);
};

/* eslint-disable-next-line complexity */
async function processAcknowledgement(payload: any): Promise<void> {
  const api = getApiBase() as string;
  const base = api;
  const batchId = String(payload.batchId);
  const email = String((payload.userPrincipalName || payload.userEmail || payload.user || payload.email || '')).toLowerCase();

  await postAck(api, payload).catch((e) => warn('SQLite ack post failed (exception)', e));

  const ctx = await loadBatchContext(base, batchId);
  if (!ctx || ctx.docCount === 0 || !email) return;

  const userComplete = await isUserComplete(base, batchId, email, ctx.docCount);
  if (!userComplete) return;
  const flagKeyUser = `sunbeth:hrUserNotified:${batchId}:${email}`;
  if (getLocalFlag(flagKeyUser)) return;

  const recipientsAll = (await getNotificationEmails(base)).map((a) => ({ address: a }));
  if (recipientsAll.length === 0) return;

  const recipientRow = findRecipientRow(ctx.recipients, email);
  const businessName = await findBusinessName(base, recipientRow);
  const docTitles = buildDocTitles(ctx.documents);

  await sendCertificateToUser({ base, batchId, ctx, docs: ctx.documents, email, payload, recipientRow, businessName, docTitles });

  await notifyAdmins({ ctx, email, payload, recipientRow, businessName, recipientsAll, docTitles });

  setLocalFlag(flagKeyUser);
  checkBatchCompleteFlag(base, batchId, ctx.recipients, ctx.docCount).catch((e) => warn('Batch completion notify check failed', e));
}

async function postAck(api: string, payload: any): Promise<void> {
  const ackPayload = {
    batchId: payload.batchId,
    documentId: payload.documentId,
    email: (payload.userPrincipalName || payload.userEmail || payload.user || payload.userDisplay || '').toLowerCase() || payload.email || '',
  };
  const ackRes = await fetch(`${api}/api/ack`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ackPayload) });
  if (!ackRes.ok) warn('SQLite ack post failed', { status: ackRes.status, body: await ackRes.text().catch(() => '') });
}

async function loadBatchContext(base: string, batchId: string): Promise<{ batch: any; recipients: any[]; documents: any[]; docCount: number } | null> {
  const batches = await fetch(`${base}/api/batches`).then((r) => r.json()).catch(() => []);
  const batch = (Array.isArray(batches) ? batches : []).find((b: any) => String(b.toba_batchid || b.id) === batchId);
  const [recipients, documents] = await Promise.all([
    fetch(`${base}/api/batches/${encodeURIComponent(batchId)}/recipients`).then((r) => r.json()).catch(() => []),
    fetch(`${base}/api/batches/${encodeURIComponent(batchId)}/documents`).then((r) => r.json()).catch(() => []),
  ]);
  const docCount = Array.isArray(documents) ? documents.length : 0;
  if (docCount === 0) return null;
  return { batch, recipients, documents, docCount };
}

async function isUserComplete(base: string, batchId: string, email: string, docCount: number): Promise<boolean> {
  const acksRes = await fetch(`${base}/api/batches/${encodeURIComponent(batchId)}/acks?email=${encodeURIComponent(email)}`, { cache: 'no-store' });
  const j = await acksRes.json().catch(() => ({ ids: [] }));
  const acked = Array.isArray(j?.ids) ? j.ids.length : 0;
  return acked >= docCount;
}

async function getNotificationEmails(base: string): Promise<string[]> {
  try {
    const res = await fetch(`${base}/api/notification-emails`);
    const j = await res.json();
    const list = Array.isArray(j?.emails) ? j.emails : [];
    if (list.length > 0) return list.map((s: string) => String(s || '').trim().toLowerCase()).filter(Boolean);
  } catch (err) {
    warn('Failed to load notificationEmails', err as any);
  }
  const fallbacks = [...getAdminEmails(), ...getHrEmails()].map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set(fallbacks));
}

function findRecipientRow(recipients: any[], email: string): any | null {
  try {
    return (Array.isArray(recipients) ? recipients : []).find((r: any) => String(r.email || r.user || '').toLowerCase() === email) || null;
  } catch {
    return null;
  }
}

async function findBusinessName(base: string, recipientRow: any): Promise<string | undefined> {
  try {
    if (!recipientRow?.businessId) return undefined;
    const biz = await fetch(`${base}/api/businesses`, { cache: 'no-store' }).then((r) => r.json()).catch(() => []);
    const match = (Array.isArray(biz) ? biz : []).find((b: any) => String(b.id ?? b.businessId ?? b.ID ?? b.toba_businessid) === String(recipientRow.businessId));
    return match ? String(match.name || match.Title || match.title || match.code || 'Business') : undefined;
  } catch {
    return undefined;
  }
}

function buildDocTitles(documents: any[]): string[] {
  return (Array.isArray(documents) ? documents : []).map((d: any) => String(d.toba_title || d.title || 'Document'));
}

type GraphTokenRef = { current: string | null };

/* eslint-disable-next-line complexity */
async function resolveFileUrl(base: string, d: any, url: string, ref: GraphTokenRef): Promise<string> {
  const isSp = /sharepoint\.com\//i.test(url) || !!d.toba_driveid || !!d.toba_itemid || /sharepoint/i.test(String(d.toba_source || d.source || ''));
  if (!isSp) return `${base}/api/proxy?url=${encodeURIComponent(url)}`;
  try {
    if (!ref.current) ref.current = await getGraphToken(['Files.Read.All', 'Sites.Read.All']);
  } catch (e) {
    // Fallback to direct proxy if token retrieval fails
    return `${base}/api/proxy?url=${encodeURIComponent(url)}`;
  }
  if (d.toba_driveid && d.toba_itemid) {
    return `${base}/api/proxy/graph?driveId=${encodeURIComponent(String(d.toba_driveid))}&itemId=${encodeURIComponent(String(d.toba_itemid))}&token=${encodeURIComponent(ref.current as string)}&download=1`;
  }
  return `${base}/api/proxy/graph?url=${encodeURIComponent(url)}&token=${encodeURIComponent(ref.current as string)}&download=1`;
}

async function buildAttachments(base: string, documents: any[]): Promise<Array<{ name: string; contentBytes: string; contentType?: string }>> {
  const out: Array<{ name: string; contentBytes: string; contentType?: string }> = [];
  const ref: GraphTokenRef = { current: null };
  for (const d of (Array.isArray(documents) ? documents : [])) {
    const title = String(d.toba_title || d.title || 'document');
    const url = String(d.toba_fileurl || d.url || '');
    try {
      const fileUrl = await resolveFileUrl(base, d, url, ref);
      const { contentBytes, contentType } = await fetchAsBase64(fileUrl);
      out.push({ name: title, contentBytes, contentType });
    } catch (e) {
      // Skip this doc on error
      // no-op
      void 0;
    }
  }
  return out;
}

async function sendUserCertificateEmail(
  email: string,
  payload: any,
  subject: string,
  bodyHtml: string,
  attachments?: Array<{ name: string; contentBytes: string; contentType?: string }>
): Promise<void> {
  try {
    await sendEmailWithAttachmentChunks([{ address: email, name: payload.userDisplay || payload.displayName || email }], subject, bodyHtml, attachments && attachments.length ? attachments : undefined);
  } catch (e) {
    try { await sendEmail([{ address: email } as any], subject, bodyHtml); } catch (e2) { void 0; }
  }
}

async function sendAdminEmail(
  recipients: Array<{ address: string }>,
  subject: string,
  bodyHtml: string,
  cc?: Array<{ address: string }>,
  bcc?: Array<{ address: string }>,
  attachments?: Array<{ name: string; contentBytes: string; contentType?: string }>
): Promise<void> {
  try {
    await sendEmail(recipients as any, subject, bodyHtml, attachments && attachments.length ? attachments : undefined, { cc, bcc });
  } catch (err) {
    let errMsg = '';
    if (err && typeof err === 'object' && 'message' in err) { errMsg = (err as any).message; }
    else { try { errMsg = JSON.stringify(err); } catch { errMsg = String(err); } }
    alert('[UserCompletionEmail] Failed to send admin notification: ' + errMsg);
  }
}

function createCertificateIdentity(): { certificateId: string; verifyUrl: string } {
  const certificateId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? (crypto.randomUUID() as string)
    : `C-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-6)}`;
  const verifyUrl = `${window.location.origin}/verify/certificate/${encodeURIComponent(certificateId)}`;
  return { certificateId, verifyUrl };
}

function getLocalFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
function setLocalFlag(key: string): void {
  try { localStorage.setItem(key, '1'); } catch (e) { void 0; }
}

async function checkBatchCompleteFlag(base: string, batchId: string, recipients: any[], docCount: number): Promise<void> {
  const flagKeyBatch = `sunbeth:hrBatchNotified:${batchId}`;
  if (getLocalFlag(flagKeyBatch)) return;
  const emails: string[] = (Array.isArray(recipients) ? recipients : [])
    .map((r: any) => String(r.email || r.user || r.userPrincipalName || '').toLowerCase())
    .filter((e: string) => !!e);
  const uniqueEmails = Array.from(new Set(emails));
  for (const em of uniqueEmails) {
    try {
      const res = await fetch(`${base}/api/batches/${encodeURIComponent(batchId)}/acks?email=${encodeURIComponent(em)}`, { cache: 'no-store' });
      const jj = await res.json().catch(() => ({ ids: [] }));
      const cnt = Array.isArray(jj?.ids) ? jj.ids.length : 0;
      if (cnt < docCount) return;
    } catch { return; }
  }
  setLocalFlag(flagKeyBatch);
}

/* eslint-disable-next-line complexity, max-lines-per-function */
async function sendCertificateToUser(args: { base: string; batchId: string; ctx: { batch: any }; docs: any[]; email: string; payload: any; recipientRow: any; businessName?: string; docTitles: string[] }): Promise<void> {
  const { base, batchId, ctx, docs, email, payload, recipientRow, businessName, docTitles } = args;
  // Always skip generating the certificate PDF attachment, but still create identity for verify link
  const includeCertAttachment = false;
  const { certificateId, verifyUrl } = createCertificateIdentity();
  const { subject: certSubject, bodyHtml: certBody } = buildUserCompletionCertificate({
    appUrl: window.location.origin,
    batchName: String(ctx.batch?.toba_name || ctx.batch?.name || 'Batch'),
    userEmail: email,
    userName: payload.userDisplay || payload.displayName || undefined,
    completedOn: new Date().toISOString(),
    department: recipientRow?.department || undefined,
    jobTitle: recipientRow?.jobTitle || undefined,
    location: recipientRow?.location || undefined,
    businessName,
    primaryGroup: recipientRow?.primaryGroup || undefined,
    documents: docTitles,
    verifyUrl,
    certificateId,
    includeAttachment: includeCertAttachment,
  });
  // Record certificate for verification even if attachment is omitted
  if (certificateId) {
    try {
      await recordCertificate(base, {
        certificateId,
        batchId,
        userEmail: email,
        userName: payload.userDisplay || payload.displayName || undefined,
        completedOn: new Date().toISOString(),
        department: recipientRow?.department || undefined,
        jobTitle: recipientRow?.jobTitle || undefined,
        location: recipientRow?.location || undefined,
        businessName,
        primaryGroup: recipientRow?.primaryGroup || undefined,
        documents: docTitles,
      });
    } catch { /* non-blocking */ }
  }

  const attachments = await buildAttachments(base, docs).catch(() => []) as Array<{ name: string; contentBytes: string; contentType?: string }>;
  // Attach PDF version of the completion email (required by default)
  try {
    const emailPdf = await generateUserCompletionPdf({
      batchName: String(ctx.batch?.toba_name || ctx.batch?.name || 'Batch'),
      userEmail: email,
      userName: payload.userDisplay || payload.displayName || undefined,
      completedOn: new Date().toISOString(),
      documents: docTitles,
      department: recipientRow?.department || undefined,
      jobTitle: recipientRow?.jobTitle || undefined,
      location: recipientRow?.location || undefined,
      businessName,
      primaryGroup: recipientRow?.primaryGroup || undefined,
    });
    if (emailPdf?.contentBytes) attachments.unshift({ name: emailPdf.name, contentBytes: emailPdf.contentBytes, contentType: emailPdf.contentType });
  } catch {
    // best-effort: keep going even if PDF fails
  }
  if (includeCertAttachment) {
    const pdf = await generateCertificatePdf({
      batchName: String(ctx.batch?.toba_name || ctx.batch?.name || 'Batch'),
      userEmail: email,
      userName: payload.userDisplay || payload.displayName || undefined,
      completedOn: new Date().toISOString(),
      documents: docTitles,
      department: recipientRow?.department || undefined,
      jobTitle: recipientRow?.jobTitle || undefined,
      location: recipientRow?.location || undefined,
      businessName,
      primaryGroup: recipientRow?.primaryGroup || undefined,
      verifyUrl,
      pageSize: 'quarter',
      certificateId,
    }).catch(() => null);
    if (pdf?.contentBytes) attachments.unshift({ name: pdf.name, contentBytes: pdf.contentBytes, contentType: pdf.contentType });
  }
  await sendUserCertificateEmail(email, payload, certSubject, certBody, attachments);
}

async function recordCertificate(base: string, data: {
  certificateId: string;
  batchId: string;
  userEmail: string;
  userName?: string;
  completedOn?: string;
  department?: string;
  jobTitle?: string;
  location?: string;
  businessName?: string;
  primaryGroup?: string;
  documents?: string[];
}): Promise<void> {
  await fetch(`${base}/api/certificates/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`record_failed ${r.status}`);
    return r.json().catch(() => ({}));
  }).then(() => undefined);
}

async function notifyAdmins(args: { ctx: { batch: any; docCount: number }; email: string; payload: any; recipientRow: any; businessName?: string; recipientsAll: Array<{ address: string }>; docTitles: string[] }): Promise<void> {
  const { ctx, email, payload, recipientRow, businessName, recipientsAll, docTitles } = args;
  const { subject, bodyHtml } = buildUserCompletionEmail({
    appUrl: window.location.origin,
    batchName: String(ctx.batch?.toba_name || ctx.batch?.name || 'Batch'),
    userEmail: email,
    userName: payload.userDisplay || payload.displayName || undefined,
    completedOn: new Date().toISOString(),
    totalDocuments: ctx.docCount,
    documents: docTitles,
    department: recipientRow?.department || undefined,
    jobTitle: recipientRow?.jobTitle || undefined,
    location: recipientRow?.location || undefined,
    businessName,
    primaryGroup: recipientRow?.primaryGroup || undefined,
  });
  let pdfAttachment: Array<{ name: string; contentBytes: string; contentType?: string }> = [];
  try {
    const pdf = await generateAdminCompletionPdf({
      batchName: String(ctx.batch?.toba_name || ctx.batch?.name || 'Batch'),
      userEmail: email,
      userName: payload.userDisplay || payload.displayName || undefined,
      completedOn: new Date().toISOString(),
      totalDocuments: ctx.docCount,
      documents: docTitles,
      department: recipientRow?.department || undefined,
      jobTitle: recipientRow?.jobTitle || undefined,
      location: recipientRow?.location || undefined,
      businessName,
      primaryGroup: recipientRow?.primaryGroup || undefined,
    });
    if (pdf?.contentBytes) {
      pdfAttachment = [{ name: pdf.name, contentBytes: pdf.contentBytes, contentType: pdf.contentType }];
    }
  } catch (e) {
    // best-effort; ignore PDF failures
  }
  const cc = getCompletionCcEmails().filter(Boolean).map((a) => ({ address: a }));
  const bcc = getCompletionBccEmails().map((a) => ({ address: a }));
  await sendAdminEmail(recipientsAll as any, subject, bodyHtml, cc, bcc, pdfAttachment);
}
