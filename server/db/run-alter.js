const mysql = require('mysql2/promise');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crowdview',
    multipleStatements: true
  });
  try {
    const sql = await fs.readFile(path.join(__dirname, 'alter.sql'), 'utf8');
    await conn.query(sql);
    console.log('✅ alter.sql applied successfully');
  } finally {
    await conn.end();
  }
})().catch(err => { console.error('❌ Migration failed:', err.message); process.exit(1); });
