import React from 'react';
import { Link } from 'react-router-dom';

interface HeaderBarProps {
  title: string;
  backTo?: string;
  isPreview?: boolean;
}

const HeaderBar: React.FC<HeaderBarProps> = ({ title, backTo = '/', isPreview }) => {
  return (
    <div className="dr-header">
      <div>
        <div className="title dr-title">{title}</div>
        {!isPreview && <div className="muted small">Please read and acknowledge</div>}
      </div>
      <Link to={backTo}><button className="btn ghost sm back-btn">← Back</button></Link>
    </div>
  );
};

export default HeaderBar;
