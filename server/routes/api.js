const express = require('express');
const router = express.Router();
const { customAlphabet } = require('nanoid');
const Session = require('../models/Session');
const Student = require('../models/Student');
const LogEvent = require('../models/LogEvent');

const generateSessionId = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

// Allowed safe apps (e.g. IDEs, compilers, course tools)
const SAFE_APPS = ['vs code', 'code', 'visual studio code', 'terminal', 'cmd', 'powershell', 'idle', 'pycharm', 'eclipse', 'sublime text', 'session connect', 'exam portal', 'invigilai'];

function checkIfViolation(appName, windowTitle) {
  const app = (appName || '').toLowerCase();
  const title = (windowTitle || '').toLowerCase();

  // Flag AI assistants, social media, entertainment, unapproved apps
  const flaggedKeywords = [
    'chatgpt', 'claude', 'gemini', 'copilot', 'openai',
    'youtube', 'discord', 'whatsapp', 'instagram', 'facebook',
    'spotify', 'telegram', 'netflix', 'game', 'reddit',
    'notepad', 'file explorer', 'explorer', 'calculator'
  ];
  for (const kw of flaggedKeywords) {
    if (title.includes(kw) || app.includes(kw)) return true;
  }

  // If app is not in safe list
  const isSafe = SAFE_APPS.some(s => app.includes(s) || title.includes(s));
  return !isSafe;
}

// 1. Create a new practical session
router.post('/sessions', async (req, res) => {
  try {
    const { title, subject, facultyName, password, durationMinutes } = req.body;
    if (!title || !password) {
      return res.status(400).json({ error: 'Session Title and Password are required.' });
    }

    const sessionId = `LAB-${generateSessionId()}`;
    const session = await Session.create({
      sessionId,
      title,
      subject: subject || 'Computer Lab Practical',
      facultyName: facultyName || 'Faculty',
      password,
      durationMinutes: durationMinutes || 120
    });

    res.status(201).json({ success: true, session });
  } catch (err) {
    console.error('[API] Create session error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// 2. Get session info
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get session students
router.get('/sessions/:sessionId/students', async (req, res) => {
  try {
    const students = await Student.find({ sessionId: req.params.sessionId }).sort({ joinedAt: -1 });
    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get session logs
router.get('/sessions/:sessionId/logs', async (req, res) => {
  try {
    const logs = await LogEvent.find({ sessionId: req.params.sessionId }).sort({ timestamp: -1 }).limit(200);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Ingest Telemetry Event from Native Desktop Agent (.exe)
router.post('/agent/event', async (req, res) => {
  try {
    const { sessionId, studentId, studentName, eventType, appName, windowTitle, details } = req.body;

    if (!sessionId || !studentId) {
      return res.status(400).json({ error: 'sessionId and studentId are required.' });
    }

    const isViolation = checkIfViolation(appName, windowTitle);

    // Update or insert Student safely
    let student = await Student.findOne({ sessionId, studentId });
    if (!student) {
      student = await Student.create({
        sessionId,
        studentId,
        name: studentName || 'Student',
        currentApp: appName || 'VS Code',
        currentTitle: windowTitle || 'Active',
        clientType: 'desktop_agent',
        violationsCount: isViolation ? 1 : 0,
        isFlagged: isViolation,
        focusScore: isViolation ? 95 : 100
      });
    } else {
      student.currentApp = appName || student.currentApp;
      student.currentTitle = windowTitle || student.currentTitle;
      student.lastSeen = new Date();
      if (isViolation) {
        student.violationsCount = (student.violationsCount || 0) + 1;
        student.isFlagged = true;
        student.focusScore = Math.max(0, 100 - (student.violationsCount * 5));
      }
      await student.save();
    }

    // Create Log Event
    const logDetails = details || (isViolation 
      ? `🚨 invigilAI DETECTED: ${appName} (${(windowTitle || '').substring(0, 60)})`
      : `✅ invigilAI ACTIVE: ${appName} (${(windowTitle || '').substring(0, 60)})`);

    const log = await LogEvent.create({
      sessionId,
      studentId,
      studentName: studentName || student.name,
      eventType: eventType || 'app_switch',
      appName: appName || 'App',
      windowTitle: windowTitle || '',
      details: logDetails,
      isViolation
    });

    // Broadcast over WebSocket to Faculty Dashboard Room
    if (req.io) {
      req.io.to(sessionId).emit('new_log_event', log);
      req.io.to(sessionId).emit('student_updated', student);
    }

    res.json({ success: true, log, student });
  } catch (err) {
    console.error('[API] Agent event error:', err);
    res.status(500).json({ error: 'Error logging agent telemetry event' });
  }
});

// 6. End Session
router.post('/sessions/:sessionId/end', async (req, res) => {
  try {
    const session = await Session.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { status: 'ended', endedAt: new Date() },
      { new: true }
    );
    if (req.io) {
      req.io.to(req.params.sessionId).emit('session_ended', { sessionId: req.params.sessionId });
    }
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
