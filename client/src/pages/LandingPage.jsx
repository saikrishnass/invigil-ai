import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Download, Monitor, Activity, Zap, Lock, 
  Users, CheckCircle2, ChevronRight, FileSpreadsheet, Cpu
} from 'lucide-react';
import { Navbar } from '../components/Navbar';

export function LandingPage() {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    const link = document.createElement('a');
    link.href = '/downloads/invigilAI-Agent.exe';
    link.setAttribute('download', 'invigilAI-Agent.exe');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 2500);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Hero Section */}
      <section style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '60px 24px 70px', 
        textAlign: 'center' 
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '30px',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          color: 'var(--accent)',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '24px'
        }}>
          <Zap size={16} /> Native OS Invigilation & Lab Telemetry
        </div>

        <h1 style={{ 
          fontSize: 'clamp(2.4rem, 5vw, 3.8rem)', 
          fontWeight: 800, 
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          marginBottom: '20px'
        }}>
          Computer Lab Activity Monitoring <br />
          <span style={{ 
            background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Powered by invigilAI
          </span>
        </h1>

        <p style={{ 
          fontSize: '1.15rem', 
          color: 'var(--text-muted)', 
          maxWidth: '740px', 
          margin: '0 auto 36px',
          lineHeight: 1.6 
        }}>
          Track active student window processes, copy-paste events, and focus integrity in real-time across college practical sessions. Zero paid AI costs. 100% OS accuracy.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={() => navigate('/admin')}
            className="btn-primary"
            style={{ 
              padding: '14px 28px', 
              fontSize: '1rem', 
              borderRadius: '12px'
            }}
          >
            <Shield size={18} /> Open Faculty Dashboard <ChevronRight size={18} />
          </button>

          <button 
            onClick={handleDownload}
            className="btn-secondary"
            style={{ 
              padding: '14px 28px', 
              fontSize: '1rem', 
              borderRadius: '12px'
            }}
          >
            <Download size={18} /> {downloading ? 'Downloading Agent...' : 'Download Desktop Agent (.exe)'}
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="glass-panel" style={{
          marginTop: '50px',
          padding: '24px',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }}></span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                invigilAI Real-Time Telemetry Stream
              </span>
            </div>
            <span className="badge badge-clean">
              ● AGENT LIVE STREAM
            </span>
          </div>

          <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', fontFamily: 'monospace', fontSize: '0.88rem' }}>
            <div style={{ color: '#94a3b8', marginBottom: '6px' }}>
              [1:33:57 PM] krishna (21CS045): <span style={{ color: '#4ade80' }}>✅ invigilAI ACTIVE: VS Code (solution.py)</span>
            </div>
            <div style={{ color: '#94a3b8', marginBottom: '6px' }}>
              [1:33:54 PM] rahul (21CS089): <span style={{ color: '#f87171' }}>🚨 invigilAI DETECTED: Google Chrome (ChatGPT)</span>
            </div>
            <div style={{ color: '#94a3b8' }}>
              [1:33:31 PM] anita (21CS012): <span style={{ color: '#38bdf8' }}>🟢 Joined Session LAB-9842</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section style={{ maxWidth: '1200px', margin: '0 auto 60px', padding: '0 24px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '20px' 
        }}>
          <FeatureCard 
            icon={<Cpu color="var(--accent)" size={24} />}
            title="Native Windows OS Tracking"
            desc="Runs on lab systems via lightweight .exe agent. Extracts active window handles and process names (VS Code, Chrome, Terminal) directly with 100% precision."
          />
          <FeatureCard 
            icon={<Activity color="var(--accent-purple)" size={24} />}
            title="Real-Time invigilAI Audit Stream"
            desc="Live chronological stream detailing app switches, browser titles, and idle duration during the lab exam session."
          />
          <FeatureCard 
            icon={<FileSpreadsheet color="#34d399" size={24} />}
            title="One-Click PDF Session Reports"
            desc="Generates instant, formatted PDF reports after session completion detailing student rankings, focus scores, and full violation logs."
          />
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '30px 24px', textAlign: 'center', marginTop: 'auto', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
        invigilAI Lab Monitoring System • MERN Stack & Native OS Proctoring
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '14px' }}>{icon}</div>
      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}
