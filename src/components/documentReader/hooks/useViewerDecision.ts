/* eslint-disable complexity */
import { useMemo } from 'react';

export function useViewerDecision(rawUrl: string, docUrl: string, contentType: string) {
  // Only allow local docUrl for viewerUrls, never fallback to backup/remote
  const { isPdf, isDocx, proxiedDownloadUrl, openInNewTabUrl, viewerUrls } = useMemo(() => {
    const extHintPdf = /\.pdf(\?|#|$)/i.test(rawUrl) || /\.pdf(\?|#|$)/i.test(docUrl);
    const extHintDocx = /\.docx(\?|#|$)/i.test(rawUrl) || /\.docx(\?|#|$)/i.test(docUrl);
    const isPdf = extHintPdf || /application\/pdf/i.test(contentType);
    const isDocx = extHintDocx || /vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i.test(contentType);
    const proxiedDownloadUrl = docUrl ? (docUrl + (docUrl.includes('?') ? '&' : '?') + 'download=1') : '';
    const openInNewTabUrl = docUrl ? (docUrl + (docUrl.includes('?') ? '&' : '?') + 'redir=1') : '';
    const viewerUrls = docUrl; // Only use local docUrl
    return { isPdf, isDocx, proxiedDownloadUrl, openInNewTabUrl, viewerUrls };
  }, [rawUrl, docUrl, contentType]);

  return { isPdf, isDocx, proxiedDownloadUrl, openInNewTabUrl, viewerUrls };
}
