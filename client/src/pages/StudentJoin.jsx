import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Navbar } from '../components/Navbar';
import {
  Shield, CheckCircle, Download, Loader, AlertCircle, Monitor, RefreshCw, XCircle, Monitor as ScreenIcon
} from 'lucide-react';
import { API_BASE, BACKEND_URL, SOCKET_URL } from '../config/api';

// Agent states
const AGENT_IDLE     = 'idle';
const AGENT_CHECKING = 'checking';
const AGENT_FOUND    = 'found';
const AGENT_MISSING  = 'missing';

export function StudentJoin() {
  const { sessionId: paramSessionId } = useParams();

  const [sessionId, setSessionId]         = useState(paramSessionId || '');
  const [passcode,  setPasscode]          = useState('');
  const [name,      setName]              = useState('');
  const [rollNo,    setRollNo]            = useState('');
  const [joined,    setJoined]            = useState(false);
  const [socket,    setSocket]            = useState(null);
  const [error,     setError]             = useState('');
  const [agentState, setAgentState]       = useState(AGENT_IDLE);
  const [downloaded, setDownloaded]       = useState(false);
  const [webOnlyMode, setWebOnlyMode]     = useState(false);
  const [isLaunching, setIsLaunching]     = useState(false);
  const [launchBlocked, setLaunchBlocked] = useState(false);
  const [screenSharing, setScreenSharing]   = useState(false);
  const [screenShareError, setScreenShareError] = useState('');

  const screenIntervalRef = useRef(null);
  const socketRef         = useRef(null);

  /* ── Agent detection ─────────────────────────────────────────── */
  const quickPingAgent = async () => {
    for (const host of ['127.0.0.1', 'localhost']) {
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 800);
        const res  = await fetch(`http://${host}:48123/ping`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (res.ok) return true;
      } catch { /* try next */ }
    }
    return false;
  };

  const checkAgent = async () => {
    setAgentState(AGENT_CHECKING);
    const active = await quickPingAgent();
    if (active) { setAgentState(AGENT_FOUND); setLaunchBlocked(false); return true; }
    setAgentState(AGENT_MISSING);
    return false;
  };

  React.useEffect(() => { checkAgent(); }, []);

  React.useEffect(() => {
    if (agentState === AGENT_FOUND || joined) return;
    const iv = setInterval(async () => {
      const active = await quickPingAgent();
      if (active) { setAgentState(AGENT_FOUND); setLaunchBlocked(false); clearInterval(iv); }
    }, 2500);
    return () => clearInterval(iv);
  }, [agentState, joined]);

  /* ── Download — serve from Render backend for faster speed ───── */
  const downloadAgent = () => {
    setDownloaded(true);
    const a = document.createElement('a');
    // Use Render backend URL directly — much faster than Vercel for binary files
    a.href = `${BACKEND_URL}/downloads/invigilAI-Agent.exe`;
    a.setAttribute('download', 'invigilAI-Agent.exe');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /* ── Screen capture — enforce ENTIRE SCREEN only ─────────────── */
  const startScreenCapture = async (s) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'monitor', // hint to Chrome: prefer Entire Screen
            width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 1 }
          },
          audio: false
        });

        // ── Enforce Entire Screen only ────────────────────────────
        const track   = stream.getVideoTracks()[0];
        const surface = track?.getSettings?.()?.displaySurface;

        if (surface && surface !== 'monitor') {
          // Student picked a Tab or Window — reject and ask again
          stream.getTracks().forEach(t => t.stop());
          setScreenShareError(
            surface === 'browser'
              ? '⚠️ You selected a Browser Tab. Please click "Share" again and choose "Entire Screen".'
              : '⚠️ You selected a Window. Please click "Share" again and choose "Entire Screen".'
          );
          continue; // retry loop
        }

        // ✅ Entire screen — proceed
        setScreenShareError('');

        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await video.play();

        const canvas = document.createElement('canvas');
        canvas.width  = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        setScreenSharing(true);

        screenIntervalRef.current = setInterval(() => {
          if (!s.connected) { stopScreenCapture(stream); return; }
          ctx.drawImage(video, 0, 0, 1280, 720);
          const frame = canvas.toDataURL('image/jpeg', 0.35);
          s.emit('screen_frame', { sessionId, studentId: rollNo, frame });
        }, 3000);

        track.addEventListener('ended', () => stopScreenCapture(stream));
        return; // success — exit the retry loop

      } catch {
        // User cancelled / dismissed the dialog
        if (stream) stream.getTracks().forEach(t => t.stop());
        setScreenSharing(false);
        setScreenShareError('⚠️ Screen share was cancelled. The admin cannot see your screen. Only agent tracking is active.');
        return;
      }
    }
    // All retries exhausted
    setScreenShareError('⚠️ Could not start screen sharing. Please rejoin and select "Entire Screen".');
  };

  const stopScreenCapture = (stream) => {
    clearInterval(screenIntervalRef.current);
    setScreenSharing(false);
    try { stream?.getTracks().forEach(t => t.stop()); } catch {}
  };


  /* ── Protocol trigger + 4.5s verification ────────────────────── */
  const triggerProtocolAndJoin = async () => {
    setIsLaunching(true);
    setLaunchBlocked(false);
    setError('');

    const protocolUrl = `invigilai://start?sessionId=${encodeURIComponent(sessionId)}&name=${encodeURIComponent(name)}&rollNo=${encodeURIComponent(rollNo)}&serverUrl=${encodeURIComponent(BACKEND_URL)}`;
    window.location.href = protocolUrl;

    let found = false;
    for (let i = 0; i < 9; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await quickPingAgent()) { found = true; break; }
    }

    if (found) {
      setAgentState(AGENT_FOUND);
      setIsLaunching(false);
      await completeJoin();
    } else {
      setIsLaunching(false);
      setAgentState(AGENT_MISSING);
      setLaunchBlocked(true);
    }
  };

  /* ── Complete join (WebSocket + agent start_session) ─────────── */
  const completeJoin = async () => {
    try {
      try {
        await fetch('http://127.0.0.1:48123/start_session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serverUrl: BACKEND_URL, sessionId, name, rollNo })
        });
      } catch { /* agent may have already received params via invigilai:// */ }

      const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
      socketRef.current = s;

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

      // ── Admin ended session → kick student out + stop agent ───
      s.on('session_ended', () => {
        clearInterval(screenIntervalRef.current);
        setJoined(false);
        setScreenSharing(false);
        setError('⚠️ The faculty has ended this practical session. Your exam has been closed.');
        s.disconnect();
        fetch('http://127.0.0.1:48123/stop_session', { method: 'POST' }).catch(() => {});
      });

      setSocket(s);
      setJoined(true);
      setError('');

      // Start screen capture after join (runs asynchronously)
      startScreenCapture(s);
    } catch {
      setError('Server connection error. Please try again.');
    }
  };

  /* ── Main Join handler ───────────────────────────────────────── */
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
      if (data.session.status === 'ended') { setError('This session has already ended.'); return; }

      const isAlreadyRunning = await quickPingAgent();
      if (isAlreadyRunning || webOnlyMode) {
        setAgentState(AGENT_FOUND);
        await completeJoin();
      } else {
        await triggerProtocolAndJoin();
      }
    } catch {
      setError('Server connection error. Please try again.');
    }
  };

  const canJoin = agentState === AGENT_FOUND || webOnlyMode;

  /* ── Agent badge ────────────────────────────────────────────── */
  const AgentBadge = () => {
    if (webOnlyMode && agentState !== AGENT_FOUND) {
      return (
        <div style={badge('#38bdf8', 'rgba(56,189,248,0.12)', 'rgba(56,189,248,0.3)')}>
          <Monitor size={15} />
          <span>🌐 Web Proctoring Mode — Tracking tab switches & window blur</span>
        </div>
      );
    }

    if (agentState === AGENT_IDLE) return null;

    if (agentState === AGENT_CHECKING) return (
      <div style={badge('#38bdf8', 'rgba(56,189,248,0.12)', 'rgba(56,189,248,0.3)')}>
        <Loader size={15} className="spin" /><span>Detecting Desktop Agent…</span>
      </div>
    );

    if (agentState === AGENT_FOUND) return (
      <div style={badge('#4ade80', 'rgba(34,197,94,0.12)', 'rgba(34,197,94,0.3)')}>
        <CheckCircle size={15} /><span>✅ Desktop Agent Active — Universal Tracking Ready!</span>
      </div>
    );

    return (
      <div style={{ ...badge('#f59e0b', 'rgba(245,158,11,0.08)', 'rgba(245,158,11,0.25)'), flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} /><span style={{ fontWeight: 700 }}>Desktop Agent Not Running</span>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '8px', width: '100%' }}>
          <div><strong>Automatic:</strong> Click <strong>Launch Agent & Join Exam</strong> to open the Chrome prompt.</div>
          <div><strong>Manual:</strong> Download the .exe below, run it, then click Join.</div>
          <div style={{ color: '#38bdf8', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Loader size={12} className="spin" /><span>Auto-detecting on port 48123…</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', alignItems: 'center' }}>
          <button type="button" onClick={downloadAgent} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.78rem', gap: '6px' }}>
            <Download size={13} /> {downloaded ? 'Download Again' : 'Download Agent (.exe)'}
          </button>
          <button type="button" onClick={checkAgent} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
            Check Again
          </button>
          <button type="button" onClick={() => setWebOnlyMode(true)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '0.74rem', textDecoration: 'underline', cursor: 'pointer', padding: '4px 6px', marginLeft: 'auto' }}>
            Lab PC blocking .exe? Join with Browser Tab Proctoring
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

            {/* Agent Check Row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: '10px', marginBottom: '10px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Monitor size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Desktop Agent Status</span>
              </div>
              <button type="button" onClick={checkAgent} disabled={agentState === AGENT_CHECKING}
                className="btn-secondary" style={{ padding: '5px 14px', fontSize: '0.78rem', opacity: agentState === AGENT_CHECKING ? 0.7 : 1 }}>
                {agentState === AGENT_CHECKING
                  ? <><Loader size={12} className="spin" /> Checking…</>
                  : agentState === AGENT_FOUND ? '✔ Re-check' : 'Check'}
              </button>
            </div>

            {agentState !== AGENT_IDLE && <div style={{ marginBottom: '16px' }}><AgentBadge /></div>}

            {/* Cancel / Blocked Banner */}
            {launchBlocked && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: '10px', padding: '14px', marginBottom: '16px', color: '#f87171'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                  <XCircle size={18} /><span>Agent Launch Cancelled / Not Running</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '12px' }}>
                  You clicked <strong>Cancel</strong> on Chrome's prompt or the Agent is missing. You <strong>cannot enter</strong> the exam without the agent.
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={triggerProtocolAndJoin} disabled={isLaunching}
                    className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem', gap: '6px', background: '#dc2626', borderColor: '#ef4444' }}>
                    <RefreshCw size={14} className={isLaunching ? 'spin' : ''} />
                    {isLaunching ? 'Opening Agent Prompt…' : '🔄 Retry Launch & Join'}
                  </button>
                  <button type="button" onClick={downloadAgent} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.8rem', gap: '6px' }}>
                    <Download size={14} /> Download Agent (.exe)
                  </button>
                </div>
              </div>
            )}

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

              <button type="submit" disabled={isLaunching} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', marginTop: '6px', opacity: isLaunching ? 0.7 : 1, cursor: isLaunching ? 'not-allowed' : 'pointer' }}>
                {isLaunching
                  ? <><Loader size={16} className="spin" /> Opening Agent Prompt & Verifying…</>
                  : canJoin ? '🚀 Start Practical Exam' : '🚀 Launch Agent & Join Exam'}
              </button>
            </form>
          </div>
        ) : (
          /* Joined screen */
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

            {/* Screen share status */}
            {screenSharing ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '16px', background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                <ScreenIcon size={13} /> 📡 Entire Screen Sharing Active — Admin Can View
              </div>
            ) : screenShareError ? (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', textAlign: 'left' }}>
                <div style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '8px' }}>{screenShareError}</div>
                <button
                  onClick={() => startScreenCapture(socketRef.current)}
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.78rem', gap: '6px' }}
                >
                  <ScreenIcon size={13} /> Share Entire Screen Again
                </button>
              </div>
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '16px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                <ScreenIcon size={13} /> ⚠️ Screen Not Shared — Only Agent Tracking Active
              </div>
            )}

            <div style={{ background: '#090d16', padding: '14px', borderRadius: '10px', textAlign: 'left', fontSize: '0.82rem', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '4px' }}>🛡️ Proctoring Active:</div>
              <ul style={{ color: 'var(--text-muted)', paddingLeft: '18px', lineHeight: 1.65 }}>
                <li>Your session is live on the Faculty Audit Dashboard.</li>
                <li>Stay in this window during the practical exam.</li>
                <li>Switching away or opening unapproved apps will trigger violation alerts.</li>
                {screenSharing && <li>Your screen is being shared with the faculty.</li>}
              </ul>
            </div>

            <button
              onClick={() => {
                clearInterval(screenIntervalRef.current);
                socket?.disconnect();
                setJoined(false);
                setScreenSharing(false);
              }}
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

const labelStyle = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' };

function badge(color, bg, border) {
  return {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', borderRadius: '8px',
    background: bg, border: `1px solid ${border}`,
    color, fontSize: '0.83rem', fontWeight: 600
  };
}
