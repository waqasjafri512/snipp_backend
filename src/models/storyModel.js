const pool = require('../config/db');

const createStoryTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS stories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_url TEXT NOT NULL,
      media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
      caption VARCHAR(200) DEFAULT '',
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log('✅ Stories table ready');
  } catch (error) {
    console.error('❌ Error creating stories table:', error.message);
  }
};

const createStory = async ({ user_id, media_url, media_type, caption }) => {
  // Stories expire in 24 hours
  const expires_at = new Date();
  expires_at.setHours(expires_at.getHours() + 24);

  const result = await pool.query(
    `INSERT INTO stories (user_id, media_url, media_type, caption, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [user_id, media_url, media_type, caption || '', expires_at]
  );
  return result.rows[0];
};

const getActiveStories = async () => {
  const result = await pool.query(
    `SELECT s.*, u.username, u.full_name, u.avatar_url
     FROM stories s
     JOIN users u ON s.user_id = u.id
     WHERE s.expires_at > CURRENT_TIMESTAMP
     ORDER BY s.created_at DESC`
  );
  return result.rows;
};

const deleteStory = async (storyId, userId) => {
  const result = await pool.query(
    'DELETE FROM stories WHERE id = $1 AND user_id = $2 RETURNING *',
    [storyId, userId]
  );
  return result.rowCount > 0;
};

module.exports = {
  createStoryTable,
  createStory,
  getActiveStories,
  deleteStory,
};
