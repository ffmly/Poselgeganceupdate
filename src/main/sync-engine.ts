import { createRequire } from 'module';
createRequire(import.meta.url);

let sqliteDb: any = null;
let firestoreHandlers: any = null;
let syncTimer: any = null;
let _onlineStatus = true;

export function initSyncEngine(db: any, handlers: any) {
  sqliteDb = db;
  firestoreHandlers = handlers;

  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
      local_id INTEGER,
      data_json TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','syncing','synced','failed')),
      error TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      synced_at TEXT,
      retry_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sync_ids (
      table_name TEXT NOT NULL,
      local_id INTEGER NOT NULL,
      firestore_id TEXT NOT NULL,
      synced_at TEXT DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (table_name, local_id)
    );
    CREATE TABLE IF NOT EXISTS firestore_cache (
      collection TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      data TEXT NOT NULL,
      cached_at TEXT DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (collection, doc_id)
    );
  `);

  syncTimer = setInterval(processQueue, 30000);
  processQueue();
}

export function stopSyncEngine() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

export function isOnline() { return _onlineStatus; }
export function setOnline(v: boolean) { _onlineStatus = v; }

export function logSyncOp(table: string, op: string, localId: number | null, data?: any) {
  if (!sqliteDb) return -1;
  const stmt = sqliteDb.prepare(
    'INSERT INTO sync_queue (table_name, operation, local_id, data_json) VALUES (?, ?, ?, ?)'
  );
  const r = stmt.run(table, op, localId, data ? JSON.stringify(data) : null);
  return Number(r.lastInsertRowid);
}

export function markSynced(opId: number) {
  if (!sqliteDb) return;
  sqliteDb.prepare("UPDATE sync_queue SET status = 'synced', synced_at = datetime('now','localtime') WHERE id = ?").run(opId);
}

export function markFailed(opId: number, error: string) {
  if (!sqliteDb) return;
  sqliteDb.prepare("UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1, error = ? WHERE id = ?").run(error, opId);
}

export function recordSyncId(table: string, localId: number, firestoreId: string) {
  if (!sqliteDb) return;
  sqliteDb.prepare('INSERT OR REPLACE INTO sync_ids (table_name, local_id, firestore_id) VALUES (?, ?, ?)').run(table, localId, firestoreId);
}

export function getFirestoreId(table: string, localId: number): string | null {
  if (!sqliteDb) return null;
  const row = sqliteDb.prepare('SELECT firestore_id FROM sync_ids WHERE table_name = ? AND local_id = ?').get(table, localId) as any;
  return row?.firestore_id || null;
}

export function getPendingCount(): number {
  if (!sqliteDb) return 0;
  const row = sqliteDb.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'").get() as any;
  return row?.count || 0;
}

export function cacheFirestoreResults(collection: string, docs: { id: string; data: any }[]) {
  if (!sqliteDb || docs.length === 0) return;
  const upsert = sqliteDb.prepare(
    'INSERT OR REPLACE INTO firestore_cache (collection, doc_id, data) VALUES (?, ?, ?)'
  );
  const tx = sqliteDb.transaction(() => {
    for (const d of docs) {
      if (!d.id) continue;
      upsert.run(collection, String(d.id), JSON.stringify(d.data));
    }
  });
  tx();
}

export function getCachedResults(collection: string): { id: string; data: any }[] {
  if (!sqliteDb) return [];
  const rows = sqliteDb.prepare(
    'SELECT doc_id, data FROM firestore_cache WHERE collection = ? ORDER BY cached_at DESC'
  ).all(collection) as any[];
  return rows.map(r => ({ id: r.doc_id, data: JSON.parse(r.data) }));
}

export async function processQueue() {
  if (!sqliteDb || !firestoreHandlers) return;
  try {
    const items = sqliteDb.prepare(
      "SELECT * FROM sync_queue WHERE status = 'pending' AND retry_count < 10 ORDER BY id ASC LIMIT 10"
    ).all() as any[];
    if (items.length === 0) return;

    for (const item of items) {
      sqliteDb.prepare("UPDATE sync_queue SET status = 'syncing' WHERE id = ?").run(item.id);
      try {
        await syncItem(item);
        markSynced(item.id);
        _onlineStatus = true;
      } catch (e: any) {
        const msg = (e?.message || '').toLowerCase();
        if (msg.includes('offline') || msg.includes('network') || msg.includes('fetch') || msg.includes('unavailable') || msg.includes('timeout') || msg.includes('internet')) {
          sqliteDb.prepare("UPDATE sync_queue SET status = 'pending' WHERE id = ?").run(item.id);
          _onlineStatus = false;
          return;
        }
        markFailed(item.id, e.message || 'Unknown');
      }
    }
  } catch (e) {
    console.error('sync error:', e);
  }
}

async function syncItem(item: any) {
  const { table_name, operation, local_id, data_json } = item;
  if (!firestoreHandlers || !sqliteDb) return;

  const fsTable = tableToFirestore(table_name);
  if (!fsTable) return;

  const { db, addDoc, collection, doc, getDoc, updateDoc, deleteDoc } = firestoreHandlers;

  if (operation === 'DELETE') {
    const firestoreId = local_id ? getFirestoreId(table_name, local_id) : null;
    if (firestoreId) {
      await deleteDoc(doc(db, fsTable, firestoreId));
    }
    return;
  }

  if (operation === 'UPDATE') {
    const firestoreId = local_id ? getFirestoreId(table_name, local_id) : null;
    if (firestoreId && data_json) {
      const data = JSON.parse(data_json);
      delete data.id;
      await updateDoc(doc(db, fsTable, firestoreId), data);
    }
    return;
  }

  if (operation === 'INSERT') {
    const data = data_json ? JSON.parse(data_json) : {};
    if (table_name === 'sales') {
      const fullData = {
        ...data,
        items: data.items || [],
        installment: data.installment || null,
      };
      const result = await firestoreHandlers.createSale(fullData);
      if (result.success && local_id) {
        recordSyncId('sales', local_id, result.sale_id);
        if (result.installment_id) {
          const instRow = sqliteDb.prepare(
            "SELECT id FROM installments WHERE sale_id = ? ORDER BY id DESC LIMIT 1"
          ).get(local_id) as any;
          if (instRow) recordSyncId('installments', instRow.id, result.installment_id);
        }
      }
      return;
    }

    const cleanData = { ...data };
    delete cleanData.id;

    if (table_name === 'debt_payments') {
      const debtFsId = data.debt_firestore_id || (data.debt_local_id ? getFirestoreId('credit_debts', data.debt_local_id) : null);
      if (debtFsId) {
        await firestoreHandlers.createDebtPayment(debtFsId, data.amount, data.notes);
      }
      return;
    }

    if (table_name === 'product_returns') {
      await firestoreHandlers.returnProduct(data);
      return;
    }

    if (table_name === 'expenses') {
      await firestoreHandlers.createExpense(data.amount, data.reason);
      return;
    }

    if (table_name === 'installment_payments') {
      const instFsId = data.installment_firestore_id ||
        (data.installment_local_id ? getFirestoreId('installments', data.installment_local_id) : null);
      if (instFsId) {
        const ref = await addDoc(collection(db, 'installment_payments'), {
          installment_id: instFsId, amount: data.amount, notes: data.notes || null,
          recorded_by: data.recorded_by || null, payment_date: data.payment_date || new Date().toISOString(),
        });
        const iRef = doc(db, 'installments', instFsId);
        const iSnap = await getDoc(iRef);
        if (iSnap.exists()) {
          const inst = iSnap.data();
          const newPaid = (inst.paid_amount || 0) + data.amount;
          const newRemaining = Math.max(0, (inst.remaining || 0) - data.amount);
          await updateDoc(iRef, { paid_amount: newPaid, remaining: newRemaining, status: newRemaining <= 0 ? 'completed' : inst.status });
        }
        if (local_id) recordSyncId(table_name, local_id, ref.id);
      }
      return;
    }

    if (table_name === 'settings') {
      await firestoreHandlers.settingsSet(data.key, data.value);
      return;
    }

    const ref = await addDoc(collection(db, fsTable), { ...cleanData, created_at: new Date().toISOString() });
    if (local_id) recordSyncId(table_name, local_id, ref.id);
  }
}

function tableToFirestore(table: string): string | null {
  const map: Record<string, string> = {
    products: 'products', customers: 'customers', suppliers: 'suppliers',
    sales: 'sales', sale_items: 'sale_items', invoices: 'invoices',
    purchases: 'purchases', purchase_items: 'purchase_items',
    installments: 'installments', installment_payments: 'installment_payments',
    credit_debts: 'credit_debts', debt_payments: 'debt_payments',
    product_returns: 'product_returns', expenses: 'expenses',
    settings: 'settings', day_closing: 'day_closing',
  };
  return map[table] || null;
}
