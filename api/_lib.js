const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PDF_DIR = path.join(process.cwd(), 'pdfs');

// Optional S3 setup
let s3Client = null;
let S3_BUCKET = process.env.S3_BUCKET || null;
if (process.env.AWS_REGION && S3_BUCKET) {
  const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  s3Client = new S3Client({ region: process.env.AWS_REGION });
  module.exports._s3 = { s3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, getSignedUrl };
}

function listLocalPDFs() {
  try {
    if (!fs.existsSync(PDF_DIR)) return [];
    return fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  } catch (e) {
    console.error('listLocalPDFs error', e);
    return [];
  }
}

async function listS3PDFs() {
  if (!s3Client || !S3_BUCKET) return [];
  try {
    const { ListObjectsV2Command } = module.exports._s3;
    const data = await s3Client.send(new ListObjectsV2Command({ Bucket: S3_BUCKET }));
    return (data.Contents || []).map(o => o.Key).filter(k => k.toLowerCase().endsWith('.pdf'));
  } catch (e) {
    console.error('listS3PDFs error', e);
    return [];
  }
}

async function getAllPDFs() {
  const local = listLocalPDFs();
  const s3 = await listS3PDFs();
  return Array.from(new Set([...local, ...s3]));
}

function safeFilename(name) {
  // basic sanitization
  if (!name) return '';
  return path.basename(name);
}

async function presignPutUrl(filename, contentType) {
  if (!s3Client || !S3_BUCKET) throw new Error('S3 not configured');
  const { PutObjectCommand, getSignedUrl } = module.exports._s3;
  const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: filename, ContentType: contentType || 'application/pdf' });
  return await getSignedUrl(s3Client, cmd, { expiresIn: 60 * 5 });
}

async function presignGetUrl(filename) {
  if (!s3Client || !S3_BUCKET) throw new Error('S3 not configured');
  const { GetObjectCommand, getSignedUrl } = module.exports._s3;
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: filename });
  return await getSignedUrl(s3Client, cmd, { expiresIn: 60 });
}

async function putBase64ToS3(filename, base64) {
  if (!s3Client || !S3_BUCKET) throw new Error('S3 not configured');
  const { PutObjectCommand } = module.exports._s3;
  const buffer = Buffer.from(base64, 'base64');
  await s3Client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: filename, Body: buffer, ContentType: 'application/pdf' }));
}

module.exports = {
  PDF_DIR,
  listLocalPDFs,
  listS3PDFs,
  getAllPDFs,
  safeFilename,
  presignPutUrl,
  presignGetUrl,
  putBase64ToS3,
  s3Client,
  S3_BUCKET
};
