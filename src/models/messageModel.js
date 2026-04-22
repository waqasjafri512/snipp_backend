const pool = require('../config/db');

// Create Messages table
const createMessagesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_messages_participants ON messages(sender_id, receiver_id);
  `;
  try {
    await pool.query(query);
    console.log('✅ Messages table ready');
  } catch (error) {
    console.error('❌ Error creating messages table:', error.message);
  }
};

// Save a message
const saveMessage = async (senderId, receiverId, content) => {
  const result = await pool.query(
    'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *',
    [senderId, receiverId, content]
  );
  return result.rows[0];
};

// Get chat history between two users
const getChatHistory = async (userId1, userId2, limit = 50, offset = 0) => {
  const result = await pool.query(
    `SELECT * FROM messages 
     WHERE (sender_id = $1 AND receiver_id = $2) 
        OR (sender_id = $2 AND receiver_id = $1)
     ORDER BY created_at DESC 
     LIMIT $3 OFFSET $4`,
    [userId1, userId2, limit, offset]
  );
  return result.rows;
};

// Get conversation list for a user
const getConversations = async (userId) => {
  const result = await pool.query(
    `SELECT DISTINCT ON (other_user_id)
            other_user_id,
            u.username,
            u.full_name,
            u.avatar_url,
            m.content as last_message,
            m.created_at as last_message_time,
            m.is_read
     FROM (
       SELECT 
         CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as other_user_id,
         id, content, created_at, is_read
       FROM messages
       WHERE sender_id = $1 OR receiver_id = $1
     ) m
     JOIN users u ON m.other_user_id = u.id
     ORDER BY other_user_id, m.created_at DESC`,
    [userId]
  );
  return result.rows.sort((a, b) => b.last_message_time - a.last_message_time);
};

module.exports = {
  createMessagesTable,
  saveMessage,
  getChatHistory,
  getConversations,
};
