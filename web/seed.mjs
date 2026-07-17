import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, addDoc, writeBatch, Timestamp } from 'firebase/firestore';

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

const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

const daysAgo = (n) => day(-n);
const daysFromNow = (n) => day(n);

function btoa(s) {
  if (typeof window !== 'undefined') return window.btoa(s);
  return Buffer.from(s, 'binary').toString('base64');
}

async function seed() {
  console.log('🌱 Seeding Firestore database...\n');

  // ── Settings ──
  console.log('  📋 Settings...');
  const settings = {
    store_name: 'Elegance POS',
    store_phone: '+213 555 123 456',
    store_address: '123 Rue Didouche, Alger',
    store_capital: '5000000',
    currency: 'DZD',
    language: 'ar',
    label_height_mm: '20',
    expiry_alert_days: '4',
    store_logo: '',
  };
  for (const [k, v] of Object.entries(settings)) {
    await setDoc(doc(db, 'settings', k), { value: String(v) });
  }

  // ── Users ──
  console.log('  👤 Users...');
  await addDoc(collection(db, 'users'), {
    username: 'admin', password: btoa('admin123'), role: 'admin', is_admin: true,
  });
  await addDoc(collection(db, 'users'), {
    username: 'seller', password: btoa('seller123'), role: 'user', is_admin: false,
  });

  // ── Products ──
  console.log('  📦 Products...');
  const productData = [
    { name: 'Lait LFB 1L', barcode: '000001', price_purchase: 80, price_cash: 120, stock: 45, expiry_date: daysFromNow(20) },
    { name: 'Huile ELIO 1L', barcode: '000002', price_purchase: 250, price_cash: 380, stock: 30, expiry_date: daysFromNow(180) },
    { name: 'Sucre blanc 1KG', barcode: '000003', price_purchase: 90, price_cash: 140, stock: 60, expiry_date: daysFromNow(365) },
    { name: 'Couscous FAR 1KG', barcode: '000004', price_purchase: 110, price_cash: 170, stock: 25, expiry_date: daysFromNow(240) },
    { name: 'Café Bell 500G', barcode: '000005', price_purchase: 420, price_cash: 650, stock: 15, expiry_date: daysFromNow(300) },
    { name: 'Semoule SM 1KG', barcode: '000006', price_purchase: 85, price_cash: 130, stock: 40, expiry_date: daysFromNow(200) },
    { name: 'Thé Vert 250G', barcode: '000007', price_purchase: 180, price_cash: 280, stock: 20, expiry_date: daysFromNow(250) },
    { name: 'Jus TONIK 1L', barcode: '000008', price_purchase: 95, price_cash: 150, stock: 0, expiry_date: daysFromNow(15) },
    { name: 'Farine 1KG', barcode: '000009', price_purchase: 70, price_cash: 110, stock: 55, expiry_date: daysFromNow(180) },
    { name: 'Eau minérale 1.5L', barcode: '000010', price_purchase: 25, price_cash: 45, stock: 100, expiry_date: daysFromNow(365) },
    { name: 'Sel fin 500G', barcode: '000011', price_purchase: 30, price_cash: 50, stock: 2, expiry_date: daysFromNow(365) },
    { name: 'Yaourt nature x6', barcode: '000012', price_purchase: 120, price_cash: 190, stock: 35, expiry_date: daysFromNow(7) },
    { name: 'Pâtes Tria 500G', barcode: '000013', price_purchase: 55, price_cash: 85, stock: 50, expiry_date: daysFromNow(300) },
    { name: 'Confiture 400G', barcode: '000014', price_purchase: 160, price_cash: 250, stock: 3, expiry_date: daysFromNow(5) },
    { name: 'Chocolat 100G', barcode: '000015', price_purchase: 90, price_cash: 150, stock: 12, expiry_date: daysFromNow(90) },
  ];
  const productRefs = [];
  for (const p of productData) {
    const ref = await addDoc(collection(db, 'products'), p);
    productRefs.push(ref);
  }
  const productMap = {};
  productData.forEach((p, i) => { productMap[p.name] = { id: productRefs[i].id, ...p }; });

  // ── Customers ──
  console.log('  👥 Customers...');
  const customerData = [
    { name: 'Ahmed Benali', phone: '0555 12 34 56', address: 'Cité 1er Novembre', notes: 'Client régulier' },
    { name: 'Fatima Zohra', phone: '0666 78 90 12', address: 'Rue des Frères', notes: 'Paiement comptant' },
    { name: 'Karim Meziane', phone: '0777 34 56 78', address: 'Cité 5 Juillet', notes: '' },
    { name: 'Samira Bouchareb', phone: '0555 90 12 34', address: 'Rue Ben Badis', notes: 'Achats au crédit' },
    { name: 'Rachid Ouali', phone: '0666 12 34 56', address: 'Route Nationale', notes: '' },
    { name: 'Nadia Hamdi', phone: '0777 56 78 90', address: 'Cité des Oliviers', notes: 'Cliente fidèle' },
  ];
  const customerRefs = [];
  for (const c of customerData) {
    const ref = await addDoc(collection(db, 'customers'), c);
    customerRefs.push(ref);
  }

  // ── Suppliers ──
  console.log('  🚚 Suppliers...');
  const supplierData = [
    { name: 'Distrib Aliment', phone: '023 45 67 89', address: 'Zone Industrielle', notes: 'Paiement 30j' },
    { name: 'Sarl Laiterie', phone: '023 98 76 54', address: 'Route de l\'Arbaa', notes: 'Produits frais' },
    { name: 'Ets Boissons', phone: '023 11 22 33', address: 'Cité des Sources', notes: 'Livraison rapide' },
    { name: 'Import Export G', phone: '021 44 55 66', address: 'Port d\'Alger', notes: 'Importation' },
  ];
  for (const s of supplierData) {
    await addDoc(collection(db, 'suppliers'), s);
  }

  // ── Helper: create sale with items ──
  const customerIds = customerRefs.map(r => r.id);

  async function createSale(type, customerIdx, discount = 0, itemSpecs, daysBack, paidAmount = 0) {
    const custId = customerIdx !== null ? customerIds[customerIdx] : null;
    const items = itemSpecs.map(spec => {
      const prod = productMap[spec.productName];
      if (!prod) throw new Error(`Product not found: ${spec.productName}`);
      const unitPrice = spec.overridePrice || prod.price_cash;
      const subtotal = unitPrice * spec.qty * (1 - (spec.itemDiscount || 0) / 100);
      return { product_id: prod.id, quantity: spec.qty, price: prod.price_cash, price_override: unitPrice, discount: spec.itemDiscount || 0, subtotal };
    });
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const discountAmt = discount > 0 ? (discount <= 1 ? subtotal * discount : discount) : 0;
    const total = Math.round(Math.max(0, subtotal - discountAmt));

    const saleData = {
      type: type === 'installment' ? 'credit' : type,
      subtotal,
      discount: discountAmt,
      total,
      customer_id: custId,
      paid_amount: paidAmount,
      created_at: daysAgo(daysBack),
      status: 'completed',
    };
    const saleRef = await addDoc(collection(db, 'sales'), saleData);

    for (const item of items) {
      await addDoc(collection(db, 'sale_items'), { sale_id: saleRef.id, ...item });
    }

    if (type === 'debt') {
      const remaining = Math.max(0, total - paidAmount);
      const dStatus = paidAmount >= total ? 'paid' : paidAmount > 0 ? 'partial' : 'active';
      const debtRef = await addDoc(collection(db, 'credit_debts'), {
        sale_id: saleRef.id, customer_id: custId,
        original_amount: total, remaining, status: dStatus, created_at: daysAgo(daysBack),
      });
      if (paidAmount > 0) {
        await addDoc(collection(db, 'credit_debts', debtRef.id, 'payments'), {
          amount: paidAmount, notes: 'Paiement à la vente',
          payment_date: daysAgo(daysBack),
        });
      }
    }

    if (type === 'installment') {
      const advance = Math.round(total * 0.3);
      const remaining = total - advance;
      const months = 6;
      const monthly = Math.round(remaining / months);
      await addDoc(collection(db, 'installments'), {
        sale_id: saleRef.id, customer_id: custId,
        total_amount: total, advance, remaining, months, monthly_payment: monthly,
        paid_amount: advance, status: 'active', start_date: daysAgo(daysBack),
      });
    }

    return saleRef;
  }

  // ── Sales ──
  console.log('  🧾 Sales...');
  // Cash sales
  await createSale('cash', 0, 0.05, [
    { productName: 'Lait LFB 1L', qty: 2 },
    { productName: 'Huile ELIO 1L', qty: 1 },
    { productName: 'Sucre blanc 1KG', qty: 3 },
  ], 1);

  await createSale('cash', 3, 0, [
    { productName: 'Café Bell 500G', qty: 1 },
    { productName: 'Thé Vert 250G', qty: 2 },
  ], 2);

  // Credit sale
  await createSale('credit', 3, 0, [
    { productName: 'Chocolat 100G', qty: 5 },
    { productName: 'Confiture 400G', qty: 2 },
    { productName: 'Yaourt nature x6', qty: 3 },
  ], 3);

  // Debt sale with partial payment
  await createSale('debt', 4, 0.1, [
    { productName: 'Couscous FAR 1KG', qty: 4 },
    { productName: 'Huile ELIO 1L', qty: 2 },
    { productName: 'Pâtes Tria 500G', qty: 6 },
  ], 5, 500); // paid 500 today, rest as debt

  // Installment sale
  await createSale('installment', 2, 0, [
    { productName: 'Eau minérale 1.5L', qty: 12 },
    { productName: 'Jus TONIK 1L', qty: 6 },
    { productName: 'Lait LFB 1L', qty: 10 },
  ], 7);

  // Another cash sale today
  await createSale('cash', 1, 50, [
    { productName: 'Semoule SM 1KG', qty: 2 },
    { productName: 'Farine 1KG', qty: 3 },
    { productName: 'Sel fin 500G', qty: 1 },
  ], 0);

  // ── Debt payments ──
  console.log('  💳 Debt payments...');
  const debtSnap = await getDocs(collection(db, 'credit_debts'));
  let count = 0;
  for (const d of debtSnap.docs) {
    if (count === 0) {
      await addDoc(collection(db, 'credit_debts', d.id, 'payments'), {
        amount: 300, notes: 'Premier paiement',
        payment_date: daysAgo(2),
      });
      await setDoc(doc(db, 'credit_debts', d.id), { remaining: d.data().remaining - 300, status: 'partial' }, { merge: true });
    }
    count++;
  }

  // ── Expenses ──
  console.log('  💸 Expenses...');
  await addDoc(collection(db, 'expenses'), {
    amount: 1500, description: 'Électricité magasin',
    created_at: daysAgo(1),
  });
  await addDoc(collection(db, 'expenses'), {
    amount: 800, description: 'Fournitures de bureau',
    created_at: daysAgo(3),
  });
  await addDoc(collection(db, 'expenses'), {
    amount: 2500, description: 'Transport marchandise',
    created_at: daysAgo(5),
  });
  await addDoc(collection(db, 'expenses'), {
    amount: 600, description: 'Nettoyage local',
    created_at: daysAgo(0),
  });

  // ── Product Returns ──
  console.log('  ↩️  Product returns...');
  await addDoc(collection(db, 'product_returns'), {
    product_id: productMap['Yaourt nature x6'].id,
    quantity: 1, price: 190, total: 190,
    reason: 'Produit périmé',
    created_at: daysAgo(2),
  });
  await addDoc(collection(db, 'product_returns'), {
    product_id: productMap['Jus TONIK 1L'].id,
    quantity: 2, price: 150, total: 300,
    reason: 'Emballage endommagé',
    created_at: daysAgo(1),
  });

  // ── Purchases ──
  console.log('  📥 Purchases...');
  const supSnap = await getDocs(collection(db, 'suppliers'));
  const supIds = supSnap.docs.map(d => d.id);

  async function createPurchase(supplierIdx, itemSpecs, daysBack) {
    const items = itemSpecs.map(s => {
      const prod = productMap[s.productName];
      return {
        product_id: prod.id, quantity: s.qty,
        cost_price: s.costPrice,
        subtotal: s.qty * s.costPrice,
      };
    });
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    const ref = await addDoc(collection(db, 'purchases'), {
      supplier_id: supIds[supplierIdx],
      total, notes: 'Achat réapprovisionnement',
      created_at: daysAgo(daysBack),
    });
    for (const item of items) {
      await addDoc(collection(db, 'purchase_items'), {
        purchase_id: ref.id, ...item,
      });
    }
  }

  await createPurchase(0, [
    { productName: 'Lait LFB 1L', qty: 24, costPrice: 80 },
    { productName: 'Huile ELIO 1L', qty: 12, costPrice: 250 },
    { productName: 'Sucre blanc 1KG', qty: 20, costPrice: 90 },
  ], 10);

  await createPurchase(1, [
    { productName: 'Yaourt nature x6', qty: 30, costPrice: 120 },
    { productName: 'Lait LFB 1L', qty: 36, costPrice: 80 },
  ], 5);

  await createPurchase(2, [
    { productName: 'Eau minérale 1.5L', qty: 50, costPrice: 25 },
    { productName: 'Jus TONIK 1L', qty: 24, costPrice: 95 },
  ], 3);

  console.log('\n✅ Database seeded successfully!');
  console.log(`   📦 ${productData.length} products`);
  console.log(`   👥 ${customerData.length} customers`);
  console.log(`   🚚 ${supplierData.length} suppliers`);
  console.log(`   🧾 6 sales`);
  console.log(`   💸 4 expenses`);
  console.log(`   ↩️  2 returns`);
  console.log(`   📥 3 purchases\n`);
  console.log('   🔑 admin / admin123');
  console.log('   🔑 seller / seller123');
}

import { getDocs } from 'firebase/firestore';
seed().catch(e => { console.error('Seed failed:', e); process.exit(1); });
