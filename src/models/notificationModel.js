const pool = require('../config/db');

// Create Notifications table
const createNotificationsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL CHECK (type IN ('like', 'comment', 'accept', 'complete', 'follow')),
      dare_id INTEGER REFERENCES dares(id) ON DELETE CASCADE,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log('✅ Notifications table ready');
  } catch (error) {
    console.error('❌ Error creating notifications table:', error.message);
  }
};

// Create a notification
const createNotification = async ({ user_id, actor_id, type, dare_id }) => {
  // Don't notify if actor is the same as receiver
  if (user_id === actor_id) return null;

  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, dare_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, actor_id, type, dare_id || null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('CreateNotification error:', error);
    return null;
  }
};

// Get notifications for user
const getNotifications = async (userId, limit = 20, offset = 0) => {
  const result = await pool.query(
    `SELECT n.*, 
            u.username AS actor_username, 
            u.avatar_url AS actor_avatar,
            d.title AS dare_title
     FROM notifications n
     JOIN users u ON n.actor_id = u.id
     LEFT JOIN dares d ON n.dare_id = d.id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
};

// Mark as read
const markAsRead = async (notificationId, userId) => {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
};

// Mark all as read
const markAllAsRead = async (userId) => {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1',
    [userId]
  );
};

module.exports = {
  createNotificationsTable,
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
};
