const pool = require('../config/db');

// Create Profiles table
const createProfilesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      location VARCHAR(100) DEFAULT '',
      website VARCHAR(255) DEFAULT '',
      date_of_birth DATE DEFAULT NULL,
      gender VARCHAR(20) DEFAULT '',
      dares_posted INTEGER DEFAULT 0,
      dares_completed INTEGER DEFAULT 0,
      dares_accepted INTEGER DEFAULT 0,
      followers_count INTEGER DEFAULT 0,
      following_count INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );
  `;
  try {
    await pool.query(query);
    console.log('✅ Profiles & Follows tables ready');
  } catch (error) {
    console.error('❌ Error creating profiles tables:', error.message);
  }
};

// Create profile for new user
const createProfile = async (userId) => {
  const result = await pool.query(
    'INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING RETURNING *',
    [userId]
  );
  return result.rows[0];
};

// Get profile by user ID (with user info joined)
const getProfileByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT u.id, u.username, u.email, u.full_name, u.avatar_url, u.bio, u.category, u.website, u.is_verified, u.created_at,
            p.location, p.date_of_birth, p.gender,
            p.dares_posted, p.dares_completed, p.dares_accepted,
            p.followers_count, p.following_count, p.xp, p.level
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0];
};

// Update profile
const updateProfile = async (userId, fields) => {
  // Separate user fields and profile fields
  const userFields = {};
  const profileFields = {};
  
  const userColumns = ['full_name', 'bio', 'avatar_url', 'category', 'website'];
  const profileColumns = ['location', 'date_of_birth', 'gender'];

  for (const [key, value] of Object.entries(fields)) {
    if (userColumns.includes(key)) userFields[key] = value;
    else if (profileColumns.includes(key)) profileFields[key] = value;
  }

  // Update user table
  if (Object.keys(userFields).length > 0) {
    const keys = Object.keys(userFields);
    const values = Object.values(userFields);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(userId);
    await pool.query(
      `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`,
      values
    );
  }

  // Update profile table
  if (Object.keys(profileFields).length > 0) {
    const keys = Object.keys(profileFields);
    const values = Object.values(profileFields);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(userId);
    await pool.query(
      `UPDATE profiles SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $${values.length}`,
      values
    );
  }

  return getProfileByUserId(userId);
};

// Follow a user
const followUser = async (followerId, followingId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
      [followerId, followingId]
    );
    await client.query(
      'UPDATE profiles SET following_count = following_count + 1 WHERE user_id = $1',
      [followerId]
    );
    await client.query(
      'UPDATE profiles SET followers_count = followers_count + 1 WHERE user_id = $1',
      [followingId]
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return false; // Already following
    throw error;
  } finally {
    client.release();
  }
};

// Unfollow a user
const unfollowUser = async (followerId, followingId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
    if (result.rowCount > 0) {
      await client.query(
        'UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE user_id = $1',
        [followerId]
      );
      await client.query(
        'UPDATE profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE user_id = $1',
        [followingId]
      );
    }
    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Check if user is following another
const isFollowing = async (followerId, followingId) => {
  const result = await pool.query(
    'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
    [followerId, followingId]
  );
  return result.rows.length > 0;
};

// Get followers list
const getFollowers = async (userId, limit = 20, offset = 0) => {
  const result = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified
     FROM follows f
     JOIN users u ON f.follower_id = u.id
     WHERE f.following_id = $1
     ORDER BY f.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
};

// Get following list
const getFollowing = async (userId, limit = 20, offset = 0) => {
  const result = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified
     FROM follows f
     JOIN users u ON f.following_id = u.id
     WHERE f.follower_id = $1
     ORDER BY f.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
};

// Add/Update XP and handle level up
const updateXP = async (userId, amount) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Increment XP
    const result = await client.query(
      'UPDATE profiles SET xp = xp + $1 WHERE user_id = $2 RETURNING xp, level',
      [amount, userId]
    );
    
    if (result.rows.length === 0) throw new Error('Profile not found');
    
    let { xp, level } = result.rows[0];
    const newLevel = Math.floor(xp / 500) + 1;
    
    // 2. Check for level up
    if (newLevel > level) {
      await client.query(
        'UPDATE profiles SET level = $1 WHERE user_id = $2',
        [newLevel, userId]
      );
      // We could also trigger a notification here
      level = newLevel;
    }
    
    await client.query('COMMIT');
    return { xp, level, leveledUp: newLevel > level };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  createProfilesTable,
  createProfile,
  getProfileByUserId,
  updateProfile,
  followUser,
  unfollowUser,
  isFollowing,
  getFollowers,
  getFollowing,
  updateXP,
};
