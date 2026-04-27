const pool = require('../config/db');
const crypto = require('crypto');

const createVerificationToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await pool.query(
    'UPDATE users SET verification_token = $1, verification_expires = $2 WHERE id = $3',
    [token, expires, userId]
  );
  return token;
};

const verifyEmail = async (token) => {
  const result = await pool.query(
    'SELECT id FROM users WHERE verification_token = $1 AND verification_expires > CURRENT_TIMESTAMP',
    [token]
  );

  if (result.rows.length === 0) return false;

  const userId = result.rows[0].id;
  await pool.query(
    'UPDATE users SET is_verified = true, verification_token = NULL, verification_expires = NULL WHERE id = $1',
    [userId]
  );
  return true;
};

const createResetToken = async (email) => {
  const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (userResult.rows.length === 0) return null;

  const userId = userResult.rows[0].id;
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

  await pool.query(
    'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
    [token, expires, userId]
  );
  return token;
};

const resetPassword = async (token, newPasswordHash) => {
  const result = await pool.query(
    'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > CURRENT_TIMESTAMP',
    [token]
  );

  if (result.rows.length === 0) return false;

  const userId = result.rows[0].id;
  await pool.query(
    'UPDATE users SET password = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
    [newPasswordHash, userId]
  );
  return true;
};

module.exports = {
  createVerificationToken,
  verifyEmail,
  createResetToken,
  resetPassword
};
