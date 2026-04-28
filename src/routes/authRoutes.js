const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  getMe, 
  forgotPassword, 
  resetPassword, 
  verifyEmail,
  resendVerification,
  syncFirebase,
  updateFcmToken,
  changePassword
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/sync', syncFirebase);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email', verifyEmail);

// Protected routes
router.get('/me', protect, getMe);
router.post('/resend-verification', protect, resendVerification);
router.post('/fcm-token', protect, updateFcmToken);
router.post('/change-password', protect, changePassword);

module.exports = router;
