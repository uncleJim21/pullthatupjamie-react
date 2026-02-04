import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();

  const sectionStyle: React.CSSProperties = {
    marginBottom: '32px',
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    fontSize: '20px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '16px',
  };

  const paragraphStyle: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    fontSize: '15px',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.8,
    marginBottom: '12px',
  };

  const listStyle: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    fontSize: '15px',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.8,
    marginLeft: '24px',
    marginBottom: '12px',
  };

  return (
    <div
      style={{
        backgroundColor: '#050505',
        minHeight: '100vh',
        color: 'white',
        padding: '80px 40px',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            cursor: 'pointer',
            marginBottom: '40px',
            padding: 0,
          }}
        >
          <ArrowLeft size={16} />
          Back to home
        </button>

        <h1
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '42px',
            fontWeight: 600,
            marginBottom: '16px',
          }}
        >
          Privacy Policy
        </h1>

        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '40px',
          }}
        >
          Last Updated: January 2026
        </p>

        <p style={paragraphStyle}>
          This Privacy Policy explains how CASCDR Inc. ("we," "us," or "our") collects, uses, and protects information in connection with the Service.
        </p>

        {/* Section 1 */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>1. Information We Collect</h2>
          
          <h3 style={{ ...headingStyle, fontSize: '17px', marginTop: '20px' }}>1.1 Information You Provide</h3>
          <ul style={listStyle}>
            <li>account information (email, username);</li>
            <li>content you submit (queries, links, files, text, audio, video);</li>
            <li>communications with us.</li>
          </ul>

          <h3 style={{ ...headingStyle, fontSize: '17px', marginTop: '20px' }}>1.2 Automatically Collected Information</h3>
          <ul style={listStyle}>
            <li>IP address, device information, browser type;</li>
            <li>usage logs, timestamps, performance data;</li>
            <li>cookies or similar technologies.</li>
            <li>anonymous analytics identifiers used to understand product usage and improve the Service (for example, session identifiers and event logs)</li>
          </ul>
        </div>

        {/* Section 2 */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>2. How We Use Information</h2>
          <p style={paragraphStyle}>We use information to:</p>
          <ul style={listStyle}>
            <li>provide, maintain, and improve the Service;</li>
            <li>operate AI models, embeddings, indexing, and search;</li>
            <li>enforce Terms and prevent abuse;</li>
            <li>comply with legal obligations.</li>
          </ul>
          <p style={{ ...paragraphStyle, fontWeight: 500 }}>
            We do not guarantee permanent storage of any data.
          </p>
        </div>

        {/* Section 3 */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>3. AI & Automated Processing</h2>
          <p style={paragraphStyle}>
            The Service uses automated systems and AI models to process content and generate outputs.
          </p>
          <p style={paragraphStyle}>You acknowledge and consent that:</p>
          <ul style={listStyle}>
            <li>content may be processed automatically;</li>
            <li>outputs may be inaccurate or incomplete;</li>
            <li>human review is not guaranteed.</li>
          </ul>
        </div>

        {/* Section 4 */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>4. Data Sharing</h2>
          <p style={paragraphStyle}>We may share information:</p>
          <ul style={listStyle}>
            <li>with service providers and infrastructure partners;</li>
            <li>to comply with legal requests;</li>
            <li>to protect our rights, users, or the public;</li>
            <li>in connection with mergers, acquisitions, or restructuring.</li>
          </ul>
          <p style={{ ...paragraphStyle, fontWeight: 500 }}>
            We do not sell personal data.
          </p>
        </div>

        {/* Section 5 */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>5. Data Retention</h2>
          <p style={paragraphStyle}>We retain data only as long as reasonably necessary for:</p>
          <ul style={listStyle}>
            <li>operating the Service;</li>
            <li>legal, security, or compliance needs.</li>
          </ul>
          <p style={paragraphStyle}>
            We may delete data at any time, with or without notice.
          </p>
        </div>

        {/* Section 6 */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>6. Security</h2>
          <p style={paragraphStyle}>
            We use reasonable administrative and technical safeguards, but no system is 100% secure.
          </p>
          <p style={{ ...paragraphStyle, fontWeight: 500 }}>
            You use the Service at your own risk.
          </p>
        </div>

        {/* Section 7 */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>7. Your Choices</h2>
          <p style={paragraphStyle}>You may:</p>
          <ul style={listStyle}>
            <li>request access or deletion of certain data (subject to legal limits);</li>
            <li>discontinue use of the Service at any time.</li>
          </ul>
          <p style={paragraphStyle}>
            Deletion requests may not remove data from backups or logs immediately.
          </p>
        </div>

        {/* Section 8 */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>8. Children's Privacy</h2>
          <p style={paragraphStyle}>
            The Service is not directed to children under 13. We do not knowingly collect personal data from children.
          </p>
        </div>

        {/* Section 9 */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>9. Changes</h2>
          <p style={paragraphStyle}>
            We may update this Privacy Policy at any time. Continued use means acceptance.
          </p>
        </div>

        {/* Section 10 */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>10. Analytics</h2>
          <p style={paragraphStyle}>
            We collect and analyze anonymous usage data to improve the Service, diagnose issues, and understand how features are used.
          </p>
          <p style={paragraphStyle}>This may include:</p>
          <ul style={listStyle}>
            <li>session identifiers that are not linked to personal identity;</li>
            <li>feature usage events (such as searches performed, pages viewed, or buttons clicked);</li>
            <li>error logs and performance metrics;</li>
            <li>aggregated statistics about how the Service is used.</li>
          </ul>
          <p style={paragraphStyle}>
            We do not use analytics data to build individual user profiles, target advertisements, or track users across other websites or services.
          </p>
          <p style={paragraphStyle}>
            Where feasible, analytics data is stored in anonymized or aggregated form.
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '60px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            © {new Date().getFullYear()} CASCDR Inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
