const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getHistory, getConversations } = require('../controllers/messageController');

router.get('/history/:otherUserId', protect, getHistory);
router.get('/conversations', protect, getConversations);

module.exports = router;
