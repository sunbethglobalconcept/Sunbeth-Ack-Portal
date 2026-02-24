import React from 'react';

interface NavControlsProps {
  onPrev: () => void;
  onNext: () => void;
  progressText: string;
}

const NavControls: React.FC<NavControlsProps> = ({ onPrev, onNext, progressText }) => {
  return (
    <div className="dr-nav">
      <div className="controls">
        <button className="btn ghost sm" id="btnPrev" onClick={onPrev}>← Previous</button>
        <div className="spacer" />
        <div className="dr-nav-next">
          <button className="btn ghost sm" id="btnNext" onClick={onNext}>Next →</button>
        </div>
      </div>

      <div className="progressBar" aria-hidden="true"><i style={{ width: progressText }} /></div>
      <div className="muted small" style={{ marginTop: 8 }}>{progressText} complete</div>
    </div>
  );
};

export default NavControls;
