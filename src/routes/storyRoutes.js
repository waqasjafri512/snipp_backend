const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { createStory, getStories, deleteStory, viewStory, getStoryViewers, reactToStory, getStoryReactions } = require('../controllers/storyController');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect);

router.post('/create', upload.single('media'), createStory);
router.get('/feed', getStories);
router.delete('/:storyId', deleteStory);
router.post('/:storyId/view', viewStory);
router.get('/:storyId/viewers', getStoryViewers);
router.post('/:storyId/react', reactToStory);
router.get('/:storyId/reactions', getStoryReactions);

module.exports = router;

