const MessageModel = require('../models/messageModel');

// GET /api/messages/history/:otherUserId
const getHistory = async (req, res) => {
  try {
    const history = await MessageModel.getChatHistory(req.user.id, req.params.otherUserId);
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

module.exports = {
  getHistory,
  getConversations,
};
