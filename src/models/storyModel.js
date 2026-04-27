const pool = require('../config/db');

const createStoryTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS stories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_url TEXT NOT NULL,
      media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
      caption VARCHAR(200) DEFAULT '',
      view_count INTEGER DEFAULT 0,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS story_views (
      id SERIAL PRIMARY KEY,
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(story_id, viewer_id)
    );

    CREATE TABLE IF NOT EXISTS story_reactions (
      id SERIAL PRIMARY KEY,
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji VARCHAR(10) NOT NULL DEFAULT '❤️',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(story_id, user_id)
    );

    -- Add view_count column if missing on existing table
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='view_count') THEN
        ALTER TABLE stories ADD COLUMN view_count INTEGER DEFAULT 0;
      END IF;
    END $$;
  `;
  try {
    await pool.query(query);
    console.log('✅ Stories, StoryViews, StoryReactions tables ready');
  } catch (error) {
    console.error('❌ Error creating stories tables:', error.message);
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

// View a story (tracks unique views)
const viewStory = async (storyId, viewerId) => {
  try {
    await pool.query(
      'INSERT INTO story_views (story_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [storyId, viewerId]
    );
    // Update view count
    await pool.query(
      `UPDATE stories SET view_count = (SELECT COUNT(*) FROM story_views WHERE story_id = $1) WHERE id = $1`,
      [storyId]
    );
    return true;
  } catch (error) {
    console.error('ViewStory error:', error);
    return false;
  }
};

// Get viewers of a story
const getStoryViewers = async (storyId) => {
  const result = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url, sv.created_at as viewed_at
     FROM story_views sv
     JOIN users u ON sv.viewer_id = u.id
     WHERE sv.story_id = $1
     ORDER BY sv.created_at DESC`,
    [storyId]
  );
  return result.rows;
};

// React to a story
const reactToStory = async (storyId, userId, emoji) => {
  try {
    const result = await pool.query(
      `INSERT INTO story_reactions (story_id, user_id, emoji) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (story_id, user_id) DO UPDATE SET emoji = $3
       RETURNING *`,
      [storyId, userId, emoji || '❤️']
    );
    return result.rows[0];
  } catch (error) {
    console.error('ReactToStory error:', error);
    return null;
  }
};

// Get reactions for a story
const getStoryReactions = async (storyId) => {
  const result = await pool.query(
    `SELECT sr.*, u.username, u.full_name, u.avatar_url
     FROM story_reactions sr
     JOIN users u ON sr.user_id = u.id
     WHERE sr.story_id = $1
     ORDER BY sr.created_at DESC`,
    [storyId]
  );
  return result.rows;
};

module.exports = {
  createStoryTable,
  createStory,
  getActiveStories,
  deleteStory,
  viewStory,
  getStoryViewers,
  reactToStory,
  getStoryReactions,
};

