const pool = require('../config/db');

// Create Blocked Users table
const createBlockedTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS blocked_users (
      id SERIAL PRIMARY KEY,
      blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(blocker_id, blocked_id)
    );
  `;
  try {
    await pool.query(query);
    console.log('✅ Blocked users table ready');
  } catch (error) {
    console.error('❌ Error creating blocked_users table:', error.message);
  }
};

// Block a user
const blockUser = async (blockerId, blockedId) => {
  try {
    await pool.query(
      'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [blockerId, blockedId]
    );

    // Also unfollow in both directions
    await pool.query(
      'DELETE FROM follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)',
      [blockerId, blockedId]
    );

    return true;
  } catch (error) {
    console.error('BlockUser error:', error);
    return false;
  }
};

// Unblock a user
const unblockUser = async (blockerId, blockedId) => {
  const result = await pool.query(
    'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
    [blockerId, blockedId]
  );
  return result.rowCount > 0;
};

// Check if user is blocked
const isBlocked = async (blockerId, blockedId) => {
  const result = await pool.query(
    'SELECT id FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
    [blockerId, blockedId]
  );
  return result.rows.length > 0;
};

// Check if either user has blocked the other (bidirectional check)
const isBlockedBidirectional = async (userId1, userId2) => {
  const result = await pool.query(
    'SELECT id FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
    [userId1, userId2]
  );
  return result.rows.length > 0;
};

// Get list of users blocked by a user
const getBlockedUsers = async (userId) => {
  const result = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url, bu.created_at as blocked_at
     FROM blocked_users bu
     JOIN users u ON bu.blocked_id = u.id
     WHERE bu.blocker_id = $1
     ORDER BY bu.created_at DESC`,
    [userId]
  );
  return result.rows;
};

// Get list of blocked user IDs (for filtering feeds/search)
const getBlockedIds = async (userId) => {
  const result = await pool.query(
    `SELECT blocked_id FROM blocked_users WHERE blocker_id = $1
     UNION
     SELECT blocker_id FROM blocked_users WHERE blocked_id = $1`,
    [userId]
  );
  return result.rows.map(r => r.blocked_id || r.blocker_id);
};

module.exports = {
  createBlockedTable,
  blockUser,
  unblockUser,
  isBlocked,
  isBlockedBidirectional,
  getBlockedUsers,
  getBlockedIds,
};
