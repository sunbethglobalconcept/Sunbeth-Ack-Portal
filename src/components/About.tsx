import React from 'react';

const About: React.FC = () => (
  <div className="container about-page">
    <div className="card about-card">
      <div className="about-title">About this Portal</div>
      <div className="about-subtitle">A quick overview of how Sunbeth's Document Acknowledgement works.</div>
      <div className="about-divider" />
      <div className="about-body">
        <p>
          This portal helps employees read and acknowledge mandatory company documents like corporate policies,
          health and safety guidance, and periodic updates.
        </p>
        <ul className="features about-features">
          <li><strong>Simple workflow</strong> — read each document and acknowledge with a click.</li>
          <li><strong>Progress tracking</strong> — see your overall completion by batch.</li>
          <li><strong>Secure sign-in</strong> — authentication via Microsoft Entra (Azure AD).</li>
          <li><strong>Compliance</strong> — acknowledgements are recorded for audit readiness.</li>
        </ul>
        <p>When you're ready, sign in with your corporate account to view your assigned batches.</p>
        <div className="about-actions">
          <a className="btn" href="/">Back to Home</a>
        </div>
      </div>
    </div>
  </div>
);

export default About;
