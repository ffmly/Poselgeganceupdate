export interface User {
  id: string;
  username: string;
  role: 'admin' | 'seller';
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  price_cash: number;
  price_credit: number;
  price_purchase: number;
  stock: number;
  created_at?: string;
}

export interface CreditDebt {
  id: string;
  sale_id: string;
  customer_id: string;
  original_amount: number;
  remaining: number;
  status: 'active' | 'partial' | 'paid' | 'overdue';
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  sale_invoice?: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  notes?: string;
  recorded_by?: string;
  payment_date: string;
  username?: string;
}

export interface ProductReturn {
  id: string;
  sale_id?: string;
  product_id: string;
  quantity: number;
  price: number;
  total: number;
  reason?: string;
  returned_by?: string;
  created_at: string;
  product_name?: string;
}

export interface Expense {
  id: string;
  amount: number;
  reason: string;
  recorded_by?: string;
  created_at: string;
  username?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at?: string;
}

export interface Sale {
  id: string;
  customer_id?: string;
  type: 'cash' | 'credit' | 'debt';
  subtotal: number;
  discount: number;
  total: number;
  paid_amount: number;
  debt_amount: number;
  status: string;
  created_by?: string;
  created_at: string;
  customer_name?: string;
  invoice_number?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price: number;
  price_override?: number;
  discount: number;
  subtotal: number;
  product_name?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  type: 'proforma' | 'final';
  sale_id?: string;
  customer_id?: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_type?: 'cash' | 'credit' | 'debt';
  notes?: string;
  created_by?: string;
  created_at: string;
  customer_name?: string;
}

export interface Installment {
  id: string;
  sale_id: string;
  customer_id: string;
  total_amount: number;
  advance: number;
  remaining: number;
  months: number;
  monthly_payment: number;
  paid_amount: number;
  status: 'active' | 'completed' | 'overdue';
  start_date: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface InstallmentPayment {
  id: string;
  installment_id: string;
  amount: number;
  notes?: string;
  recorded_by?: string;
  payment_date: string;
  username?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at?: string;
}

export interface Purchase {
  id: string;
  supplier_id?: string;
  total: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  supplier_name?: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  cost_price: number;
  subtotal: number;
  product_name?: string;
}

export interface CartItem {
  product_id: string;
  name: string;
  price_cash: number;
  price_credit: number;
  stock: number;
  barcode?: string;
  quantity: number;
  price: number;
  price_override?: number;
  discount: number;
  subtotal: number;
}

export interface Settings {
  store_name: string;
  store_phone: string;
  store_address: string;
  store_capital: string;
  store_logo: string;
  currency: string;
  language: string;
  theme: string;
  printer_barcode: string;
  printer_receipt: string;
  printer_invoice: string;
  auto_print_receipt: string;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  status: number;
  isDefault: boolean;
}

export interface LicenseInfo {
  activated: boolean;
  daysLeft?: number;
  expiryDate?: string;
  message: string;
}

export interface DayCloseSummary {
  totalSales: number;
  cashTotal: number;
  creditTotal: number;
  debtTotal: number;
  count: number;
  sales: any[];
  returnsTotal: number;
  expensesTotal: number;
  debtCollected: number;
  cashIn: number;
  cashOut: number;
  netCash: number;
  isClosed: boolean;
  closedAt?: string;
  closedBy?: string;
}

declare global {
  interface Window {
    electronAPI: {
      login: (username: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
      getUsers: () => Promise<User[]>;
      createUser: (username: string, password: string, role: string) => Promise<{ success: boolean; id?: string; error?: string }>;
      deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
      resetPassword: (id: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;

      query: (sql: string, ...params: any[]) => Promise<any[]>;
      get: (sql: string, ...params: any[]) => Promise<any>;
      run: (sql: string, ...params: any[]) => Promise<{ lastInsertRowid?: string; changes?: number; success?: boolean; return_id?: string; error?: string }>;

      createSale: (saleData: any) => Promise<{ success: boolean; sale_id?: string; invoice_number?: string; installment_id?: string; error?: string }>;
      generateInvoiceNumber: (type: 'proforma' | 'final') => Promise<string>;

      getSettings: () => Promise<Record<string, string>>;
      setSetting: (key: string, value: string) => Promise<{ success: boolean }>;

      getDayCloseSummary: () => Promise<DayCloseSummary>;
      confirmDayClose: (notes?: string) => Promise<{ success: boolean; netCash?: number; returnsTotal?: number; expensesTotal?: number; debtCollected?: number; error?: string }>;
      isDayClosed: () => Promise<boolean>;

      generateProductQR: (productId: string, productName: string, price: number) => Promise<string>;

      createDebtPayment: (debtId: string, amount: number, notes?: string) => Promise<{ success: boolean; error?: string }>;
      getCustomerDebts: (customerId: string) => Promise<any[]>;
      getAllDebts: () => Promise<any[]>;
      getDebtPayments: (debtId: string) => Promise<any[]>;

      returnProduct: (data: { sale_id?: string; product_id: string; quantity: number; price: number; reason?: string; returned_by?: string }) => Promise<{ success: boolean; error?: string; return_id?: string }>;
      getTodayReturns: () => Promise<{ total: number; count: number }>;

      createExpense: (amount: number, reason: string) => Promise<{ success: boolean; error?: string }>;
      getTodayExpenses: () => Promise<{ total: number; items: any[] }>;

      addCashMovement: (type: 'in' | 'out', amount: number, reason: string) => Promise<{ success: boolean; id?: string; error?: string }>;
      getTodayCashMovements: () => Promise<{ total_in: number; total_out: number; net: number; items: any[] }>;
      getAllCashMovements: () => Promise<any[]>;

      quickCreateCustomer: (name: string, phone?: string) => Promise<{ success: boolean; id?: string; error?: string }>;
      searchCustomers: (query: string) => Promise<any[]>;

      getPrinters: () => Promise<PrinterInfo[]>;
      printToPrinter: (html: string, printerName?: string, pageSize?: { width: number; height: number }, landscapeFlag?: boolean, count?: number) => Promise<{ success: boolean; error?: string }>;
      kickCashDrawer: (printerName: string) => Promise<{ success: boolean }>;
      fireCutter: (printerName: string) => Promise<void>;
      printRaw: (printerName: string, hexBytes: string) => Promise<void>;

      checkLicense: () => Promise<LicenseInfo>;
      activateLicense: (key: string) => Promise<{ success: boolean; message: string }>;

      showSaveDialog: (defaultName: string) => Promise<string | null>;
      writeFile: (filePath: string, base64Data: string) => Promise<{ success: boolean; error?: string }>;

      // Auto-updater
      checkForUpdates: () => Promise<{ success: boolean; message: string }>;
      downloadUpdate: () => Promise<{ success: boolean; message: string }>;
      installUpdate: () => Promise<{ success: boolean }>;
      onUpdateAvailable: (cb: (info: { version: string; releaseDate: string; releaseNotes: string }) => void) => void;
      onUpdateNotAvailable: (cb: () => void) => void;
      onUpdateError: (cb: (msg: string) => void) => void;
      onUpdateDownloadProgress: (cb: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => void;
      onUpdateDownloaded: (cb: () => void) => void;
    };
  }
}
