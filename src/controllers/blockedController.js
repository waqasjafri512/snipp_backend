const BlockedModel = require('../models/blockedModel');

// POST /api/profile/block/:userId
const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot block yourself' });
    }

    const success = await BlockedModel.blockUser(req.user.id, userId);
    if (success) {
      res.json({ success: true, message: 'User blocked successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to block user' });
    }
  } catch (error) {
    console.error('BlockUser controller error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/profile/unblock/:userId
const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const success = await BlockedModel.unblockUser(req.user.id, userId);
    if (success) {
      res.json({ success: true, message: 'User unblocked successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Block record not found' });
    }
  } catch (error) {
    console.error('UnblockUser controller error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/profile/blocked
const getBlockedUsers = async (req, res) => {
  try {
    const blocked = await BlockedModel.getBlockedUsers(req.user.id);
    res.json({ success: true, data: { blocked } });
  } catch (error) {
    console.error('GetBlockedUsers controller error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  blockUser,
  unblockUser,
  getBlockedUsers,
};
