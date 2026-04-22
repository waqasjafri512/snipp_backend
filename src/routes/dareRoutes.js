const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const {
  createDare,
  getFeed,
  getDare,
  deleteDare,
  toggleLike,
  addComment,
  getComments,
  acceptDare,
  completeDare,
  getCategories,
  getUserDares,
  getParticipatedDares,
  updateDare,
  uploadDareMedia,
  toggleCommentLike,
} = require('../controllers/dareController');

// All dare routes are protected
router.use(protect);

// Categories
router.get('/categories', getCategories);

// Feed & CRUD
router.get('/feed', getFeed);
router.post('/create', createDare);
router.post('/upload-media', upload.single('media'), uploadDareMedia);
router.get('/user/:userId', getUserDares);
router.get('/user/:userId/participated', getParticipatedDares);
router.get('/:id', getDare);
router.put('/:id', updateDare);
router.delete('/:id', deleteDare);

// Interactions
router.post('/:id/like', toggleLike);
router.post('/:id/comment', addComment);
router.get('/:id/comments', getComments);
router.post('/comments/:commentId/like', toggleCommentLike);
router.post('/:id/accept', acceptDare);
router.post('/:id/complete', completeDare);

module.exports = router;
