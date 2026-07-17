import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  test: () => 'bridge-ok',

  login: (username: string, password: string) => ipcRenderer.invoke('auth-login', username, password),
  getUsers: () => ipcRenderer.invoke('auth-get-users'),
  createUser: (username: string, password: string, role: string) => ipcRenderer.invoke('auth-create-user', username, password, role),
  deleteUser: (id: string) => ipcRenderer.invoke('auth-delete-user', id),
  resetPassword: (id: string, newPassword: string) => ipcRenderer.invoke('auth-reset-password', id, newPassword),

  query: (sql: string, ...params: any[]) => ipcRenderer.invoke('db-query', sql, ...params),
  get: (sql: string, ...params: any[]) => ipcRenderer.invoke('db-get', sql, ...params),
  run: (sql: string, ...params: any[]) => ipcRenderer.invoke('db-run', sql, ...params),

  createSale: (saleData: any) => ipcRenderer.invoke('create-sale', saleData),
  generateInvoiceNumber: (type: 'proforma' | 'final') => ipcRenderer.invoke('generate-invoice-number', type),

  // Debt management
  createDebtPayment: (debtId: string, amount: number, notes?: string) => ipcRenderer.invoke('create-debt-payment', debtId, amount, notes),
  getCustomerDebts: (customerId: string) => ipcRenderer.invoke('get-customer-debts', customerId),
  getAllDebts: () => ipcRenderer.invoke('get-all-debts'),
  getDebtPayments: (debtId: string) => ipcRenderer.invoke('get-debt-payments', debtId),

  // Product returns
  returnProduct: (data: any) => ipcRenderer.invoke('return-product', data),
  getTodayReturns: () => ipcRenderer.invoke('get-today-returns'),

  // Expenses
  createExpense: (amount: number, reason: string) => ipcRenderer.invoke('create-expense', amount, reason),
  getTodayExpenses: () => ipcRenderer.invoke('get-today-expenses'),

  // Cash movements
  addCashMovement: (type: 'in' | 'out', amount: number, reason: string) => ipcRenderer.invoke('add-cash-movement', type, amount, reason),
  getTodayCashMovements: () => ipcRenderer.invoke('get-today-cash-movements'),
  getAllCashMovements: () => ipcRenderer.invoke('get-all-cash-movements'),

  // Quick customer creation
  quickCreateCustomer: (name: string, phone?: string) => ipcRenderer.invoke('quick-create-customer', name, phone),
  searchCustomers: (query: string) => ipcRenderer.invoke('search-customers', query),

  getSettings: () => ipcRenderer.invoke('settings-get'),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings-set', key, value),

  getDayCloseSummary: () => ipcRenderer.invoke('day-close-summary'),
  confirmDayClose: (notes?: string) => ipcRenderer.invoke('day-close-confirm', notes),
  isDayClosed: () => ipcRenderer.invoke('day-close-status'),

  generateProductQR: (productId: string, productName: string, price: number) => ipcRenderer.invoke('qr-generate', productId, productName, price),

  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printToPrinter: (html: string, printerName?: string, pageSize?: { width: number; height: number }, landscapeFlag?: boolean, count?: number) => ipcRenderer.invoke('print-to-printer', html, printerName, pageSize, landscapeFlag, count),
  fireCutter: (printerName: string) => ipcRenderer.invoke('fire-cutter', printerName),
  printRaw: (printerName: string, hexBytes: string) => ipcRenderer.invoke('print-raw', printerName, hexBytes),

  kickCashDrawer: (printerName: string) => ipcRenderer.invoke('kick-cash-drawer', printerName),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  onUpdateAvailable: (cb: (info: any) => void) => { ipcRenderer.on('update-available', (_, info) => cb(info)); },
  onUpdateNotAvailable: (cb: () => void) => { ipcRenderer.on('update-not-available', () => cb()); },
  onUpdateError: (cb: (msg: string) => void) => { ipcRenderer.on('update-error', (_, msg) => cb(msg)); },
  onUpdateDownloadProgress: (cb: (progress: any) => void) => { ipcRenderer.on('update-download-progress', (_, p) => cb(p)); },
  onUpdateDownloaded: (cb: () => void) => { ipcRenderer.on('update-downloaded', () => cb()); },

  checkLicense: () => ipcRenderer.invoke('license-check'),
  activateLicense: (key: string) => ipcRenderer.invoke('license-activate', key),

  // Offline sync
  getSyncStatus: () => ipcRenderer.invoke('sync-status'),
  processSyncNow: () => ipcRenderer.invoke('sync-process-now'),

  // Export
  showSaveDialog: (defaultName: string) => ipcRenderer.invoke('show-save-dialog', defaultName),
  writeFile: (filePath: string, base64Data: string) => ipcRenderer.invoke('write-file', filePath, base64Data),

});
