import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Navbar } from '../components/Navbar';
import {
  Shield, CheckCircle, Download, Loader, AlertCircle, Monitor
} from 'lucide-react';
import { API_BASE, BACKEND_URL, SOCKET_URL } from '../config/api';

// Agent states
const AGENT_IDLE    = 'idle';
const AGENT_CHECKING = 'checking';
const AGENT_FOUND   = 'found';
const AGENT_MISSING = 'missing';

export function StudentJoin() {
  const { sessionId: paramSessionId } = useParams();

  const [sessionId, setSessionId]   = useState(paramSessionId || '');
  const [passcode,  setPasscode]    = useState('');
  const [name,      setName]        = useState('');
  const [rollNo,    setRollNo]      = useState('');
  const [joined,    setJoined]      = useState(false);
  const [socket,    setSocket]      = useState(null);
  const [error,     setError]       = useState('');
  const [agentState, setAgentState] = useState(AGENT_IDLE);

  /* ── Agent detection ─────────────────────────────────────────── */
  const checkAgent = async () => {
    setAgentState(AGENT_CHECKING);
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 2000);
      const res  = await fetch('http://127.0.0.1:48123/ping', { signal: ctrl.signal });
      clearTimeout(tid);
      setAgentState(res.ok ? AGENT_FOUND : AGENT_MISSING);
    } catch {
      setAgentState(AGENT_MISSING);
    }
  };

  const downloadAgent = () => {
    const a = document.createElement('a');
    a.href = '/downloads/invigilAI-Agent.exe';
    a.setAttribute('download', 'invigilAI-Agent.exe');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /* ── Join handler ────────────────────────────────────────────── */
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!sessionId || !passcode || !name || !rollNo) {
      setError('Please fill in all details.');
      return;
    }

    try {
      const res  = await fetch(`${API_BASE}/sessions/${sessionId}`);
      const data = await res.json();

      if (!res.ok || !data.session) { setError('Invalid Session Code.'); return; }
      if (data.session.password !== passcode) { setError('Incorrect Passcode.'); return; }

      // Tell the local agent to start tracking
      try {
        await fetch('http://127.0.0.1:48123/start_session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serverUrl: BACKEND_URL, sessionId, name, rollNo })
        });
      } catch { /* agent might not be running – web events still work */ }

      // WebSocket
      const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
      s.on('connect', () => {
        s.emit('student_web_join', { sessionId, studentId: rollNo, studentName: name });
      });

      window.onblur = () => s.emit('student_web_event', {
        sessionId, studentId: rollNo, studentName: name,
        eventType: 'focus_loss',
        details: '🚨 invigilAI DETECTED: Left exam window (Switched away)'
      });

      window.onfocus = () => s.emit('student_web_event', {
        sessionId, studentId: rollNo, studentName: name,
        eventType: 'focus_regain',
        details: 'Returned to exam window'
      });

      setSocket(s);
      setJoined(true);
      setError('');
    } catch {
      setError('Server connection error. Please try again.');
    }
  };

  const canJoin = agentState === AGENT_FOUND;

  /* ── Render helpers ──────────────────────────────────────────── */
  const AgentBadge = () => {
    if (agentState === AGENT_IDLE) return null;

    if (agentState === AGENT_CHECKING) return (
      <div style={badge('#38bdf8', 'rgba(56,189,248,0.12)', 'rgba(56,189,248,0.3)')}>
        <Loader size={15} className="spin" />
        <span>Checking for Desktop Agent…</span>
      </div>
    );

    if (agentState === AGENT_FOUND) return (
      <div style={badge('#4ade80', 'rgba(34,197,94,0.12)', 'rgba(34,197,94,0.3)')}>
        <CheckCircle size={15} />
        <span>✅ Desktop Agent is running — you're good to go!</span>
      </div>
    );

    // AGENT_MISSING
    return (
      <div style={{ ...badge('#f59e0b', 'rgba(245,158,11,0.10)', 'rgba(245,158,11,0.3)'), flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} />
          <span style={{ fontWeight: 700 }}>Agent not found on this PC</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Download <strong>invigilAI-Agent.exe</strong>, run it, then click <strong>Check Again</strong>.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={downloadAgent} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.78rem', gap: '6px' }}>
            <Download size={13} /> Download Agent (.exe)
          </button>
          <button type="button" onClick={checkAgent} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
            Check Again
          </button>
        </div>
      </div>
    );
  };

  /* ── Main render ─────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        {!joined ? (
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: 'linear-gradient(135deg,#0284c7,#38bdf8)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px'
              }}>
                <Shield size={26} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Join Practical Session</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginTop: '3px' }}>
                Verify your Desktop Agent, then enter exam credentials
              </p>
            </div>

            {/* ── Agent Check Row ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: '10px', marginBottom: '10px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Monitor size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Desktop Agent Status</span>
              </div>

              <button
                type="button"
                onClick={checkAgent}
                disabled={agentState === AGENT_CHECKING}
                className="btn-secondary"
                style={{ padding: '5px 14px', fontSize: '0.78rem', opacity: agentState === AGENT_CHECKING ? 0.7 : 1 }}
              >
                {agentState === AGENT_CHECKING
                  ? <><Loader size={12} className="spin" /> Checking…</>
                  : agentState === AGENT_FOUND
                    ? '✔ Re-check'
                    : 'Check'
                }
              </button>
            </div>

            {/* Status badge (below the row) */}
            {agentState !== AGENT_IDLE && (
              <div style={{ marginBottom: '16px' }}>
                <AgentBadge />
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '0.85rem', marginBottom: '14px' }}>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Session Code</label>
                <input type="text" className="input-field" placeholder="e.g. LAB-ZPL41K"
                  value={sessionId} onChange={e => setSessionId(e.target.value.toUpperCase())} required />
              </div>

              <div>
                <label style={labelStyle}>Session Passcode</label>
                <input type="password" className="input-field" placeholder="Enter passcode"
                  value={passcode} onChange={e => setPasscode(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" className="input-field" placeholder="e.g. Krishna Kumar"
                    value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div>
                  <label style={labelStyle}>Roll Number</label>
                  <input type="text" className="input-field" placeholder="e.g. 21CS045"
                    value={rollNo} onChange={e => setRollNo(e.target.value)} required />
                </div>
              </div>

              <button
                type="submit"
                disabled={!canJoin}
                className="btn-primary"
                style={{
                  width: '100%', justifyContent: 'center', padding: '13px',
                  marginTop: '6px',
                  opacity: canJoin ? 1 : 0.45,
                  cursor: canJoin ? 'pointer' : 'not-allowed'
                }}
              >
                {canJoin ? '🚀 Start Practical Exam' : '⚠️ Check Agent First to Unlock'}
              </button>
            </form>
          </div>
        ) : (
          /* ── Joined screen ── */
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '36px 28px', textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)', color: '#4ade80',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px'
            }}>
              <CheckCircle size={34} />
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '6px' }}>
              Connected to Session: {sessionId}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Invigilation active for <strong style={{ color: '#fff' }}>{name}</strong> ({rollNo}).
            </p>

            <div style={{ background: '#090d16', padding: '14px', borderRadius: '10px', textAlign: 'left', fontSize: '0.82rem', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '4px' }}>🛡️ Proctoring Active:</div>
              <ul style={{ color: 'var(--text-muted)', paddingLeft: '18px', lineHeight: 1.65 }}>
                <li>Your session is live on the Faculty Audit Dashboard.</li>
                <li>Stay in this window during the practical exam.</li>
                <li>Switching away or opening unapproved apps will trigger violation alerts.</li>
              </ul>
            </div>

            <button
              onClick={() => { socket?.disconnect(); setJoined(false); }}
              className="btn-secondary"
              style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', padding: '8px 18px', fontSize: '0.85rem' }}
            >
              Disconnect Session
            </button>
          </div>
        )}
      </main>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const labelStyle = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' };

function badge(color, bg, border) {
  return {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', borderRadius: '8px',
    background: bg, border: `1px solid ${border}`,
    color, fontSize: '0.83rem', fontWeight: 600
  };
}
