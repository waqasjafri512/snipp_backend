const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { globalSearch, getTrending, getTrendingCreators } = require('../controllers/searchController');

router.get('/', protect, globalSearch);
router.get('/trending', protect, getTrending);
router.get('/trending/creators', protect, getTrendingCreators);

module.exports = router;
