'use strict';

const provider = process.env.FACE_PROVIDER || 'rekognition';

let impl;
if (provider === 'compreface') {
  impl = require('./compreface');
  console.log('🔍 Face provider: CompreFace');
} else {
  impl = require('./rekognition');
  console.log('🔍 Face provider: AWS Rekognition');
}

module.exports = impl;
