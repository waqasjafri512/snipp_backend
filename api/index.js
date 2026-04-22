const app = require('../src/app');
const { createUsersTable } = require('../src/models/userModel');
const { createProfilesTable } = require('../src/models/profileModel');
const { createDareTables } = require('../src/models/dareModel');
const { createNotificationsTable } = require('../src/models/notificationModel');
const { createMessagesTable } = require('../src/models/messageModel');
const { createStreamsTable } = require('../src/models/streamModel');
const { createStoryTable } = require('../src/models/storyModel');

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
