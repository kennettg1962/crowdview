'use strict';

/**
 * Purges orphaned faces from the Rekognition collection —
 * faces that exist in AWS but have no matching Friend_Photo row in the DB.
 *
 * Run from the server/ directory:
 *   node rekognition/purge-orphans.js
 */

require('dotenv').config();
const { RekognitionClient, ListFacesCommand, DeleteFacesCommand } = require('@aws-sdk/client-rekognition');
const pool = require('../db/connection');

const COLLECTION_ID = process.env.REKOGNITION_COLLECTION_ID || 'crowdview-faces';

const client = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function listAllFaces() {
  const faces = [];
  let nextToken;
  do {
    const res = await client.send(new ListFacesCommand({
      CollectionId: COLLECTION_ID,
      MaxResults: 100,
      ...(nextToken && { NextToken: nextToken }),
    }));
    faces.push(...(res.Faces || []));
    nextToken = res.NextToken;
  } while (nextToken);
  return faces;
}

async function main() {
  console.log(`Listing all faces in collection: ${COLLECTION_ID}`);
  const awsFaces = await listAllFaces();
  console.log(`Found ${awsFaces.length} face(s) in AWS`);

  // Get all Rekognition_Face_Id values that exist in the DB
  const [rows] = await pool.execute('SELECT Rekognition_Face_Id FROM Friend_Photo WHERE Rekognition_Face_Id IS NOT NULL');
  const dbFaceIds = new Set(rows.map(r => r.Rekognition_Face_Id));
  console.log(`Found ${dbFaceIds.size} face(s) in DB`);

  const orphans = awsFaces.filter(f => !dbFaceIds.has(f.FaceId));
  console.log(`Found ${orphans.length} orphaned face(s) to delete`);

  if (orphans.length === 0) {
    console.log('Nothing to clean up.');
    process.exit(0);
  }

  orphans.forEach(f => console.log(`  - FaceId: ${f.FaceId}  ExternalImageId: ${f.ExternalImageId}`));

  const orphanIds = orphans.map(f => f.FaceId);
  // Delete in batches of 100 (AWS limit)
  for (let i = 0; i < orphanIds.length; i += 100) {
    const batch = orphanIds.slice(i, i + 100);
    await client.send(new DeleteFacesCommand({ CollectionId: COLLECTION_ID, FaceIds: batch }));
    console.log(`Deleted batch of ${batch.length}`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
