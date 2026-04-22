const pool = require('../config/db');

// Create Dares, Likes, Comments tables
const createDareTables = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      icon VARCHAR(10) DEFAULT '🎯',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO categories (name, icon) VALUES 
      ('Physical', '💪'), ('Mental', '🧠'), ('Social', '🗣️'),
      ('Creative', '🎨'), ('Food', '🍔'), ('Adventure', '🏔️'),
      ('Funny', '😂'), ('Skill', '🎯'), ('Other', '📦')
    ON CONFLICT (name) DO NOTHING;

    CREATE TABLE IF NOT EXISTS dares (
      id SERIAL PRIMARY KEY,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) DEFAULT NULL,
      difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'legendary')),
      media_url TEXT DEFAULT NULL,
      media_type VARCHAR(10) DEFAULT NULL CHECK (media_type IN ('image', 'video', NULL)),
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      accepts_count INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS likes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dare_id INTEGER NOT NULL REFERENCES dares(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, dare_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dare_id INTEGER NOT NULL REFERENCES dares(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE DEFAULT NULL,
      content TEXT NOT NULL,
      likes_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, comment_id)
    );

    CREATE TABLE IF NOT EXISTS dare_accepts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dare_id INTEGER NOT NULL REFERENCES dares(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'accepted' CHECK (status IN ('accepted', 'in_progress', 'completed', 'failed')),
      proof_url TEXT DEFAULT NULL,
      completed_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, dare_id)
    );

    -- Ensure missing columns exist in existing tables
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='parent_id') THEN
        ALTER TABLE comments ADD COLUMN parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE DEFAULT NULL;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='likes_count') THEN
        ALTER TABLE comments ADD COLUMN likes_count INTEGER DEFAULT 0;
      END IF;
    END $$;
  `;
  try {
    await pool.query(query);
    console.log('✅ Dares, Likes, Comments, Accepts tables ready');
  } catch (error) {
    console.error('❌ Error creating dare tables:', error.message);
  }
};

// Create a dare
const createDare = async ({ creator_id, title, description, category_id, difficulty, media_url, media_type }) => {
  const result = await pool.query(
    `INSERT INTO dares (creator_id, title, description, category_id, difficulty, media_url, media_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [creator_id, title, description, category_id || null, difficulty || 'medium', media_url || null, media_type || null]
  );

  // Increment user's dares_posted count
  await pool.query(
    'UPDATE profiles SET dares_posted = dares_posted + 1 WHERE user_id = $1',
    [creator_id]
  );

  return result.rows[0];
};

// Get feed with pagination
const getFeed = async (userId, limit = 10, offset = 0) => {
  const query = `
    (
      SELECT d.*, 
             u.username AS creator_username, 
             u.full_name AS creator_name,
             u.avatar_url AS creator_avatar,
             u.is_verified AS creator_verified,
             c.name AS category_name,
             c.icon AS category_icon,
             EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND dare_id = d.id) AS is_liked,
             EXISTS(SELECT 1 FROM dare_accepts WHERE user_id = $1 AND dare_id = d.id) AS is_accepted,
             EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = d.creator_id) AS is_following_creator,
             'dare' as post_type,
             NULL as solver_id,
             NULL as solver_username,
             NULL as solver_avatar,
             false as is_following_solver
      FROM dares d
      JOIN users u ON d.creator_id = u.id
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE d.is_active = true
    )
    UNION ALL
    (
      SELECT d.id, d.creator_id, d.title, d.description, d.category_id, d.difficulty, 
             da.proof_url as media_url, 'video' as media_type,
             d.likes_count, d.comments_count, d.accepts_count, d.is_active, 
             da.completed_at as created_at, d.updated_at,
             u.username AS creator_username, 
             u.full_name AS creator_name,
             u.avatar_url AS creator_avatar,
             u.is_verified AS creator_verified,
             c.name AS category_name,
             c.icon AS category_icon,
             EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND dare_id = d.id) AS is_liked,
             true AS is_accepted,
             EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = d.creator_id) AS is_following_creator,
             'completion' as post_type,
             da.user_id as solver_id,
             us.username as solver_username,
             us.avatar_url as solver_avatar,
             EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = da.user_id) AS is_following_solver
      FROM dare_accepts da
      JOIN dares d ON da.dare_id = d.id
      JOIN users u ON d.creator_id = u.id
      JOIN users us ON da.user_id = us.id
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE da.status = 'completed'
    )
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const result = await pool.query(query, [userId, limit, offset]);
  return result.rows;
};

// Get single dare by ID
const getDareById = async (dareId, userId) => {
  const result = await pool.query(
    `SELECT d.*, 
            u.username AS creator_username, 
            u.full_name AS creator_name,
            u.avatar_url AS creator_avatar,
            u.is_verified AS creator_verified,
            c.name AS category_name,
            c.icon AS category_icon,
            EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND dare_id = d.id) AS is_liked,
            EXISTS(SELECT 1 FROM dare_accepts WHERE user_id = $1 AND dare_id = d.id) AS is_accepted
     FROM dares d
     JOIN users u ON d.creator_id = u.id
     LEFT JOIN categories c ON d.category_id = c.id
     WHERE d.id = $2`,
    [userId, dareId]
  );
  return result.rows[0];
};

// Delete dare
const deleteDare = async (dareId, userId) => {
  const result = await pool.query(
    'DELETE FROM dares WHERE id = $1 AND creator_id = $2 RETURNING id',
    [dareId, userId]
  );
  if (result.rowCount > 0) {
    await pool.query(
      'UPDATE profiles SET dares_posted = GREATEST(dares_posted - 1, 0) WHERE user_id = $1',
      [userId]
    );
  }
  return result.rowCount > 0;
};

// Update dare
const updateDare = async (dareId, userId, { title, description, category_id, difficulty }) => {
  const result = await pool.query(
    `UPDATE dares 
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         category_id = COALESCE($3, category_id),
         difficulty = COALESCE($4, difficulty),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5 AND creator_id = $6
     RETURNING *`,
    [title, description, category_id, difficulty, dareId, userId]
  );
  return result.rows[0];
};

// Like a dare
const likeDare = async (dareId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO likes (user_id, dare_id) VALUES ($1, $2)',
      [userId, dareId]
    );
    await client.query(
      'UPDATE dares SET likes_count = likes_count + 1 WHERE id = $1',
      [dareId]
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return false; // Already liked
    throw error;
  } finally {
    client.release();
  }
};

// Unlike a dare
const unlikeDare = async (dareId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'DELETE FROM likes WHERE user_id = $1 AND dare_id = $2',
      [userId, dareId]
    );
    if (result.rowCount > 0) {
      await client.query(
        'UPDATE dares SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
        [dareId]
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

// Add comment
const addComment = async (dareId, userId, content, parentId = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO comments (user_id, dare_id, content, parent_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, dareId, content, parentId]
    );
    await client.query(
      'UPDATE dares SET comments_count = comments_count + 1 WHERE id = $1',
      [dareId]
    );

    const commentResult = await client.query(
      `SELECT cm.*, u.username, u.full_name, u.avatar_url, u.is_verified
       FROM comments cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.id = $1`,
      [result.rows[0].id]
    );

    await client.query('COMMIT');
    return commentResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get comments for a dare
const getComments = async (dareId, userId, limit = 20, offset = 0) => {
  const result = await pool.query(
    `SELECT cm.*, u.username, u.full_name, u.avatar_url, u.is_verified,
            EXISTS(SELECT 1 FROM comment_likes WHERE user_id = $1 AND comment_id = cm.id) AS is_liked
     FROM comments cm
     JOIN users u ON cm.user_id = u.id
     WHERE cm.dare_id = $2
     ORDER BY cm.created_at ASC
     LIMIT $3 OFFSET $4`,
    [userId, dareId, limit, offset]
  );
  return result.rows;
};

// Toggle comment like
const toggleCommentLike = async (commentId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const checkLike = await client.query(
      'SELECT id FROM comment_likes WHERE user_id = $1 AND comment_id = $2',
      [userId, commentId]
    );

    let liked = false;
    if (checkLike.rows.length > 0) {
      await client.query(
        'DELETE FROM comment_likes WHERE id = $1',
        [checkLike.rows[0].id]
      );
      await client.query(
        'UPDATE comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
        [commentId]
      );
    } else {
      await client.query(
        'INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2)',
        [userId, commentId]
      );
      await client.query(
        'UPDATE comments SET likes_count = likes_count + 1 WHERE id = $1',
        [commentId]
      );
      liked = true;
    }

    await client.query('COMMIT');
    return { liked };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Accept a dare
const acceptDare = async (dareId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO dare_accepts (user_id, dare_id) 
       VALUES ($1, $2) RETURNING *`,
      [userId, dareId]
    );
    await client.query(
      'UPDATE dares SET accepts_count = accepts_count + 1 WHERE id = $1',
      [dareId]
    );
    await client.query(
      'UPDATE profiles SET dares_accepted = dares_accepted + 1 WHERE user_id = $1',
      [userId]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return null; // Already accepted
    throw error;
  } finally {
    client.release();
  }
};

// Complete a dare
const completeDare = async (dareId, userId, proofUrl) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE dare_accepts SET status = 'completed', proof_url = $3, completed_at = CURRENT_TIMESTAMP
       WHERE dare_id = $1 AND user_id = $2 AND status != 'completed'
       RETURNING *`,
      [dareId, userId, proofUrl]
    );
    if (result.rowCount > 0) {
      await client.query(
        'UPDATE profiles SET dares_completed = dares_completed + 1 WHERE user_id = $1',
        [userId]
      );
    }
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get user's dares
const getUserDares = async (userId, limit = 10, offset = 0) => {
  const result = await pool.query(
    `SELECT d.*, c.name AS category_name, c.icon AS category_icon
     FROM dares d
     LEFT JOIN categories c ON d.category_id = c.id
     WHERE d.creator_id = $1 AND d.is_active = true
     ORDER BY d.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
};

// Get dares user participated in
const getParticipatedDares = async (userId, limit = 10, offset = 0) => {
  const result = await pool.query(
    `SELECT d.*, c.name AS category_name, c.icon AS category_icon, da.status, da.proof_url
     FROM dares d
     JOIN dare_accepts da ON d.id = da.dare_id
     LEFT JOIN categories c ON d.category_id = c.id
     WHERE da.user_id = $1
     ORDER BY da.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
};

// Get categories
const getCategories = async () => {
  const result = await pool.query('SELECT * FROM categories ORDER BY name');
  return result.rows;
};

module.exports = {
  createDareTables,
  createDare,
  getFeed,
  getDareById,
  deleteDare,
  updateDare,
  likeDare,
  unlikeDare,
  addComment,
  getComments,
  toggleCommentLike,
  acceptDare,
  completeDare,
  getUserDares,
  getParticipatedDares,
  getCategories,
};
