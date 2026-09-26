const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  studentId: { type: String, required: true }, // Roll number / Unique ID
  name: { type: String, required: true },
  currentApp: { type: String, default: 'Desktop / Standby' },
  currentTitle: { type: String, default: 'Initialising...' },
  focusScore: { type: Number, default: 100 },
  violationsCount: { type: Number, default: 0 },
  isFlagged: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: true },
  clientType: { type: String, enum: ['desktop_agent', 'web_browser'], default: 'desktop_agent' },
  joinedAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
});

StudentSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Student', StudentSchema);

