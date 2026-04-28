const StoryModel = require('../models/storyModel');
const { uploadToCloudinary } = require('../config/cloudinary');
const fs = require('fs');
const { sendPushNotification } = require('../services/notificationService');

const createStory = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.path, 'stories');
    const mediaUrl = result.secure_url;
    const mediaType = result.resource_type; // 'image' or 'video'
    const { caption } = req.body;

    const story = await StoryModel.createStory({
      user_id: req.user.id,
      media_url: mediaUrl,
      media_type: mediaType,
      caption: caption || ''
    });

    // Clean up local file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(201).json({
      success: true,
      message: 'Story uploaded successfully',
      data: { story }
    });
  } catch (error) {
    console.error('CreateStory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getStories = async (req, res) => {
  try {
    const stories = await StoryModel.getActiveStories();
    
    // Group stories by user (like Instagram)
    const groupedStories = stories.reduce((acc, story) => {
      const userId = story.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          user_id: userId,
          username: story.username,
          full_name: story.full_name,
          avatar_url: story.avatar_url,
          stories: []
        };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});

    res.json({
      success: true,
      data: { stories: Object.values(groupedStories) }
    });
  } catch (error) {
    console.error('GetStories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const deleted = await StoryModel.deleteStory(storyId, req.user.id);

    if (deleted) {
      res.json({ success: true, message: 'Story deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Story not found or unauthorized' });
    }
  } catch (error) {
    console.error('DeleteStory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/stories/:storyId/view
const viewStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    await StoryModel.viewStory(storyId, req.user.id);
    res.json({ success: true, message: 'Story viewed' });
  } catch (error) {
    console.error('ViewStory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/stories/:storyId/viewers
const getStoryViewers = async (req, res) => {
  try {
    const { storyId } = req.params;
    const viewers = await StoryModel.getStoryViewers(storyId);
    res.json({ success: true, data: { viewers, count: viewers.length } });
  } catch (error) {
    console.error('GetStoryViewers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/stories/:storyId/react
const reactToStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { emoji } = req.body;
    const reaction = await StoryModel.reactToStory(storyId, req.user.id, emoji || '❤️');

    if (!reaction) {
      return res.status(500).json({ success: false, message: 'Failed to react' });
    }

    // Real-time: Notify story owner via socket
    const io = req.app.get('io');
    // We need the story to find the owner
    const stories = await StoryModel.getActiveStories();
    const story = stories.find(s => s.id === parseInt(storyId));
    if (story && story.user_id !== req.user.id) {
      io.to(`user_${story.user_id}`).emit('storyReaction', {
        story_id: storyId,
        reactor_username: req.user.username,
        reactor_avatar: req.user.avatar_url,
        emoji: emoji || '❤️',
      });

      // Send Push Notification
      await sendPushNotification(story.user_id, {
        title: 'Story Reaction! 😍',
        body: `${req.user.full_name || req.user.username} reacted ${emoji || '❤️'} to your story.`,
        data: { type: 'story_reaction', story_id: String(storyId) }
      });
    }

    res.json({ success: true, data: { reaction } });
  } catch (error) {
    console.error('ReactToStory error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/stories/:storyId/reactions
const getStoryReactions = async (req, res) => {
  try {
    const { storyId } = req.params;
    const reactions = await StoryModel.getStoryReactions(storyId);
    res.json({ success: true, data: { reactions } });
  } catch (error) {
    console.error('GetStoryReactions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createStory,
  getStories,
  deleteStory,
  viewStory,
  getStoryViewers,
  reactToStory,
  getStoryReactions,
};

