const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');

const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided',
      });
    }

    let user;

    // 1. Try custom JWT FIRST (fast, local verification — no network call)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await UserModel.findById(decoded.id);
    } catch (jwtError) {
      // 2. Fallback to Firebase ID Token (slower, network call to Google)
      try {
        const admin = require('../config/firebase');
        if (admin.apps && admin.apps.length > 0) {
          const decodedFirebaseToken = await admin.auth().verifyIdToken(token);
          user = await UserModel.findByFirebaseUid(decodedFirebaseToken.uid);
          
          if (!user) {
            // Fallback: check by email if sync hasn't fully completed
            user = await UserModel.findByEmail(decodedFirebaseToken.email);
          }
        }
      } catch (firebaseError) {
        // Both failed
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
        });
      }
    }

    // Check if user still exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists',
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication',
    });
  }
};

module.exports = { protect };
