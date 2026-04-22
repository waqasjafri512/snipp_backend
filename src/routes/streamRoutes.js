const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getAgoraToken,
  startLive,
  endLive,
  getActive,
} = require('../controllers/streamController');

router.use(protect);

router.get('/token', getAgoraToken);
router.get('/active', getActive);
router.post('/start', startLive);
router.post('/end', endLive);

module.exports = router;
