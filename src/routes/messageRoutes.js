const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getHistory, getConversations, markRead, getUnreadCount, uploadMedia } = require('../controllers/messageController');
const upload = require('../middlewares/uploadMiddleware');

router.get('/history/:otherUserId', protect, getHistory);
router.get('/conversations', protect, getConversations);
router.get('/unread-count', protect, getUnreadCount);
router.post('/mark-read/:otherUserId', protect, markRead);
router.post('/upload', protect, upload.single('media'), uploadMedia);

module.exports = router;

