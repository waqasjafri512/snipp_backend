const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getNotifications,
  markRead,
  markAllRead,
} = require('../controllers/notificationController');

// All notification routes are protected
router.use(protect);

router.get('/', getNotifications);
router.post('/mark-read/:id', markRead);
router.post('/mark-all-read', markAllRead);

module.exports = router;
