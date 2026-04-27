const pool = require('../config/db');

const createGroupsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT DEFAULT '',
      avatar_url TEXT DEFAULT NULL,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, user_id)
    );
  `;
  try {
    await pool.query(query);
    console.log('✅ Groups & Group Members tables ready');
  } catch (error) {
    console.error('❌ Error creating group tables:', error.message);
  }
};

const createGroup = async (name, creatorId, description = '', avatarUrl = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const groupResult = await client.query(
      'INSERT INTO groups (name, creator_id, description, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, creatorId, description, avatarUrl]
    );
    
    const groupId = groupResult.rows[0].id;
    
    await client.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
      [groupId, creatorId, 'admin']
    );
    
    await client.query('COMMIT');
    return groupResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const addMember = async (groupId, userId, role = 'member') => {
  const result = await pool.query(
    'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *',
    [groupId, userId, role]
  );
  return result.rows[0];
};

const getGroupMembers = async (groupId) => {
  const result = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url, gm.role, gm.joined_at 
     FROM group_members gm 
     JOIN users u ON gm.user_id = u.id 
     WHERE gm.group_id = $1`,
    [groupId]
  );
  return result.rows;
};

const getUserGroups = async (userId) => {
  const result = await pool.query(
    `SELECT g.*, gm.role, 
      (SELECT content FROM messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_time
     FROM groups g 
     JOIN group_members gm ON g.id = gm.group_id 
     WHERE gm.user_id = $1
     ORDER BY last_message_time DESC NULLS LAST`,
    [userId]
  );
  return result.rows;
};

const getGroupMessages = async (groupId, limit = 50, offset = 0) => {
  const result = await pool.query(
    `SELECT m.*, u.username, u.avatar_url 
     FROM messages m 
     JOIN users u ON m.sender_id = u.id 
     WHERE m.group_id = $1 
     ORDER BY m.created_at DESC 
     LIMIT $2 OFFSET $3`,
    [groupId, limit, offset]
  );
  return result.rows;
};

module.exports = {
  createGroupsTable,
  createGroup,
  addMember,
  getGroupMembers,
  getUserGroups,
  getGroupMessages
};
