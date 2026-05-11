#!/usr/bin/env node
/**
 * Replace https://YOUR_FASTAPI_BACKEND_HOST in vercel.json with VERCEL_BACKEND_URL
 * or the first CLI argument. Example:
 *   VERCEL_BACKEND_URL=https://my-api.onrender.com node scripts/patch-vercel-backend.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const file = path.join(root, 'vercel.json');
let url = (process.env.VERCEL_BACKEND_URL || process.argv[2] || '').trim().replace(/\/$/, '');
if (!url) {
  console.error('Usage: VERCEL_BACKEND_URL=https://origin.example.com node scripts/patch-vercel-backend.js');
  process.exit(1);
}
if (!/^https:\/\//i.test(url)) {
  console.error('VERCEL_BACKEND_URL must start with https://');
  process.exit(1);
}

let text = fs.readFileSync(file, 'utf8');
if (!text.includes('YOUR_FASTAPI_BACKEND_HOST')) {
  console.log('vercel.json: placeholder already replaced — nothing to do.');
  process.exit(0);
}
text = text.replace(/https:\/\/YOUR_FASTAPI_BACKEND_HOST/g, url);
fs.writeFileSync(file, text, 'utf8');
console.log('Updated vercel.json with backend', url);
