const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../config/default');
const logger = require('../utils/logger');

// Neon SSL talab qiladi; lokal (localhost) baza uchun SSL o'chiriladi
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(config.db.url);

const pool = new Pool({
  connectionString: config.db.url,
  ssl: isLocal ? false : { rejectUnauthorized: true },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => logger.error(`PostgreSQL pool xatosi: ${err.message}`));

const query = (text, params) => pool.query(text, params);

/** Tranzaksiya ichida callback ishlatish: withTransaction(async (client) => {...}) */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function checkConnection() {
  const { rows } = await pool.query('SELECT NOW() AS now');
  logger.info(`PostgreSQL ulandi (${rows[0].now.toISOString()})`);
}

/** schema.sql ni bazada ishga tushiradi (idempotent, mavjud ma'lumot o'chmaydi) */
async function applySchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  logger.info('Schema muvaffaqiyatli qo\'llandi');
}

/** npm run db:init */
async function initSchema() {
  await applySchema();
  await pool.end();
}

module.exports = { pool, query, withTransaction, checkConnection, applySchema, initSchema };
