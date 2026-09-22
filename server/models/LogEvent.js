const mongoose = require('mongoose');

const LogEventSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  eventType: { 
    type: String, 
    enum: ['join', 'app_switch', 'tab_switch', 'copy_paste', 'idle', 'focus_loss', 'focus_regain', 'disconnect'],
    default: 'app_switch' 
  },
  appName: { type: String, default: 'Unknown App' },
  windowTitle: { type: String, default: '' },
  details: { type: String, required: true },
  isViolation: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LogEvent', LogEventSchema);
