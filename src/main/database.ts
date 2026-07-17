import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

function getDbPath() {
  return process.env.NODE_ENV === 'development'
    ? path.join(process.cwd(), 'pos_data.db')
    : path.join(app.getPath('userData'), 'pos_data.db');
}

let dbPath = getDbPath();
let db = new Database(dbPath);

function applySchema(database: any) {
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'seller')) DEFAULT 'seller',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE,
      price_purchase REAL NOT NULL DEFAULT 0,
      price_cash REAL NOT NULL DEFAULT 0,
      price_credit REAL NOT NULL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      fabrication_date TEXT,
      expiry_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('cash', 'credit', 'debt')),
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      debt_amount REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      price_override REAL,
      discount REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('proforma', 'final')),
      sale_id INTEGER,
      customer_id INTEGER,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      payment_type TEXT CHECK(payment_type IN ('cash', 'credit', 'debt')),
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      advance REAL DEFAULT 0,
      remaining REAL NOT NULL,
      months INTEGER NOT NULL,
      monthly_payment REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'overdue')),
      start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS installment_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installment_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      recorded_by INTEGER,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(installment_id) REFERENCES installments(id),
      FOREIGN KEY(recorded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      cost_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY(purchase_id) REFERENCES purchases(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS day_closing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      opened_at DATETIME,
      total_sales REAL DEFAULT 0,
      cash_total REAL DEFAULT 0,
      credit_total REAL DEFAULT 0,
      debt_total REAL DEFAULT 0,
      returns_total REAL DEFAULT 0,
      expenses_total REAL DEFAULT 0,
      debt_collected REAL DEFAULT 0,
      net_cash REAL DEFAULT 0,
      transaction_count INTEGER DEFAULT 0,
      notes TEXT,
      closed_by INTEGER,
      FOREIGN KEY(closed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS credit_debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      original_amount REAL NOT NULL,
      remaining REAL NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'partial', 'paid', 'overdue')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      recorded_by INTEGER,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(debt_id) REFERENCES credit_debts(id),
      FOREIGN KEY(recorded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS product_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL,
      reason TEXT,
      returned_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(product_id) REFERENCES products(id),
      FOREIGN KEY(returned_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      recorded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(recorded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('in', 'out')),
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      recorded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(recorded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
      local_id INTEGER,
      parent_op INTEGER,
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

    CREATE TRIGGER IF NOT EXISTS decrease_stock_after_sale
    AFTER INSERT ON sale_items
    BEGIN
      UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
    END;

    CREATE TRIGGER IF NOT EXISTS increase_stock_after_purchase
    AFTER INSERT ON purchase_items
    BEGIN
      UPDATE products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_installment_paid
    AFTER INSERT ON installment_payments
    BEGIN
      UPDATE installments SET
        paid_amount = paid_amount + NEW.amount,
        remaining = remaining - NEW.amount,
        status = CASE WHEN (remaining - NEW.amount) <= 0 THEN 'completed' ELSE status END
      WHERE id = NEW.installment_id;
    END;

    CREATE TRIGGER IF NOT EXISTS increase_stock_after_return
    AFTER INSERT ON product_returns
    BEGIN
      UPDATE products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_debt_after_payment
    AFTER INSERT ON debt_payments
    BEGIN
      UPDATE credit_debts SET
        remaining = remaining - NEW.amount,
        status = CASE
          WHEN (remaining - NEW.amount) <= 0 THEN 'paid'
          WHEN (remaining - NEW.amount) < original_amount THEN 'partial'
          ELSE status
        END
      WHERE id = NEW.debt_id;
    END;
  `);
}

function seedDefaults(database: any) {
  const adminExists = database.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    database.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')")
      .run('admin', hash);
  }

  const settingsDefaults: Record<string, string> = {
    store_name: 'My Electronics Store',
    store_phone: '',
    store_address: '',
    store_capital: '',
    store_logo: '',
    currency: 'DZD',
    language: 'ar',
    theme: 'dark',
    printer_barcode: '',
    printer_receipt: '',
    printer_invoice: '',
    auto_print_receipt: '1',
    label_height_mm: '20',
    expiry_alert_days: '4',
  };
  const insertSetting = database.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(settingsDefaults)) {
    insertSetting.run(k, v);
  }
}

applySchema(db);

// Migrations for existing databases
try { db.exec("ALTER TABLE products ADD COLUMN price_purchase REAL NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE sales ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE sales ADD COLUMN debt_amount REAL NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE day_closing ADD COLUMN debt_total REAL NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE day_closing ADD COLUMN returns_total REAL NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE day_closing ADD COLUMN expenses_total REAL NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE day_closing ADD COLUMN debt_collected REAL NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE day_closing ADD COLUMN net_cash REAL NOT NULL DEFAULT 0"); } catch {}
// Fix sales CHECK constraint for existing databases (add 'debt' type)
// Using table recreation because SQLite caches parsed constraints in memory
// and even PRAGMA writable_schema doesn't force a re-parse of CHECK constraints.
try {
  const migDone = db.prepare(`SELECT value FROM settings WHERE key = 'mig_sales_debt'`).get() as any;
  if (!migDone) {
    db.exec(`PRAGMA foreign_keys = OFF`);
    db.exec(`DROP TABLE IF EXISTS sales_rebuild`);
    db.exec(`
      CREATE TABLE sales_rebuild (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        type TEXT NOT NULL CHECK(type IN ('cash', 'credit', 'debt')),
        subtotal REAL NOT NULL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0,
        debt_amount REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'completed',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(customer_id) REFERENCES customers(id),
        FOREIGN KEY(created_by) REFERENCES users(id)
      )
    `);
    db.exec(`INSERT INTO sales_rebuild SELECT * FROM sales`);
    db.exec(`DROP TABLE sales`);
    db.exec(`ALTER TABLE sales_rebuild RENAME TO sales`);
    db.exec(`PRAGMA foreign_keys = ON`);
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('mig_sales_debt', '1')`).run();
    console.log('Migration: recreated sales table with debt type in CHECK constraint');
  } else {
    console.log('Migration: sales CHECK constraint already migrated, skipping');
  }
} catch (e) { console.error('Migration recreate sales table:', e); }

// Backfill missing barcodes for existing products
try {
  db.exec(`UPDATE products SET barcode = SUBSTR('000000' || CAST(id AS TEXT), -6) WHERE barcode IS NULL OR barcode = ''`);
} catch (e) { console.error('Migration backfill barcodes:', e); }

// Add fabrication_date and expiry_date columns
try { db.exec("ALTER TABLE products ADD COLUMN fabrication_date TEXT"); } catch {}
try { db.exec("ALTER TABLE products ADD COLUMN expiry_date TEXT"); } catch {}
// Add price_credit column for existing databases
try { db.exec("ALTER TABLE products ADD COLUMN price_credit REAL NOT NULL DEFAULT 0"); } catch {}
// Add notes column to customers
try { db.exec("ALTER TABLE customers ADD COLUMN notes TEXT"); } catch {}
// Fix STORED_GENERATED column issue (recreate products table without GENERATED columns)


seedDefaults(db);

function closeAndReplace(newPath: string) {
  db.close();
  dbPath = newPath;
  fs.copyFileSync(newPath, getDbPath());
  db = new Database(getDbPath());
  applySchema(db);
}

function getCurrentDbPath() {
  return getDbPath();
}

function getDbSize() {
  try {
    const stats = fs.statSync(getDbPath());
    return stats.size;
  } catch {
    return 0;
  }
}

export default db;
export { bcrypt, getCurrentDbPath, getDbSize, closeAndReplace, applySchema };
