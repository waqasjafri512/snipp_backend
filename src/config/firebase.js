const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

try {
  let serviceAccount;

  // 1. Check for Environment Variable (Best for Vercel)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (parseError) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:', parseError);
    }
  } 
  
  // 2. Fallback to Local File (Development)
  if (!serviceAccount) {
    const serviceAccountPath = path.join(__dirname, '../../firebase-adminsdk.json');
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = require(serviceAccountPath);
    }
  }

  if (serviceAccount) {
    // Only initialize if no apps exist
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    console.log('Firebase Admin SDK initialized successfully.');
  } else {
    console.warn('WARNING: Firebase credentials not found. Firebase features will be disabled.');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
}

module.exports = admin;
