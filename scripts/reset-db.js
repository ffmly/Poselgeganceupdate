import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function findDbFiles(dir) {
  const files = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f === 'pos_data.db' || f === 'pos_data.db-wal' || f === 'pos_data.db-shm') {
        files.push(path.join(dir, f));
      }
    }
  } catch (_) {}
  return files;
}

// Development: project root
const devFiles = findDbFiles(projectRoot);

// Production: AppData\Roaming\POS Installment ERP
const prodDir = path.join(process.env.APPDATA || '', 'POS Installment ERP');
const prodFiles = findDbFiles(prodDir);

const allFiles = [...devFiles, ...prodFiles];

if (allFiles.length === 0) {
  console.log('No database files found.');
  process.exit(0);
}

console.log('Found:');
for (const f of allFiles) {
  const size = fs.statSync(f).size;
  console.log(`  ${f} (${(size / 1024).toFixed(1)} KB)`);
}

console.log('');

let deleted = 0;
for (const f of allFiles) {
  try {
    fs.unlinkSync(f);
    console.log(`  ✓ Deleted: ${path.basename(f)}`);
    deleted++;
  } catch (e) {
    console.log(`  ✗ Skipped (in use): ${path.basename(f)} — ${e.message}`);
  }
}

if (deleted > 0) {
  console.log(`\nDone. ${deleted} file(s) deleted. Run the app fresh to recreate the DB.`);
} else {
  console.log('\nNothing deleted. Close the POS app first and try again.');
}
