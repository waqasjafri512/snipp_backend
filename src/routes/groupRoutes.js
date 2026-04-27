const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { 
  createGroup, 
  getGroups, 
  getGroupMessages, 
  addMember, 
  getMembers 
} = require('../controllers/groupController');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect);

router.post('/', upload.single('avatar'), createGroup);
router.get('/', getGroups);
router.get('/:groupId/messages', getGroupMessages);
router.post('/:groupId/members', addMember);
router.get('/:groupId/members', getMembers);

module.exports = router;
