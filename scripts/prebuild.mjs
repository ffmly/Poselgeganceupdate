import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, '..', 'src', 'main', 'build-config.ts');

const expiryDays = process.env.APP_EXPIRY_DAYS || '';
const buildTime = new Date().toISOString();

const content = `// Auto-generated at build time — do not edit manually
export const APP_EXPIRY_DAYS = '${expiryDays}';
export const APP_BUILD_TIME = '${buildTime}';
`;

fs.writeFileSync(outputPath, content, 'utf-8');
console.log(`[prebuild] Generated build-config.ts (expiryDays=${expiryDays || 'none'}, buildTime=${buildTime})`);
