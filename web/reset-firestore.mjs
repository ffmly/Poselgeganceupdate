import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, addDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAMIiOBE5yLkHf4HiVIjXLTy0L-H5d3TWg',
  authDomain: 'elegance-pos-2b059.firebaseapp.com',
  projectId: 'elegance-pos-2b059',
  storageBucket: 'elegance-pos-2b059.firebasestorage.app',
  messagingSenderId: '73389992067',
  appId: '1:73389992067:web:d0b313dae14000e945d3b6',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function btoa(s) {
  if (typeof window !== 'undefined') return window.btoa(s);
  return Buffer.from(s, 'binary').toString('base64');
}

const collectionsToClear = [
  'sales', 'sale_items', 'invoices', 'installments', 'installment_payments',
  'expenses', 'cash_movements', 'product_returns', 'purchases', 'purchase_items',
  'debt_payments', 'credit_debts', 'day_closing', 'customers', 'suppliers',
  'print_commands', 'settings',
];

async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  if (snap.empty) { console.log(`  ${name}: empty`); return; }
  let count = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, name, d.id));
    count++;
    if (count % 50 === 0) process.stdout.write('.');
  }
  console.log(`  ${name}: ${count} deleted`);
}

async function reset() {
  console.log('=== FIRESTORE RESET ===\n');
  console.log('Clearing transactional data...\n');

  const deleteOrder = [
    'purchase_items', 'sale_items', 'installment_payments', 'debt_payments',
    'invoices', 'installments', 'credit_debts', 'sales',
    'product_returns', 'expenses', 'cash_movements', 'purchases',
    'day_closing', 'print_commands', 'settings', 'suppliers', 'customers',
  ];
  for (const c of deleteOrder) {
    await clearCollection(c);
  }

  console.log('\nAdding user "user" / "user123"...');
  await addDoc(collection(db, 'users'), {
    username: 'user', password: btoa('user123'), role: 'user', is_admin: false,
  });
  console.log('  ✓ user added (role: user)\n');

  // Re-seed default settings
  console.log('Re-seeding default settings...');
  const settings = {
    store_name: 'Elegance POS', store_phone: '+213 555 123 456',
    store_address: '123 Rue Didouche, Alger', store_capital: '5000000',
    currency: 'DZD', language: 'ar', label_height_mm: '20',
    expiry_alert_days: '4', store_logo: '',
  };
  for (const [k, v] of Object.entries(settings)) {
    await setDoc(doc(db, 'settings', k), { value: String(v) });
  }
  console.log('  ✓ settings restored\n');

  console.log('=== RESET COMPLETE ===');
  console.log('Preserved: products, users');
  console.log('New user: user / user123');
  console.log('\nTo verify logins:');
  console.log('  admin / admin123 (admin)');
  console.log('  seller / seller123 (seller)');
  console.log('  user  / user123   (user)');
}

reset().catch(e => { console.error('Reset failed:', e); process.exit(1); });
