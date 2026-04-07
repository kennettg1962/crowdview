'use strict';

const fetch = require('node-fetch');
const sharp = require('sharp');

const BASE_URL       = process.env.COMPREFACE_URL || 'http://localhost:8000';
const DETECT_KEY     = process.env.COMPREFACE_DETECT_KEY || '';
const RECOGNIZE_KEY  = process.env.COMPREFACE_RECOGNIZE_KEY || '';

const DETECT_URL    = `${BASE_URL}/api/v1/detection/detect`;
const RECOGNIZE_URL = `${BASE_URL}/api/v1/recognition/faces`;
const VERIFY_URL    = `${BASE_URL}/api/v1/recognition/recognize`;

// ---------------------------------------------------------------------------
// ensureCollection — no-op for CompreFace (subjects are created on first index)
// ---------------------------------------------------------------------------
async function ensureCollection() {
  console.log('ℹ️  CompreFace provider active — no collection setup required');
}

// ---------------------------------------------------------------------------
// indexFace — add a face to a CompreFace subject
// Subject name convention: u{userId}_f{friendId}
// ---------------------------------------------------------------------------
async function indexFace(buf, userId, friendId, photoId) {
  const subject = `u${userId}_f${friendId}_p${photoId}`;
  const form = new (require('form-data'))();
  form.append('file', buf, { filename: 'photo.jpg', contentType: 'image/jpeg' });

  const res = await fetch(
    `${RECOGNIZE_URL}?subject=${encodeURIComponent(subject)}`,
    {
      method: 'POST',
      headers: { 'x-api-key': RECOGNIZE_KEY, ...form.getHeaders() },
      body: form,
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CompreFace indexFace failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.image_id || null;
}

// ---------------------------------------------------------------------------
// deleteFaces — remove faces by their CompreFace image_ids
// ---------------------------------------------------------------------------
async function deleteFaces(faceIds) {
  if (!faceIds || faceIds.length === 0) return;
  await Promise.all(faceIds.map(id =>
    fetch(`${RECOGNIZE_URL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-api-key': RECOGNIZE_KEY },
    })
  ));
}

// ---------------------------------------------------------------------------
// detectFaces — detect faces and return Rekognition-compatible structure
// ---------------------------------------------------------------------------
async function detectFaces(buf) {
  // Get actual image dimensions for correct normalization
  const meta = await sharp(buf).metadata();
  const imgW = meta.width;
  const imgH = meta.height;

  const form = new (require('form-data'))();
  form.append('file', buf, { filename: 'photo.jpg', contentType: 'image/jpeg' });

  const res = await fetch(
    `${DETECT_URL}?face_plugins=age,gender,emotion,mask`,
    {
      method: 'POST',
      headers: { 'x-api-key': DETECT_KEY, ...form.getHeaders() },
      body: form,
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CompreFace detectFaces failed: ${res.status} ${text}`);
  }
  const data = await res.json();

  // Normalise to Rekognition-compatible shape
  return (data.result || []).map(face => {
    const box = face.box; // { x_min, y_min, x_max, y_max, probability }
    const age     = face.age;
    const gender  = face.gender;
    const emotion = face.emotion;
    const mask    = face.mask;

    return {
      BoundingBox: {
        Left:   box.x_min / imgW,
        Top:    box.y_min / imgH,
        Width:  (box.x_max - box.x_min) / imgW,
        Height: (box.y_max - box.y_min) / imgH,
      },
      Confidence: (box.probability || 0.9) * 100,
      AgeRange:   age    ? { Low: Math.max(0, age.low  || age - 5), High: age.high || age + 5 } : null,
      Gender:     gender ? { Value: gender.value?.charAt(0).toUpperCase() + gender.value?.slice(1).toLowerCase() } : null,
      Emotions:   emotion
        ? Object.entries(emotion.emotion || emotion)
            .filter(([, v]) => typeof v === 'number')
            .map(([type, confidence]) => ({ Type: type.toUpperCase(), Confidence: confidence * 100 }))
            .sort((a, b) => b.Confidence - a.Confidence)
        : [],
      Mask:        mask ? { Value: mask.value === true, Confidence: (mask.probability || 0) * 100 } : null,
      Smile:       { Value: false },
      Eyeglasses:  { Value: false },
      Sunglasses:  { Value: false },
      Beard:       { Value: false },
    };
  });
}

// ---------------------------------------------------------------------------
// searchFace — search recognition service for matching subject
// Returns Rekognition-compatible FaceMatches array
// ---------------------------------------------------------------------------
async function searchFace(buf) {
  const form = new (require('form-data'))();
  form.append('file', buf, { filename: 'face.jpg', contentType: 'image/jpeg' });

  const res = await fetch(
    `${VERIFY_URL}?limit=1&prediction_count=20&det_prob_threshold=0.75`,
    {
      method: 'POST',
      headers: { 'x-api-key': RECOGNIZE_KEY, ...form.getHeaders() },
      body: form,
    }
  );
  if (!res.ok) return []; // no face or error → no matches

  const data = await res.json();
  const results = data.result?.[0]?.subjects || [];

  // Return all candidates above a low floor — the route applies per-context thresholds
  return results
    .filter(s => s.similarity >= 0.65)
    .map(s => ({
      Similarity: s.similarity * 100,
      Face: {
        FaceId:          s.subject,
        ExternalImageId: s.subject,
      },
    }));
}

// ---------------------------------------------------------------------------
// indexEmployeeFace — add an employee face to the CompreFace collection
// Subject name convention: org{orgId}_emp{employeeId}_p{photoId}
// ---------------------------------------------------------------------------
async function indexEmployeeFace(buf, orgId, employeeId, photoId) {
  const subject = `org${orgId}_emp${employeeId}_p${photoId}`;
  const form = new (require('form-data'))();
  form.append('file', buf, { filename: 'photo.jpg', contentType: 'image/jpeg' });
  const res = await fetch(
    `${RECOGNIZE_URL}?subject=${encodeURIComponent(subject)}`,
    {
      method: 'POST',
      headers: { 'x-api-key': RECOGNIZE_KEY, ...form.getHeaders() },
      body: form,
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CompreFace indexEmployeeFace failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.image_id || null;
}

// ---------------------------------------------------------------------------
// deleteSubject — remove all indexed faces for a given subject name
// ---------------------------------------------------------------------------
async function deleteSubject(subject) {
  const SUBJECTS_URL = `${BASE_URL}/api/v1/recognition/subjects`;
  await fetch(`${SUBJECTS_URL}/${encodeURIComponent(subject)}`, {
    method: 'DELETE',
    headers: { 'x-api-key': RECOGNIZE_KEY },
  });
}

module.exports = { ensureCollection, indexFace, indexEmployeeFace, deleteFaces, deleteSubject, detectFaces, searchFace };
