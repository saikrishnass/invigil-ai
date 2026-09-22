import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Monitor, PlusCircle, Download, Home } from 'lucide-react';

export function Navbar({ onOpenCreateModal, activeSessionId }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleDownloadAgent = () => {
    const link = document.createElement('a');
    link.href = '/downloads/invigilAI-Agent.exe';
    link.setAttribute('download', 'invigilAI-Agent.exe');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <header style={{
      borderBottom: '1px solid var(--border-color)',
      background: 'rgba(9, 13, 22, 0.85)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 24px'
    }}>
      <div style={{
        maxWidth: '1350px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand Logo */}
        <div 
          onClick={() => navigate('/')} 
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
          }}>
            <Shield size={22} />
          </div>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              invigil<span style={{ color: 'var(--accent)' }}>AI</span>
            </span>
            <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 600 }}>
              LAB PROCTORING OS
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {location.pathname !== '/' && (
            <button 
              onClick={() => navigate('/')}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <Home size={15} /> Home
            </button>
          )}

          <button 
            onClick={handleDownloadAgent}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Download size={15} /> Agent (.exe)
          </button>

          {location.pathname !== '/admin' ? (
            <button 
              onClick={() => navigate('/admin')}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Monitor size={15} /> Faculty Dashboard
            </button>
          ) : (
            <button 
              onClick={onOpenCreateModal}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <PlusCircle size={15} /> Create Lab Session
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
