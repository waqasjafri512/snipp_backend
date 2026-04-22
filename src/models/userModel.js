const pool = require('../config/db');

// Create Users table if not exists
const createUsersTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(100),
      avatar_url TEXT DEFAULT NULL,
      bio TEXT DEFAULT '',
      category VARCHAR(100) DEFAULT NULL,
      website TEXT DEFAULT NULL,
      is_verified BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      fcm_token TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log('✅ Users table ready');
  } catch (error) {
    console.error('❌ Error creating users table:', error.message);
  }
};

// Find user by email
const findByEmail = async (email) => {
  const result = await pool.query('SELECT * FROM users WHERE TRIM(LOWER(email)) = TRIM(LOWER($1))', [email]);
  return result.rows[0];
};

// Find user by username
const findByUsername = async (username) => {
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0];
};

// Find user by ID
const findById = async (id) => {
  const result = await pool.query(
    'SELECT id, username, email, full_name, avatar_url, bio, category, website, is_verified, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

// Create new user
const createUser = async ({ username, email, password, full_name }) => {
  const result = await pool.query(
    `INSERT INTO users (username, email, password, full_name) 
     VALUES ($1, LOWER($2), $3, $4) 
     RETURNING id, username, email, full_name, avatar_url, bio, category, website, is_verified, created_at`,
    [username, email, password, full_name]
  );
  return result.rows[0];
};

// Update user profile
const updateUser = async (id, fields) => {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(id);
  
  const result = await pool.query(
    `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $${values.length} 
     RETURNING id, username, email, full_name, avatar_url, bio, category, website, is_verified, created_at`,
    values
  );
  return result.rows[0];
};

module.exports = {
  createUsersTable,
  findByEmail,
  findByUsername,
  findById,
  createUser,
  updateUser,
};
