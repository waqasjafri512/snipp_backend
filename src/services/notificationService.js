const admin = require('../config/firebase');
const UserModel = require('../models/userModel');

/**
 * Send a push notification to a specific user
 * @param {number} userId - The ID of the user to notify
 * @param {Object} notification - { title, body, data }
 */
const sendPushNotification = async (userId, { title, body, data = {} }) => {
  try {
    const user = await UserModel.findById(userId);
    if (!user || !user.fcm_token) {
      console.log(`User ${userId} has no FCM token. Skipping push notification.`);
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      token: user.fcm_token,
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent push notification:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

/**
 * Send a push notification to multiple users
 * @param {Array<number>} userIds - Array of user IDs
 * @param {Object} notification - { title, body, data }
 */
const sendMulticastNotification = async (userIds, { title, body, data = {} }) => {
  try {
    // In a real app, you'd fetch all tokens in one query
    const tokens = [];
    for (const id of userIds) {
      const user = await UserModel.findById(id);
      if (user && user.fcm_token) tokens.push(user.fcm_token);
    }

    if (tokens.length === 0) return;

    const message = {
      notification: { title, body },
      data,
      tokens,
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log(`${response.successCount} messages were sent successfully`);
    return response;
  } catch (error) {
    console.error('Error sending multicast notification:', error);
  }
};

module.exports = {
  sendPushNotification,
  sendMulticastNotification,
};
