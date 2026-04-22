const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { globalSearch, getTrending } = require('../controllers/searchController');

router.get('/', protect, globalSearch);
router.get('/trending', protect, getTrending);

module.exports = router;
