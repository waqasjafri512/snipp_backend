const pool = require('../config/db');

// Create Streams table
const createStreamsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS streams (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel_name VARCHAR(100) UNIQUE NOT NULL,
      title VARCHAR(200),
      is_live BOOLEAN DEFAULT true,
      viewer_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log('✅ Streams table ready');
  } catch (error) {
    console.error('❌ Error creating streams table:', error.message);
  }
};

// Create a new stream session
const startStream = async (userId, channelName, title) => {
  const result = await pool.query(
    `INSERT INTO streams (user_id, channel_name, title) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (channel_name) DO UPDATE SET is_live = true, ended_at = NULL
     RETURNING *`,
    [userId, channelName, title]
  );
  return result.rows[0];
};

// End a stream
const endStream = async (channelName) => {
  await pool.query(
    'UPDATE streams SET is_live = false, ended_at = CURRENT_TIMESTAMP WHERE channel_name = $1',
    [channelName]
  );
};

// Get list of active streams
const getActiveStreams = async () => {
  const result = await pool.query(
    `SELECT s.*, u.username, u.avatar_url 
     FROM streams s
     JOIN users u ON s.user_id = u.id
     WHERE s.is_live = true
     ORDER BY s.viewer_count DESC`
  );
  return result.rows;
};

module.exports = {
  createStreamsTable,
  startStream,
  endStream,
  getActiveStreams,
};
