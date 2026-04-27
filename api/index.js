const app = require('../src/app');
const { createUsersTable } = require('../src/models/userModel');
const { createProfilesTable } = require('../src/models/profileModel');
const { createDareTables } = require('../src/models/dareModel');
const { createNotificationsTable } = require('../src/models/notificationModel');
const { createMessagesTable } = require('../src/models/messageModel');
const { createStreamsTable } = require('../src/models/streamModel');
const { createStoryTable } = require('../src/models/storyModel');
const { createBlockedTable } = require('../src/models/blockedModel');
const { createGroupsTable } = require('../src/models/groupModel');
const pool = require('../src/config/db');

// Initialize DB tables (This might be slow on cold starts, but ensures tables exist)
let isDbInitialized = false;

const initDb = async () => {
  if (isDbInitialized) return;
  try {
    await createUsersTable();
    await createProfilesTable();
    await createDareTables();
    await createNotificationsTable();
    await createMessagesTable();
    await createStreamsTable();
    await createStoryTable();
    await createBlockedTable();
    await createGroupsTable();

    // Migrations
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE`);
    await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
    await pool.query(`ALTER TABLE stories ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0`);
    
    // Group Chat Support
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL`);

    isDbInitialized = true;
    console.log('✅ Vercel DB Initialized');
  } catch (error) {
    console.error('❌ Vercel DB Init Error:', error.message);
  }
};

// Middleware to ensure DB is ready
app.use(async (req, res, next) => {
  await initDb();
  next();
});

module.exports = app;
