const DareModel = require('../models/dareModel');
const NotificationModel = require('../models/notificationModel');
const ProfileModel = require('../models/profileModel');
const { uploadToCloudinary } = require('../config/cloudinary');
const fs = require('fs');

// POST /api/dares/create
const createDare = async (req, res) => {
  try {
    const { title, description, category_id, difficulty, media_url, media_type, post_type } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    if (title.length > 200) {
      return res.status(400).json({ success: false, message: 'Title must be under 200 characters' });
    }

    const dare = await DareModel.createDare({
      creator_id: req.user.id,
      title,
      description,
      category_id,
      difficulty,
      media_url,
      media_type,
      post_type,
    });

    // Real-time: Notify everyone about new dare
    const io = req.app.get('io');
    io.emit('newDare', { ...dare, username: req.user.username });

    res.status(201).json({
      success: true,
      message: 'Dare created successfully',
      data: { dare },
    });
  } catch (error) {
    console.error('CreateDare error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dares/feed
const getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const dares = await DareModel.getFeed(req.user.id, limit, offset);

    res.json({
      success: true,
      data: {
        dares,
        page,
        limit,
        hasMore: dares.length === limit,
      },
    });
  } catch (error) {
    console.error('GetFeed error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dares/:id
const getDare = async (req, res) => {
  try {
    const dare = await DareModel.getDareById(req.params.id, req.user.id);
    if (!dare) {
      return res.status(404).json({ success: false, message: 'Dare not found' });
    }
    res.json({ success: true, data: { dare } });
  } catch (error) {
    console.error('GetDare error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/dares/:id
const deleteDare = async (req, res) => {
  try {
    const deleted = await DareModel.deleteDare(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Dare not found or unauthorized' });
    }
    res.json({ success: true, message: 'Dare deleted successfully' });
  } catch (error) {
    console.error('DeleteDare error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/dares/:id/like
const toggleLike = async (req, res) => {
  try {
    const dareId = req.params.id;
    const liked = await DareModel.likeDare(dareId, req.user.id);

    if (!liked) {
      // Already liked, so unlike
      await DareModel.unlikeDare(dareId, req.user.id);
      return res.json({ success: true, message: 'Unliked', data: { liked: false } });
    }

    // Get dare to find creator
    const dare = await DareModel.getDareById(dareId, req.user.id);
    if (dare) {
      if (String(dare.creator_id) !== String(req.user.id)) {
        await NotificationModel.createNotification({
          user_id: dare.creator_id,
          actor_id: req.user.id,
          type: 'like',
          dare_id: dareId,
        });
        // Award XP to creator for getting a like
        await ProfileModel.updateXP(dare.creator_id, 5);

        // Real-time: Notify creator
        const io = req.app.get('io');
        io.to(`user_${dare.creator_id}`).emit('newNotification', {
          type: 'like',
          actor_id: req.user.id,
          actor_username: req.user.username,
          actor_avatar: req.user.avatar_url,
          dare_id: dareId,
          dare_title: dare.title,
          created_at: new Date()
        });
      }
      
      // Award XP to actor for liking
      await ProfileModel.updateXP(req.user.id, 2);

      // Real-time: Update feed for everyone
      const updatedDare = await DareModel.getDareById(dareId, req.user.id);
      if (updatedDare) {
        io.emit('dareUpdated', updatedDare);
      }
    }

    res.json({ success: true, message: 'Liked', data: { liked: true } });
  } catch (error) {
    console.error('ToggleLike error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/dares/:id/comment
const addComment = async (req, res) => {
  try {
    const { content, parent_id } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const comment = await DareModel.addComment(req.params.id, req.user.id, content.trim(), parent_id);

    // Notify creator
    const dare = await DareModel.getDareById(req.params.id, req.user.id);
    if (dare) {
      if (String(dare.creator_id) !== String(req.user.id)) {
        await NotificationModel.createNotification({
          user_id: dare.creator_id,
          actor_id: req.user.id,
          type: 'comment',
          dare_id: req.params.id,
        });

        // Real-time: Notify creator
        const io = req.app.get('io');
        io.to(`user_${dare.creator_id}`).emit('newNotification', {
          type: 'comment',
          actor_id: req.user.id,
          actor_username: req.user.username,
          actor_avatar: req.user.avatar_url,
          dare_id: req.params.id,
          dare_title: dare.title,
          created_at: new Date()
        });
      }
      
      // Award XP for commenting
      await ProfileModel.updateXP(req.user.id, 3);

      // Real-time: Update feed for everyone
      const updatedDare = await DareModel.getDareById(req.params.id, req.user.id);
      if (updatedDare) {
        io.emit('dareUpdated', updatedDare);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Comment added',
      data: { comment },
    });
  } catch (error) {
    console.error('AddComment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dares/:id/comments
const getComments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const comments = await DareModel.getComments(req.params.id, req.user.id, limit, offset);
    res.json({
      success: true,
      data: { comments, page, limit, hasMore: comments.length === limit },
    });
  } catch (error) {
    console.error('GetComments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/dares/comments/:commentId/like
const toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { liked } = await DareModel.toggleCommentLike(commentId, req.user.id);
    
    res.json({
      success: true,
      data: { liked },
    });
  } catch (error) {
    console.error('ToggleCommentLike error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/dares/:id/accept
const acceptDare = async (req, res) => {
  try {
    const dare = await DareModel.getDareById(req.params.id, req.user.id);
    if (!dare) {
      return res.status(404).json({ success: false, message: 'Dare not found' });
    }

    if (dare.creator_id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot accept your own dare' });
    }

    const accept = await DareModel.acceptDare(req.params.id, req.user.id);
    if (!accept) {
      return res.status(409).json({ success: false, message: 'Already accepted this dare' });
    }

    // Award XP for accepting a dare
    await ProfileModel.updateXP(req.user.id, 20);

    // Notify creator
    if (String(dare.creator_id) !== String(req.user.id)) {
      await NotificationModel.createNotification({
        user_id: dare.creator_id,
        actor_id: req.user.id,
        type: 'accept',
        dare_id: req.params.id,
      });

      // Real-time: Notify creator
      const io = req.app.get('io');
      io.to(`user_${dare.creator_id}`).emit('newNotification', {
        type: 'accept',
        actor_id: req.user.id,
        actor_username: req.user.username,
        actor_avatar: req.user.avatar_url,
        dare_id: req.params.id,
        dare_title: dare.title,
        created_at: new Date()
      });
    }

    res.status(201).json({ success: true, message: 'Dare accepted! 🔥', data: { accept } });
  } catch (error) {
    console.error('AcceptDare error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/dares/:id/complete
const completeDare = async (req, res) => {
  try {
    const dareId = req.params.id;
    const { proof_url } = req.body;
    const result = await DareModel.completeDare(dareId, req.user.id, proof_url);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Dare not accepted or already completed' });
    }

    // Real-time: Notify creator
    const dare = await DareModel.getDareById(dareId, req.user.id);
    if (dare) {
      // Notify creator
      if (String(dare.creator_id) !== String(req.user.id)) {
        await NotificationModel.createNotification({
          user_id: dare.creator_id,
          actor_id: req.user.id,
          type: 'complete',
          dare_id: dareId,
        });

        // Real-time
        const io = req.app.get('io');
        io.to(`user_${dare.creator_id}`).emit('newNotification', {
          type: 'complete',
          actor_id: req.user.id,
          actor_username: req.user.username,
          actor_avatar: req.user.avatar_url,
          dare_id: dareId,
          dare_title: dare.title,
          created_at: new Date()
        });
      }
      
      // Award XP for completing a dare
      await ProfileModel.updateXP(req.user.id, 100);
      await ProfileModel.updateXP(dare.creator_id, 20); // Creator gets XP for completed challenge
    }

    res.json({ success: true, message: 'Dare completed! 🎉', data: { result } });
  } catch (error) {
    console.error('CompleteDare error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dares/categories
const getCategories = async (req, res) => {
  try {
    const categories = await DareModel.getCategories();
    res.json({ success: true, data: { categories } });
  } catch (error) {
    console.error('GetCategories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dares/user/:userId
const getUserDares = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const dares = await DareModel.getUserDares(req.params.userId, limit, offset);
    res.json({
      success: true,
      data: { dares, page, limit, hasMore: dares.length === limit },
    });
  } catch (error) {
    console.error('GetUserDares error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/dares/:id
const updateDare = async (req, res) => {
  try {
    const { title, description, category_id, difficulty } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const dare = await DareModel.updateDare(req.params.id, req.user.id, {
      title,
      description,
      category_id,
      difficulty,
    });

    if (!dare) {
      return res.status(404).json({ success: false, message: 'Dare not found or unauthorized' });
    }

    res.json({ success: true, message: 'Dare updated successfully', data: { dare } });
  } catch (error) {
    console.error('UpdateDare error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/dares/upload-media
const uploadDareMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.path, 'dares');
    const mediaUrl = result.secure_url;
    const mediaType = result.resource_type; // 'image' or 'video'

    // Clean up local file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      data: { mediaUrl, mediaType },
    });
  } catch (error) {
    console.error('UploadDareMedia error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dares/user/:userId/participated
const getParticipatedDares = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const dares = await DareModel.getParticipatedDares(userId, limit, offset);
    res.json({ success: true, data: { dares, page, limit } });
  } catch (error) {
    console.error('GetParticipatedDares error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createDare,
  getFeed,
  getDare,
  deleteDare,
  updateDare,
  uploadDareMedia,
  toggleLike,
  addComment,
  getComments,
  acceptDare,
  completeDare,
  getCategories,
  getUserDares,
  getParticipatedDares,
  toggleCommentLike,
};
