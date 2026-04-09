const mysql = require('mysql2/promise');
require('dotenv').config();

// Columns to add if they don't already exist
const alterations = [
  { table: 'User',         column: 'Password_Reset_Token',      definition: 'VARCHAR(255)' },
  { table: 'User',         column: 'Password_Reset_Expires',    definition: 'DATETIME' },
  { table: 'Friend_Photo', column: 'Rekognition_Face_Id',       definition: 'VARCHAR(255)' },
  { table: 'User',         column: 'Email_Verified_Fl',         definition: "CHAR(1) DEFAULT 'N'" },
  { table: 'User',         column: 'Email_Verify_Token_Txt',    definition: 'VARCHAR(255) NULL' },
  { table: 'User',         column: 'Email_Verify_Expires_Dt',   definition: 'DATETIME NULL' },
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crowdview'
  });
  try {
    for (const { table, column, definition } of alterations) {
      const [rows] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      if (rows[0].cnt === 0) {
        await conn.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`✅ Added ${table}.${column}`);
      } else {
        console.log(`ℹ️  ${table}.${column} already exists, skipping`);
      }
    }
    console.log('✅ DB migration complete');
  } finally {
    await conn.end();
  }
})().catch(err => { console.error('❌ Migration failed:', err.message); process.exit(1); });
