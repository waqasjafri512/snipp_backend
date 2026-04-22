const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { createStory, getStories, deleteStory } = require('../controllers/storyController');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect);

router.post('/create', upload.single('media'), createStory);
router.get('/feed', getStories);
router.delete('/:storyId', deleteStory);

module.exports = router;
