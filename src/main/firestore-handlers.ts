import { db } from './firebase-config';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, limit, setDoc,
  runTransaction,
} from 'firebase/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

// Exports for sync-engine
export { db, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, limit, runTransaction };

// ─── Day Close State ───────────────────────────────────────────────────────────
let _closedDate = '';
let _todayClosed = false;

export function isDayClosed(): boolean {
  const today = new Date().toISOString().split('T')[0];
  if (_closedDate === today) return _todayClosed;
  _closedDate = today;
  _todayClosed = false;
  getDocs(query(collection(db, 'day_closing'), orderBy('closed_at', 'desc'), limit(1))).then(snap => {
    if (!snap.empty && snap.docs[0].data().closed_at?.startsWith(today)) _todayClosed = true;
  }).catch(() => {});
  return false;
}

export function setDayClosed() {
  _todayClosed = true;
  _closedDate = new Date().toISOString().split('T')[0];
}

// ─── Date Condition Parser ─────────────────────────────────────────────────────
function filterByDateCondition(sql: string): (val: string) => boolean {
  const lower = sql.toLowerCase();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const monthYear = today.substring(0, 7);
  const year = today.substring(0, 4);
  const useLocal = lower.includes('localtime');

  // DATE(col) = DATE('now') or DATE('now', 'localtime')
  if ((lower.includes("= date('now')") || lower.includes("= date('now', 'localtime')")) && lower.includes('date(')) {
    const refDate = useLocal ? todayLocal : today;
    return v => v?.startsWith(refDate);
  }
  // strftime('%m-%Y', col) = strftime('%m-%Y', 'now')
  if (lower.includes("strftime('%m-%Y'") && lower.includes("= strftime('%m-%Y', 'now')")) {
    return v => v?.startsWith(monthYear);
  }
  // strftime('%Y', col) = strftime('%Y', 'now')
  if (lower.includes("strftime('%Y'") && lower.includes("= strftime('%Y', 'now')")) {
    return v => v?.startsWith(year);
  }
  // DATE(col) BETWEEN 'X' AND 'Y'
  const betweenMatch = lower.match(/date\(.*?\) between '(\d{4}-\d{2}-\d{2})' and '(\d{4}-\d{2}-\d{2})'/);
  if (betweenMatch) {
    const start = betweenMatch[1];
    const end = betweenMatch[2];
    return v => !!(v && v.split('T')[0] >= start && v.split('T')[0] <= end);
  }
  // 1=1 (no filter) or fallback
  return () => true;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function docsToArray(snapshot: any) {
  const arr: any[] = [];
  snapshot.forEach((d: any) => arr.push({ id: d.id, ...d.data() }));
  return arr;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
export async function authLogin(username: string, password: string) {
  const snap = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
  if (snap.empty) return { success: false, error: 'invalid_credentials' };
  const userDoc = snap.docs[0];
  const user = userDoc.data();
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return { success: false, error: 'invalid_credentials' };
  return { success: true, user: { id: userDoc.id, username: user.username, role: user.is_admin ? 'admin' : 'seller' } };
}

export async function authGetUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('username')));
  return docsToArray(snap).map(u => ({ id: u.id, username: u.username, role: u.is_admin ? 'admin' : 'seller', created_at: u.created_at }));
}

export async function authCreateUser(username: string, password: string, role: string) {
  try {
    const hash = bcrypt.hashSync(password, 10);
    const ref = await addDoc(collection(db, 'users'), { username, password_hash: hash, is_admin: role === 'admin', created_at: new Date().toISOString() });
    return { success: true, id: ref.id };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function authDeleteUser(id: string) {
  try { await deleteDoc(doc(db, 'users', id)); return { success: true }; }
  catch (e: any) { return { success: false, error: e.message }; }
}

export async function authResetPassword(id: string, newPassword: string) {
  try {
    const hash = bcrypt.hashSync(newPassword, 10);
    await updateDoc(doc(db, 'users', id), { password_hash: hash });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── Generic Query Helpers ─────────────────────────────────────────────────────
// These map the specific SQL patterns used by the renderer to Firestore calls

export async function dbQuery(sql: string, ...params: any[]) {
  const s = sql.replace(/\s+/g, ' ').trim();

  // Products
  if (sql === 'SELECT * FROM products ORDER BY name') {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('name')));
    return docsToArray(snap);
  }
  if (sql.startsWith('SELECT * FROM products')) {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('name')));
    return docsToArray(snap);
  }
  // Purchases
  if (sql === 'SELECT p.*,s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id ORDER BY p.created_at DESC') {
    const snap = await getDocs(query(collection(db, 'purchases'), orderBy('created_at', 'desc')));
    const list = docsToArray(snap);
    const sSnap = await getDocs(collection(db, 'suppliers'));
    const sMap: any = {};
    sSnap.forEach(d => sMap[d.id] = d.data().name);
    return list.map(p => ({ ...p, supplier_name: sMap[p.supplier_id] || '-' }));
  }
  if (sql === 'SELECT * FROM suppliers ORDER BY name') {
    const snap = await getDocs(query(collection(db, 'suppliers'), orderBy('name')));
    return docsToArray(snap);
  }
  if (sql === 'SELECT * FROM products ORDER BY name') {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('name')));
    return docsToArray(snap);
  }
  if (sql.startsWith('SELECT pi.*,p.name FROM purchase_items pi JOIN products p ON pi.product_id=p.id WHERE pi.purchase_id=?')) {
    const pid = params[0];
    const piSnap = await getDocs(query(collection(db, 'purchase_items'), where('purchase_id', '==', pid)));
    const items = docsToArray(piSnap);
    const pSnap = await getDocs(collection(db, 'products'));
    const pMap: any = {};
    pSnap.forEach(d => pMap[d.id] = d.data().name);
    return items.map(i => ({ ...i, name: pMap[i.product_id] || '-' }));
  }
  if (sql.startsWith('SELECT pi.*,p.name as name FROM purchase_items pi JOIN products p ON pi.product_id=p.id WHERE pi.purchase_id=?')) {
    const pid = params[0];
    const piSnap = await getDocs(query(collection(db, 'purchase_items'), where('purchase_id', '==', pid)));
    const items = docsToArray(piSnap);
    const pSnap = await getDocs(collection(db, 'products'));
    const pMap: any = {};
    pSnap.forEach(d => pMap[d.id] = d.data().name);
    return items.map(i => ({ ...i, name: pMap[i.product_id] || '-' }));
  }
  // Customers
  if (sql === 'SELECT * FROM customers ORDER BY name') {
    const snap = await getDocs(query(collection(db, 'customers'), orderBy('name')));
    return docsToArray(snap);
  }
  // Sales (with optional date filter and profit subquery)
  if (s.includes('FROM sales s LEFT JOIN customers c')) {
    const filter = filterByDateCondition(sql);
    const hasProfit = sql.includes('SELECT') && sql.includes('as profit') && sql.includes('FROM sale_items');
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    let limitCount = limitMatch ? parseInt(limitMatch[1]) : 0;

    const snap = await getDocs(query(collection(db, 'sales'), orderBy('created_at', 'desc')));
    let list = docsToArray(snap).filter(s => filter(s.created_at));

    const cSnap = await getDocs(collection(db, 'customers'));
    const cMap: any = {};
    cSnap.forEach(d => cMap[d.id] = d.data());

    let pMap: any = null;
    if (hasProfit) {
      const siSnap = await getDocs(collection(db, 'sale_items'));
      const pSnap = await getDocs(collection(db, 'products'));
      pMap = {};
      pSnap.forEach(d => pMap[d.id] = d.data());
      // Compute profit per sale
      const profitMap: Record<string, number> = {};
      siSnap.forEach(d => {
        const si = d.data();
        if (!profitMap[si.sale_id]) profitMap[si.sale_id] = 0;
        const p = pMap[si.product_id];
        if (p) profitMap[si.sale_id] += (si.subtotal - (si.quantity * (p.price_purchase || 0)));
      });
      list = list.map(s => ({ ...s, profit: profitMap[s.id] || 0 }));
    }

    const iSnap = await getDocs(collection(db, 'invoices'));
    const iMap: any = {};
    iSnap.forEach(d => iMap[d.data().sale_id] = d.data().invoice_number);

    const result = list.map(s => {
      const c = cMap[s.customer_id] || {};
      return { ...s, customer_name: c.name || '-', customer_phone: c.phone || '', customer_address: c.address || '', invoice_number: iMap[s.id] || '' };
    });

    if (limitCount > 0) return result.slice(0, limitCount);
    return result;
  }
  if (sql.startsWith('SELECT si.*,p.name FROM sale_items si JOIN products p ON si.product_id=p.id WHERE si.sale_id=?') ||
      sql.startsWith('SELECT si.*, p.name as name FROM sale_items si JOIN products p ON si.product_id=p.id WHERE si.sale_id=?')) {
    const sid = params[0];
    const siSnap = await getDocs(query(collection(db, 'sale_items'), where('sale_id', '==', sid)));
    const items = docsToArray(siSnap);
    const pSnap = await getDocs(collection(db, 'products'));
    const pMap: any = {};
    pSnap.forEach(d => pMap[d.id] = d.data().name);
    return items.map(i => ({ ...i, name: pMap[i.product_id] || '-' }));
  }
  // Installments (all, with customer name)
  if (s.includes('FROM installments') && s.includes('ORDER BY i.created_at DESC')) {
    const snap = await getDocs(query(collection(db, 'installments'), orderBy('created_at', 'desc')));
    const list = docsToArray(snap);
    const cSnap = await getDocs(collection(db, 'customers'));
    const cMap: any = {};
    cSnap.forEach(d => cMap[d.id] = d.data().name);
    return list.map(i => ({ ...i, customer_name: cMap[i.customer_id] || '-', customer_phone: '' }));
  }
  // Overdue installments (Reports)
  if (s.includes('FROM installments i LEFT JOIN customers c') && s.includes('i.remaining > 0') && s.includes('installment_payments')) {
    const snap = await getDocs(collection(db, 'installments'));
    const pSnap = await getDocs(collection(db, 'installment_payments'));
    const cSnap = await getDocs(collection(db, 'customers'));
    const cMap: any = {};
    cSnap.forEach(d => cMap[d.id] = d.data());
    const pMap: Record<string, string> = {};
    pSnap.forEach(d => {
      const pd = d.data();
      const existing = pMap[pd.installment_id];
      if (!existing || pd.payment_date > existing) pMap[pd.installment_id] = pd.payment_date;
    });
    const now = new Date();
    const overdue = docsToArray(snap).filter(i => {
      if (i.remaining <= 0) return false;
      const lastPay = pMap[i.id] || i.start_date;
      const days = Math.ceil((now.getTime() - new Date(lastPay).getTime()) / 86400000);
      return days > 30;
    });
    return overdue.map(i => {
      const c = cMap[i.customer_id] || {};
      return { ...i, customer_name: c.name || '-', customer_phone: c.phone || '' };
    });
  }
  if (s.includes("SELECT i.*, c.name as customer_name, c.phone as customer_phone FROM installments i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ?")) {
    const id = params[0];
    const d = await getDoc(doc(db, 'installments', id));
    if (!d.exists()) return [];
    const data = d.data();
    let cName = '-', cPhone = '';
    if (data.customer_id) {
      const cSnap = await getDoc(doc(db, 'customers', data.customer_id));
      if (cSnap.exists()) { cName = cSnap.data().name; cPhone = cSnap.data().phone || ''; }
    }
    return [{ id: d.id, ...data, customer_name: cName, customer_phone: cPhone }];
  }
  if (sql.includes('installment_payments') && sql.includes('installment_id')) {
    const snap = await getDocs(query(collection(db, 'installment_payments'), where('installment_id', '==', params[0]), orderBy('payment_date', 'desc')));
    const uSnap = await getDocs(collection(db, 'users'));
    const uMap: Record<string, string> = {};
    uSnap.forEach(d => uMap[d.id] = d.data().username);
    return docsToArray(snap).map(p => ({ ...p, username: uMap[p.recorded_by] || '-' }));
  }
  // Reports - top products
  if (s.includes('SELECT si.product_id, p.name, SUM(si.quantity) as qty, SUM(si.subtotal) as total FROM sale_items si')) {
    const snap = await getDocs(collection(db, 'sale_items'));
    const items = docsToArray(snap);
    const pSnap = await getDocs(collection(db, 'products'));
    const pMap: any = {};
    pSnap.forEach(d => pMap[d.id] = d.data().name);
    const grouped: any = {};
    for (const i of items) {
      if (!grouped[i.product_id]) grouped[i.product_id] = { product_id: i.product_id, name: pMap[i.product_id] || '-', qty: 0, total: 0 };
      grouped[i.product_id].qty += i.quantity;
      grouped[i.product_id].total += i.subtotal;
    }
    const sorted = Object.values(grouped).sort((a: any, b: any) => b.total - a.total);
    return sorted;
  }
  // Reports - installment overdue
  if (sql.includes("WHERE i.status = 'active'")) {
    const snap = await getDocs(query(collection(db, 'installments'), where('status', '==', 'active')));
    const list = docsToArray(snap);
    const cSnap = await getDocs(collection(db, 'customers'));
    const cMap: any = {};
    cSnap.forEach(d => cMap[d.id] = d.data().name);
    return list.map(i => ({ ...i, customer_name: cMap[i.customer_id] || '-', customer_phone: '' }));
  }
  // Products with low stock
  if (sql.includes('WHERE stock <= 5')) {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('stock', 'asc')));
    return docsToArray(snap).filter(p => p.stock <= 5);
  }
  // Expiring products (SoonExpired page / Reports)
  if (sql.includes("expiry_date IS NOT NULL") && sql.includes("expiry_date != ''")) {
    const snap = await getDocs(collection(db, 'products'));
    const now = new Date();
    const maxDate = params[0] ? new Date(params[0]) : null;
    const list = docsToArray(snap).filter(p => {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date);
      if (exp < now) return false;
      if (maxDate && exp > maxDate) return false;
      return true;
    }).map(p => {
      const days = Math.ceil((new Date(p.expiry_date).getTime() - now.getTime()) / 86400000);
      return { ...p, days_left: days };
    });
    return list;
  }
  // Sales by date range (Reports)
  if (s.includes('FROM sales s LEFT JOIN customers c') && (s.includes('DATE(s.created_at) BETWEEN') || s.includes("DATE(s.created_at) = DATE('now'"))) {
    const snap = await getDocs(query(collection(db, 'sales'), orderBy('created_at', 'desc')));
    const list = docsToArray(snap);
    const cSnap = await getDocs(collection(db, 'customers'));
    const cMap: any = {};
    cSnap.forEach(d => cMap[d.id] = d.data().name);
    return list.map(s => ({ ...s, customer_name: cMap[s.customer_id] || '-' }));
  }

  // Dashboard recent sales
  if (sql.includes('s.id, s.type, s.total, s.discount, s.created_at') && sql.includes('ORDER BY s.created_at DESC LIMIT')) {
    const snap = await getDocs(query(collection(db, 'sales'), orderBy('created_at', 'desc'), limit(8)));
    const list = docsToArray(snap);
    const cSnap = await getDocs(collection(db, 'customers'));
    const cMap: any = {};
    cSnap.forEach(d => cMap[d.id] = d.data().name);
    return list.map(s => ({ ...s, customer_name: cMap[s.customer_id] || '-' }));
  }

  // Expenses with user join
  if (s.includes('FROM expenses e LEFT JOIN users u')) {
    const filter = filterByDateCondition(sql);
    const eSnap = await getDocs(collection(db, 'expenses'));
    const uSnap = await getDocs(collection(db, 'users'));
    const uMap: any = {};
    uSnap.forEach(d => uMap[d.id] = d.data().username);
    const items = docsToArray(eSnap)
      .filter(e => filter(e.created_at))
      .map(e => ({ ...e, recorded_by_name: uMap[e.recorded_by] || '-' }));
    items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return items;
  }

  // Top products with GROUP BY, date range, LIMIT
  if (s.includes('GROUP BY si.product_id') && s.includes('FROM sale_items si JOIN sales s')) {
    const filter = filterByDateCondition(sql);
    const siSnap = await getDocs(collection(db, 'sale_items'));
    const pSnap = await getDocs(collection(db, 'products'));
    const sSnap = await getDocs(collection(db, 'sales'));
    const pMap: any = {};
    pSnap.forEach(d => pMap[d.id] = d.data());
    const sMap: Set<string> = new Set();
    sSnap.forEach(d => { if (filter(d.data().created_at)) sMap.add(d.id); });
    const grouped: any = {};
    siSnap.forEach(d => {
      const si = d.data();
      if (!sMap.has(si.sale_id)) return;
      const pid = si.product_id;
      if (!grouped[pid]) {
        const p = pMap[pid] || {};
        grouped[pid] = { id: pid, product_id: pid, name: p.name || '-', price_cash: p.price_cash || 0, price_purchase: p.price_purchase || 0, total_qty: 0, total_revenue: 0, total_profit: 0 };
      }
      grouped[pid].total_qty += si.quantity;
      grouped[pid].total_revenue += si.subtotal;
      const cost = si.quantity * (pMap[pid]?.price_purchase || 0);
      grouped[pid].total_profit += (si.subtotal - cost);
    });
    return Object.values(grouped).sort((a: any, b: any) => b.total_qty - a.total_qty).slice(0, 50);
  }

  // Barcode MAX query for auto-assignment (Products.tsx openAdd)
  if (sql.includes('MAX(CAST(barcode AS INTEGER))') && sql.includes('FROM products')) {
    const snap = await getDocs(collection(db, 'products'));
    let maxId = 0;
    snap.forEach(d => {
      const bc = d.data().barcode;
      if (bc && /^\d+$/.test(bc)) maxId = Math.max(maxId, parseInt(bc, 10));
    });
    return [{ next_id: maxId + 1 }];
  }

  console.warn('dbQuery: unhandled SQL:', sql.substring(0, 120));
  return [];
}

export async function dbGet(sql: string, ...params: any[]) {
  const s = sql.replace(/\s+/g, ' ').trim();
  // Dashboard counts and aggregates
  if (s.includes('COUNT(*)') || s.includes('COALESCE(SUM') || s.includes('COALESCE(COUNT')) {
    const isProfit = sql.includes('profit');
    const isSalesSum = sql.includes('SUM(total - discount)');
    const isCash = sql.includes("type='cash'");
    const isCredit = sql.includes("type='credit'");
    const isDebt = sql.includes("type='debt'");
    const isCustomers = sql.includes('FROM customers');
    const isProducts = sql.includes('FROM products');
    const isLowStock = sql.includes('stock <= 3');
    const isSoonExpired = sql.includes('expiry_date');
    const isToday = sql.includes("DATE('now')") || sql.includes("DATE('now',");

    if (isCustomers) {
      const snap = await getDocs(collection(db, 'customers'));
      return { count: snap.size };
    }
    if (isSoonExpired) {
      const snap = await getDocs(collection(db, 'products'));
      const now = new Date();
      const maxDate = params[0] ? new Date(params[0]) : null;
      const count = docsToArray(snap).filter(p => {
        if (!p.expiry_date) return false;
        const exp = new Date(p.expiry_date);
        if (exp < now) return false;
        if (maxDate && exp > maxDate) return false;
        return true;
      }).length;
      return { count };
    }
    if (isProducts) {
      const snap = await getDocs(collection(db, 'products'));
      if (isLowStock) return { count: docsToArray(snap).filter(p => p.stock <= 3).length };
      return { count: snap.size };
    }
    if (isProfit && !sql.includes('JOIN sales s')) {
      const siSnap = await getDocs(collection(db, 'sale_items'));
      const pSnap = await getDocs(collection(db, 'products'));
      const pMap: any = {};
      pSnap.forEach(d => pMap[d.id] = d.data());
      let profit = 0;
      siSnap.forEach(d => {
        const si = d.data();
        const p = pMap[si.product_id];
        if (p) profit += (si.subtotal - (si.quantity * (p.price_purchase || 0)));
      });
      return { profit };
    }
    if (isToday) {
      if (isDayClosed()) return { total: 0 };
      const now = new Date();
      const today = sql.includes('localtime')
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        : now.toISOString().split('T')[0];
      if (sql.includes('expenses')) {
        const snap = await getDocs(collection(db, 'expenses'));
        let total = 0;
        snap.forEach(d => {
          if (d.data().created_at?.startsWith(today)) total += d.data().amount;
        });
        return { total };
      }
      if (sql.includes('product_returns')) {
        const snap = await getDocs(collection(db, 'product_returns'));
        let total = 0;
        snap.forEach(d => {
          if (d.data().created_at?.startsWith(today)) total += d.data().total;
        });
        return { total };
      }
      const snap = await getDocs(collection(db, 'sales'));
      let total = 0;
      snap.forEach(d => {
        const s = d.data();
        if (s.created_at?.startsWith(today)) total += (s.total - (s.discount || 0));
      });
      return { total };
    }

    if (isSalesSum) {
      const snap = await getDocs(collection(db, 'sales'));
      let total = 0;
      snap.forEach(d => {
        const s = d.data();
        if (isCash && s.type === 'cash') total += (s.total - (s.discount || 0));
        else if (isCredit && s.type === 'credit') total += (s.total - (s.discount || 0));
        else if (isDebt && s.type === 'debt') total += (s.total - (s.discount || 0));
        else if (!isCash && !isCredit && !isDebt) total += (s.total - (s.discount || 0));
      });
      return { count: snap.size, revenue: total, total, cash_total: total };
    }
  }

  // Invoice number lookup
  if (sql.includes("SELECT invoice_number FROM invoices WHERE sale_id = ?")) {
    const snap = await getDocs(query(collection(db, 'invoices'), where('sale_id', '==', params[0]), limit(1)));
    if (!snap.empty) return snap.docs[0].data();
    return null;
  }

  // Installments - dashboard active/overdue
  if (sql.includes('FROM installments') && sql.includes('COUNT(*) as active') && sql.includes("i.status != 'completed'")) {
    const snap = await getDocs(collection(db, 'installments'));
    const list = docsToArray(snap).filter(i => i.status !== 'completed');
    const iPaySnap = await getDocs(collection(db, 'installment_payments'));
    const iPayMap: Record<string, string[]> = {};
    iPaySnap.forEach(d => {
      const p = d.data();
      if (!iPayMap[p.installment_id]) iPayMap[p.installment_id] = [];
      iPayMap[p.installment_id].push(p.payment_date);
    });
    let overdue = 0;
    const now = new Date();
    for (const i of list) {
      if (i.remaining > 0) {
        const dates = iPayMap[i.id] || [];
        const lastPay = dates.length > 0 ? dates.sort().reverse()[0] : i.start_date;
        const daysSinceLastPay = Math.ceil((now.getTime() - new Date(lastPay).getTime()) / 86400000);
        if (daysSinceLastPay > 30) overdue++;
      }
    }
    return { active: list.length, overdue };
  }

  // Reports - sales summary by date period
  if (s.includes('SELECT COALESCE(COUNT(*),0) as count') && s.includes('COALESCE(SUM(total - discount),0) as total')) {
    const filter = filterByDateCondition(sql);
    const snap = await getDocs(collection(db, 'sales'));
    let total = 0, count = 0;
    snap.forEach(d => {
      if (filter(d.data().created_at)) { total += (d.data().total - (d.data().discount || 0)); count++; }
    });
    return { count, total };
  }

  // Reports - sales summary with individual SUM(total), SUM(discount), COUNT
  if (s.includes('FROM sales') && s.includes('SUM(total)') && s.includes('SUM(discount)') && s.includes('COUNT(*)')) {
    const filter = filterByDateCondition(sql);
    const snap = await getDocs(collection(db, 'sales'));
    let total = 0, discount = 0, count = 0;
    snap.forEach(d => {
      if (filter(d.data().created_at)) { total += (d.data().total || 0); discount += (d.data().discount || 0); count++; }
    });
    return { count, total, discount };
  }

  // Reports - profit with date range (JOIN sales for date filter)
  if (s.includes('profit') && s.includes('FROM sale_items si') && s.includes('JOIN sales s')) {
    const filter = filterByDateCondition(sql);
    const siSnap = await getDocs(collection(db, 'sale_items'));
    const pSnap = await getDocs(collection(db, 'products'));
    const sSnap = await getDocs(collection(db, 'sales'));
    const pMap: any = {};
    pSnap.forEach(d => pMap[d.id] = d.data());
    const sMap: Set<string> = new Set();
    sSnap.forEach(d => { if (filter(d.data().created_at)) sMap.add(d.id); });
    let profit = 0;
    siSnap.forEach(d => {
      const si = d.data();
      if (!sMap.has(si.sale_id)) return;
      const p = pMap[si.product_id];
      if (p) profit += (si.subtotal - (si.quantity * (p.price_purchase || 0)));
    });
    return { profit };
  }

  // Reports - expenses summary
  if (s.includes('FROM expenses') && s.includes('SUM(amount)')) {
    const filter = filterByDateCondition(sql);
    const snap = await getDocs(collection(db, 'expenses'));
    let total = 0, count = 0;
    snap.forEach(d => {
      if (filter(d.data().created_at)) { total += (d.data().amount || 0); count++; }
    });
    return { count, total };
  }

  // Barcode duplicate check (Products.tsx)
  if (s.includes('WHERE barcode=') && s.includes('FROM products')) {
    const q = query(collection(db, 'products'), where('barcode', '==', String(params[0])));
    const snap = await getDocs(q);
    if (s.includes('id!=')) {
      const currentId = String(params[1]);
      const dup = snap.docs.find(d => d.id !== currentId);
      return dup ? { id: dup.id } : null;
    }
    return snap.empty ? null : { id: snap.docs[0].id };
  }

  console.warn('dbGet: unhandled SQL:', sql.substring(0, 120));
  return null;
}

export async function dbRun(sql: string, ...params: any[]) {
  try {
    // INSERT INTO products
    if (sql.startsWith('INSERT INTO products')) {
      const docData: any = { name: params[0], barcode: params[1] || null, price_purchase: params[2] || 0, price_cash: params[3] || 0, price_credit: params[4] || 0, stock: params[5] || 0, created_at: new Date().toISOString() };
      if (params[6] !== undefined) docData.fabrication_date = params[6];
      if (params[7] !== undefined) docData.expiry_date = params[7];
      const ref = await addDoc(collection(db, 'products'), docData);
      return { lastInsertRowid: ref.id, changes: 1 };
    }
    // UPDATE products
    if (sql.startsWith('UPDATE products')) {
      await updateDoc(doc(db, 'products', String(params[8])), {
        name: params[0], barcode: params[1], price_purchase: params[2], price_cash: params[3],
        price_credit: params[4], stock: params[5], fabrication_date: params[6] || null, expiry_date: params[7] || null,
      });
      return { changes: 1 };
    }
    // DELETE products
    if (sql.startsWith('DELETE FROM products')) {
      await deleteDoc(doc(db, 'products', String(params[0])));
      return { changes: 1 };
    }
    // INSERT INTO customers
    if (sql.startsWith('INSERT INTO customers')) {
      const ref = await addDoc(collection(db, 'customers'), { name: params[0], phone: params[1] || null, address: params[2] || null, notes: params[3] || null, created_at: new Date().toISOString() });
      return { lastInsertRowid: ref.id, changes: 1 };
    }
    // UPDATE customers
    if (sql.startsWith('UPDATE customers')) {
      await updateDoc(doc(db, 'customers', String(params[4])), { name: params[0], phone: params[1] || null, address: params[2] || null, notes: params[3] || null });
      return { changes: 1 };
    }
    // DELETE customers
    if (sql.startsWith('DELETE FROM customers')) {
      await deleteDoc(doc(db, 'customers', String(params[0])));
      return { changes: 1 };
    }
    // INSERT INTO suppliers
    if (sql.startsWith('INSERT INTO suppliers')) {
      const ref = await addDoc(collection(db, 'suppliers'), { name: params[0], phone: params[1] || null, address: params[2] || null, notes: params[3] || null, created_at: new Date().toISOString() });
      return { lastInsertRowid: ref.id, changes: 1 };
    }
    // UPDATE suppliers
    if (sql.startsWith('UPDATE suppliers')) {
      await updateDoc(doc(db, 'suppliers', String(params[4])), { name: params[0], phone: params[1] || null, address: params[2] || null, notes: params[3] || null });
      return { changes: 1 };
    }
    // DELETE suppliers
    if (sql.startsWith('DELETE FROM suppliers')) {
      await deleteDoc(doc(db, 'suppliers', String(params[0])));
      return { changes: 1 };
    }
    // INSERT INTO purchases
    if (sql.startsWith('INSERT INTO purchases')) {
      const ref = await addDoc(collection(db, 'purchases'), { supplier_id: params[0] || null, total: params[1], notes: params[2] || null, created_by: params[3] || null, created_at: new Date().toISOString() });
      return { lastInsertRowid: ref.id, changes: 1 };
    }
    // INSERT INTO purchase_items
    if (sql.startsWith('INSERT INTO purchase_items')) {
      const ref = await addDoc(collection(db, 'purchase_items'), { purchase_id: params[0], product_id: params[1], quantity: params[2], cost_price: params[3], subtotal: params[4] });
      // Update product stock
      const pRef = doc(db, 'products', String(params[1]));
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        await updateDoc(pRef, { stock: (pSnap.data().stock || 0) + params[2] });
      }
      return { lastInsertRowid: ref.id, changes: 1 };
    }
    // INSERT INTO installment_payments
    if (sql.startsWith('INSERT INTO installment_payments')) {
      const ref = await addDoc(collection(db, 'installment_payments'), {
        installment_id: params[0], amount: params[1], notes: params[2] || null,
        recorded_by: params[3] || null, payment_date: new Date().toISOString(),
      });
      // Update installment balance
      const iRef = doc(db, 'installments', String(params[0]));
      const iSnap = await getDoc(iRef);
      if (iSnap.exists()) {
        const i = iSnap.data();
        const newPaid = (i.paid_amount || 0) + params[1];
        const newRemaining = Math.max(0, (i.remaining || 0) - params[1]);
        await updateDoc(iRef, {
          paid_amount: newPaid, remaining: newRemaining,
          status: newRemaining <= 0 ? 'completed' : i.status,
        });
      }
      return { lastInsertRowid: ref.id, changes: 1 };
    }
    // INSERT INTO product_returns (return-product)
    if (sql.startsWith('INSERT INTO product_returns')) {
      const ref = await addDoc(collection(db, 'product_returns'), {
        sale_id: params[0] || null, product_id: params[1], quantity: params[2],
        price: params[3], total: params[2] * params[3], reason: params[4] || null,
        returned_by: params[5] || null, created_at: new Date().toISOString(),
      });
      // Increase product stock
      const pRef = doc(db, 'products', String(params[1]));
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        await updateDoc(pRef, { stock: (pSnap.data().stock || 0) + params[2] });
      }
      return { success: true, return_id: ref.id };
    }
    // INSERT INTO expenses
    if (sql.startsWith('INSERT INTO expenses')) {
      await addDoc(collection(db, 'expenses'), { amount: params[0], reason: params[1], recorded_by: params[2] || null, created_at: new Date().toISOString() });
      return { success: true };
    }
    // DELETE from any collection by id
    if (sql.startsWith('DELETE FROM')) {
      const table = sql.replace('DELETE FROM ', '').trim().split(' ')[0].replace('?', '');
      if (table === 'suppliers') {
        await deleteDoc(doc(db, 'suppliers', String(params[0])));
        return { changes: 1 };
      }
    }
    // Update barcode after insert
    if (sql.startsWith('UPDATE products SET barcode')) {
      await updateDoc(doc(db, 'products', String(params[1])), { barcode: params[0] });
      return { changes: 1 };
    }

    console.warn('dbRun: unhandled SQL:', sql.substring(0, 120));
    return { changes: 0 };
  } catch (e: any) {
    console.error('dbRun error:', e);
    return { success: false, error: e.message };
  }
}

// ─── Settings ───────────────────────────────────────────────────────────────────
export async function settingsGet() {
  const snap = await getDocs(collection(db, 'settings'));
  const obj: Record<string, string> = {};
  snap.forEach(d => obj[d.id] = d.data().value);
  return obj;
}

export async function settingsSet(key: string, value: string) {
  const snap = await getDocs(collection(db, 'settings'));
  let found = false;
  snap.forEach(d => { if (d.id === key) { found = true; } });
  if (found) {
    snap.forEach(async d => { if (d.id === key) await updateDoc(doc(db, 'settings', d.id), { value }); });
  } else {
    await setDoc(doc(db, 'settings', key), { value });
  }
  return { success: true };
}

// ─── Customers ─────────────────────────────────────────────────────────────────
export async function quickCreateCustomer(name: string, phone?: string) {
  const ref = await addDoc(collection(db, 'customers'), {
    name, phone: phone || null, address: '', notes: '', created_at: new Date().toISOString(),
  });
  return { success: true, id: ref.id };
}

export async function searchCustomers(searchQuery: string) {
  const snap = await getDocs(query(collection(db, 'customers'), orderBy('name')));
  const lower = searchQuery.toLowerCase();
  return docsToArray(snap).filter(c =>
    c.name.toLowerCase().includes(lower) || (c.phone || '').includes(searchQuery)
  );
}

// ─── Invoice ───────────────────────────────────────────────────────────────────
export async function generateInvoiceNumber(type: 'proforma' | 'final') {
  const prefix = type === 'proforma' ? 'PRO' : 'FAC';
  const year = new Date().getFullYear();
  const snap = await getDocs(query(collection(db, 'invoices'), where('type', '==', type), orderBy('created_at', 'desc'), limit(1)));
  let seq = 1;
  if (!snap.empty) {
    const last = snap.docs[0].data().invoice_number;
    if (last) {
      const parts = last.split('-');
      seq = parseInt(parts[parts.length - 1]) + 1;
    }
  }
  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
}

// ─── Sale ──────────────────────────────────────────────────────────────────────
export async function createSale(saleData: any) {
  try {
    const paidAmount = saleData.type === 'debt' ? (saleData.paid_amount || 0) : saleData.total;
    const debtAmount = saleData.type === 'debt' ? Math.max(0, saleData.total - (saleData.paid_amount || 0)) : 0;

    // Generate invoice number
    const year = new Date().getFullYear();
    const invSnap = await getDocs(query(collection(db, 'invoices'), where('type', '==', 'final'), orderBy('created_at', 'desc'), limit(1)));
    let seq = 1;
    if (!invSnap.empty) {
      const last = invSnap.docs[0].data().invoice_number;
      if (last) {
        const parts = last.split('-');
        seq = parseInt(parts[parts.length - 1]) + 1;
      }
    }
    const invoiceNumber = `FAC-${year}-${String(seq).padStart(5, '0')}`;

    // Use Firestore transaction
    const result = await runTransaction(db, async (transaction) => {
      // Step 1: ALL reads first
      const productSnapshots: Map<string, any> = new Map();
      for (const item of saleData.items) {
        const pRef = doc(db, 'products', String(item.product_id));
        const pSnap = await transaction.get(pRef);
        if (pSnap.exists()) {
          productSnapshots.set(String(item.product_id), pSnap.data());
        }
      }

      // Step 2: ALL writes after
      const saleRef = doc(collection(db, 'sales'));
      transaction.set(saleRef, {
        customer_id: saleData.customer_id || null,
        type: saleData.type,
        subtotal: saleData.subtotal,
        discount: saleData.discount || 0,
        total: saleData.total,
        paid_amount: paidAmount,
        debt_amount: debtAmount,
        status: 'completed',
        created_by: saleData.created_by || null,
        created_at: new Date().toISOString(),
      });

      for (const item of saleData.items) {
        transaction.set(doc(collection(db, 'sale_items')), {
          sale_id: saleRef.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          price_override: item.price_override || null,
          discount: item.discount || 0,
          subtotal: item.subtotal,
        });
        const pData = productSnapshots.get(String(item.product_id));
        if (pData) {
          transaction.update(doc(db, 'products', String(item.product_id)), { stock: Math.max(0, (pData.stock || 0) - item.quantity) });
        }
      }

      transaction.set(doc(collection(db, 'invoices')), {
        invoice_number: invoiceNumber,
        type: 'final',
        sale_id: saleRef.id,
        customer_id: saleData.customer_id || null,
        subtotal: saleData.subtotal,
        discount: saleData.discount || 0,
        total: saleData.total,
        payment_type: saleData.type,
        notes: saleData.notes || null,
        created_by: saleData.created_by || null,
        created_at: new Date().toISOString(),
      });

      let installment_id = null;
      if (saleData.type === 'credit' && saleData.installment) {
        const inst = saleData.installment;
        const instRef = doc(collection(db, 'installments'));
        transaction.set(instRef, {
          sale_id: saleRef.id,
          customer_id: saleData.customer_id,
          total_amount: inst.total_amount,
          advance: inst.advance,
          remaining: inst.remaining,
          months: inst.months,
          monthly_payment: inst.monthly_payment,
          paid_amount: inst.advance || 0,
          status: 'active',
          start_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        installment_id = instRef.id;
      }

      if (saleData.type === 'debt' && debtAmount > 0 && saleData.customer_id) {
        transaction.set(doc(collection(db, 'credit_debts')), {
          sale_id: saleRef.id,
          customer_id: saleData.customer_id,
          original_amount: debtAmount,
          remaining: debtAmount,
          status: 'active',
          created_at: new Date().toISOString(),
        });
      }

      return { sale_id: saleRef.id, invoice_number: invoiceNumber, installment_id };
    });

    return { success: true, ...result };
  } catch (e: any) {
    console.error('create-sale error:', e);
    return { success: false, error: e.message };
  }
}

// ─── Debt Management ───────────────────────────────────────────────────────────
export async function createDebtPayment(debtId: string, amount: number, notes?: string) {
  try {
    await addDoc(collection(db, 'debt_payments'), {
      debt_id: debtId, amount, notes: notes || null, payment_date: new Date().toISOString(),
    });
    // Update credit_debt balance using Firestore transaction
    await runTransaction(db, async (transaction) => {
      const dRef = doc(db, 'credit_debts', debtId);
      const dSnap = await transaction.get(dRef);
      if (dSnap.exists()) {
        const d = dSnap.data();
        const newRemaining = Math.max(0, (d.remaining || 0) - amount);
        let newStatus = d.status;
        if (newRemaining <= 0) newStatus = 'paid';
        else if (newRemaining < (d.original_amount || 0)) newStatus = 'partial';
        transaction.update(dRef, { remaining: newRemaining, status: newStatus });
      }
    });
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getCustomerDebts(customerId: string) {
  const snap = await getDocs(query(collection(db, 'credit_debts'), where('customer_id', '==', customerId), where('status', '!=', 'paid'), orderBy('created_at', 'desc')));
  const list = docsToArray(snap);
  // Attach invoice number
  for (const d of list) {
    if (d.sale_id) {
      const invSnap = await getDocs(query(collection(db, 'invoices'), where('sale_id', '==', d.sale_id), limit(1)));
      if (!invSnap.empty) d.invoice_number = invSnap.docs[0].data().invoice_number;
    }
  }
  return list;
}

export async function getAllDebts() {
  const snap = await getDocs(query(collection(db, 'credit_debts'), orderBy('created_at', 'desc')));
  const list = docsToArray(snap);
  const cSnap = await getDocs(collection(db, 'customers'));
  const cMap: any = {};
  cSnap.forEach(d => cMap[d.id] = d.data());
  return list.map(d => ({
    ...d,
    customer_name: cMap[d.customer_id]?.name || '-',
    customer_phone: cMap[d.customer_id]?.phone || '',
  }));
}

export async function getDebtPayments(debtId: string) {
  try {
    const snap = await getDocs(query(collection(db, 'debt_payments'), where('debt_id', '==', debtId), orderBy('payment_date', 'desc')));
    const list = docsToArray(snap);
    const uSnap = await getDocs(collection(db, 'users'));
    const uMap: any = {};
    uSnap.forEach(d => uMap[d.id] = d.data().username);
    return list.map(p => ({ ...p, username: uMap[p.recorded_by] || '-' }));
  } catch {
    const snap = await getDocs(query(collection(db, 'debt_payments'), where('debt_id', '==', debtId)));
    const list = docsToArray(snap);
    list.sort((a, b) => ((b.payment_date || '') + '').localeCompare((a.payment_date || '') + ''));
    const uSnap = await getDocs(collection(db, 'users'));
    const uMap: any = {};
    uSnap.forEach(d => uMap[d.id] = d.data().username);
    return list.map(p => ({ ...p, username: uMap[p.recorded_by] || '-' }));
  }
}

// ─── Returns ───────────────────────────────────────────────────────────────────
export async function returnProduct(data: any) {
  try {
    const ref = await addDoc(collection(db, 'product_returns'), {
      sale_id: data.sale_id || null,
      product_id: data.product_id,
      quantity: data.quantity,
      price: data.price,
      total: data.quantity * data.price,
      reason: data.reason || null,
      returned_by: data.returned_by || null,
      created_at: new Date().toISOString(),
    });
    // Increase stock
    const pRef = doc(db, 'products', String(data.product_id));
    const pSnap = await getDoc(pRef);
    if (pSnap.exists()) {
      await updateDoc(pRef, { stock: (pSnap.data().stock || 0) + data.quantity });
    }
    return { success: true, return_id: ref.id };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getTodayReturns() {
  if (isDayClosed()) return { total: 0, count: 0 };
  const today = new Date().toISOString().split('T')[0];
  const snap = await getDocs(collection(db, 'product_returns'));
  let total = 0, count = 0;
  snap.forEach(d => {
    if (d.data().created_at?.startsWith(today)) {
      total += (d.data().total || 0);
      count++;
    }
  });
  return { total, count };
}

// ─── Expenses ──────────────────────────────────────────────────────────────────
export async function createExpense(amount: number, reason: string) {
  if (!reason || !reason.trim()) return { success: false, error: 'Reason is required' };
  await addDoc(collection(db, 'expenses'), {
    amount, reason, recorded_by: null, created_at: new Date().toISOString(),
  });
  return { success: true };
}

export async function getTodayExpenses() {
  if (isDayClosed()) return { total: 0, items: [] };
  const today = new Date().toISOString().split('T')[0];
  const snap = await getDocs(collection(db, 'expenses'));
  const items: any[] = [];
  snap.forEach(d => {
    if (d.data().created_at?.startsWith(today)) {
      items.push({ id: d.id, ...d.data(), recorded_by_name: '-' });
    }
  });
  items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const total = items.reduce((s, i) => s + i.amount, 0);
  return { total, items };
}

// ─── Cash Movements ────────────────────────────────────────────────────────────
export async function addCashMovement(type: 'in' | 'out', amount: number, reason: string, recordedBy?: string) {
  try {
    if (!reason || !reason.trim()) return { success: false, error: 'Reason is required' };
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };
    const ref = await addDoc(collection(db, 'cash_movements'), {
      type, amount, reason, recorded_by: recordedBy || null, created_at: new Date().toISOString(),
    });
    return { success: true, id: ref.id };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getTodayCashMovements() {
  if (isDayClosed()) return { total_in: 0, total_out: 0, items: [] };
  const today = new Date().toISOString().split('T')[0];
  const snap = await getDocs(collection(db, 'cash_movements'));
  const items: any[] = [];
  snap.forEach(d => {
    if (d.data().created_at?.startsWith(today)) {
      items.push({ id: d.id, ...d.data() });
    }
  });
  items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  let total_in = 0, total_out = 0;
  for (const it of items) {
    if (it.type === 'in') total_in += it.amount;
    else total_out += it.amount;
  }
  return { total_in, total_out, net: total_in - total_out, items };
}

export async function getAllCashMovements() {
  const snap = await getDocs(query(collection(db, 'cash_movements'), orderBy('created_at', 'desc'))); // composite index needed: created_at DESC
  const list = docsToArray(snap);
  const uSnap = await getDocs(collection(db, 'users'));
  const uMap: any = {};
  uSnap.forEach(d => uMap[d.id] = d.data().username);
  return list.map(m => ({ ...m, recorded_by_name: uMap[m.recorded_by] || '-' }));
}

// ─── Day Close ─────────────────────────────────────────────────────────────────
export async function dayCloseSummary() {
  const today = new Date().toISOString().split('T')[0];
  const salesSnap = await getDocs(collection(db, 'sales'));
  let count = 0, cashTotal = 0, creditTotal = 0, debtTotal = 0, totalSum = 0;
  const sales: any[] = [];

  const cSnap = await getDocs(collection(db, 'customers'));
  const cMap: any = {};
  cSnap.forEach(d => cMap[d.id] = d.data().name);

  for (const d of salesSnap.docs) {
    const s = d.data();
    if (s.created_at?.startsWith(today)) {
      count++;
      const amt = s.total - (s.discount || 0);
      totalSum += amt;
      if (s.type === 'cash') cashTotal += amt;
      else if (s.type === 'credit') creditTotal += amt;
      else if (s.type === 'debt') debtTotal += amt;
      sales.push({ id: d.id, ...s, customer_name: cMap[s.customer_id] || '-' });
    }
  }
  sales.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  const retSnap = await getDocs(collection(db, 'product_returns'));
  let returnsTotal = 0;
  retSnap.forEach(d => { if (d.data().created_at?.startsWith(today)) returnsTotal += (d.data().total || 0); });

  const expSnap = await getDocs(collection(db, 'expenses'));
  let expensesTotalVal = 0;
  expSnap.forEach(d => { if (d.data().created_at?.startsWith(today)) expensesTotalVal += (d.data().amount || 0); });

  // Debt collected today
  const debtPaySnap = await getDocs(collection(db, 'debt_payments'));
  let debtCollected = 0;
  debtPaySnap.forEach(d => { if (d.data().payment_date?.startsWith(today)) debtCollected += (d.data().amount || 0); });

  // Cash movements today
  const cmSnap = await getDocs(collection(db, 'cash_movements'));
  let cashIn = 0, cashOut = 0;
  cmSnap.forEach(d => {
    if (d.data().created_at?.startsWith(today)) {
      if (d.data().type === 'in') cashIn += (d.data().amount || 0);
      else cashOut += (d.data().amount || 0);
    }
  });

  const netCash = totalSum - returnsTotal - expensesTotalVal + debtCollected + cashIn - cashOut;

  // Check if already closed today
  const closeSnap = await getDocs(query(collection(db, 'day_closing'), orderBy('closed_at', 'desc'), limit(1)));
  let isClosed = false;
  let closedAt: string | null = null;
  let closedBy: string | null = null;
  for (const d of closeSnap.docs) {
    if (d.data().closed_at?.startsWith(today)) {
      isClosed = true;
      closedAt = d.data().closed_at;
      closedBy = d.data().closed_by_name || null;
      break;
    }
  }

  return { totalSales: totalSum, cashTotal, creditTotal, debtTotal, count, sales, returnsTotal, expensesTotal: expensesTotalVal, debtCollected, cashIn, cashOut, netCash, isClosed, closedAt, closedBy };
}

export async function dayCloseConfirm(notes?: string) {
  const today = new Date().toISOString().split('T')[0];
  setDayClosed();
  const summary = await dayCloseSummary();

  await addDoc(collection(db, 'day_closing'), {
    closed_at: new Date().toISOString(),
    opened_at: today + ' 00:00:00',
    total_sales: summary.totalSales,
    cash_total: summary.cashTotal,
    credit_total: summary.creditTotal,
    debt_total: summary.debtTotal,
    returns_total: summary.returnsTotal,
    expenses_total: summary.expensesTotal,
    debt_collected: summary.debtCollected,
    cash_in: summary.cashIn,
    cash_out: summary.cashOut,
    net_cash: summary.netCash,
    transaction_count: summary.count,
    notes: notes || null,
    closed_by: null,
  });

  return { success: true, netCash: summary.netCash, returnsTotal: summary.returnsTotal, expensesTotal: summary.expensesTotal, debtCollected: summary.debtCollected, cashIn: summary.cashIn, cashOut: summary.cashOut };
}

export async function dayCloseStatus() {
  const today = new Date().toISOString().split('T')[0];
  const snap = await getDocs(query(collection(db, 'day_closing'), orderBy('closed_at', 'desc'), limit(1)));
  for (const d of snap.docs) {
    if (d.data().closed_at?.startsWith(today)) return true;
  }
  return false;
}
