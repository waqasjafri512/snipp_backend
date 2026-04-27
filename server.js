require('dotenv').config();
const http = require('http');
const socketio = require('socket.io');
const app = require('./src/app');
const pool = require('./src/config/db');

// Model imports
const { createUsersTable } = require('./src/models/userModel');
const { createProfilesTable } = require('./src/models/profileModel');
const { createDareTables } = require('./src/models/dareModel');
const { createNotificationsTable } = require('./src/models/notificationModel');
const { createMessagesTable, saveMessage } = require('./src/models/messageModel');
const { createStreamsTable } = require('./src/models/streamModel');
const { createStoryTable } = require('./src/models/storyModel');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Attach io to app for controller access
app.set('io', io);

// Socket logic
io.on('connection', (socket) => {
  console.log('New WebSocket connection:', socket.id);

  // User joins their own private room
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their private room`);
  });

  // Handle private message
  socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
    try {
      // Save message to DB
      const message = await saveMessage(senderId, receiverId, content);
      
      // Emit to receiver's room
      io.to(`user_${receiverId}`).emit('message', message);
      
      // Emit back to sender (useful for dual-device sync or just confirmation)
      io.to(`user_${senderId}`).emit('message', message);
      
      console.log(`Message sent from ${senderId} to ${receiverId}`);
    } catch (error) {
      console.error('Socket sendMessage error:', error);
    }
  });

  // --- Live Stream Events ---
  socket.on('joinStream', (channelName) => {
    socket.join(`stream_${channelName}`);
    console.log(`User ${socket.id} joined stream room: ${channelName}`);
  });

  socket.on('leaveStream', (channelName) => {
    socket.leave(`stream_${channelName}`);
    console.log(`User ${socket.id} left stream room: ${channelName}`);
  });

  socket.on('streamMessage', (data) => {
    const { channelName, username, message, avatar } = data;
    // Broadcast to everyone in the room EXCEPT the sender? 
    // Actually usually we want it to come back to sender for confirmation if UI is optimistic.
    io.to(`stream_${channelName}`).emit('streamMessage', {
      username,
      message,
      avatar,
      timestamp: new Date()
    });
  });

  socket.on('streamReaction', (data) => {
    const { channelName, emoji } = data;
    io.to(`stream_${channelName}`).emit('streamReaction', { emoji });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Initialize database tables then start server
const startServer = async () => {
  try {
    // DB table initialization
    await createUsersTable();
    await createProfilesTable();
    await createDareTables();
    await createNotificationsTable();
    await createMessagesTable();
    await createStreamsTable();
    await createStoryTable();

    // Start Server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();