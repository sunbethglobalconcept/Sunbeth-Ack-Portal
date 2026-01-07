import React from 'react';

interface BusinessOption {
  id: number | string;
  name: string;
}

interface AcceptControlsProps {
  ready: boolean;
  alreadyAcked: boolean;
  userName?: string;
  ack: boolean;
  onAckChange: (checked: boolean) => void;
  onAccept: () => void;
  // New: mandatory business selection before accepting
  businesses?: BusinessOption[];
  selectedBusinessId?: number | string | null;
  onBusinessChange?: (businessId: number | string) => void;
}

const AckStatement: React.FC<{ userName?: string; ack: boolean; onAckChange: (checked: boolean) => void; }> = ({ userName, ack, onAckChange }) => (
  <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input type="checkbox" checked={ack} onChange={e => onAckChange(e.target.checked)} />
    {userName ? (
      <>
        <span>I </span>
        <strong>{userName}</strong>
        <span>have read, understood, and agree to comply with the terms of this document</span>
      </>
    ) : (
      'I have read and understood this document.'
    )}
  </label>
);

const BusinessSelector: React.FC<{ businesses: BusinessOption[]; selectedBusinessId: number | string | null; onBusinessChange?: (businessId: number | string) => void; }> = ({ businesses, selectedBusinessId, onBusinessChange }) => (
  <div className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span>Business</span>
    <select
      id="businessSelect"
      className="input"
      value={selectedBusinessId != null ? String(selectedBusinessId) : ''}
      onChange={e => onBusinessChange && onBusinessChange(e.target.value)}
      style={{ minWidth: 220 }}
    >
      <option value="" disabled>
        {(businesses || []).length === 0 ? 'No businesses available' : 'Select your business'}
      </option>
      {(businesses || []).map(b => (
        <option key={String(b.id)} value={String(b.id)}>{b.name}</option>
      ))}
    </select>
  </div>
);

const AcceptControls: React.FC<AcceptControlsProps> = ({
  ready,
  alreadyAcked,
  userName,
  ack,
  onAckChange,
  onAccept,
  businesses = [],
  selectedBusinessId = null,
  onBusinessChange,
}) => {
  if (!ready || alreadyAcked) return null;
  const disabled = !ack || !selectedBusinessId;
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, flexWrap: 'wrap' }}>
        <AckStatement userName={userName} ack={ack} onAckChange={onAckChange} />
        <BusinessSelector businesses={businesses} selectedBusinessId={selectedBusinessId} onBusinessChange={onBusinessChange} />
      </div>
      <button
        className="btn accent sm acknowledge-button"
        id="btnAccept"
        onClick={onAccept}
        disabled={disabled}
        aria-disabled={disabled}
        title={!ack ? 'Please confirm you have read the document' : !selectedBusinessId ? 'Please select your business' : undefined}
      >
        I Accept
      </button>
    </div>
  );
};

export default AcceptControls;
