import React from 'react';
import { Link } from 'react-router-dom';

interface HeaderBarProps {
  title: string;
  backTo?: string;
  isPreview?: boolean;
}

const HeaderBar: React.FC<HeaderBarProps> = ({ title, backTo = '/', isPreview }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div className="title">{title}</div>
        {!isPreview && <div className="muted small">Please read and acknowledge</div>}
      </div>
      <Link to={backTo}><button className="btn ghost sm">← Back</button></Link>
    </div>
  );
};

export default HeaderBar;
