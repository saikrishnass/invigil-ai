import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Navbar } from '../components/Navbar';
import { CreateSessionModal } from '../components/CreateSessionModal';
import { PDFReportModal } from '../components/PDFReportModal';
import { 
  Users, ShieldCheck, AlertTriangle, Clock, Copy, Check, 
  FileText, Monitor, RefreshCw, StopCircle, X, Wifi, WifiOff,
  ChevronRight, Activity
} from 'lucide-react';
import { API_BASE, SOCKET_URL } from '../config/api';

export function FacultyDashboard() {
  const [sessionId, setSessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || '';
  });

  const [session, setSession]           = useState(null);
  const [students, setStudents]         = useState([]);
  const [logs, setLogs]                 = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen]       = useState(false);
  const [copiedLink, setCopiedLink]     = useState(false);
  const [copiedCode, setCopiedCode]     = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null); // for drawer
  const [studentLogs, setStudentLogs]   = useState([]);
  const [loadingStudentLogs, setLoadingStudentLogs] = useState(false);

  // Sync state with URL search param
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

    const newUrl = `${window.location.pathname}?session=${sessionId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    // Fetch initial data
    fetch(`${API_BASE}/sessions/${sessionId}`)
      .then(r => r.json())
      .then(d => { if (d.session) setSession(d.session); })
      .catch(console.error);

    fetch(`${API_BASE}/sessions/${sessionId}/students`)
      .then(r => r.json())
      .then(d => { if (d.students) setStudents(d.students); })
      .catch(console.error);

    fetch(`${API_BASE}/sessions/${sessionId}/logs`)
      .then(r => r.json())
      .then(d => { if (d.logs) setLogs(d.logs); })
      .catch(console.error);

    // Socket Connection
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
      setLogs(prev => [log, ...prev]);
      // If drawer is open for this student, update their log stream too
      setSelectedStudent(prev => {
        if (prev && prev.studentId === log.studentId) {
          setStudentLogs(pl => [log, ...pl]);
        }
        return prev;
      });
    });

    socket.on('session_ended', () => {
      // Lock the session on admin side — no more incoming data
      setSession(prev => prev ? { ...prev, status: 'ended' } : prev);
      setStudents(prev => prev.map(s => ({ ...s, isOnline: false })));
    });

    return () => socket.disconnect();
  }, [sessionId]);

  // Open per-student log drawer
  const openStudentDrawer = async (student) => {
    setSelectedStudent(student);
    setLoadingStudentLogs(true);
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/students/${student.studentId}/logs`);
      const data = await res.json();
      setStudentLogs(data.logs || []);
    } catch {
      setStudentLogs([]);
    }
    setLoadingStudentLogs(false);
  };

  const closeDrawer = () => {
    setSelectedStudent(null);
    setStudentLogs([]);
  };

  const handleEndSession = async () => {
    if (!window.confirm('Are you sure you want to end this practical session?')) return;
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}/end`, { method: 'POST' });
      setSession(prev => prev ? { ...prev, status: 'ended' } : prev);
      setStudents(prev => prev.map(s => ({ ...s, isOnline: false })));
      setIsPdfModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const joinLink = `${window.location.origin}/join/${sessionId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const avgFocus = students.length > 0
    ? Math.round(students.filter(s => s.isOnline !== false).reduce((acc, s) => acc + (s.focusScore || 100), 0) / Math.max(1, students.filter(s => s.isOnline !== false).length))
    : 100;

  const totalViolations = logs.filter(l => l.isViolation).length;
  const onlineCount = students.filter(s => s.isOnline !== false).length;
  const sessionEnded = session?.status === 'ended';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onOpenCreateModal={() => setIsCreateModalOpen(true)} activeSessionId={sessionId} />

      <main style={{ flex: 1, maxWidth: '1350px', margin: '0 auto', width: '100%', padding: '24px' }}>
        {!sessionId ? (
          <div className="glass-panel" style={{ padding: '50px 30px', textAlign: 'center', maxWidth: '560px', margin: '60px auto' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
            }}>
              <Monitor size={30} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px' }}>Faculty Invigilation Portal</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
              Create a new practical session to generate a shareable session code and student join link for automated monitoring.
            </p>
            <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)} style={{ padding: '12px 26px' }}>
              Create Practical Session Now
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Session Ended Banner ─────────────────────────────── */}
            {sessionEnded && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '12px', padding: '14px 20px',
                display: 'flex', alignItems: 'center', gap: '12px', color: '#f87171'
              }}>
                <StopCircle size={20} />
                <div>
                  <div style={{ fontWeight: 700 }}>Session Ended — All monitoring stopped.</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    No new events will be accepted from students or agents. Download the PDF report to review all logs.
                  </div>
                </div>
                <button onClick={() => setIsPdfModalOpen(true)} className="btn-primary"
                  style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: '0.82rem', flexShrink: 0 }}>
                  <FileText size={14} /> PDF Report
                </button>
              </div>
            )}

            {/* Top Session Banner */}
            <div className="glass-panel" style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
                    {session?.title || 'Practical Session'}
                  </h2>
                  <span className={`badge ${sessionEnded ? 'badge-flagged' : 'badge-clean'}`}>
                    {sessionEnded ? 'SESSION ENDED' : '● ACTIVE'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Subject: <strong style={{ color: '#fff' }}>{session?.subject || 'Lab Practical'}</strong> • Passcode: <strong style={{ color: 'var(--accent)' }}>{session?.password || '1234'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.9)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
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
                  <button onClick={handleEndSession} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}>
                    <StopCircle size={15} /> End Session
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <MetricCard icon={<Users size={22} color="var(--accent)" />} label="Online Students" val={`${onlineCount} / ${students.length}`} />
              <MetricCard icon={<ShieldCheck size={22} color="#4ade80" />} label="Avg Focus Index" val={`${avgFocus}%`} />
              <MetricCard icon={<AlertTriangle size={22} color="#f87171" />} label="Violations Detected" val={totalViolations} />
              <MetricCard icon={<Clock size={22} color="var(--accent-purple)" />} label="Session Duration" val={`${session?.durationMinutes || 120} Mins`} />
            </div>

            {/* Students Grid */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  Student Monitors ({students.length}) — <span style={{ color: '#4ade80', fontSize: '0.95rem' }}>{onlineCount} Online</span>
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Click a card to view individual logs & activity</span>
              </div>

              {students.length === 0 ? (
                <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Monitor size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <p style={{ fontWeight: 600 }}>No students connected yet.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                    Students can join via: <strong style={{ color: 'var(--accent)' }}>{joinLink}</strong>
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {students.map(st => {
                    const isOnline = st.isOnline !== false;
                    return (
                      <div
                        key={st.studentId}
                        className="glass-panel"
                        onClick={() => openStudentDrawer(st)}
                        style={{
                          padding: '16px', position: 'relative', cursor: 'pointer',
                          opacity: isOnline ? 1 : 0.55,
                          border: isOnline ? '1px solid var(--border-color)' : '1px solid rgba(255,255,255,0.05)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '';
                        }}
                      >
                        {/* Header row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              {isOnline
                                ? <Wifi size={13} color="#4ade80" />
                                : <WifiOff size={13} color="#f87171" />
                              }
                              <span style={{ fontWeight: 700, fontSize: '1.02rem' }}>{st.name}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>Roll: {st.studentId}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`badge ${st.isFlagged ? 'badge-flagged' : 'badge-clean'}`}>
                              {st.isFlagged ? '🚨 Flagged' : '✅ Focused'}
                            </span>
                            <ChevronRight size={14} color="var(--text-dim)" />
                          </div>
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
                          <span style={{ color: 'var(--text-muted)' }}>Focus Score:</span>
                          <strong style={{ color: st.focusScore >= 80 ? '#4ade80' : st.focusScore >= 60 ? '#facc15' : '#f87171' }}>
                            {st.focusScore}%
                          </strong>
                        </div>

                        {!isOnline && (
                          <div style={{
                            marginTop: '8px', padding: '5px 10px', borderRadius: '6px',
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            fontSize: '0.75rem', color: '#f87171', textAlign: 'center'
                          }}>
                            🔴 Student Disconnected
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live Audit Log Feed — all students */}
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
                    <div
                      key={idx}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '8px',
                        background: log.isViolation ? 'rgba(239, 68, 68, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                        border: log.isViolation ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-color)',
                        fontSize: '0.88rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <strong style={{ color: '#fff' }}>{log.studentName}</strong>
                        <span style={{ color: log.isViolation ? '#f87171' : 'var(--text-muted)' }}>
                          {log.details}
                        </span>
                      </div>
                      <span className={`badge ${log.isViolation ? 'badge-flagged' : 'badge-clean'}`} style={{ fontSize: '0.7rem' }}>
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

      {/* ── Per-Student Drawer ─────────────────────────────────────── */}
      {selectedStudent && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeDrawer}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
              zIndex: 900, backdropFilter: 'blur(2px)'
            }}
          />
          {/* Drawer */}
          <div style={{
            position: 'fixed', right: 0, top: 0, bottom: 0,
            width: '460px', maxWidth: '95vw',
            background: '#0b1120', borderLeft: '1px solid var(--border-color)',
            zIndex: 901, display: 'flex', flexDirection: 'column',
            animation: 'slideIn 0.22s ease'
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: '20px 22px', borderBottom: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Activity size={18} color="var(--accent)" />
                  <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{selectedStudent.name}</span>
                  {selectedStudent.isOnline !== false
                    ? <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', fontWeight: 700 }}>● Online</span>
                    : <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 700 }}>Offline</span>
                  }
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Roll: {selectedStudent.studentId} • Focus: <strong style={{ color: selectedStudent.focusScore >= 80 ? '#4ade80' : '#f87171' }}>{selectedStudent.focusScore}%</strong> • Violations: <strong style={{ color: '#f87171' }}>{selectedStudent.violationsCount || 0}</strong>
                </div>
              </div>
              <button
                onClick={closeDrawer}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Current App Status */}
            <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
                {selectedStudent.isOnline !== false ? 'Currently Active' : 'Last Active App'}
              </div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{selectedStudent.currentApp || 'Unknown'}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{selectedStudent.currentTitle || '—'}</div>
            </div>

            {/* Student Logs */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Activity Log ({studentLogs.length} events)
              </div>

              {loadingStudentLogs ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                  <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                  <div>Loading logs…</div>
                </div>
              ) : studentLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  No activity logged yet for this student.
                </div>
              ) : (
                studentLogs.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem',
                      background: log.isViolation ? 'rgba(239,68,68,0.08)' : 'rgba(15,23,42,0.6)',
                      border: log.isViolation ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`badge ${log.isViolation ? 'badge-flagged' : 'badge-clean'}`} style={{ fontSize: '0.65rem' }}>
                        {log.eventType}
                      </span>
                    </div>
                    <div style={{ color: log.isViolation ? '#f87171' : 'var(--text-muted)' }}>
                      {log.details}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <CreateSessionModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSessionCreated={(id) => setSessionId(id)} 
      />

      {isPdfModalOpen && (
        <PDFReportModal 
          session={session || { sessionId, title: 'Practical Exam Session', durationMinutes: 120 }}
          students={students}
          logs={logs}
          onClose={() => setIsPdfModalOpen(false)}
        />
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function MetricCard({ icon, label, val }) {
  return (
    <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px' }}>{val}</div>
      </div>
    </div>
  );
}
