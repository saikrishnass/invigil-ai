const Session = require('../models/Session');
const Student = require('../models/Student');
const LogEvent = require('../models/LogEvent');

function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    // Faculty joins dashboard room
    socket.on('faculty_join_room', async ({ sessionId }) => {
      try {
        if (!sessionId) return;
        socket.join(sessionId);

        // Send initial state
        const students = await Student.find({ sessionId }).sort({ joinedAt: -1 });
        const logs = await LogEvent.find({ sessionId }).sort({ timestamp: -1 }).limit(200);
        const session = await Session.findOne({ sessionId });

        socket.emit('dashboard_init', { session, students, logs });
      } catch (error) {
        console.error('Error in faculty_join_room:', error);
      }
    });

    // Student web client joins
    socket.on('student_web_join', async ({ sessionId, studentId, studentName }) => {
      try {
        if (!sessionId || !studentId) return;

        // ── Check session is still active ──────────────────────────
        const session = await Session.findOne({ sessionId });
        if (!session || session.status === 'ended') {
          socket.emit('session_ended', { sessionId });
          return;
        }

        socket.join(sessionId);
        socket.sessionId = sessionId;
        socket.studentId = studentId;

        const student = await Student.findOneAndUpdate(
          { sessionId, studentId },
          {
            $set: {
              name: studentName || 'Student',
              clientType: 'web_browser',
              currentApp: 'Exam Browser Tab',
              currentTitle: 'Online Exam Workspace',
              isOnline: true,
              lastSeen: new Date()
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const log = await LogEvent.create({
          sessionId,
          studentId,
          studentName: student.name,
          eventType: 'join',
          appName: 'Web Browser',
          details: `🟢 ${student.name} (${studentId}) joined practical session`
        });

        io.to(sessionId).emit('student_joined', student);
        io.to(sessionId).emit('new_log_event', log);
      } catch (error) {
        console.error('Error in student_web_join:', error);
      }
    });

    // Student browser tab blur / focus loss event
    socket.on('student_web_event', async ({ sessionId, studentId, studentName, eventType, details }) => {
      try {
        if (!sessionId || !studentId) return;

        // ── Drop events if session is ended ──────────────────────
        const session = await Session.findOne({ sessionId });
        if (!session || session.status === 'ended') return;

        const isViolation = eventType === 'focus_loss' || eventType === 'tab_switch' || eventType === 'copy_paste';
        
        let student = await Student.findOne({ sessionId, studentId });
        if (student && isViolation) {
          student.violationsCount = (student.violationsCount || 0) + 1;
          student.isFlagged = true;
          student.focusScore = Math.max(0, 100 - (student.violationsCount * 5));
          student.lastSeen = new Date();
          await student.save();
        }

        const log = await LogEvent.create({
          sessionId,
          studentId,
          studentName: studentName || 'Student',
          eventType: eventType || 'focus_loss',
          details: details || `🚨 invigilAI DETECTED: Student switched away from exam window`,
          isViolation
        });

        io.to(sessionId).emit('new_log_event', log);
        if (student) io.to(sessionId).emit('student_updated', student);
      } catch (error) {
        console.error('Error in student_web_event:', error);
      }
    });

    // ── Disconnect: mark student offline and notify faculty ──────
    socket.on('disconnect', async () => {
      try {
        const { sessionId, studentId } = socket;
        if (!sessionId || !studentId) return;

        // Mark student as offline in DB
        const student = await Student.findOneAndUpdate(
          { sessionId, studentId },
          { isOnline: false, lastSeen: new Date() },
          { new: true }
        );

        // Log the disconnect event
        if (student) {
          const log = await LogEvent.create({
            sessionId,
            studentId,
            studentName: student.name,
            eventType: 'disconnect',
            details: `🔴 ${student.name} (${studentId}) disconnected from session`,
            isViolation: false
          });
          io.to(sessionId).emit('new_log_event', log);
          io.to(sessionId).emit('student_updated', { ...student.toObject(), isOnline: false });
        }

        io.to(sessionId).emit('student_disconnected', { studentId });
      } catch (error) {
        console.error('Error in disconnect:', error);
      }
    });
  });
}

module.exports = initSocketHandlers;
