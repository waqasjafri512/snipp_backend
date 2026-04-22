const pool = require('./src/config/db');

const migrate = async () => {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS website TEXT DEFAULT NULL;
    `);
    console.log('✅ Migration successful: Added category and website columns to users table');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
};

migrate();
