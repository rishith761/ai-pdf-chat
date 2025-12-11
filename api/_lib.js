const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PDF_DIR = path.join(process.cwd(), 'pdfs');

// S3 setup lazily on first use (Vercel env vars may not be available at module load time)
let s3Client = null;
let s3Modules = null;

function initS3() {
  if (s3Client) return true; // already initialized
  if (!process.env.AWS_REGION || !process.env.S3_BUCKET) return false; // not configured
  
  try {
    const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    s3Client = new S3Client({ region: process.env.AWS_REGION });
    s3Modules = { PutObjectCommand, GetObjectCommand, ListObjectsV2Command, getSignedUrl };
    console.log('S3 initialized:', process.env.AWS_REGION, process.env.S3_BUCKET);
    return true;
  } catch (e) {
    console.error('S3 init error:', e.message);
    return false;
  }
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
  if (!initS3()) return [];
  try {
    const { ListObjectsV2Command } = s3Modules;
    const data = await s3Client.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET }));
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
  if (!initS3()) throw new Error('S3 not configured');
  const { PutObjectCommand, getSignedUrl } = s3Modules;
  const cmd = new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: filename, ContentType: contentType || 'application/pdf' });
  return await getSignedUrl(s3Client, cmd, { expiresIn: 60 * 5 });
}

async function presignGetUrl(filename) {
  if (!initS3()) throw new Error('S3 not configured');
  const { GetObjectCommand, getSignedUrl } = s3Modules;
  const cmd = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: filename });
  return await getSignedUrl(s3Client, cmd, { expiresIn: 60 });
}

async function putBase64ToS3(filename, base64) {
  if (!initS3()) throw new Error('S3 not configured');
  const { PutObjectCommand } = s3Modules;
  const buffer = Buffer.from(base64, 'base64');
  await s3Client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: filename, Body: buffer, ContentType: 'application/pdf' }));
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
  s3Client: () => s3Client,
  S3_BUCKET: () => process.env.S3_BUCKET,
  initS3
};
