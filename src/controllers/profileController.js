const ProfileModel = require('../models/profileModel');
const NotificationModel = require('../models/notificationModel');
const { uploadToCloudinary } = require('../config/cloudinary');
const fs = require('fs');
const { sendPushNotification } = require('../services/notificationService');

// GET /api/profile/:userId
const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await ProfileModel.getProfileByUserId(userId);

    if (!profile) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check relationships
    let is_following = false;
    let follows_me = false;
    
    if (req.user && req.user.id !== parseInt(userId)) {
      is_following = await ProfileModel.isFollowing(req.user.id, parseInt(userId));
      follows_me = await ProfileModel.isFollowing(parseInt(userId), req.user.id);
    }
 
    res.json({
      success: true,
      data: { 
        profile: { 
          ...profile, 
          is_following,
          follows_me,
          is_friend: is_following && follows_me 
        } 
      },
    });
  } catch (error) {
    console.error('GetProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/profile/update
const updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      'full_name', 'bio', 'avatar_url', 'cover_url', 'location', 'website', 
      'category', 'date_of_birth', 'gender', 'works_at', 'studied_at', 'from_location',
      'is_private', 'show_activity', 'push_notifications', 'email_notifications'
    ];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const profile = await ProfileModel.updateProfile(req.user.id, updates);
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { profile },
    });
  } catch (error) {
    console.error('UpdateProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/profile/follow/:userId
const followUser = async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId);

    if (req.user.id === targetId) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    }

    const result = await ProfileModel.followUser(req.user.id, targetId);
    if (!result) {
      return res.status(409).json({ success: false, message: 'Already following this user' });
    }

    // Create notification
    await NotificationModel.createNotification({
      user_id: targetId,
      actor_id: req.user.id,
      type: 'follow',
    });

    // Real-time: Notify target user
    const io = req.app.get('io');
    io.to(`user_${targetId}`).emit('newNotification', {
      type: 'follow',
      actor_id: req.user.id,
      actor_username: req.user.username,
      actor_avatar: req.user.avatar_url,
      created_at: new Date()
    });

    // Send Push Notification
    await sendPushNotification(targetId, {
      title: 'New Follower! 👤',
      body: `${req.user.full_name || req.user.username} started following you.`,
      data: { type: 'follow', actor_id: String(req.user.id) }
    });

    res.json({ success: true, message: 'Followed successfully' });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/profile/unfollow/:userId
const unfollowUser = async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId);
    const result = await ProfileModel.unfollowUser(req.user.id, targetId);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Not following this user' });
    }

    res.json({ success: true, message: 'Unfollowed successfully' });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/profile/:userId/followers
const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const followers = await ProfileModel.getFollowers(userId, limit, offset);
    res.json({ success: true, data: { followers, page, limit } });
  } catch (error) {
    console.error('GetFollowers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/profile/:userId/following
const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const following = await ProfileModel.getFollowing(userId, limit, offset);
    res.json({ success: true, data: { following, page, limit } });
  } catch (error) {
    console.error('GetFollowing error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/profile/upload-avatar
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.path, 'avatars');
    const avatarUrl = result.secure_url;

    // Update profile in DB
    const profile = await ProfileModel.updateProfile(req.user.id, { avatar_url: avatarUrl });

    // Clean up local file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: { avatarUrl, profile },
    });
  } catch (error) {
    console.error('UploadAvatar error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/profile/upload-cover
const uploadCover = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.path, 'covers');
    const coverUrl = result.secure_url;

    // Update profile in DB
    const profile = await ProfileModel.updateProfile(req.user.id, { cover_url: coverUrl });

    // Clean up local file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      message: 'Cover photo updated successfully',
      data: { coverUrl, profile },
    });
  } catch (error) {
    console.error('UploadCover error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/profile/fcm-token
const updateFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    await ProfileModel.updateFcmToken(req.user.id, token);
    res.json({ success: true, message: 'FCM token updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  uploadAvatar,
  uploadCover,
  updateFcmToken
};
