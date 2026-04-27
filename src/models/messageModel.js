const pool = require('../config/db');

// Create Messages table
const createMessagesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      type VARCHAR(20) DEFAULT 'text',
      media_url TEXT DEFAULT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_messages_participants ON messages(sender_id, receiver_id);

    -- Migration
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='type') THEN
        ALTER TABLE messages ADD COLUMN type VARCHAR(20) DEFAULT 'text';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='media_url') THEN
        ALTER TABLE messages ADD COLUMN media_url TEXT DEFAULT NULL;
      END IF;
    END $$;
  `;
  try {
    await pool.query(query);
    console.log('✅ Messages table ready');
  } catch (error) {
    console.error('❌ Error creating messages table:', error.message);
  }
};

// Save a message
const saveMessage = async (senderId, receiverId, content, type = 'text', mediaUrl = null) => {
  const result = await pool.query(
    'INSERT INTO messages (sender_id, receiver_id, content, type, media_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [senderId, receiverId, content, type, mediaUrl]
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
            m.is_read,
            m.sender_id
     FROM (
       SELECT 
         CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as other_user_id,
         id, content, created_at, is_read, sender_id
       FROM messages
       WHERE sender_id = $1 OR receiver_id = $1
     ) m
     JOIN users u ON m.other_user_id = u.id
     WHERE m.other_user_id NOT IN (
       SELECT blocked_id FROM blocked_users WHERE blocker_id = $1
       UNION
       SELECT blocker_id FROM blocked_users WHERE blocked_id = $1
     )
     ORDER BY other_user_id, m.created_at DESC`,
    [userId]
  );
  
  // Also compute unread count per conversation
  const unreadResult = await pool.query(
    `SELECT sender_id, COUNT(*) as unread_count
     FROM messages
     WHERE receiver_id = $1 AND is_read = false
     GROUP BY sender_id`,
    [userId]
  );
  
  const unreadMap = {};
  unreadResult.rows.forEach(r => { unreadMap[r.sender_id] = parseInt(r.unread_count); });
  
  const conversations = result.rows.map(conv => ({
    ...conv,
    unread_count: unreadMap[conv.other_user_id] || 0,
  }));
  
  return conversations.sort((a, b) => b.last_message_time - a.last_message_time);
};

// Mark all messages from a sender as read (when receiver opens the chat)
const markMessagesAsRead = async (receiverId, senderId) => {
  const result = await pool.query(
    'UPDATE messages SET is_read = true WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false',
    [receiverId, senderId]
  );
  return result.rowCount;
};

// Get total unread message count for a user
const getUnreadCount = async (userId) => {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM messages WHERE receiver_id = $1 AND is_read = false',
    [userId]
  );
  return parseInt(result.rows[0].count);
};

module.exports = {
  createMessagesTable,
  saveMessage,
  getChatHistory,
  getConversations,
  markMessagesAsRead,
  getUnreadCount,
};

