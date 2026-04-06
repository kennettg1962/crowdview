'use strict';

const {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
  DeleteFacesCommand,
  DetectFacesCommand,
  SearchFacesByImageCommand,
} = require('@aws-sdk/client-rekognition');

const COLLECTION_ID = process.env.REKOGNITION_COLLECTION_ID || 'crowdview-faces';

const client = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Create the Rekognition collection if it doesn't exist yet.
 * Safe to call on every startup — ignores ResourceAlreadyExistsException.
 */
async function ensureCollection() {
  try {
    await client.send(new CreateCollectionCommand({ CollectionId: COLLECTION_ID }));
    console.log(`✅ Rekognition collection created: ${COLLECTION_ID}`);
  } catch (err) {
    if (err.name === 'ResourceAlreadyExistsException') {
      console.log(`ℹ️  Rekognition collection already exists: ${COLLECTION_ID}`);
    } else {
      throw err;
    }
  }
}

/**
 * Index a single face image into the collection.
 * @param {Buffer} buf - Image buffer (JPEG/PNG)
 * @param {number} userId
 * @param {number} friendId
 * @param {number} photoId
 * @returns {string|null} FaceId assigned by Rekognition, or null if no face detected
 */
async function indexFace(buf, userId, friendId, photoId) {
  const externalImageId = `u${userId}_f${friendId}_p${photoId}`;
  const result = await client.send(new IndexFacesCommand({
    CollectionId: COLLECTION_ID,
    Image: { Bytes: buf },
    ExternalImageId: externalImageId,
    MaxFaces: 1,
    QualityFilter: 'AUTO',
    DetectionAttributes: [],
  }));
  const record = result.FaceRecords && result.FaceRecords[0];
  return record ? record.Face.FaceId : null;
}

/**
 * Remove faces from the collection by their Rekognition FaceIds.
 * @param {string[]} faceIds
 */
async function deleteFaces(faceIds) {
  if (!faceIds || faceIds.length === 0) return;
  await client.send(new DeleteFacesCommand({
    CollectionId: COLLECTION_ID,
    FaceIds: faceIds,
  }));
}

/**
 * Detect all faces in an image and return their bounding boxes.
 * @param {Buffer} buf
 * @returns {Array<{BoundingBox, Confidence}>}
 */
async function detectFaces(buf) {
  const result = await client.send(new DetectFacesCommand({
    Image: { Bytes: buf },
    Attributes: ['ALL'],
  }));
  return result.FaceDetails || [];
}

/**
 * Search the collection for a matching face in the provided image crop.
 * @param {Buffer} buf - Cropped face image buffer
 * @returns {Array} FaceMatches array from Rekognition
 */
async function searchFace(buf) {
  try {
    const result = await client.send(new SearchFacesByImageCommand({
      CollectionId: COLLECTION_ID,
      Image: { Bytes: buf },
      MaxFaces: 5,
      FaceMatchThreshold: 70,
    }));
    return result.FaceMatches || [];
  } catch (err) {
    // InvalidParameterException means no face detected in crop — return empty
    if (err.name === 'InvalidParameterException') return [];
    throw err;
  }
}

/**
 * Index an employee face into the collection.
 * ExternalImageId format: org{orgId}_emp{employeeId}_p{photoId}
 */
async function indexEmployeeFace(buf, orgId, employeeId, photoId) {
  const externalImageId = `org${orgId}_emp${employeeId}_p${photoId}`;
  const result = await client.send(new IndexFacesCommand({
    CollectionId: COLLECTION_ID,
    Image: { Bytes: buf },
    ExternalImageId: externalImageId,
    MaxFaces: 1,
    QualityFilter: 'AUTO',
    DetectionAttributes: [],
  }));
  const record = result.FaceRecords && result.FaceRecords[0];
  return record ? record.Face.FaceId : null;
}

// deleteSubject — no-op for AWS Rekognition (faces are deleted by faceId via deleteFaces)
async function deleteSubject(_subject) {}

module.exports = { ensureCollection, indexFace, indexEmployeeFace, deleteFaces, deleteSubject, detectFaces, searchFace };
