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
const { createBlockedTable } = require('./src/models/blockedModel');

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

const onlineUsers = new Map(); // userId -> { count: number, lastSeen: Date }
const roomViewers = new Map(); // roomName -> Set of socketIds

// Socket logic
io.on('connection', (socket) => {
  // User joins their own private room
  socket.on('join', async (userId) => {
    socket.userId = userId;
    socket.join(`user_${userId}`);
    
    // Fetch basic user info for socket identification (e.g. for group messages)
    try {
      const result = await pool.query('SELECT username, avatar_url FROM users WHERE id = $1', [userId]);
      if (result.rows.length > 0) {
        socket.username = result.rows[0].username;
        socket.avatar_url = result.rows[0].avatar_url;
      }
    } catch (e) { console.error('Error fetching socket user info:', e); }

    const status = onlineUsers.get(userId) || { count: 0, lastSeen: new Date() };
    status.count++;
    onlineUsers.set(userId, status);
    
    io.emit('userStatus', { userId, online: true });
    console.log(`User ${userId} joined their private room`);
  });

  // Check user status
  socket.on('checkUserStatus', async (userId) => {
    const status = onlineUsers.get(userId);
    if (status && status.count > 0) {
      socket.emit('userStatus', { userId, online: true });
    } else {
      try {
        const result = await pool.query('SELECT last_seen FROM users WHERE id = $1', [userId]);
        if (result.rows.length > 0) {
          socket.emit('userStatus', { userId, online: false, lastSeen: result.rows[0].last_seen });
        }
      } catch (e) { console.error('Error fetching last_seen:', e); }
    }
  });

  // Handle private message
  socket.on('sendMessage', async ({ senderId, receiverId, content, type, mediaUrl }) => {
    try {
      // Check if blocked
      const { isBlockedBidirectional } = require('./src/models/blockedModel');
      const blocked = await isBlockedBidirectional(senderId, receiverId);
      if (blocked) {
        socket.emit('error', { message: 'Cannot send message to this user.' });
        return;
      }

      // Save message to DB
      const message = await saveMessage(senderId, receiverId, content, type || 'text', mediaUrl);
      
      // Emit to receiver's room
      io.to(`user_${receiverId}`).emit('message', message);
      
      // Emit back to sender
      io.to(`user_${senderId}`).emit('message', message);
      
      console.log(`Message sent from ${senderId} to ${receiverId}`);
    } catch (error) {
      console.error('Socket sendMessage error:', error);
    }
  });

  // --- Live Stream Events ---
  socket.on('joinStream', (channelName) => {
    socket.join(`stream_${channelName}`);
    
    if (!roomViewers.has(channelName)) {
      roomViewers.set(channelName, new Set());
    }
    roomViewers.get(channelName).add(socket.id);
    socket.currentStream = channelName;

    const viewerCount = roomViewers.get(channelName).size;
    io.to(`stream_${channelName}`).emit('viewerCount', { count: viewerCount });
    
    console.log(`User ${socket.id} joined stream ${channelName}. Total: ${viewerCount}`);
  });

  socket.on('leaveStream', (channelName) => {
    socket.leave(`stream_${channelName}`);
    _removeViewer(socket, channelName);
    console.log(`User ${socket.id} left stream room: ${channelName}`);
  });

  // --- Group Chat Events ---
  socket.on('joinGroup', (groupId) => {
    socket.join(`group_${groupId}`);
    console.log(`User ${socket.userId} joined group_${groupId}`);
  });

  socket.on('sendGroupMessage', async ({ senderId, groupId, content, type, mediaUrl }) => {
    try {
      // Save message to DB (receiverId is null for group messages)
      const result = await pool.query(
        'INSERT INTO messages (sender_id, group_id, content, type, media_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [senderId, groupId, content, type || 'text', mediaUrl]
      );
      
      const message = {
        ...result.rows[0],
        username: socket.username, // Assuming we have username in socket
        avatar_url: socket.avatar_url
      };
      
      // Emit to everyone in the group room
      io.to(`group_${groupId}`).emit('groupMessage', message);
      
      console.log(`Group message sent from ${senderId} to group ${groupId}`);
    } catch (error) {
      console.error('Socket sendGroupMessage error:', error);
    }
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

  socket.on('disconnect', async () => {
    if (socket.currentStream) {
      _removeViewer(socket, socket.currentStream);
    }

    if (socket.userId) {
      const status = onlineUsers.get(socket.userId);
      if (status) {
        status.count--;
        if (status.count <= 0) {
          status.lastSeen = new Date();
          onlineUsers.set(socket.userId, status);
          io.emit('userStatus', { userId: socket.userId, online: false, lastSeen: status.lastSeen });
          
          try {
            await pool.query('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [socket.userId]);
          } catch(e) { console.error('Error updating last_seen', e); }
        }
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const _removeViewer = (socket, channelName) => {
  if (roomViewers.has(channelName)) {
    roomViewers.get(channelName).delete(socket.id);
    const viewerCount = roomViewers.get(channelName).size;
    socket.broadcast.to(`stream_${channelName}`).emit('viewerCount', { count: viewerCount });
    
    if (viewerCount === 0) {
      roomViewers.delete(channelName);
    }
  }
  socket.currentStream = null;
};


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
    await createBlockedTable();
    const { createGroupsTable } = require('./src/models/groupModel');
    await createGroupsTable();

    // Migration / Alterations
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP`);
    await pool.query(`ALTER TABLE stories ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0`);
    
    // Firebase & FCM Support
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255) UNIQUE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT`);
    
    // Group Chat Support
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL`);

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