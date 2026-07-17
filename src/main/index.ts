import { app, BrowserWindow, ipcMain, Menu, net, dialog } from 'electron';
import { setUpdater } from './updater';

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

const require = createRequire(import.meta.url);
const QRCode = require('qrcode');

const ELECTRON_DIR = path.dirname(fileURLToPath(import.meta.url));

app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null;

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(ELECTRON_DIR, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#0f0f10',
    titleBarStyle: 'default',
    icon: path.join(ELECTRON_DIR, '../public/icon.png'),
  });
  console.log('Preload path:', path.join(ELECTRON_DIR, '../preload/index.mjs'));

  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(ELECTRON_DIR, '../renderer/index.html'));
  }

  mainWindow.webContents.on('console-message', (_, level, message) => {
    console.log(`[renderer ${level}] ${message}`);
  });

  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow?.setFullScreen(!mainWindow?.isFullScreen());
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.maximize();
    setUpdater(mainWindow!);
  });
}

// ─── SQLite Local Database + Sync Engine ──────────────────────────────────────
import sqliteDb from './database';
import { initSyncEngine, processQueue, logSyncOp, getPendingCount, isOnline, setOnline, cacheFirestoreResults, getCachedResults } from './sync-engine';
import * as fsHandlers from './firestore-handlers';

let syncInitialized = false;
let printPollerTimer: any = null;

async function executePrintCommand(html: string, printerName?: string) {
  let pw: BrowserWindow | null = null;
  try {
    pw = new BrowserWindow({
      width: 400, height: 600, show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false },
    });
    await pw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise(r => setTimeout(r, 800));
    const opts: any = { silent: true, margins: { marginType: 'none' }, header: '', footer: '', printBackground: true };
    if (printerName) opts.deviceName = printerName;
    await new Promise<boolean>(resolve => pw!.webContents.print(opts, (ok: boolean) => resolve(ok)));
    pw.close();
    return true;
  } catch (e) {
    if (pw && !pw.isDestroyed()) pw.close();
    throw e;
  }
}

function startPrintCommandPoller() {
  if (printPollerTimer) clearInterval(printPollerTimer);
  printPollerTimer = setInterval(async () => {
    try {
      const q = fsHandlers.query(fsHandlers.collection(fsHandlers.db, 'print_commands'), fsHandlers.where('status', '==', 'pending'));
      const snap = await fsHandlers.getDocs(q);
      if (snap.empty) return;

      for (const d of snap.docs) {
        const cmd = d.data();
        console.log('Print command received:', cmd.type, cmd.sale_id?.slice(0, 8));

        try {
          if (cmd.type === 'print_receipt' && cmd.sale_data) {
            const data = cmd.sale_data;
            const cur = cmd.currency || 'DZD';
            const itemsHtml = (data.items || []).map((i: any) =>
              `<tr><td style="padding:3px 4px;border-bottom:1px solid #ccc">${i.product_name || i.name || '-'}</td>
               <td style="padding:3px 4px;border-bottom:1px solid #ccc;text-align:center">${i.quantity}</td>
               <td style="padding:3px 4px;border-bottom:1px solid #ccc;text-align:right">${i.price} ${cur}</td>
               <td style="padding:3px 4px;border-bottom:1px solid #ccc;text-align:right">${i.subtotal} ${cur}</td></tr>`
            ).join('');
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
body{font-family:'Segoe UI','Arial','Traditional Arabic','Consolas','Courier New',monospace;padding:8px;font-size:11px;width:72mm}
h1{font-size:14px;text-align:center;margin:4px 0}
h2{font-size:12px;text-align:center;margin:2px 0;color:#555}
table{width:100%;border-collapse:collapse;margin:4px 0}
th{padding:3px 4px;font-size:10px;border-bottom:2px solid #000;text-align:left}
td{padding:3px 4px}
.total{font-size:13px;font-weight:bold;text-align:right;margin:4px 0;border-top:2px solid #000;padding-top:4px}
.footer{text-align:center;font-size:9px;color:#888;margin-top:8px;border-top:1px dashed #ccc;padding-top:6px}
</style></head><body dir="auto">
<h1 dir="auto">${cmd.store_name || 'Store'}</h1>
<h2>Receipt</h2>
<p style="font-size:10px">${new Date(cmd.created_at || Date.now()).toLocaleString()}</p>
<p style="font-size:10px">Invoice: #${data.id?.slice(0,8) || '-'}</p>
<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
<div class="total">Total: ${data.total} ${cur}</div>
<div class="footer">Thank you for your business!</div>
</body></html>`;
            await executePrintCommand(html, cmd.printer_name || undefined);
          }

          await fsHandlers.updateDoc(fsHandlers.doc(fsHandlers.db, 'print_commands', d.id), {
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: 'windows-app',
          });
        } catch (cmdErr) {
          console.error('Print command failed:', cmdErr);
          await fsHandlers.updateDoc(fsHandlers.doc(fsHandlers.db, 'print_commands', d.id), {
            status: 'failed',
            error: (cmdErr as any)?.message || 'error',
          });
        }
      }
    } catch (e) {
      // offline or collection doesn't exist — skip silently
    }
  }, 5000);
}

async function initOfflineSupport() {
  try {
    initSyncEngine(sqliteDb, fsHandlers);
    syncInitialized = true;
    console.log('Sync engine initialized');

    startPrintCommandPoller();

    if (net.isOnline()) {
      setOnline(true);
      try {
        const colMap = [
          'products', 'customers', 'suppliers', 'settings', 'users',
          'sales', 'sale_items', 'invoices',
          'purchases', 'purchase_items',
          'installments', 'installment_payments',
          'credit_debts', 'debt_payments',
          'product_returns', 'expenses', 'day_closing',
        ];
        await Promise.all(colMap.map(async (col) => {
          try {
            const snap = await fsHandlers.getDocs(fsHandlers.collection(fsHandlers.db, col));
            if (!snap.empty) {
              const docs = snap.docs.map((d: any) => ({ id: d.id, data: d.data() }));
              cacheFirestoreResults(col, docs);
            }
          } catch (e) {
            console.warn(`  Skip caching ${col}:`, (e as any)?.message);
          }
        }));
        console.log('Initial Firestore cache populated (' + colMap.length + ' collections)');
      } catch (e) {
        console.warn('Initial cache fetch skipped:', (e as any)?.message);
      }
    }
  } catch (e) {
    console.error('Sync engine init error:', e);
  }
}

app.whenReady().then(async () => {
  createWindow();
  initOfflineSupport();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── Firestore handlers ────────────────────────────────────────────────────────
import {
  authLogin, authGetUsers, authCreateUser, authDeleteUser, authResetPassword,
  dbQuery, dbGet, dbRun,
  settingsGet, settingsSet,
  quickCreateCustomer, searchCustomers,
  generateInvoiceNumber, createSale,
  createDebtPayment, getCustomerDebts, getAllDebts, getDebtPayments,
  returnProduct, getTodayReturns,
  createExpense, getTodayExpenses,
  dayCloseSummary, dayCloseConfirm, dayCloseStatus,
  addCashMovement, getTodayCashMovements, getAllCashMovements,
} from './firestore-handlers';

// ─── Auth IPC ──────────────────────────────────────────────────────────────────

ipcMain.handle('auth-login', async (_, username: string, password: string) => {
  return await authLogin(username, password);
});

ipcMain.handle('auth-get-users', async () => {
  return await authGetUsers();
});

ipcMain.handle('auth-create-user', async (_, username: string, password: string, role: string) => {
  return await authCreateUser(username, password, role);
});

ipcMain.handle('auth-delete-user', async (_, id: string) => {
  return await authDeleteUser(id);
});

ipcMain.handle('auth-reset-password', async (_, id: string, newPassword: string) => {
  return await authResetPassword(id, newPassword);
});

// ─── Generic DB IPC (Firestore with SQLite fallback) ───────────────────────────

function getSqliteTableFromSql(sql: string): string | null {
  const lower = sql.toLowerCase().trim();
  const tables = ['products','customers','suppliers','sales','sale_items','invoices','purchases',
    'purchase_items','installments','installment_payments','credit_debts','debt_payments',
    'product_returns','expenses','settings','day_closing','users'];
  for (const t of tables) {
    if (lower.includes(` ${t} `) || lower.startsWith(`select.*from ${t}`) || lower.startsWith(`select * from ${t}`) ||
        lower.startsWith(`insert into ${t}`) || lower.startsWith(`update ${t}`) || lower.startsWith(`delete from ${t}`)) {
      return t;
    }
  }
  return null;
}

ipcMain.handle('db-query', async (_, sql: string, ...params: any[]) => {
  try {
    const result = await dbQuery(sql, ...params);
    if (result && Array.isArray(result) && result.length > 0 && syncInitialized) {
      try {
        const table = getSqliteTableFromSql(sql);
        if (table) {
          const docs = result.map((r: any) => ({ id: r.id, data: r }));
          cacheFirestoreResults(table, docs);
        }
      } catch (_) {}
    }
    return result;
  } catch (e: any) {
    console.error('db-query error, trying SQLite cache:', e?.message);
    if (syncInitialized) {
      const table = getSqliteTableFromSql(sql);
      if (table) {
        try {
          const cached = getCachedResults(table);
          if (cached.length > 0) return cached.map(c => c.data);
        } catch (_) {}
      }
    }
    return [];
  }
});

ipcMain.handle('db-get', async (_, sql: string, ...params: any[]) => {
  try {
    const result = await dbGet(sql, ...params);
    if (result && syncInitialized) {
      try {
        const table = getSqliteTableFromSql(sql);
        if (table) {
          const docs = Array.isArray(result) ? result : [result];
          const cached = docs.map((r: any) => ({ id: r.id, data: r }));
          cacheFirestoreResults(table, cached);
        }
      } catch (_) {}
    }
    return result;
  } catch (e: any) {
    console.error('db-get error, trying SQLite cache:', e?.message);
    if (syncInitialized) {
      const table = getSqliteTableFromSql(sql);
      if (table) {
        try {
          const cached = getCachedResults(table);
          if (cached.length > 0) return cached[0]?.data || null;
        } catch (_) {}
      }
    }
    return null;
  }
});

ipcMain.handle('db-run', async (_, sql: string, ...params: any[]) => {
  try {
    return await dbRun(sql, ...params);
  } catch (e: any) {
    console.error('db-run error, queueing for sync:', e?.message);
    // Queue for later sync
    if (syncInitialized) {
      const table = getSqliteTableFromSql(sql);
      if (table) {
        const lower = sql.toLowerCase().trim();
        const op = lower.startsWith('insert') ? 'INSERT' : lower.startsWith('update') ? 'UPDATE' : 'DELETE';
        logSyncOp(table, op, null, { sql, params });
        setOnline(false);
      }
    }
    return { success: false, error: e?.message, queued: true };
  }
});

// ─── Invoice Number Generator ──────────────────────────────────────────────────

ipcMain.handle('generate-invoice-number', async (_, type: 'proforma' | 'final') => {
  return await generateInvoiceNumber(type);
});

// ─── Sale with invoice (transaction) ──────────────────────────────────────────

ipcMain.handle('create-sale', async (_, saleData: any) => {
  try {
    return await createSale(saleData);
  } catch (e: any) {
    console.error('create-sale error, queueing for sync:', e?.message);
    if (syncInitialized) {
      logSyncOp('sales', 'INSERT', null, saleData);
      setOnline(false);
      return { success: true, offline: true, sale_id: 'offline-' + Date.now(), invoice_number: 'PENDING', installment_id: null };
    }
    return { success: false, error: e?.message };
  }
});

// ─── Sync Status IPC ──────────────────────────────────────────────────────────

ipcMain.handle('sync-status', async () => {
  const pending = syncInitialized ? getPendingCount() : 0;
  return { online: isOnline(), pending };
});

ipcMain.handle('sync-process-now', async () => {
  if (syncInitialized) {
    await processQueue();
  }
  return { done: true };
});

// ─── Settings IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('settings-get', async () => {
  return await settingsGet();
});

ipcMain.handle('settings-set', async (_, key: string, value: string) => {
  return await settingsSet(key, value);
});

// ─── Quick Customer Creation ──────────────────────────────────────────────────

ipcMain.handle('quick-create-customer', async (_, name: string, phone?: string) => {
  return await quickCreateCustomer(name, phone);
});

ipcMain.handle('search-customers', async (_, query: string) => {
  return await searchCustomers(query);
});

// ─── Credit Debt Management ──────────────────────────────────────────────────

ipcMain.handle('create-debt-payment', async (_, debtId: string, amount: number, notes?: string) => {
  try {
    return await createDebtPayment(debtId, amount, notes);
  } catch (e: any) {
    console.error('create-debt-payment error, queueing:', e?.message);
    if (syncInitialized) {
      logSyncOp('debt_payments', 'INSERT', null, { debt_local_id: debtId, amount, notes, payment_date: new Date().toISOString() });
      setOnline(false);
      return { success: true, offline: true };
    }
    return { success: false, error: e?.message };
  }
});

ipcMain.handle('get-customer-debts', async (_, customerId: string) => {
  return await getCustomerDebts(customerId);
});

ipcMain.handle('get-all-debts', async () => {
  return await getAllDebts();
});

ipcMain.handle('get-debt-payments', async (_, debtId: string) => {
  return await getDebtPayments(debtId);
});

// ─── Product Returns ──────────────────────────────────────────────────────────

ipcMain.handle('return-product', async (_, data: any) => {
  try {
    return await returnProduct(data);
  } catch (e: any) {
    console.error('return-product error, queueing:', e?.message);
    if (syncInitialized) {
      logSyncOp('product_returns', 'INSERT', null, data);
      setOnline(false);
      return { success: true, offline: true, return_id: 'offline-' + Date.now() };
    }
    return { success: false, error: e?.message };
  }
});

ipcMain.handle('get-today-returns', async () => {
  try { return await getTodayReturns(); }
  catch (e: any) { console.error('get-today-returns error:', e?.message); return { total: 0, count: 0 }; }
});

// ─── Expenses ─────────────────────────────────────────────────────────────────

ipcMain.handle('create-expense', async (_, amount: number, reason: string) => {
  try {
    return await createExpense(amount, reason);
  } catch (e: any) {
    console.error('create-expense error, queueing:', e?.message);
    if (syncInitialized) {
      logSyncOp('expenses', 'INSERT', null, { amount, reason, recorded_by: null });
      setOnline(false);
      return { success: true, offline: true };
    }
    return { success: false, error: e?.message };
  }
});

ipcMain.handle('get-today-expenses', async () => {
  try { return await getTodayExpenses(); }
  catch (e: any) { console.error('get-today-expenses error:', e?.message); return { total: 0, items: [] }; }
});

// ─── Cash Movements IPC ───────────────────────────────────────────────────────

ipcMain.handle('add-cash-movement', async (_, type: 'in' | 'out', amount: number, reason: string) => {
  try { return await addCashMovement(type, amount, reason); }
  catch (e: any) { return { success: false, error: e?.message }; }
});

ipcMain.handle('get-today-cash-movements', async () => {
  try { return await getTodayCashMovements(); }
  catch (e: any) { return { total_in: 0, total_out: 0, net: 0, items: [] }; }
});

ipcMain.handle('get-all-cash-movements', async () => {
  try { return await getAllCashMovements(); }
  catch (e: any) { return []; }
});

// ─── Day Close IPC ────────────────────────────────────────────────────────────

ipcMain.handle('day-close-summary', async () => {
  try { return await dayCloseSummary(); }
  catch (e: any) { console.error('day-close-summary error:', e); return { error: e.message }; }
});

ipcMain.handle('day-close-confirm', async (_, notes?: string) => {
  try { return await dayCloseConfirm(notes); }
  catch (e: any) { console.error('day-close-confirm error:', e); return { success: false, error: e.message }; }
});

ipcMain.handle('day-close-status', async () => {
  try { return await dayCloseStatus(); }
  catch (e: any) { return false; }
});

// ─── QR Code Generation IPC ────────────────────────────────────────────────────

ipcMain.handle('qr-generate', async (_, productId: string, productName: string, price: number) => {
  try {
    const data = JSON.stringify({ id: productId, name: productName, price });
    const url = await QRCode.toDataURL(data, { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } });
    return url;
  } catch (e: any) {
    console.error('qr-generate error:', e);
    return '';
  }
});

// ─── Printer IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('get-printers', async () => {
  try {
    const tempWin = new BrowserWindow({
      width: 1, height: 1, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false },
    });
    await tempWin.loadURL('data:text/html;charset=utf-8,<html><body></body></html>');
    const wc = tempWin.webContents as any;

    let printers: any[];
    if (typeof wc.getPrintersAsync === 'function') {
      printers = await wc.getPrintersAsync();
    } else if (typeof wc.getPrinters === 'function') {
      printers = wc.getPrinters();
    } else {
      throw new Error('No getPrinters API on webContents');
    }

    tempWin.close();
    return (printers || []).map((p: any) => ({
      name: p.name, displayName: p.displayName, status: p.status, isDefault: p.isDefault,
    }));
  } catch (e: any) {
    console.error('get-printers electron error, trying ps fallback:', e.message);
  }

  try {
    const raw = execSync('powershell -NoProfile -Command "Get-Printer | Select-Object Name, PrinterStatus, Shared | ConvertTo-Json -Compress"', {
      encoding: 'utf-8', timeout: 5000,
    }).trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((p: any) => ({
      name: p.Name, displayName: p.Name, status: p.PrinterStatus === 3 ? 0 : 1, isDefault: false,
    }));
  } catch (e2: any) {
    console.error('get-printers ps fallback error:', e2.message);
    return [];
  }
});

function sendRawPrint(printerName: string, hexBytes: string) {
  const safeName = printerName.replace(/'/g, "''");
  const ps = [
    '$ErrorActionPreference = "Stop"',
    '$VerbosePreference = "Continue"',
    "Add-Type -TypeDefinition @'",
    'using System;using System.Runtime.InteropServices;',
    'public class W{',
    '[DllImport("winspool.drv",CharSet=CharSet.Unicode)]public static extern bool OpenPrinter(string p,out IntPtr h,IntPtr d);',
    '[DllImport("winspool.drv")]public static extern bool ClosePrinter(IntPtr h);',
    '[DllImport("winspool.drv",CharSet=CharSet.Unicode)]public static extern bool StartDocPrinter(IntPtr h,int l,ref DI d);',
    '[DllImport("winspool.drv")]public static extern bool EndDocPrinter(IntPtr h);',
    '[DllImport("winspool.drv")]public static extern bool StartPagePrinter(IntPtr h);',
    '[DllImport("winspool.drv")]public static extern bool EndPagePrinter(IntPtr h);',
    '[DllImport("winspool.drv")]public static extern bool WritePrinter(IntPtr h,byte[] b,int c,out int w);',
    '[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct DI{public string a;public string b;public string c;}',
    "}",
    "'@",
    "try{$p=Get-CimInstance Win32_Printer -ErrorAction Stop|?{\$_.Name -eq '" + safeName + "'}}catch{}",
    "if(!$p){try{$p=Get-WmiObject Win32_Printer|?{\$_.Name -eq '" + safeName + "'}}catch{}}",
    "if(!$p){throw 'Printer not found: " + safeName.replace(/"/g, '`"') + "'}",
    '$ptr=[IntPtr]::Zero',
    '$ok=[W]::OpenPrinter($p.Name,[ref]$ptr,[IntPtr]::Zero)',
    "if(!$ok){$e=[Runtime.InteropServices.Marshal]::GetLastWin32Error();throw 'OpenPrinter failed (code: '+$e+')'}",
    '$d=New-Object W+DI;$d.a="Print";$d.b=$null;$d.c="RAW"',
    '$ok=[W]::StartDocPrinter($ptr,1,[ref]$d)',
    "if(!$ok){$e=[Runtime.InteropServices.Marshal]::GetLastWin32Error();throw 'StartDocPrinter failed (code: '+$e+')'}",
    '$ok=[W]::StartPagePrinter($ptr)',
    "if(!$ok){throw 'StartPagePrinter failed'}",
    '$bytes=[byte[]](' + hexBytes + ');$w=0',
    '$ok=[W]::WritePrinter($ptr,$bytes,$bytes.Length,[ref]$w)',
    "if(!$ok){$e=[Runtime.InteropServices.Marshal]::GetLastWin32Error();throw 'WritePrinter failed (code: '+$e+')'}",
    "Write-Verbose \"Wrote $w bytes to printer\"",
    '[W]::EndPagePrinter($ptr)',
    '[W]::EndDocPrinter($ptr)',
    '[W]::ClosePrinter($ptr)',
  ].join('\n');
  const psFile = path.join(app.getPath('temp'), 'rawprint_ps.ps1');
  require('fs').writeFileSync(psFile, ps, 'utf8');
  try {
    const psPath = process.env.SystemRoot + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    execSync('"' + psPath + '" -NoProfile -ExecutionPolicy Bypass -File "' + psFile + '"', {
      timeout: 30000, windowsHide: true, stdio: 'pipe',
    });
    try { require('fs').unlinkSync(psFile); } catch (e) { console.error('delete ps1:', e); }
  } catch (e: any) {
    const std = e.stdout?.toString() || '';
    const err = e.stderr?.toString() || '';
    if (err) console.error('sendRawPrint stderr:', err);
    if (std) console.error('sendRawPrint stdout:', std);
    throw new Error('Raw print failed: ' + e.message);
  }
}

function sendCutterCommand(printerName: string) {
  sendRawPrint(printerName, '0x1D,0x56,0x42,0x00');
}

async function kickCashDrawer(printerName: string) {
  try {
    sendRawPrint(printerName, '0x1B,0x70,0x00,0x19,0xFA');
  } catch (e) {
    console.error('Cash drawer kick failed (non-fatal):', e);
  }
}

ipcMain.handle('print-to-printer', async (_, html: string, printerName?: string, pageSize?: { width: number; height: number }, landscapeFlag?: boolean, count?: number) => {
  let printWindow: BrowserWindow | null = null;
  try {
    if (!mainWindow) return { success: false, error: 'No window' };

    printWindow = new BrowserWindow({
      width: 800, height: 600, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false },
    });

    const repeats = Math.max(count || 1, 1);
    const wc = printWindow.webContents;

    for (let i = 0; i < repeats; i++) {
      await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      await new Promise(r => setTimeout(r, i === 0 ? 1000 : 300));

      if (printerName) {
        const opts: any = { deviceName: printerName, silent: true, margins: { marginType: 'none' }, header: '', footer: '', printBackground: true, pageSize: pageSize || undefined, landscape: landscapeFlag || false };
        const printed = await new Promise<boolean>(resolve => {
          wc.print(opts, (ok: boolean) => resolve(ok));
        });
        if (!printed) { printWindow.close(); return { success: false, error: 'Print returned false' }; }
      } else {
        const printed = await new Promise<boolean>(resolve => {
          wc.print({ silent: false }, (ok: boolean) => resolve(ok));
        });
        if (!printed) { printWindow.close(); return { success: false, error: 'Print returned false' }; }
      }
    }
    printWindow.close();
    return { success: true };
  } catch (e: any) {
    console.error('print-to-printer error:', e);
    if (printWindow && !printWindow.isDestroyed()) printWindow.close();
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fire-cutter', async (_, printerName: string) => {
  sendCutterCommand(printerName);
});

ipcMain.handle('print-raw', async (_, printerName: string, hexBytes: string) => {
  try {
    await kickCashDrawer(printerName);
    sendRawPrint(printerName, hexBytes);
    return { success: true };
  }
  catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
  }
  return false;
});

// ─── License IPC ───────────────────────────────────────────────────────────────

import { checkLicense, activateLicense } from './license';

ipcMain.handle('license-check', async () => {
  return await checkLicense();
});

ipcMain.handle('license-activate', async (_, key: string) => {
  return await activateLicense(key);
});

// ─── Cash Drawer IPC ──────────────────────────────────────────────────────────

ipcMain.handle('kick-cash-drawer', async (_, printerName: string) => {
  await kickCashDrawer(printerName);
  return { success: true };
});

// ─── File Export IPC ──────────────────────────────────────────────────────────

ipcMain.handle('show-save-dialog', async (_, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    title: 'Export Data',
    defaultPath: defaultName,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('write-file', async (_, filePath: string, base64Data: string) => {
  try {
    const buf = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buf);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

