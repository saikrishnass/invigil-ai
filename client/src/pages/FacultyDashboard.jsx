import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Navbar } from '../components/Navbar';
import { CreateSessionModal } from '../components/CreateSessionModal';
import { PDFReportModal } from '../components/PDFReportModal';
import { 
  Users, ShieldCheck, AlertTriangle, Clock, Copy, Check, 
  FileText, Monitor, StopCircle, X, Wifi, WifiOff, Maximize2
} from 'lucide-react';
import { API_BASE, SOCKET_URL } from '../config/api';

export function FacultyDashboard() {
  const [sessionId, setSessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || '';
  });

  const [session, setSession]                   = useState(null);
  const [students, setStudents]                 = useState([]);
  const [logs, setLogs]                         = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen]       = useState(false);
  const [copiedLink, setCopiedLink]             = useState(false);
  const [copiedCode, setCopiedCode]             = useState(false);

  // Screen viewer state
  const [viewingStudent, setViewingStudent]     = useState(null);
  const [viewingFrame, setViewingFrame]         = useState(null);
  const [viewingTimestamp, setViewingTimestamp] = useState(null);

  // Store latest frame per student WITHOUT causing re-renders
  const screenFramesRef = useRef({}); // { studentId: { frame, timestamp } }

  // Sync state with URL
  useEffect(() => {
    const checkUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlSession = params.get('session');
      if (urlSession && urlSession !== sessionId) setSessionId(urlSession);
    };
    window.addEventListener('popstate', checkUrl);
    return () => window.removeEventListener('popstate', checkUrl);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    window.history.pushState({ path: `${window.location.pathname}?session=${sessionId}` }, '', `${window.location.pathname}?session=${sessionId}`);

    fetch(`${API_BASE}/sessions/${sessionId}`)
      .then(r => r.json()).then(d => { if (d.session) setSession(d.session); }).catch(console.error);

    fetch(`${API_BASE}/sessions/${sessionId}/students`)
      .then(r => r.json()).then(d => { if (d.students) setStudents(d.students); }).catch(console.error);

    fetch(`${API_BASE}/sessions/${sessionId}/logs`)
      .then(r => r.json()).then(d => { if (d.logs) setLogs(d.logs); }).catch(console.error);

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.emit('faculty_join_room', { sessionId });

    socket.on('dashboard_init', (data) => {
      if (data.session) setSession(data.session);
      if (data.students) setStudents(data.students);
      if (data.logs) setLogs(data.logs);
    });

    socket.on('student_joined', (student) => {
      setStudents(prev => {
        const exists = prev.find(s => s.studentId === student.studentId);
        if (exists) return prev.map(s => s.studentId === student.studentId ? { ...student, isOnline: true } : s);
        return [{ ...student, isOnline: true }, ...prev];
      });
    });

    socket.on('student_updated', (student) => {
      setStudents(prev => prev.map(s => s.studentId === student.studentId ? student : s));
    });

    socket.on('student_disconnected', ({ studentId }) => {
      setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, isOnline: false } : s));
    });

    socket.on('new_log_event', (log) => {
      setLogs(prev => [log, ...prev.slice(0, 299)]);
    });

    socket.on('session_ended', () => {
      setSession(prev => prev ? { ...prev, status: 'ended' } : prev);
      setStudents(prev => prev.map(s => ({ ...s, isOnline: false })));
    });

    // ── Screen frame handler: store frame, update modal if it's open ──
    socket.on('student_screen_frame', ({ studentId, frame, timestamp }) => {
      screenFramesRef.current[studentId] = { frame, timestamp };
      // Update live frame only if admin has that student's screen open
      setViewingStudent(vs => {
        if (vs && vs.studentId === studentId) {
          setViewingFrame(frame);
          setViewingTimestamp(timestamp);
        }
        return vs;
      });
    });

    return () => socket.disconnect();
  }, [sessionId]);

  const handleEndSession = async () => {
    if (!window.confirm('Are you sure you want to end this practical session?')) return;
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}/end`, { method: 'POST' });
      setSession(prev => prev ? { ...prev, status: 'ended' } : prev);
      setStudents(prev => prev.map(s => ({ ...s, isOnline: false })));
      setIsPdfModalOpen(true);
    } catch (err) { console.error(err); }
  };

  const openScreenViewer = (student) => {
    const stored = screenFramesRef.current[student.studentId];
    setViewingStudent(student);
    setViewingFrame(stored?.frame || null);
    setViewingTimestamp(stored?.timestamp || null);
  };

  const closeScreenViewer = () => {
    setViewingStudent(null);
    setViewingFrame(null);
    setViewingTimestamp(null);
  };

  const joinLink = `${window.location.origin}/join/${sessionId}`;
  const handleCopyLink = () => { navigator.clipboard.writeText(joinLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); };
  const handleCopyCode = () => { navigator.clipboard.writeText(sessionId); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };

  const onlineStudents = students.filter(s => s.isOnline !== false);
  const avgFocus = onlineStudents.length > 0
    ? Math.round(onlineStudents.reduce((acc, s) => acc + (s.focusScore || 100), 0) / onlineStudents.length)
    : 100;
  const totalViolations = logs.filter(l => l.isViolation).length;
  const sessionEnded = session?.status === 'ended';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onOpenCreateModal={() => setIsCreateModalOpen(true)} activeSessionId={sessionId} />

      <main style={{ flex: 1, maxWidth: '1350px', margin: '0 auto', width: '100%', padding: '24px' }}>
        {!sessionId ? (
          <div className="glass-panel" style={{ padding: '50px 30px', textAlign: 'center', maxWidth: '560px', margin: '60px auto' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg,#0284c7,#38bdf8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Monitor size={30} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px' }}>Faculty Invigilation Portal</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
              Create a new practical session to generate a shareable session code and student join link.
            </p>
            <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)} style={{ padding: '12px 26px' }}>
              Create Practical Session Now
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Session Ended Banner */}
            {sessionEnded && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', color: '#f87171' }}>
                <StopCircle size={20} />
                <div>
                  <div style={{ fontWeight: 700 }}>Session Ended — All monitoring stopped.</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>No new events will be accepted. Download the PDF report to review all logs.</div>
                </div>
                <button onClick={() => setIsPdfModalOpen(true)} className="btn-primary" style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: '0.82rem', flexShrink: 0 }}>
                  <FileText size={14} /> PDF Report
                </button>
              </div>
            )}

            {/* Session Banner */}
            <div className="glass-panel" style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>{session?.title || 'Practical Session'}</h2>
                  <span className={`badge ${sessionEnded ? 'badge-flagged' : 'badge-clean'}`}>
                    {sessionEnded ? 'SESSION ENDED' : '● ACTIVE'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Subject: <strong style={{ color: '#fff' }}>{session?.subject || 'Lab Practical'}</strong> • Passcode: <strong style={{ color: 'var(--accent)' }}>{session?.password || '1234'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15,23,42,0.9)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Code:</span>
                  <strong style={{ color: '#f59e0b', fontSize: '0.95rem' }}>{sessionId}</strong>
                  <button onClick={handleCopyCode} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                    {copiedCode ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                  </button>
                </div>
                {!sessionEnded && (
                  <button onClick={handleCopyLink} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                    {copiedLink ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                    {copiedLink ? 'Copied Link' : 'Copy Join Link'}
                  </button>
                )}
                <button onClick={() => setIsPdfModalOpen(true)} className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                  <FileText size={15} /> PDF Report
                </button>
                {!sessionEnded && (
                  <button onClick={handleEndSession} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', borderColor: 'rgba(239,68,68,0.4)', color: '#f87171' }}>
                    <StopCircle size={15} /> End Session
                  </button>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <MetricCard icon={<Users size={22} color="var(--accent)" />} label="Online Students" val={`${onlineStudents.length} / ${students.length}`} />
              <MetricCard icon={<ShieldCheck size={22} color="#4ade80" />} label="Avg Focus Index" val={`${avgFocus}%`} />
              <MetricCard icon={<AlertTriangle size={22} color="#f87171" />} label="Violations Detected" val={totalViolations} />
              <MetricCard icon={<Clock size={22} color="var(--accent-purple)" />} label="Session Duration" val={`${session?.durationMinutes || 120} Mins`} />
            </div>

            {/* Students Grid */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  Student Monitors ({students.length}) — <span style={{ color: '#4ade80', fontSize: '0.95rem' }}>{onlineStudents.length} Online</span>
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Click <strong style={{ color: 'var(--accent)' }}>👁 View Screen</strong> to watch any student's live screen
                </span>
              </div>

              {students.length === 0 ? (
                <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Monitor size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <p style={{ fontWeight: 600 }}>No students connected yet.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                    Share the join link: <strong style={{ color: 'var(--accent)' }}>{joinLink}</strong>
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {students.map(st => {
                    const isOnline = st.isOnline !== false;
                    const hasFrame = !!screenFramesRef.current[st.studentId];
                    return (
                      <div key={st.studentId} className="glass-panel"
                        style={{ padding: '16px', position: 'relative', opacity: isOnline ? 1 : 0.55, border: isOnline ? '1px solid var(--border-color)' : '1px solid rgba(255,255,255,0.05)' }}>

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              {isOnline ? <Wifi size={13} color="#4ade80" /> : <WifiOff size={13} color="#f87171" />}
                              <span style={{ fontWeight: 700, fontSize: '1.02rem' }}>{st.name}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>Roll: {st.studentId}</div>
                          </div>
                          <span className={`badge ${st.isFlagged ? 'badge-flagged' : 'badge-clean'}`}>
                            {st.isFlagged ? '🚨 Flagged' : '✅ Focused'}
                          </span>
                        </div>

                        {/* Active App */}
                        <div style={{ background: '#090d16', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '12px' }}>
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>
                            {isOnline ? 'Active Application' : 'Last Seen App'}
                          </div>
                          <div style={{ fontWeight: 600, color: isOnline ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {st.currentApp || 'VS Code'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {st.currentTitle || 'Active Workspace'}
                          </div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Focus: <strong style={{ color: st.focusScore >= 80 ? '#4ade80' : st.focusScore >= 60 ? '#facc15' : '#f87171' }}>{st.focusScore}%</strong></span>

                          {/* View Screen Button */}
                          <button
                            onClick={() => openScreenViewer(st)}
                            className="btn-secondary"
                            style={{
                              padding: '5px 11px', fontSize: '0.75rem', gap: '5px',
                              borderColor: hasFrame ? 'rgba(56,189,248,0.4)' : 'var(--border-color)',
                              color: hasFrame ? '#38bdf8' : 'var(--text-dim)',
                              cursor: 'pointer'
                            }}
                          >
                            <Maximize2 size={12} />
                            {hasFrame ? '👁 Live Screen' : '📷 View Screen'}
                          </button>
                        </div>

                        {!isOnline && (
                          <div style={{ marginTop: '8px', padding: '5px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.75rem', color: '#f87171', textAlign: 'center' }}>
                            🔴 Student Disconnected
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live Audit Log Feed */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '14px' }}>
                🔴 Live Invigilation Audit Stream ({logs.length})
              </h3>

              <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {logs.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>
                    Awaiting student activity telemetry...
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: '8px',
                      background: log.isViolation ? 'rgba(239,68,68,0.08)' : 'rgba(15,23,42,0.6)',
                      border: log.isViolation ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border-color)',
                      fontSize: '0.88rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'monospace', flexShrink: 0 }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {/* Student name — clicking opens their screen */}
                        <strong
                          style={{ color: '#38bdf8', cursor: 'pointer', flexShrink: 0 }}
                          title="Click to view this student's screen"
                          onClick={() => {
                            const st = students.find(s => s.studentId === log.studentId);
                            if (st) openScreenViewer(st);
                          }}
                        >
                          {log.studentName}
                        </strong>
                        <span style={{ color: log.isViolation ? '#f87171' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.details}
                        </span>
                      </div>
                      <span className={`badge ${log.isViolation ? 'badge-flagged' : 'badge-clean'}`} style={{ fontSize: '0.7rem', flexShrink: 0, marginLeft: '8px' }}>
                        {log.eventType}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Screen Viewer Modal ──────────────────────────────────────── */}
      {viewingStudent && (
        <>
          <div onClick={closeScreenViewer} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 900, backdropFilter: 'blur(3px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 'min(95vw, 1000px)', background: '#0a0f1e',
            border: '1px solid var(--border-color)', borderRadius: '14px',
            zIndex: 901, overflow: 'hidden', boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
            animation: 'popIn 0.2s ease'
          }}>
            {/* Modal header */}
            <div style={{
              padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: viewingStudent.isOnline !== false ? '#4ade80' : '#f87171', boxShadow: viewingStudent.isOnline !== false ? '0 0 8px #4ade80' : 'none' }} />
                <strong style={{ fontSize: '1rem' }}>
                  {viewingStudent.name} — Live Screen
                </strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Roll: {viewingStudent.studentId}</span>
                {viewingTimestamp && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>
                    Updated {new Date(viewingTimestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <button onClick={closeScreenViewer} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Screen frame */}
            <div style={{ background: '#000', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {viewingFrame ? (
                <img
                  src={viewingFrame}
                  alt={`${viewingStudent.name}'s screen`}
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '75vh', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '60px 20px' }}>
                  <Monitor size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>Waiting for screen share…</div>
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.6, maxWidth: '360px' }}>
                    The student needs to <strong style={{ color: '#fff' }}>allow screen share</strong> in the Chrome permission dialog when they joined.<br />
                    If they denied, ask them to rejoin and accept the screen share prompt.
                  </div>
                </div>
              )}

              {/* Live pulse indicator */}
              {viewingFrame && viewingStudent.isOnline !== false && (
                <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.65)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', color: '#4ade80', fontWeight: 700 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', display: 'inline-block', animation: 'pulse 1.5s ease infinite' }} />
                  LIVE — Updates every ~3s
                </div>
              )}
            </div>

            {/* Bottom info bar */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '20px', fontSize: '0.82rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)' }}>
              <span>Focus Score: <strong style={{ color: viewingStudent.focusScore >= 80 ? '#4ade80' : '#f87171' }}>{viewingStudent.focusScore}%</strong></span>
              <span>Violations: <strong style={{ color: '#f87171' }}>{viewingStudent.violationsCount || 0}</strong></span>
              <span>App: <strong style={{ color: '#38bdf8' }}>{viewingStudent.currentApp || '—'}</strong></span>
              <span style={{ marginLeft: 'auto' }}>
                {viewingStudent.isFlagged ? '🚨 Flagged' : '✅ Clean'}
              </span>
            </div>
          </div>
        </>
      )}

      <CreateSessionModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSessionCreated={(id) => setSessionId(id)} />
      {isPdfModalOpen && (
        <PDFReportModal
          session={session || { sessionId, title: 'Practical Exam Session', durationMinutes: 120 }}
          students={students} logs={logs}
          onClose={() => setIsPdfModalOpen(false)}
        />
      )}

      <style>{`
        @keyframes popIn {
          from { transform: translate(-50%,-50%) scale(0.93); opacity: 0; }
          to   { transform: translate(-50%,-50%) scale(1);    opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function MetricCard({ icon, label, val }) {
  return (
    <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px' }}>{val}</div>
      </div>
    </div>
  );
}
