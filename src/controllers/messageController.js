const MessageModel = require('../models/messageModel');
const UserModel = require('../models/userModel');
const pool = require('../config/db');
const { sendPushNotification } = require('../services/notificationService');

// GET /api/messages/history/:otherUserId
const getHistory = async (req, res) => {
  try {
    const history = await MessageModel.getChatHistory(req.user.id, req.params.otherUserId);
    
    // Mark messages from the other user as read when fetching history
    await MessageModel.markMessagesAsRead(req.user.id, parseInt(req.params.otherUserId));
    
    res.json({ success: true, data: { history } });
  } catch (error) {
    console.error('GetHistory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/messages/conversations
const getConversations = async (req, res) => {
  try {
    const conversations = await MessageModel.getConversations(req.user.id);
    res.json({ success: true, data: { conversations } });
  } catch (error) {
    console.error('GetConversations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/messages/mark-read/:otherUserId
const markRead = async (req, res) => {
  try {
    const count = await MessageModel.markMessagesAsRead(req.user.id, parseInt(req.params.otherUserId));
    
    // Notify the sender via socket that their messages were read
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${req.params.otherUserId}`).emit('messagesRead', {
        readBy: req.user.id,
        count,
      });
    }
    
    res.json({ success: true, data: { markedCount: count } });
  } catch (error) {
    console.error('MarkRead error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/messages/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const count = await MessageModel.getUnreadCount(req.user.id);
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('GetUnreadCount error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const { uploadToCloudinary } = require('../config/cloudinary');
const fs = require('fs');

// POST /api/messages/upload
const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const folder = req.file.mimetype.startsWith('video/') ? 'chat_videos' : 'chat_images';
    const result = await uploadToCloudinary(req.file.path, folder);

    // Clean up local file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      data: {
        mediaUrl: result.secure_url,
        type: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
      }
    });
  } catch (error) {
    console.error('UploadMedia error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/messages/call
const initiateCall = async (req, res) => {
  try {
    const { receiverId, type, channelName } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !type || !channelName) {
      return res.status(400).json({ success: false, message: 'receiverId, type, and channelName are required' });
    }

    const sender = await UserModel.findById(senderId);
    const senderName = sender.full_name || sender.username || 'Someone';

    // Send push notification to receiver
    await sendPushNotification(receiverId, {
      title: `Incoming ${type} call`,
      body: `${senderName} is calling you...`,
      data: {
        type: 'call',
        callType: type,
        from: String(senderId),
        fromName: senderName,
        fromAvatar: sender.avatar_url || '',
        channelName,
      }
    });

    // Also try socket if available (for local dev)
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiverId}`).emit('incomingCall', {
        from: senderId,
        fromName: senderName,
        fromAvatar: sender.avatar_url,
        type,
        channelName
      });
    }

    res.json({ success: true, message: 'Call initiated' });
  } catch (error) {
    console.error('InitiateCall error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/messages/heartbeat
const heartbeat = async (req, res) => {
  try {
    await pool.query('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/messages/user-status/:userId
const getUserStatus = async (req, res) => {
  try {
    const result = await pool.query('SELECT last_seen FROM users WHERE id = $1', [parseInt(req.params.userId)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const lastSeen = result.rows[0].last_seen;
    const now = new Date();
    const diffMs = now - new Date(lastSeen);
    const isOnline = diffMs < 2 * 60 * 1000; // Online if active in last 2 minutes

    res.json({ success: true, data: { userId: parseInt(req.params.userId), online: isOnline, lastSeen } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/messages/users-status
const getUsersStatus = async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.json({ success: true, data: { statuses: [] } });
    }
    const result = await pool.query('SELECT id, last_seen FROM users WHERE id = ANY($1)', [userIds]);
    const now = new Date();
    const statuses = result.rows.map(row => ({
      userId: row.id,
      online: (now - new Date(row.last_seen)) < 2 * 60 * 1000,
      lastSeen: row.last_seen
    }));
    res.json({ success: true, data: { statuses } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getHistory,
  getConversations,
  markRead,
  getUnreadCount,
  uploadMedia,
  initiateCall,
  heartbeat,
  getUserStatus,
  getUsersStatus,
};

