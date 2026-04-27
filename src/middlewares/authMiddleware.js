const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const admin = require('../config/firebase');

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

    try {
      // 1. First, try to verify as a Firebase ID Token
      if (admin.apps.length > 0) {
        const decodedFirebaseToken = await admin.auth().verifyIdToken(token);
        user = await UserModel.findByFirebaseUid(decodedFirebaseToken.uid);
        
        // If user is not found by Firebase UID, we might need to link them, 
        // but typically they should hit /sync first. Let's return error if not found.
        if (!user) {
          // As a fallback, check by email if sync hasn't fully completed
          user = await UserModel.findByEmail(decodedFirebaseToken.email);
        }
      } else {
        throw new Error("Firebase not initialized");
      }
    } catch (firebaseError) {
      // 2. Fallback to our Custom JWT (for legacy active sessions)
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await UserModel.findById(decoded.id);
      } catch (jwtError) {
        // If both fail, return error
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
