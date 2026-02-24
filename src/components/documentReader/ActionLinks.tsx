import React from 'react';

interface ActionLinksProps {
  docUrl: string;
  openInNewTabUrl: string;
  proxiedDownloadUrl: string;
  originalUrl?: string;
  // New: show selected business context (optional)
  selectedBusinessName?: string;
}

const ActionLinks: React.FC<ActionLinksProps> = ({
  docUrl,
  openInNewTabUrl,
  proxiedDownloadUrl,
  originalUrl,
  selectedBusinessName,
}) => {
  if (!docUrl && !originalUrl) return null;
  return (
    <div className="row dr-actions">
      {selectedBusinessName ? (
        <span className="badge" style={{ alignSelf: 'center' }} title="Selected business">
          {selectedBusinessName}
        </span>
      ) : null}
      {docUrl && (
        <a href={openInNewTabUrl} target="_blank" rel="noopener noreferrer" className="btn ghost xs">Open in new tab ↗</a>
      )}
      {docUrl && (
        <a href={proxiedDownloadUrl} className="btn ghost xs">Download</a>
      )}
      {originalUrl && originalUrl !== docUrl && (
        <>
          {docUrl && <span className="dr-actions-divider">|</span>}
          <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="btn ghost xs">View in SharePoint</a>
        </>
      )}
    </div>
  );
};

export default ActionLinks;
