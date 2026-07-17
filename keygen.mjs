#!/usr/bin/env node

import { createCipheriv, createHash } from 'crypto';
import { createInterface } from 'readline';

const SECRET_KEY = 'p0s-1nstallm3nt-3rp-s3cr3t-k3y-2024!@#';

function encrypt(text) {
  const key = createHash('sha256').update(SECRET_KEY).digest('hex').substring(0, 32);
  const iv = createHash('md5').update(SECRET_KEY).digest('hex').substring(0, 16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function generateLicenseKey(days) {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  const data = JSON.stringify({
    exp: expiry.toISOString(),
    iss: new Date().toISOString(),
  });
  const encrypted = encrypt(data);
  return encrypted.match(/.{1,5}/g)?.join('-')?.toUpperCase() || encrypted;
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('=== POS License Key Generator ===\n');
console.log('Duration options:');
console.log('  1  -> 1 month  (30 days)');
console.log('  2  -> 2 months (60 days)');
console.log('  3  -> 3 months (90 days)');
console.log('  6  -> 6 months (180 days)');
console.log('  12 -> 1 year   (365 days)\n');

rl.question('Enter duration (1/2/3/6/12): ', (opt) => {
  const daysMap = { '1': 30, '2': 60, '3': 90, '6': 180, '12': 365 };
  const days = daysMap[opt.trim()];
  if (!days) {
    console.log('\nInvalid option!');
    rl.close();
    return;
  }

  const key = generateLicenseKey(days);
  const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  console.log('\n=== LICENSE KEY ===');
  console.log(key);
  console.log('====================');
  console.log(`Duration: ${days} days`);
  console.log(`Expires: ${expiry.toLocaleDateString()}`);
  console.log('');
  rl.close();
});
