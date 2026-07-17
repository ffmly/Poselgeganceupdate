import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '../out/renderer/index.html');
if (existsSync(htmlPath)) {
  let html = readFileSync(htmlPath, 'utf-8');
  const cleaned = html.replace(/\s+crossorigin(=["'][^"']*["'])?/gi, '');
  if (cleaned !== html) {
    writeFileSync(htmlPath, cleaned);
    console.log('[fix-html] Stripped crossorigin from index.html');
  }
}
