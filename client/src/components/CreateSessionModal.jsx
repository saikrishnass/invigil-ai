import React, { useState } from 'react';
import { X, Sparkles, Lock, Clock, BookOpen, User } from 'lucide-react';
import { API_BASE } from '../config/api';

export function CreateSessionModal({ isOpen, onClose, onSessionCreated }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Python Programming Lab');
  const [facultyName, setFacultyName] = useState('Prof. Lab Incharge');
  const [password, setPassword] = useState('1234');
  const [duration, setDuration] = useState(120);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !password) {
      setError('Please provide Session Title and Passcode.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subject,
          facultyName,
          password,
          durationMinutes: Number(duration)
        })
      });

      const data = await res.json();
      if (res.ok && data.session) {
        onSessionCreated(data.session.sessionId);
        onClose();
      } else {
        setError(data.error || 'Failed to create session');
      }
    } catch (err) {
      setError('Network connection error');
    } finally {
      setLoading(false);
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
        maxWidth: '480px',
        padding: '28px',
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Create New Lab Session</h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.85rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Practical Exam Title
            </label>
            <input 
              type="text"
              className="input-field"
              placeholder="e.g. Data Structures End-Sem Practical"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Subject Name
              </label>
              <input 
                type="text"
                className="input-field"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Faculty Name
              </label>
              <input 
                type="text"
                className="input-field"
                value={facultyName}
                onChange={e => setFacultyName(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Student Passcode
              </label>
              <input 
                type="text"
                className="input-field"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Duration (Mins)
              </label>
              <input 
                type="number"
                className="input-field"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                min="10"
                max="300"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary" 
            style={{ width: '100%', justifyContent: 'center', marginTop: '10px', padding: '12px' }}
          >
            {loading ? 'Initializing Session...' : '🚀 Launch Practical Session'}
          </button>
        </form>
      </div>
    </div>
  );
}
