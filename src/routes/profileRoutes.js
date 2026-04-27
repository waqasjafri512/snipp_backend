const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  uploadAvatar,
  uploadCover,
  updateFcmToken,
} = require('../controllers/profileController');
const upload = require('../middlewares/uploadMiddleware');

// All profile routes are protected
router.use(protect);

router.post('/upload-avatar', upload.single('avatar'), uploadAvatar);
router.post('/upload-cover', upload.single('cover'), uploadCover);
router.post('/fcm-token', updateFcmToken);
router.get('/:userId', getProfile);
router.put('/update', updateProfile);
router.post('/follow/:userId', followUser);
router.delete('/unfollow/:userId', unfollowUser);
router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);

// Block routes
const { blockUser, unblockUser, getBlockedUsers } = require('../controllers/blockedController');
router.post('/block/:userId', blockUser);
router.delete('/unblock/:userId', unblockUser);
router.get('/settings/blocked', getBlockedUsers);

module.exports = router;
