const MessageModel = require('../models/messageModel');

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
    io.to(`user_${req.params.otherUserId}`).emit('messagesRead', {
      readBy: req.user.id,
      count,
    });
    
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

module.exports = {
  getHistory,
  getConversations,
  markRead,
  getUnreadCount,
  uploadMedia
};

