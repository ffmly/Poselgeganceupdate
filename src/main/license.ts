import crypto from 'crypto';

const SECRET_KEY = 'p0s-1nstallm3nt-3rp-s3cr3t-k3y-2024!@#';

function encrypt(text: string): string {
  const key = crypto.createHash('sha256').update(SECRET_KEY).digest('hex').substring(0, 32);
  const iv = crypto.createHash('md5').update(SECRET_KEY).digest('hex').substring(0, 16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function generateLicenseKey(days: number): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  const data = JSON.stringify({
    exp: expiry.toISOString(),
    iss: new Date().toISOString(),
  });
  const encrypted = encrypt(data);
  return encrypted.match(/.{1,5}/g)?.join('-')?.toUpperCase() || encrypted;
}

// Lifetime license — no checks, no expiry

export async function checkLicense(): Promise<{
  activated: boolean;
  daysLeft?: number;
  expiryDate?: string;
  message: string;
}> {
  return { activated: true, message: 'Lifetime license' };
}

export async function activateLicense(_key: string): Promise<{ success: boolean; message: string }> {
  return { success: true, message: 'OK' };
}
