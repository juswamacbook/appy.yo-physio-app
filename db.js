/**
 * Shared DB pool configuration.
 */
require('dotenv').config();
const mysql = require('mysql2');

const hasDatabaseUrl = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim().length > 0;

const poolConfig = hasDatabaseUrl
  ? process.env.DATABASE_URL
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'physio',
      port: Number(process.env.DB_PORT || 3306),
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
      queueLimit: 0
    };

const pool = mysql.createPool(poolConfig);

if (hasDatabaseUrl) {
  console.log('[DB] Connected via DATABASE_URL');
} else {
  console.log(
    `[DB] host=${poolConfig.host} user=${poolConfig.user} db=${poolConfig.database} port=${poolConfig.port}`
  );
}

module.exports = pool.promise();
