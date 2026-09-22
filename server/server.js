require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/api');
const initSocketHandlers = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// WebSockets Server
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Connect to Local MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/invigil_ai';
mongoose.connect(MONGO_URI)
  .then(() => console.log(`[MongoDB] Connected successfully to ${MONGO_URI}`))
  .catch(err => console.error('[MongoDB] Connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());

// Pass socket.io instance to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Static public folders for EXE downloads
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, 'public/downloads')));

// API Routes
app.use('/api', apiRoutes);

// Serve Client build if in production
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Endpoint not found' });
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(200).send('invigilAI Server Running! Access client on dev port.');
  });
});

// Socket Event Handlers
initSocketHandlers(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  🛡️ invigilAI Production Backend Server Active`);
  console.log(`  📡 HTTP & WebSockets: http://localhost:${PORT}`);
  console.log(`  📊 Database: ${MONGO_URI}`);
  console.log(`====================================================`);
});
