import React, { useRef, useState } from 'react';
import { X, Download, FileText, Shield, Clock, Users, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function PDFReportModal({ session, students, logs, onClose }) {
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const totalViolations = logs.filter(l => l.isViolation).length;

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setGenerating(true);

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`invigilAI-Report-${session?.sessionId || 'LAB'}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#090d16'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0f172a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText color="var(--accent)" size={22} />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Practical Exam Invigilation Report
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              onClick={handleDownloadPDF} 
              disabled={generating}
              className="btn-primary" 
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Download size={15} /> {generating ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div style={{ overflowY: 'auto', padding: '24px' }}>
          <div 
            ref={reportRef}
            style={{
              background: '#0f172a',
              color: '#f8fafc',
              padding: '30px',
              borderRadius: '12px',
              border: '1px solid #1e293b'
            }}
          >
            {/* Report Title */}
            <div style={{ borderBottom: '2px solid #334155', paddingBottom: '18px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '1.6rem', fontWeight: 800 }}>
                  🛡️ invigilAI Practical Exam Report
                </h2>
                <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                  {session?.subject || 'Computer Science Practical Examination'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Session Code</span>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#f59e0b' }}>{session?.sessionId}</div>
              </div>
            </div>

            {/* Session Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
              <div style={{ background: '#1e293b', padding: '12px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} color="#38bdf8" /> Session Title
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session?.title || 'Lab Practical'}
                </div>
              </div>

              <div style={{ background: '#1e293b', padding: '12px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="#818cf8" /> Duration
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '4px' }}>
                  {session?.durationMinutes || 120} Minutes
                </div>
              </div>

              <div style={{ background: '#1e293b', padding: '12px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} color="#34d399" /> Total Students
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '4px' }}>
                  {students.length}
                </div>
              </div>

              <div style={{ background: '#1e293b', padding: '12px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} color="#f43f5e" /> Violations
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '4px', color: '#f43f5e' }}>
                  {totalViolations}
                </div>
              </div>
            </div>

            {/* Students Integrity Ranking */}
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: '#e2e8f0' }}>
              Student Focus & Integrity Index
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Student Name</th>
                  <th style={{ padding: '10px 12px' }}>Roll Number</th>
                  <th style={{ padding: '10px 12px' }}>Focus Score</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>No students recorded.</td>
                  </tr>
                ) : (
                  students.map((st, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{st.name}</td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{st.studentId}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: st.focusScore >= 80 ? '#4ade80' : st.focusScore >= 60 ? '#facc15' : '#f87171' }}>
                        {st.focusScore}%
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {st.isFlagged ? (
                          <span style={{ color: '#f87171', fontWeight: 600 }}>🚨 Flagged ({st.violationsCount || 1})</span>
                        ) : (
                          <span style={{ color: '#4ade80', fontWeight: 600 }}>✅ Clean</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Event Audit Log Feed */}
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: '#e2e8f0' }}>
              Real-time Invigilation Audit Stream
            </h4>
            <div style={{ background: '#1e293b', padding: '14px', borderRadius: '8px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {logs.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center' }}>No activity logged.</div>
              ) : (
                logs.slice(0, 15).map((log, i) => (
                  <div key={i} style={{ padding: '5px 0', borderBottom: i < 14 ? '1px solid #334155' : 'none', display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#64748b' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{log.studentName}:</span>
                    <span style={{ color: log.isViolation ? '#f87171' : '#4ade80' }}>{log.details}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
