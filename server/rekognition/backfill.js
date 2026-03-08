'use strict';

/**
 * One-time backfill script: indexes all Friend_Photo rows that have no Rekognition_Face_Id yet.
 * Run from the server/ directory:
 *   node rekognition/backfill.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mysql = require('mysql2/promise');
const { indexFace, ensureCollection } = require('./client');

(async () => {
  const pool = await mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'crowdview',
  });

  try {
    await ensureCollection();

    const [rows] = await pool.execute(
      `SELECT fp.Friend_Photo_Id, fp.Friend_Id, fp.Photo_Data, fp.Photo_Mime_Type,
              f.User_Id
       FROM Friend_Photo fp
       JOIN Friend f ON fp.Friend_Id = f.Friend_Id
       WHERE fp.Rekognition_Face_Id IS NULL`
    );

    console.log(`Found ${rows.length} photos to backfill.`);

    let indexed = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const faceId = await indexFace(
          row.Photo_Data,
          row.User_Id,
          row.Friend_Id,
          row.Friend_Photo_Id
        );
        if (faceId) {
          await pool.execute(
            'UPDATE Friend_Photo SET Rekognition_Face_Id = ? WHERE Friend_Photo_Id = ?',
            [faceId, row.Friend_Photo_Id]
          );
          console.log(`✅ Indexed photo ${row.Friend_Photo_Id} → ${faceId}`);
          indexed++;
        } else {
          console.log(`⚠️  No face detected in photo ${row.Friend_Photo_Id} (skipping)`);
          skipped++;
        }
      } catch (err) {
        console.error(`❌ Error indexing photo ${row.Friend_Photo_Id}:`, err.message);
        skipped++;
      }
    }

    console.log(`\nBackfill complete: ${indexed} indexed, ${skipped} skipped.`);
  } finally {
    await pool.end();
  }
})().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
