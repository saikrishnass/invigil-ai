import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Navbar } from '../components/Navbar';
import { CreateSessionModal } from '../components/CreateSessionModal';
import { PDFReportModal } from '../components/PDFReportModal';
import {
  Users, ShieldCheck, AlertTriangle, Clock, Copy, Check,
  FileText, Monitor, StopCircle, X, Wifi, WifiOff, Maximize2, Filter
} from 'lucide-react';
import { API_BASE, SOCKET_URL } from '../config/api';

export function FacultyDashboard() {
  const [sessionId, setSessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || '';
  });

  const [session, setSession]                     = useState(null);
  const [students, setStudents]                   = useState([]);
  const [logs, setLogs]                           = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen]       = useState(false);
  const [copiedLink, setCopiedLink]               = useState(false);
  const [copiedCode, setCopiedCode]               = useState(false);

  // ── Log filter: null = show all, string = show only that student ──
  const [filterStudentId, setFilterStudentId]     = useState(null);
  const logPanelRef                               = useRef(null);

  // ── Screen viewer ─────────────────────────────────────────────────
  const [viewingStudent, setViewingStudent]       = useState(null);
  const [viewingFrame, setViewingFrame]           = useState(null);
  const [viewingTimestamp, setViewingTimestamp]   = useState(null);
  const screenFramesRef                           = useRef({}); // { studentId: {frame, timestamp} }

  // Sync URL
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
    window.history.pushState({}, '', `${window.location.pathname}?session=${sessionId}`);

    fetch(`${API_BASE}/sessions/${sessionId}`).then(r => r.json()).then(d => { if (d.session) setSession(d.session); }).catch(console.error);
    fetch(`${API_BASE}/sessions/${sessionId}/students`).then(r => r.json()).then(d => { if (d.students) setStudents(d.students); }).catch(console.error);
    fetch(`${API_BASE}/sessions/${sessionId}/logs`).then(r => r.json()).then(d => { if (d.logs) setLogs(d.logs); }).catch(console.error);

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.emit('faculty_join_room', { sessionId });

    socket.on('dashboard_init', d => {
      if (d.session) setSession(d.session);
      if (d.students) setStudents(d.students);
      if (d.logs) setLogs(d.logs);
    });

    socket.on('student_joined', student => {
      setStudents(prev => {
        const exists = prev.find(s => s.studentId === student.studentId);
        if (exists) return prev.map(s => s.studentId === student.studentId ? { ...student, isOnline: true } : s);
        return [{ ...student, isOnline: true }, ...prev];
      });
    });

    socket.on('student_updated', student => {
      setStudents(prev => prev.map(s => s.studentId === student.studentId ? student : s));
    });

    socket.on('student_disconnected', ({ studentId }) => {
      setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, isOnline: false } : s));
    });

    socket.on('new_log_event', log => {
      setLogs(prev => [log, ...prev.slice(0, 499)]);
    });

    socket.on('session_ended', () => {
      setSession(prev => prev ? { ...prev, status: 'ended' } : prev);
      setStudents(prev => prev.map(s => ({ ...s, isOnline: false })));
    });

    socket.on('student_screen_frame', ({ studentId, frame, timestamp }) => {
      screenFramesRef.current[studentId] = { frame, timestamp };
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

  // ── Click student card → filter logs to that student ─────────────
  const handleStudentClick = (st) => {
    setFilterStudentId(prev => prev === st.studentId ? null : st.studentId);
    // Scroll log panel into view
    setTimeout(() => logPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  // ── View screen modal ─────────────────────────────────────────────
  const openScreenViewer = (e, student) => {
    e.stopPropagation(); // don't trigger student card click
    const stored = screenFramesRef.current[student.studentId];
    setViewingStudent(student);
    setViewingFrame(stored?.frame || null);
    setViewingTimestamp(stored?.timestamp || null);
  };

  const closeScreenViewer = () => { setViewingStudent(null); setViewingFrame(null); setViewingTimestamp(null); };

  const handleEndSession = async () => {
    if (!window.confirm('Are you sure you want to end this practical session?')) return;
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}/end`, { method: 'POST' });
      setSession(prev => prev ? { ...prev, status: 'ended' } : prev);
      setStudents(prev => prev.map(s => ({ ...s, isOnline: false })));
      setIsPdfModalOpen(true);
    } catch (err) { console.error(err); }
  };

  const joinLink = `${window.location.origin}/join/${sessionId}`;
  const handleCopyLink = () => { navigator.clipboard.writeText(joinLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); };
  const handleCopyCode = () => { navigator.clipboard.writeText(sessionId); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };

  const onlineStudents  = students.filter(s => s.isOnline !== false);
  const avgFocus        = onlineStudents.length > 0 ? Math.round(onlineStudents.reduce((a, s) => a + (s.focusScore || 100), 0) / onlineStudents.length) : 100;
  const totalViolations = logs.filter(l => l.isViolation).length;
  const sessionEnded    = session?.status === 'ended';

  // Filtered logs
  const filteredLogs    = filterStudentId ? logs.filter(l => l.studentId === filterStudentId) : logs;
  const filterStudent   = filterStudentId ? students.find(s => s.studentId === filterStudentId) : null;

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
                  <strong style={{ color: 'var(--accent)' }}>Click card</strong> → filter logs &nbsp;|&nbsp; <strong style={{ color: '#38bdf8' }}>👁 button</strong> → live screen
                </span>
              </div>

              {students.length === 0 ? (
                <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Monitor size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <p style={{ fontWeight: 600 }}>No students connected yet.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Share: <strong style={{ color: 'var(--accent)' }}>{joinLink}</strong></p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(295px, 1fr))', gap: '16px' }}>
                  {students.map(st => {
                    const isOnline   = st.isOnline !== false;
                    const hasFrame   = !!screenFramesRef.current[st.studentId];
                    const isSelected = filterStudentId === st.studentId;

                    return (
                      <div
                        key={st.studentId}
                        className="glass-panel"
                        onClick={() => handleStudentClick(st)}
                        style={{
                          padding: '16px', position: 'relative', cursor: 'pointer',
                          opacity: isOnline ? 1 : 0.55,
                          border: isSelected
                            ? '1.5px solid #38bdf8'
                            : isOnline ? '1px solid var(--border-color)' : '1px solid rgba(255,255,255,0.05)',
                          boxShadow: isSelected ? '0 0 0 2px rgba(56,189,248,0.15)' : 'none',
                          transition: 'border 0.15s, box-shadow 0.15s, transform 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        {/* Selected indicator */}
                        {isSelected && (
                          <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#38bdf8', color: '#000', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '10px' }}>
                            LOGS FILTERED
                          </div>
                        )}

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

                        {/* Footer row: focus score + view screen button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>
                            Focus: <strong style={{ color: st.focusScore >= 80 ? '#4ade80' : st.focusScore >= 60 ? '#facc15' : '#f87171' }}>{st.focusScore}%</strong>
                            &nbsp;·&nbsp; V: <strong style={{ color: '#f87171' }}>{st.violationsCount || 0}</strong>
                          </span>

                          <button
                            onClick={(e) => openScreenViewer(e, st)}
                            className="btn-secondary"
                            style={{
                              padding: '4px 10px', fontSize: '0.74rem', gap: '4px',
                              borderColor: hasFrame ? 'rgba(56,189,248,0.5)' : 'var(--border-color)',
                              color: hasFrame ? '#38bdf8' : 'var(--text-dim)',
                            }}
                          >
                            <Maximize2 size={11} />
                            {hasFrame ? '👁 Live' : '📷 Screen'}
                          </button>
                        </div>

                        {!isOnline && (
                          <div style={{ marginTop: '8px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.74rem', color: '#f87171', textAlign: 'center' }}>
                            🔴 Disconnected
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Live Audit Log Feed (filterable) ──────────────────── */}
            <div className="glass-panel" style={{ padding: '20px' }} ref={logPanelRef}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                    🔴 {filterStudentId ? `${filterStudent?.name || 'Student'}'s Activity Log` : 'Live Invigilation Audit Stream'} ({filteredLogs.length})
                  </h3>

                  {filterStudentId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '20px', padding: '3px 10px', fontSize: '0.78rem', color: '#38bdf8' }}>
                      <Filter size={11} />
                      {filterStudent?.name}
                    </div>
                  )}
                </div>

                {filterStudentId && (
                  <button
                    onClick={() => setFilterStudentId(null)}
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '0.78rem', gap: '6px', color: 'var(--text-muted)' }}
                  >
                    <X size={12} /> Show All Students
                  </button>
                )}
              </div>

              {/* Student name filter pills */}
              {!filterStudentId && students.length > 1 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {students.map(st => (
                    <button
                      key={st.studentId}
                      onClick={() => { setFilterStudentId(st.studentId); }}
                      className="btn-secondary"
                      style={{
                        padding: '3px 10px', fontSize: '0.75rem', gap: '5px',
                        color: st.isFlagged ? '#f87171' : 'var(--text-muted)',
                        borderColor: st.isFlagged ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'
                      }}
                    >
                      {st.isFlagged ? '🚨' : '●'} {st.name}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {filteredLogs.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '28px', fontSize: '0.88rem' }}>
                    {filterStudentId ? `No activity logged yet for ${filterStudent?.name}.` : 'Awaiting student activity telemetry...'}
                  </div>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 13px', borderRadius: '8px',
                      background: log.isViolation ? 'rgba(239,68,68,0.08)' : 'rgba(15,23,42,0.6)',
                      border: log.isViolation ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border-color)',
                      fontSize: '0.85rem', gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.76rem', fontFamily: 'monospace', flexShrink: 0 }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {/* Clickable student name → filter this student's logs */}
                        {!filterStudentId && (
                          <strong
                            style={{ color: '#38bdf8', cursor: 'pointer', flexShrink: 0, fontSize: '0.82rem' }}
                            onClick={() => setFilterStudentId(log.studentId)}
                            title={`Click to filter ${log.studentName}'s logs`}
                          >
                            {log.studentName}
                          </strong>
                        )}
                        <span style={{ color: log.isViolation ? '#f87171' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.details}
                        </span>
                      </div>
                      <span className={`badge ${log.isViolation ? 'badge-flagged' : 'badge-clean'}`} style={{ fontSize: '0.68rem', flexShrink: 0 }}>
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

      {/* ── Screen Viewer Modal ─────────────────────────────────────── */}
      {viewingStudent && (
        <>
          <div onClick={closeScreenViewer} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 900, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 'min(96vw, 1060px)', background: '#0a0f1e',
            border: '1px solid var(--border-color)', borderRadius: '14px',
            zIndex: 901, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
            animation: 'popIn 0.18s ease'
          }}>
            {/* Header */}
            <div style={{ padding: '13px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: viewingStudent.isOnline !== false ? '#4ade80' : '#f87171', boxShadow: viewingStudent.isOnline !== false ? '0 0 8px #4ade80' : 'none' }} />
                <strong>{viewingStudent.name}</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Roll: {viewingStudent.studentId}</span>
                {viewingTimestamp && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>
                    {new Date(viewingTimestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <button onClick={closeScreenViewer} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Screen frame */}
            <div style={{ background: '#000', minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {viewingFrame ? (
                <>
                  <img src={viewingFrame} alt="Live screen" style={{ width: '100%', height: 'auto', maxHeight: '72vh', objectFit: 'contain', display: 'block' }} />
                  {viewingStudent.isOnline !== false && (
                    <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,0,0,0.65)', padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', color: '#4ade80', fontWeight: 700 }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', display: 'inline-block', animation: 'pulse 1.5s ease infinite' }} />
                      LIVE · Updates every ~3s
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '60px 20px' }}>
                  <Monitor size={48} style={{ margin: '0 auto 14px', opacity: 0.3 }} />
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>No screen frame received yet</div>
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.6, maxWidth: '340px' }}>
                    The student must select <strong style={{ color: '#fff' }}>"Entire Screen"</strong> in the Chrome share dialog when they join. If they chose a Tab or Window, their frames are blocked.
                  </div>
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Focus: <strong style={{ color: viewingStudent.focusScore >= 80 ? '#4ade80' : '#f87171' }}>{viewingStudent.focusScore}%</strong></span>
              <span>Violations: <strong style={{ color: '#f87171' }}>{viewingStudent.violationsCount || 0}</strong></span>
              <span>App: <strong style={{ color: '#38bdf8' }}>{viewingStudent.currentApp || '—'}</strong></span>
              <span style={{ marginLeft: 'auto' }}>{viewingStudent.isFlagged ? '🚨 Flagged' : '✅ Clean'}</span>
            </div>
          </div>
        </>
      )}

      <CreateSessionModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSessionCreated={id => setSessionId(id)} />
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
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
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
