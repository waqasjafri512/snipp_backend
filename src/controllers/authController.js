const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const ProfileModel = require('../models/profileModel');
const AuthModel = require('../models/authModel');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/mailService');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// POST /api/auth/sync
// Called after Firebase auth success to sync user to PostgreSQL
const syncFirebase = async (req, res) => {
  try {
    // If the request passes the protect middleware, we can just use req.user.
    // However, this is typically an open route where Flutter passes the token in header 
    // and uid in body. We can verify it securely here.
    const admin = require('../config/firebase');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No Firebase token provided' });
    }
    const token = authHeader.split(' ')[1];
    
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Invalid Firebase token' });
    }

    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const { username, full_name, avatar_url } = req.body;

    let user = await UserModel.findByFirebaseUid(uid);

    if (!user) {
      // Create user or link if email exists
      let existingEmail = await UserModel.findByEmail(email);
      if (existingEmail) {
        // Link existing user to this firebase account
        user = await UserModel.syncFirebaseUser({ firebase_uid: uid, email, username: existingEmail.username, full_name: existingEmail.full_name, avatar_url });
      } else {
        // Create new user completely
        const finalUsername = username || email.split('@')[0] + Math.floor(Math.random() * 1000);
        user = await UserModel.syncFirebaseUser({ firebase_uid: uid, email, username: finalUsername, full_name: full_name || finalUsername, avatar_url });
        await ProfileModel.createProfile(user.id);
      }
    }

    // Generate our JWT token so existing app APIs don't break immediately
    const jwtToken = generateToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Firebase user synced successfully',
      data: { user, token: jwtToken }
    });
  } catch (error) {
    console.error('Firebase sync error:', error);
    res.status(500).json({ success: false, message: 'Server error during firebase sync' });
  }
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if email already exists
    const existingEmail = await UserModel.findByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Check if username already exists
    const existingUsername = await UserModel.findByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'Username already taken',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await UserModel.createUser({
      username,
      email,
      password: hashedPassword,
      full_name: full_name || username,
    });

    // Create profile for the user
    await ProfileModel.createProfile(user.id);

    // Generate Verification Token
    const verifyToken = await AuthModel.createVerificationToken(user.id);
    await sendVerificationEmail(email, verifyToken);

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your email.',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Check user and password
    const user = await UserModel.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Remove password from response
    delete user.password;

    res.status(200).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user data',
    });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    const token = await AuthModel.createResetToken(email);
    if (token) {
      await sendPasswordResetEmail(email, token);
    }

    // Always return success to prevent email enumeration
    res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and new password are required' });

  try {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const success = await AuthModel.resetPassword(token, hashedPassword);
    if (!success) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/auth/verify-email
const verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

  try {
    const success = await AuthModel.verifyEmail(token);
    if (!success) {
      return res.status(400).send('<h1>Invalid or expired verification link</h1>');
    }

    res.send('<h1>Email verified successfully! You can now log in to the app.</h1>');
  } catch (error) {
    res.status(500).send('<h1>Server error</h1>');
  }
};

// POST /api/auth/resend-verification
const resendVerification = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.is_verified) return res.status(400).json({ success: false, message: 'Email already verified' });

    const verifyToken = await AuthModel.createVerificationToken(user.id);
    await sendVerificationEmail(user.email, verifyToken);

    res.status(200).json({ success: true, message: 'Verification email resent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/fcm-token
const updateFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

    await UserModel.updateFcmToken(req.user.id, token);
    res.status(200).json({ success: true, message: 'FCM token updated' });
  } catch (error) {
    console.error('Update FCM token error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Check current password
    if (!user.password) {
      return res.status(400).json({ success: false, message: 'This account uses social login. Set a password via Forgot Password first.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await UserModel.updateUser(req.user.id, { password: hashedPassword });

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  getMe,
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  syncFirebase,
  updateFcmToken,
  changePassword,
};
