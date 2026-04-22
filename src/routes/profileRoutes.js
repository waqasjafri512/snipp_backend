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
} = require('../controllers/profileController');
const upload = require('../middlewares/uploadMiddleware');

// All profile routes are protected
router.use(protect);

router.post('/upload-avatar', upload.single('avatar'), uploadAvatar);
router.get('/:userId', getProfile);
router.put('/update', updateProfile);
router.post('/follow/:userId', followUser);
router.delete('/unfollow/:userId', unfollowUser);
router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);

module.exports = router;
