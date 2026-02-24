/* eslint-disable max-lines-per-function, complexity */
// DocumentReader split into presentational parts and hooks; remaining warnings will be addressed incrementally.
/**
 * DocumentReader: Displays a single document within a batch and handles acknowledgement.
 *
 * - Reads documents via dbService (SQLite API or SharePoint Lists).
 * - Sends acknowledgements via flowService.
 * - Navigates previous/next between documents and shows progress.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExternalAuth } from '../context/ExternalAuthContext';
// flow submission and busy indicators are handled inside useAcceptHandler
import Toast from './Toast';
import HeaderBar from './documentReader/HeaderBar';
import ConsentBanner from './documentReader/ConsentBanner';
import GraphAccessHint from './documentReader/GraphAccessHint';
import ViewerFrame from './documentReader/ViewerFrame';
import ActionLinks from './documentReader/ActionLinks';
import AcceptControls from './documentReader/AcceptControls';
import { apiGet, apiPut } from '../services/api';
import NavControls from './documentReader/NavControls';
import { getApiBase as getApiBaseCfg } from '../utils/runtimeConfig';
import { hasConsent } from '../utils/legalConsent';
import { useBatchAndProgress } from './documentReader/hooks/useBatchAndProgress';
import { useDocUrlResolution } from './documentReader/hooks/useDocUrlResolution';
import { useContentTypeProbe } from './documentReader/hooks/useContentTypeProbe';
import { useAcceptHandler } from './documentReader/hooks/useAcceptHandler';
import { useDocNavigation } from './documentReader/hooks/useDocNavigation';
import { useViewerDecision } from './documentReader/hooks/useViewerDecision';
// progress refresh is handled inside useAcceptHandler

const DocumentReader: React.FC = () => {
  const { id } = useParams();
  const { account, token, getToken, login } = useAuth();
  const { user: externalUser } = useExternalAuth();
  const [ack, setAck] = useState(false);
  const title = useMemo(() => `Document ${id}`, [id]);
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const batchIdFromQuery = params.get('batchId') || undefined;

  const { docs, index, progressText, alreadyAcked, ackCheckReady, setProgressText } =
    useBatchAndProgress(
      id,
      batchIdFromQuery,
      token ?? undefined,
      account?.username || externalUser?.email || undefined
    );
  const userName = (
    account?.name ||
    account?.username ||
    externalUser?.name ||
    externalUser?.email ||
    ''
  ).toString();
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [businesses, setBusinesses] = useState<Array<{ id: number | string; name: string }>>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | string | null>(null);
  const [isLastPage, setIsLastPage] = useState<boolean>(false);

  // Load businesses list for selector
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await apiGet<any>(`/api/businesses/active`);
        const list = Array.isArray(r?.businesses) ? r.businesses : Array.isArray(r) ? r : [];
        if (mounted) setBusinesses(list);
      } catch {
        /* ignore fetch errors; selector will remain empty */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const { onAccept, toastMsg, showToast } = useAcceptHandler({
    ack,
    id,
    title,
    username: account?.username || externalUser?.email || undefined,
    displayName: account?.name || externalUser?.name || externalUser?.email || undefined,
    batchIdFromQuery,
    index,
    docs,
    token,
    navigate,
    setProgressText,
  });

  // Intercept onAccept to persist selected business before sending acknowledgement
  const handleAccept = async () => {
    if (!ack || !selectedBusinessId) return; // guarded by UI, but double-check
    try {
      const email = (account?.username || externalUser?.email || '').toString();
      if (email && selectedBusinessId) {
        // Best-effort persist; ignore failures so user isn't blocked
        try {
          await apiPut(`/api/users/${encodeURIComponent(email)}/business`, {
            businessId: selectedBusinessId,
          });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    onAccept();
  };

  // loaded via useBatchAndProgress

  const { prevDoc, nextDoc } = useDocNavigation(docs, index, batchIdFromQuery, navigate);

  const currentDoc =
    Array.isArray(docs) && index >= 0 && index < docs.length ? docs[index] : (undefined as any);
  const rawUrl = currentDoc?.toba_fileurl || (currentDoc as any)?.url || '';
  // Resolve API base via runtime config; if not set, use same-origin relative '/api'
  const cfgBase = getApiBaseCfg();
  const apiBase = cfgBase ? cfgBase : '';

  const getTokenAdapter = getToken
    ? async (scopes?: string[]) => {
        const t = await getToken(scopes);
        return t === null ? undefined : t;
      }
    : undefined;
  const { docUrl, needGraphAuth } = useDocUrlResolution(
    currentDoc,
    apiBase,
    getTokenAdapter,
    refreshKey
  );
  const contentType = useContentTypeProbe(docUrl, apiBase);

  // resolved via useDocUrlResolution

  // content-type probing via useContentTypeProbe
  // const docTitle = currentDoc?.toba_title || `Document ${id}`;
  // Determine viewer by URL extension or content-type (set by diagnostics)
  const { isPdf, isDocx, proxiedDownloadUrl, openInNewTabUrl, viewerUrls } = useViewerDecision(
    rawUrl,
    docUrl,
    contentType
  );

  const originalUrl = (currentDoc as any)?.toba_originalurl as string | undefined;

  return (
    <div className="container document-reader">
      <div className="card dr-card">
        <HeaderBar title={title} />
        <ConsentBanner
          show={
            !!(
              batchIdFromQuery &&
              !hasConsent(account?.username || externalUser?.email || undefined, batchIdFromQuery)
            )
          }
        />
        <GraphAccessHint
          visible={needGraphAuth}
          onGrant={async () => {
            try {
              // If not already authenticated with Microsoft, trigger MSAL login
              if (!account) {
                await login();
              }
              await getToken?.(['Files.Read.All', 'Sites.Read.All']);
              setRefreshKey((k) => k + 1);
            } catch (e) {
              /* noop */
            }
          }}
        />
        <ViewerFrame
          isPdf={isPdf}
          isDocx={isDocx}
          viewerUrls={viewerUrls}
          docUrl={docUrl}
          needGraphAuth={needGraphAuth}
          onLastPageChange={(isLast) => setIsLastPage((prev) => prev || isLast)}
        />
        <ActionLinks
          docUrl={docUrl || ''}
          openInNewTabUrl={openInNewTabUrl || ''}
          proxiedDownloadUrl={proxiedDownloadUrl || ''}
          originalUrl={originalUrl}
          selectedBusinessName={
            (businesses.find((b) => String(b.id) === String(selectedBusinessId)) || undefined)?.name
          }
        />
        <AcceptControls
          ready={ackCheckReady}
          alreadyAcked={alreadyAcked}
          userName={userName}
          ack={ack}
          onAckChange={setAck}
          onAccept={handleAccept}
          businesses={businesses}
          selectedBusinessId={selectedBusinessId}
          onBusinessChange={(bid) => setSelectedBusinessId(bid)}
          isLastPage={isLastPage}
        />
        <NavControls onPrev={prevDoc} onNext={nextDoc} progressText={progressText} />
        <Toast message={toastMsg} show={showToast} />
      </div>
    </div>
  );
};
export default DocumentReader;
