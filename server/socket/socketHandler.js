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
        const logs = await LogEvent.find({ sessionId }).sort({ timestamp: -1 }).limit(100);
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
        socket.join(sessionId);
        socket.sessionId = sessionId;
        socket.studentId = studentId;

        const student = await Student.findOneAndUpdate(
          { sessionId, studentId },
          {
            $setOnInsert: {
              name: studentName || 'Student',
              clientType: 'web_browser',
              currentApp: 'Exam Browser Tab',
              currentTitle: 'Online Exam Workspace'
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

        const isViolation = eventType === 'focus_loss' || eventType === 'tab_switch' || eventType === 'copy_paste';
        
        let student = await Student.findOne({ sessionId, studentId });
        if (student && isViolation) {
          student.violationsCount = (student.violationsCount || 0) + 1;
          student.isFlagged = true;
          student.focusScore = Math.max(0, 100 - (student.violationsCount * 5));
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

    // Disconnect
    socket.on('disconnect', () => {
      try {
        if (socket.sessionId && socket.studentId) {
          io.to(socket.sessionId).emit('student_disconnected', { studentId: socket.studentId });
        }
      } catch (error) {
        console.error('Error in disconnect:', error);
      }
    });
  });
}

module.exports = initSocketHandlers;
