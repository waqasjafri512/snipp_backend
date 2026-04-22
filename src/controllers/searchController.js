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
    // Search Users
    const usersResult = await pool.query(
      `SELECT id, username, full_name, avatar_url,
              EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = users.id) AS is_following
       FROM users 
       WHERE username ILIKE $2 OR full_name ILIKE $2
       LIMIT 10`,
      [userId, queryStr]
    );

    // Search Dares
    const daresResult = await pool.query(
      `SELECT d.*, u.username AS creator_username, u.avatar_url AS creator_avatar,
              EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND dare_id = d.id) AS is_liked
       FROM dares d
       JOIN users u ON d.creator_id = u.id
       WHERE d.title ILIKE $2 OR d.description ILIKE $2
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
      `SELECT d.*, u.username AS creator_username, u.avatar_url AS creator_avatar,
              EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND dare_id = d.id) AS is_liked,
              (d.likes_count + d.accepts_count * 2) as trend_score
       FROM dares d
       JOIN users u ON d.creator_id = u.id
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

module.exports = {
  globalSearch,
  getTrending,
};
