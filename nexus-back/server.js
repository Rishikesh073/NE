// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Adjust to your frontend URL in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json()); // Parses incoming JSON requests

// Import your routes file
const apiRoutes = require('./routes/api');

// Mount the routes and apply the '/api' prefix to all of them
app.use('/api', apiRoutes);

// Health Check
app.get('/', (req, res) => {
  res.send('NEXUS API is running...');
});

// ─────────────────────────────────────────────────
// SOCKET.IO REAL-TIME LAYER
// ─────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*', // Adjust to your frontend URL in production
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Allow a user to join a room identified by their Firebase UID
  socket.on('join_room', (clientId) => {
    socket.join(clientId);
    // Admin always joins the shared admin room
    socket.join('admin_room');
    console.log(`[Socket] Socket ${socket.id} joined room: ${clientId}`);
  });

  // Admin sends a direct message to a specific client room
  // Payload: { clientId, from, msg, type, time }
  socket.on('send_message', (messageData) => {
    console.log(`[Socket] send_message to room ${messageData.clientId}:`, messageData.msg);
    // Broadcast to the target client's room AND back to admin
    io.to(messageData.clientId).emit('receive_message', messageData);
    io.to('admin_room').emit('receive_message', messageData);
  });

  // Admin assigns a task to a specific client room
  // Payload: { id, title, clientId, status }
  socket.on('assign_task', (taskData) => {
    console.log(`[Socket] assign_task to room ${taskData.clientId}:`, taskData.title);
    // Broadcast the new task to the target client's room
    io.to(taskData.clientId).emit('new_task_assigned', taskData);
    // Also echo to admin_room so admin sees it confirmed
    io.to('admin_room').emit('new_task_assigned', taskData);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────────
// SCHEDULED JOBS (UNCHANGED)
// ─────────────────────────────────────────────────
const cron = require('node-cron');
const { syncWithAdNetworks } = require('./services/adNetworkSync');

// Schedule the automated Ad Sync to run every night at Midnight (00:00)
cron.schedule('0 0 * * *', () => {
  syncWithAdNetworks();
});

// ─────────────────────────────────────────────────
// START SERVER (using httpServer instead of app.listen)
// ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Explicitly bind to 0.0.0.0 for Render deployment
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO real-time layer active.`);
});