const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  subject: { type: String, default: 'Computer Lab Practical' },
  facultyName: { type: String, default: 'Lab Faculty' },
  password: { type: String, required: true },
  durationMinutes: { type: Number, default: 120 },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

module.exports = mongoose.model('Session', SessionSchema);
