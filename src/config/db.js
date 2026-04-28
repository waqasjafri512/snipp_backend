const { Pool } = require('pg');
require('dotenv').config();

const isProduction = !!process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 20,
  min: 5, // Increased min connections
  idleTimeoutMillis: 60000, // 1 minute
  connectionTimeoutMillis: 10000, // 10 seconds
});

// Handle unexpected errors on idle clients
pool.on('error', (err) => {
  console.error('❌ Unexpected pool error on idle client:', err.message);
});

// Resilient query wrapper with 1 retry for transient connection errors
pool.queryResilient = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (err.message.includes('Connection terminated unexpectedly') || err.message.includes('terminating connection due to idle timeout')) {
      console.warn('⚠️ Database connection lost. Retrying query...');
      return await pool.query(text, params);
    }
    throw err;
  }
};

// Log connection success on first query
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Database connected successfully!'))
  .catch(err => console.error('❌ Database connection failed:', err.message));

module.exports = pool;