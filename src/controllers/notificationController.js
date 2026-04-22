const NotificationModel = require('../models/notificationModel');

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const notifications = await NotificationModel.getNotifications(req.user.id, limit, offset);
    res.json({
      success: true,
      data: { notifications, page, limit },
    });
  } catch (error) {
    console.error('GetNotifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/notifications/mark-read/:id
const markRead = async (req, res) => {
  try {
    await NotificationModel.markAsRead(req.params.id, req.user.id);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('MarkRead error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/notifications/mark-all-read
const markAllRead = async (req, res) => {
  try {
    await NotificationModel.markAllAsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('MarkAllRead error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getNotifications,
  markRead,
  markAllRead,
};
