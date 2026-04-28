const pool = require('../config/db');

// GET /api/search?q=query
const globalSearch = async (req, res) => {
  const { q } = req.query;
  const userId = req.user.id;

  if (!q) {
    return res.json({ success: true, data: { users: [], dares: [] } });
  }

  const queryStr = `%${q}%`;

  try {
    // Search Users (Excluding blocked)
    const usersResult = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
              EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) AS is_following
       FROM users u
       WHERE (u.username ILIKE $2 OR u.full_name ILIKE $2)
       AND u.id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = $1
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = $1
       )
       LIMIT 10`,
      [userId, queryStr]
    );

    // Search Dares (Excluding blocked creators)
    const daresResult = await pool.query(
      `SELECT d.*, u.username AS creator_username, u.full_name AS creator_full_name, 
              u.avatar_url AS creator_avatar, u.is_verified AS creator_verified,
              EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND dare_id = d.id) AS is_liked
       FROM dares d
       JOIN users u ON d.creator_id = u.id
       WHERE (d.title ILIKE $2 OR d.description ILIKE $2)
       AND d.creator_id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = $1
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = $1
       )
       ORDER BY d.created_at DESC
       LIMIT 10`,
      [userId, queryStr]
    );

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        dares: daresResult.rows,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/search/trending
const getTrending = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT d.*, u.username AS creator_username, u.full_name AS creator_full_name, 
              u.avatar_url AS creator_avatar, u.is_verified AS creator_verified,
              EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND dare_id = d.id) AS is_liked,
              (d.likes_count + d.accepts_count * 2) as trend_score
       FROM dares d
       JOIN users u ON d.creator_id = u.id
       WHERE d.creator_id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = $1
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = $1
       )
       ORDER BY trend_score DESC, d.created_at DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      success: true,
      data: { dares: result.rows },
    });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/search/trending/creators
const getTrendingCreators = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified, p.followers_count,
              EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) AS is_following
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE u.id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = $1
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = $1
       )
       ORDER BY p.followers_count DESC, p.xp DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      success: true,
      data: { users: result.rows },
    });
  } catch (error) {
    console.error('TrendingCreators error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  globalSearch,
  getTrending,
  getTrendingCreators,
};
