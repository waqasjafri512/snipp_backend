const pool = require('./src/config/db');

async function checkUsers() {
  try {
    const res = await pool.query('SELECT username, email FROM users');
    console.log('Existing Users:');
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    process.exit(1);
  }
}

checkUsers();
