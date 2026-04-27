const GroupModel = require('../models/groupModel');
const { uploadToCloudinary } = require('../config/cloudinary');
const fs = require('fs');

const createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Group name is required' });

    let avatarUrl = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.path, 'group_avatars');
      avatarUrl = result.secure_url;
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }

    const group = await GroupModel.createGroup(name, req.user.id, description, avatarUrl);
    res.status(201).json({ success: true, data: { group } });
  } catch (error) {
    console.error('CreateGroup error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getGroups = async (req, res) => {
  try {
    const groups = await GroupModel.getUserGroups(req.user.id);
    res.json({ success: true, data: { groups } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const messages = await GroupModel.getGroupMessages(groupId, limit, offset);
    res.json({ success: true, data: { messages } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    await GroupModel.addMember(groupId, userId);
    res.json({ success: true, message: 'Member added' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const members = await GroupModel.getGroupMembers(groupId);
    res.json({ success: true, data: { members } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroupMessages,
  addMember,
  getMembers
};
