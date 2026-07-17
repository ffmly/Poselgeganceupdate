import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ShoppingCart, Trash2, Plus, Minus, X, Banknote, CreditCard, Printer, Tag, User, Camera, Scan, CheckCircle, FileText, Undo2, Wallet, PlusCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { printThermalReceiptRaw, printProformaInvoiceRaw, printDetailedInvoiceRaw } from '../utils/invoicePrinter';

interface Product { id: string; name: string; barcode?: string; price_purchase: number; price_cash: number; price_credit: number; stock: number; }
interface Customer { id: string; name: string; phone?: string; address?: string; notes?: string; }
interface CartItem {
  product_id: string; name: string; price_cash: number; price_credit: number;
  barcode?: string; stock: number; quantity: number; unitPrice: number; discount: number; subtotal: number;
}

export default function POS() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [orderDiscountType, setOrderDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'debt'>('cash');
  const [currency, setCurrency] = useState('DZD');
  const [storeName, setStoreName] = useState('My Electronics Store');
  const [storeInfo, setStoreInfo] = useState<any>({});
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);
  const [printerReceipt, setPrinterReceipt] = useState('');
  const [printerInvoice, setPrinterInvoice] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [instAdvance, setInstAdvance] = useState(0);
  const [instMonths, setInstMonths] = useState(12);
  const [instTotalPrice, setInstTotalPrice] = useState(0);

  const [showScanner, setShowScanner] = useState(false);
  const [amountGiven, setAmountGiven] = useState('');
  const [showPostSale, setShowPostSale] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<any>(null);

  const [showTodaySales, setShowTodaySales] = useState(false);
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [todaySalesItems, setTodaySalesItems] = useState<Record<string, any[]>>({});
  const [loadingToday, setLoadingToday] = useState(false);

  // ─── Quick Customer ──────────────────────────────────────────────────────────
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');

  // ─── Return Mode ─────────────────────────────────────────────────────────────
  const [returnMode, setReturnMode] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnProduct, setReturnProduct] = useState<any>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');

  // ─── Expense Withdrawal ───────────────────────────────────────────────────────
  const [showExpense, setShowExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');
  const [showCashIn, setShowCashIn] = useState(false);
  const [cashInAmount, setCashInAmount] = useState('');
  const [cashInReason, setCashInReason] = useState('');

  const scannerRef = useRef<HTMLDivElement>(null);
  const scannerInstanceRef = useRef<any>(null);
  const barcodeBufferRef = useRef('');
  const barcodeTimerRef = useRef<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F8') { e.preventDefault(); if (cart.length > 0) { setPaymentType('cash'); setShowCheckout(true); } }
      if (e.key === 'F9') { e.preventDefault(); if (cart.length > 0) { setPaymentType('credit'); setShowCheckout(true); } }
      if (e.key === 'F10') { e.preventDefault(); if (cart.length > 0) { setPaymentType('debt'); setShowCheckout(true); } }
      if (e.key === 'Escape') { setShowCheckout(false); setSearch(''); setShowScanner(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart.length]);

  const handleBarcodeEnter = useCallback((code: string) => {
    const product = products.find(p => p.barcode === code);
    if (product) {
      if (returnMode) {
        setReturnProduct(product);
        setReturnQty(1);
        setReturnReason('');
        setShowReturnDialog(true);
      } else {
        addToCart(product);
      }
      return true;
    }
    return false;
  }, [products, returnMode]);

  useEffect(() => {
    const handleBarcodeScan = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F2' || e.key === 'F8' || e.key === 'F9') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      clearTimeout(barcodeTimerRef.current);

      if (e.key === 'Enter') {
        const code = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = '';
        if (code) {
          if (!handleBarcodeEnter(code)) {
            setSearch(code);
          }
          return;
        }
        if (e.target instanceof HTMLInputElement) {
          const inputVal = (e.target as HTMLInputElement).value.trim();
          if (inputVal && handleBarcodeEnter(inputVal)) {
            (e.target as HTMLInputElement).value = '';
            return;
          }
        }
        return;
      }

      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
        barcodeTimerRef.current = setTimeout(() => {
          barcodeBufferRef.current = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleBarcodeScan);
    return () => window.removeEventListener('keydown', handleBarcodeScan);
  }, [handleBarcodeEnter]);

  const loadData = async () => {
    const [prods, custs, settings] = await Promise.all([
      window.electronAPI.query("SELECT * FROM products ORDER BY name"),
      window.electronAPI.query("SELECT * FROM customers ORDER BY name"),
      window.electronAPI.getSettings(),
    ]);
    setProducts(prods || []);
    setCustomers(custs || []);
    setCurrency(settings?.currency || 'DZD');
    setStoreName(settings?.store_name || 'My Electronics Store');
    setStoreInfo({ phone: settings?.store_phone, address: settings?.store_address, capital: settings?.store_capital, logo: settings?.store_logo });
    setAutoPrintReceipt(settings?.auto_print_receipt !== '0');
    setPrinterReceipt(settings?.printer_receipt || '');
    setPrinterInvoice(settings?.printer_invoice || '');
  };

  const filtered = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search)))
    : products.slice(0, 50);

  const addToCart = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) {
        return prev.map(i => i.product_id === p.id
          ? { ...i, quantity: i.quantity + 1, subtotal: calcSubtotal(i.unitPrice, i.quantity + 1, i.discount) }
          : i
        );
      }
      const unitPrice = p.price_cash;
      return [...prev, { product_id: p.id, name: p.name, price_cash: p.price_cash, price_credit: p.price_credit, stock: p.stock, quantity: 1, unitPrice, discount: 0, subtotal: unitPrice }];
    });
    setSearch('');
  };

  const calcSubtotal = (price: number, qty: number, disc: number) => price * qty * (1 - disc / 100);

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) { removeItem(id); return; }
    setCart(prev => prev.map(i => i.product_id === id ? { ...i, quantity: qty, subtotal: calcSubtotal(i.unitPrice, qty, i.discount) } : i));
  };

  const updatePrice = (id: string, price: number) => {
    setCart(prev => prev.map(i => i.product_id === id ? { ...i, unitPrice: price, subtotal: calcSubtotal(price, i.quantity, i.discount) } : i));
  };

  const updateDiscount = (id: string, disc: number) => {
    setCart(prev => prev.map(i => i.product_id === id ? { ...i, discount: disc, subtotal: calcSubtotal(i.unitPrice, i.quantity, disc) } : i));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.product_id !== id));

  const cartSubtotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const orderDiscountAmt = orderDiscountType === 'percentage'
    ? cartSubtotal * orderDiscount / 100
    : orderDiscount;
  const cartTotal = Math.max(0, cartSubtotal - orderDiscountAmt);

  useEffect(() => {
    if (paymentType === 'credit' && cart.length > 0) {
      const creditSubtotal = cart.reduce((s, i) => {
        return s + i.price_cash * i.quantity * (1 - i.discount / 100);
      }, 0);
      const discAmt = orderDiscountType === 'percentage'
        ? creditSubtotal * orderDiscount / 100
        : orderDiscount;
      setInstTotalPrice(Math.round(Math.max(0, creditSubtotal - discAmt)));
    }
  }, [cart, paymentType, orderDiscount, orderDiscountType]);

  const loadTodaySales = async () => {
    setLoadingToday(true);
    setShowTodaySales(true);
    try {
      const sales = await window.electronAPI.query(`
        SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, i.invoice_number
        FROM sales s
        LEFT JOIN customers c ON s.customer_id=c.id
        LEFT JOIN invoices i ON i.sale_id=s.id
        WHERE DATE(s.created_at) = DATE('now', 'localtime')
        ORDER BY s.created_at DESC
      `);
      setTodaySales(sales || []);
      const itemsMap: Record<number, any[]> = {};
      for (const sale of (sales || [])) {
        const items = await window.electronAPI.query(
          "SELECT si.*, p.name as name FROM sale_items si JOIN products p ON si.product_id=p.id WHERE si.sale_id=?", sale.id
        );
        itemsMap[sale.id] = items || [];
      }
      setTodaySalesItems(itemsMap);
    } catch (err) {
      console.error('loadTodaySales error:', err);
    }
    setLoadingToday(false);
  };

  const instRemaining = Math.max(0, instTotalPrice - instAdvance);
  const instMonthly = instMonths > 0 ? Math.round(instRemaining / instMonths) : 0;

  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;

  const changeAmount = Math.max(0, (Number(amountGiven) || 0) - cartTotal);

  const handleProforma = () => {
    const proformaData = {
      storeName,
      customer: selectedCustomer,
      items: cart,
      subtotal: cartSubtotal,
      discount: orderDiscount,
      total: cartTotal,
      paymentType,
      installment: paymentType === 'credit' ? { total: instTotalPrice, advance: instAdvance, remaining: instRemaining, months: instMonths, monthly: instMonthly } : null,
      currency,
    };
    printProformaInvoiceRaw({ ...proformaData, storeInfo, ...(storeInfo?.logo ? { storeLogo: storeInfo.logo } : {}), printerName: printerReceipt });
  };

  const handleConfirm = useCallback(async () => {
    if (paymentType === 'credit' && !selectedCustomer) { alert(t('select_customer')); return; }

    const debtPaidAmount = paymentType === 'debt' ? (Number(amountGiven) || 0) : 0;
    const saleData = {
      customer_id: selectedCustomer?.id || null,
      type: paymentType,
      subtotal: cartSubtotal,
      discount: orderDiscountAmt,
      total: paymentType === 'credit' ? instTotalPrice : cartTotal,
      paid_amount: debtPaidAmount,
      created_by: user?.id || null,
      items: cart.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        price: i.price_cash,
        price_override: i.unitPrice,
        discount: i.discount,
        subtotal: i.subtotal,
      })),
      installment: paymentType === 'credit' ? {
        total_amount: instTotalPrice,
        advance: instAdvance,
        remaining: instRemaining,
        months: instMonths,
        monthly_payment: instMonthly,
      } : null,
    };

    const result = await window.electronAPI.createSale(saleData);
    if (result.success) {
      if (autoPrintReceipt) {
        printThermalReceiptRaw({
          invoiceNumber: result.invoice_number!,
          storeName,
          storeInfo,
          ...(storeInfo?.logo ? { storeLogo: storeInfo.logo } : {}),
          customer: selectedCustomer,
          items: cart,
          subtotal: cartSubtotal,
          discountPct: orderDiscount,
          total: saleData.total,
          paymentType,
          installment: paymentType === 'credit' ? { total: instTotalPrice, advance: instAdvance, remaining: instRemaining, months: instMonths, monthly: instMonthly } : null,
          currency,
          printerName: printerReceipt,
        });
      }

      setLastSaleData({
        invoiceNumber: result.invoice_number!,
        storeName,
        ...(storeInfo?.logo ? { storeLogo: storeInfo.logo } : {}),
        customer: selectedCustomer,
        items: [...cart],
        subtotal: cartSubtotal,
        discountPct: orderDiscount,
        discountAmt: orderDiscountAmt,
        total: saleData.total,
        paymentType,
        installment: paymentType === 'credit' ? { total: instTotalPrice, advance: instAdvance, remaining: instRemaining, months: instMonths, monthly: instMonthly } : null,
        currency,
      });

      setCart([]);
      setOrderDiscount(0);
      setSelectedCustomer(null);
      setShowCheckout(false);
      setInstAdvance(0);
      setInstMonths(12);
      setAmountGiven('');
      setShowPostSale(true);
      setSuccessMsg(`${t('sale_confirmed')} — ${result.invoice_number}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadData();
    } else {
      alert('Error: ' + result.error);
    }
  }, [cart, paymentType, selectedCustomer, cartSubtotal, cartTotal, instTotalPrice, instAdvance, instRemaining, instMonths, instMonthly, orderDiscountAmt, orderDiscount, user, storeName, storeInfo, currency, autoPrintReceipt]);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || '').includes(customerSearch)
  );

  const startScanner = async () => {
    setShowScanner(true);
    setTimeout(async () => {
      try {
        const Html5Qrcode = (await import('html5-qrcode')).Html5Qrcode;
        const scanner = new Html5Qrcode('qr-scanner-element');
        scannerInstanceRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            scanner.stop().catch(() => {});
            setShowScanner(false);
            const code = decodedText.trim();
            try {
              const data = JSON.parse(code);
              if (data.id) {
                const product = products.find(p => p.id === data.id);
                if (product) { addToCart(product); return; }
              }
            } catch {}
            const product = products.find(p => p.barcode === code);
            if (product) {
              addToCart(product);
            } else {
              setSearch(code);
            }
          },
          () => {}
        );
      } catch (err) {
        console.error('Scanner error:', err);
        setShowScanner(false);
      }
    }, 300);
  };

  const stopScanner = () => {
    if (scannerInstanceRef.current) {
      scannerInstanceRef.current.stop().catch(() => {});
      scannerInstanceRef.current = null;
    }
    setShowScanner(false);
  };

  return (
    <div className="flex h-full gap-4 -m-6 p-0 overflow-hidden">
      {successMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-medium animate-bounce text-sm">
          ✓ {successMsg}
        </div>
      )}

      {/* LEFT: Products */}
      <div className="flex flex-col flex-1 border-e border-[var(--border-color)] bg-[var(--bg-primary)]">
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`${t('search_products')} (F2)`}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl ps-9 pe-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm"
            />
            <button onClick={startScanner} className="absolute end-2 top-1/2 -translate-y-1/2 p-2 text-[var(--text-muted)] hover:text-indigo-500 hover:bg-[var(--bg-surface)] rounded-lg transition-all" title={t('camera_scan')}>
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => {
                if (returnMode) {
                  setReturnProduct(p);
                  setReturnQty(1);
                  setReturnReason('');
                  setShowReturnDialog(true);
                } else {
                  addToCart(p);
                }
              }}
              disabled={p.stock <= 0 && !returnMode}
              className={`bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-indigo-500 hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl p-4 text-start transition-all group shadow-sm ${returnMode ? 'ring-2 ring-red-500/30 hover:ring-red-500' : ''}`}
            >
              <div className="font-medium text-[var(--text-primary)] text-sm mb-2 line-clamp-2 leading-snug">{p.name}</div>
              {p.barcode && <div className="text-[10px] text-[var(--text-muted)] font-mono mb-0.5">{p.barcode}</div>}
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{fmt(p.price_cash)}</div>
              {user?.role === 'admin' && <div className={`text-xs mt-2 ${p.stock <= 3 ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>{p.stock <= 0 ? t('out_of_stock') : `${t('stock')}: ${p.stock}`}</div>}
            </button>
          ))}
          {filtered.length === 0 && search && (
            <div className="col-span-full text-center text-[var(--text-muted)] py-12">{t('no_data')}</div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-[var(--border-color)] flex gap-3 text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)]/30 flex-wrap">
          <span>F2 {t('search')}</span>
          <span>F8 {t('cash')}</span>
          <span>F9 {t('credit')}</span>
          <span>F10 {t('debt')}</span>
          <span>Esc {t('cancel')}</span>
          <span className="flex items-center gap-1"><Scan className="w-3 h-3" />{t('scan_qr')}</span>
          <button
            onClick={() => setReturnMode(!returnMode)}
            className={`flex items-center gap-1 font-medium transition-colors ${returnMode ? 'text-red-500' : 'text-[var(--text-muted)] hover:text-red-500'}`}
          >
            <Undo2 className="w-3 h-3" />{t('return_mode')}
          </button>
          <button
            onClick={() => setShowExpense(true)}
            className="flex items-center gap-1 text-[var(--text-muted)] hover:text-amber-500 font-medium transition-colors"
          >
            <Wallet className="w-3 h-3" />{t('cash_withdrawal')}
          </button>
          <button
            onClick={() => setShowCashIn(true)}
            className="flex items-center gap-1 text-[var(--text-muted)] hover:text-emerald-500 font-medium transition-colors"
          >
            <Wallet className="w-3 h-3" />{t('cash_in')}
          </button>
          <button onClick={loadTodaySales} className="ms-auto flex items-center gap-1 text-indigo-500 hover:text-indigo-400 font-medium transition-colors">
            <FileText className="w-3 h-3" />{t('today_sales')}
          </button>
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div className="flex flex-col w-[460px] bg-[var(--bg-surface)] border-s border-[var(--border-color)] shadow-xl">
        <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-500" />
            <span className="font-semibold text-[var(--text-primary)]">{t('cart')}</span>
            {cart.length > 0 && <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow-lg shadow-indigo-500/30">{cart.length}</span>}
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors">
              <Trash2 className="w-3 h-3" />{t('clear_cart')}
            </button>
          )}
        </div>

        <div className="px-4 py-2 border-b border-[var(--border-color)]">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div
                className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3 py-2 cursor-pointer hover:border-indigo-500/30 transition-all shadow-sm"
                onClick={() => setShowCustomerList(!showCustomerList)}
              >
                <User className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-secondary)] flex-1">{selectedCustomer ? selectedCustomer.name : t('no_customer')}</span>
                {selectedCustomer && <button onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }} className="text-[var(--text-muted)] hover:text-red-500"><X className="w-3 h-3" /></button>}
              </div>
            {showCustomerList && (
              <div className="absolute top-full start-0 end-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl z-30 overflow-hidden">
                <div className="p-2">
                  <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <button onClick={() => { setSelectedCustomer(null); setShowCustomerList(false); setCustomerSearch(''); }} className="w-full text-start px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] transition-colors">{t('no_customer')}</button>
                  {filteredCustomers.map(c => (
                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); setCustomerSearch(''); }} className="w-full text-start px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors border-t border-[var(--border-color)]/30">
                      {c.name} {c.phone && <span className="text-[var(--text-muted)] text-xs">({c.phone})</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowQuickCustomer(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3 py-2 text-xs font-semibold transition-all shadow-sm active:scale-95 shrink-0"
            title={t('quick_add_customer')}
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{t('add')}</span>
          </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-color)]">
          {cart.length === 0
            ? <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-3 opacity-50"><ShoppingCart className="w-12 h-12" /><span>{t('empty_cart')}</span></div>
            : cart.map(item => (
              <div key={item.product_id} className="px-4 py-3 space-y-2 hover:bg-[var(--bg-secondary)]/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="text-sm font-medium text-[var(--text-primary)] flex-1 pe-2">{item.name}</div>
                  <button onClick={() => removeItem(item.product_id)} className="text-[var(--text-muted)] hover:text-red-500 shrink-0 transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-secondary)] shadow-inner">
                    <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--border-color)] hover:text-[var(--text-primary)] transition-colors"><Minus className="w-3 h-3" /></button>
                    <span className="px-3 text-[var(--text-primary)] text-sm min-w-[2rem] text-center font-medium">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--border-color)] hover:text-[var(--text-primary)] transition-colors"><Plus className="w-3 h-3" /></button>
                  </div>
                  <div className="relative group">
                    <input type="number" value={item.unitPrice} onChange={e => updatePrice(item.product_id, Number(e.target.value))} className="w-24 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center transition-all shadow-inner" min={0} />
                  </div>
                  <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg overflow-hidden shadow-inner">
                    <Tag className="w-3 h-3 text-[var(--text-muted)] ms-2" />
                    <input type="number" value={item.discount} onChange={e => updateDiscount(item.product_id, Math.min(100, Number(e.target.value)))} placeholder="0" className="w-10 bg-transparent text-[var(--text-primary)] text-sm px-1 py-1 focus:outline-none text-center font-medium" min={0} max={100} />
                    <span className="text-[var(--text-muted)] text-[10px] uppercase font-bold pe-2">%</span>
                  </div>
                  <span className="text-sm font-semibold text-indigo-500 ms-auto">{fmt(item.subtotal)}</span>
                </div>
              </div>
            ))
          }
        </div>

        {cart.length > 0 && (
          <div className="border-t border-[var(--border-color)] px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Tag className="w-3 h-3" />{t('order_discount')}
              </div>
              <div className="flex items-center gap-1">
                <div className="flex border border-[var(--border-color)] rounded-lg overflow-hidden text-[10px] font-bold me-1">
                  <button onClick={() => setOrderDiscountType('percentage')} className={`px-1.5 py-1 ${orderDiscountType === 'percentage' ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>%</button>
                  <button onClick={() => setOrderDiscountType('fixed')} className={`px-1.5 py-1 ${orderDiscountType === 'fixed' ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>{currency}</button>
                </div>
                <input type="number" value={orderDiscount} onChange={e => setOrderDiscount(Math.max(0, orderDiscountType === 'percentage' ? Math.min(100, Number(e.target.value)) : Number(e.target.value)))} className="w-16 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" min={0} />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
              <span>{t('subtotal')}</span><span>{fmt(cartSubtotal)}</span>
            </div>
            {orderDiscountAmt > 0 && <div className="flex items-center justify-between text-sm text-red-500"><span>-{t('discount')}</span><span>-{fmt(orderDiscountAmt)}</span></div>}
            <div className="flex items-center justify-between font-bold text-xl text-[var(--text-primary)] border-t border-[var(--border-color)] pt-2">
              <span>{t('total')}</span><span className="text-indigo-500">{fmt(cartTotal)}</span>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-[var(--border-color)] space-y-2 bg-[var(--bg-secondary)]/30">
          {cart.length > 0 && (
            <button onClick={handleProforma} className="w-full flex items-center justify-center gap-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-xl py-2.5 text-sm font-medium transition-all shadow-sm">
              <Printer className="w-4 h-4" />{t('print_proforma')}
            </button>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => { setPaymentType('cash'); setShowCheckout(true); }} disabled={cart.length === 0} className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold transition-all shadow-lg shadow-emerald-500/20">
              <Banknote className="w-5 h-5" />{t('cash')} (F8)
            </button>
            <button onClick={() => { setPaymentType('credit'); setShowCheckout(true); }} disabled={cart.length === 0} className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold transition-all shadow-lg shadow-violet-500/20">
              <CreditCard className="w-5 h-5" />{t('credit')} (F9)
            </button>
            <button onClick={() => { setPaymentType('debt'); setShowCheckout(true); }} disabled={cart.length === 0} className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold transition-all shadow-lg shadow-amber-500/20">
              <FileText className="w-5 h-5" />{t('debt')} (F10)
            </button>
          </div>
        </div>
      </div>

      {/* POST-SALE DIALOG */}
      {showPostSale && lastSaleData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-[var(--border-color)] text-center">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="font-bold text-lg text-[var(--text-primary)]">{t('sale_confirmed')}</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">{lastSaleData.invoiceNumber}</p>
            </div>
            <div className="p-6 space-y-3">
              <button onClick={() => {
                printThermalReceiptRaw({ ...lastSaleData, storeInfo, ...(storeInfo?.logo ? { storeLogo: storeInfo.logo } : {}), printerName: printerReceipt });
                setShowPostSale(false);
                setLastSaleData(null);
              }} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]">
                <Printer className="w-5 h-5" /> {t('print_receipt')}
              </button>
              <button onClick={() => {
                printDetailedInvoiceRaw({ ...lastSaleData, storeInfo, ...(storeInfo?.logo ? { storeLogo: storeInfo.logo } : {}), printerName: printerInvoice, discountAmt: lastSaleData.discountAmt || 0 });
                setShowPostSale(false);
                setLastSaleData(null);
              }} className="w-full flex items-center justify-center gap-2 bg-[var(--bg-surface)] border-2 border-indigo-600/30 hover:border-indigo-600 text-indigo-600 rounded-xl py-3 font-bold transition-all active:scale-[0.98]">
                <FileText className="w-5 h-5" /> {t('print_invoice')}
              </button>
              <button onClick={() => {
                setShowPostSale(false);
                setLastSaleData(null);
              }} className="w-full flex items-center justify-center gap-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-xl py-3 font-medium hover:text-[var(--text-primary)] transition-all border border-[var(--border-color)]">
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA SCANNER OVERLAY */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-500" />
                <h2 className="font-semibold text-[var(--text-primary)]">{t('camera_scan')}</h2>
              </div>
              <button onClick={stopScanner} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              <div id="qr-scanner-element" ref={scannerRef} className="w-full aspect-square bg-black rounded-xl overflow-hidden" />
            </div>
            <div className="px-6 pb-4 text-center text-xs text-[var(--text-muted)]">{t('scanning')}</div>
          </div>
        </div>
      )}

      {/* TODAY'S SALES DIALOG */}
      {showTodaySales && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h2 className="font-semibold text-[var(--text-primary)]">{t('today_sales')}</h2>
                <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-full">{todaySales.length}</span>
              </div>
              <button onClick={() => { setShowTodaySales(false); setTodaySalesItems({}); }} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingToday ? (
                <div className="text-center text-[var(--text-muted)] py-12">{t('loading')}</div>
              ) : todaySales.length === 0 ? (
                <div className="text-center text-[var(--text-muted)] py-12">{t('no_sales_today')}</div>
              ) : (
                <div className="space-y-3">
                  {todaySales.map(sale => {
                    const items = todaySalesItems[sale.id] || [];
                    const customer = sale.customer_name ? { name: sale.customer_name, phone: sale.customer_phone, address: sale.customer_address } : null;
                    return (
                      <div key={sale.id} className="bg-[var(--bg-secondary)]/30 border border-[var(--border-color)] rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-[var(--text-muted)]">#{sale.invoice_number || sale.id}</span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${sale.type === 'cash' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : sale.type === 'debt' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300'}`}>
                              {t(sale.type)}
                            </span>
                          </div>
                          <span className="font-black text-[var(--text-primary)]">{fmt(sale.total)}</span>
                        </div>
                        {customer && (
                          <div className="text-xs text-[var(--text-muted)]">
                            {t('customer')}: {customer.name}{customer.phone ? ` — ${customer.phone}` : ''}
                          </div>
                        )}
                        <div className="text-xs text-[var(--text-muted)]">
                          {new Date(sale.created_at).toLocaleTimeString()} — {items.length} {t('items')}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => {
                            setCart(items.map((i: any) => ({
                              product_id: i.product_id, name: i.name,
                              price_cash: 0, price_credit: i.price_credit || 0, stock: 999,
                              quantity: i.quantity, unitPrice: i.price_override || i.price,
                              discount: i.discount, subtotal: i.subtotal,
                            })));
                            if (customer) setSelectedCustomer({ id: sale.customer_id, name: customer.name, phone: customer.phone, address: customer.address });
                            setShowTodaySales(false);
                            setTodaySalesItems({});
                          }} className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95">
                            <ShoppingCart className="w-3 h-3" />{t('return_to_cart')}
                          </button>
                          <button onClick={() => {
                            printThermalReceiptRaw({
                              invoiceNumber: sale.invoice_number || `SALE-${sale.id}`,
                              storeName,
                              ...(storeInfo?.logo ? { storeLogo: storeInfo.logo } : {}),
                              customer,
                              items: items.map((i: any) => ({
                                name: i.name, quantity: i.quantity, unitPrice: i.price_override || i.price,
                                discount: i.discount, subtotal: i.subtotal
                              })),
                              subtotal: sale.subtotal,
                              discountPct: sale.discount > 0 ? Math.round(sale.discount / sale.subtotal * 100) : 0,
                              total: sale.total,
                              paymentType: sale.type,
                              installment: sale.type === 'credit' ? {
                                total: sale.total, advance: 0, remaining: sale.total, months: 0, monthly: 0
                              } : null,
                              currency,
                              printerName: printerReceipt,
                            });
                          }} className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95">
                            <Printer className="w-3 h-3" />{t('print_receipt')}
                          </button>
                          <button onClick={() => {
                            printDetailedInvoiceRaw({
                              invoiceNumber: sale.invoice_number || `SALE-${sale.id}`,
                              storeName, storeInfo,
                              ...(storeInfo?.logo ? { storeLogo: storeInfo.logo } : {}),
                              customer,
                              items: items.map((i: any) => ({
                                name: i.name, quantity: i.quantity, unitPrice: i.price_override || i.price,
                                discount: i.discount, subtotal: i.subtotal
                              })),
                              subtotal: sale.subtotal,
                              discountPct: sale.discount > 0 ? Math.round(sale.discount / sale.subtotal * 100) : 0,
                              discountAmt: sale.discount,
                              total: sale.total,
                              paymentType: sale.type,
                              installment: sale.type === 'credit' ? {
                                total: sale.total, advance: 0, remaining: sale.total, months: 0, monthly: 0
                              } : null,
                              currency,
                              printerName: printerInvoice,
                            });
                          }} className="flex items-center gap-1.5 text-xs font-semibold bg-[var(--bg-surface)] border border-indigo-600/30 hover:border-indigo-600 text-indigo-600 px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95">
                            <FileText className="w-3 h-3" />{t('print_invoice')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK CUSTOMER MODAL */}
      {showQuickCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <h2 className="font-semibold text-[var(--text-primary)]">{t('add_customer')}</h2>
              <button onClick={() => { setShowQuickCustomer(false); setQuickCustName(''); setQuickCustPhone(''); }} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('customer_name')} *</label>
                <input
                  type="text"
                  value={quickCustName}
                  onChange={e => setQuickCustName(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                  autoFocus
                  placeholder={t('customer_name')}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('phone')}</label>
                <input
                  type="text"
                  value={quickCustPhone}
                  onChange={e => setQuickCustPhone(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                  placeholder={t('phone')}
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setShowQuickCustomer(false); setQuickCustName(''); setQuickCustPhone(''); }} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-2.5 font-medium transition-all shadow-sm">{t('cancel')}</button>
              <button
                onClick={async () => {
                  if (!quickCustName.trim()) return;
                  const result = await window.electronAPI.quickCreateCustomer(quickCustName.trim(), quickCustPhone.trim() || undefined);
                  if (result.success && result.id) {
                    const newCust = { id: result.id, name: quickCustName.trim(), phone: quickCustPhone.trim() || undefined, address: undefined };
                    setSelectedCustomer(newCust);
                    setCustomers(prev => [...prev, newCust]);
                    setShowQuickCustomer(false);
                    setQuickCustName('');
                    setQuickCustPhone('');
                  } else {
                    alert('Error: ' + (result.error || 'Could not create customer'));
                  }
                }}
                disabled={!quickCustName.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-2.5 font-bold transition-all shadow-lg shadow-indigo-500/20"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN DIALOG (triggered from product click in return mode) */}
      {showReturnDialog && returnProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-red-500" />
                <h2 className="font-semibold text-[var(--text-primary)]">{t('return_product')}</h2>
              </div>
              <button onClick={() => { setShowReturnDialog(false); setReturnProduct(null); setReturnQty(1); setReturnReason(''); }} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-sm">
                <div className="font-semibold text-[var(--text-primary)]">{returnProduct.name}</div>
                <div className="text-[var(--text-muted)]">{t('price')}: {fmt(returnProduct.price_cash)}</div>
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('qty')}</label>
                <input type="number" value={returnQty} onChange={e => setReturnQty(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-inner" min={1} />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('reason')} *</label>
                <input type="text" value={returnReason} onChange={e => setReturnReason(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-inner"
                  placeholder={t('reason_placeholder')} />
              </div>
              <div className="flex items-center justify-between bg-red-100 dark:bg-red-500/10 rounded-xl px-4 py-3 border border-red-200 dark:border-red-500/20 shadow-sm">
                <span className="text-red-700 dark:text-red-300 text-sm font-bold uppercase tracking-wider">{t('total_refund')}</span>
                <span className="font-black text-xl text-red-600 dark:text-white">{fmt(returnProduct.price_cash * returnQty)}</span>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setShowReturnDialog(false); setReturnProduct(null); setReturnQty(1); setReturnReason(''); }} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-2.5 font-medium transition-all shadow-sm">{t('cancel')}</button>
              <button
                onClick={async () => {
                  if (!returnReason.trim()) return;
                  const result = await window.electronAPI.returnProduct({
                    product_id: returnProduct.id,
                    quantity: returnQty,
                    price: returnProduct.price_cash,
                    reason: returnReason.trim(),
                    returned_by: user?.id,
                  });
                  if (result.success) {
                    setProducts(prev => prev.map(p => p.id === returnProduct.id ? { ...p, stock: p.stock + returnQty } : p));
                    setShowReturnDialog(false);
                    setReturnProduct(null);
                    setReturnQty(1);
                    setReturnReason('');
                    setReturnMode(false);
                    window.electronAPI.kickCashDrawer(printerReceipt).catch(() => {});
                  } else {
                    alert('Error: ' + (result.error || 'Return failed'));
                  }
                }}
                disabled={!returnReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl py-2.5 font-bold transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
              >
                <Undo2 className="w-4 h-4" />{t('confirm_return')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPENSE WITHDRAWAL MODAL */}
      {showExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-[var(--text-primary)]">{t('cash_withdrawal')}</h2>
              </div>
              <button onClick={() => { setShowExpense(false); setExpenseAmount(''); setExpenseReason(''); }} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('amount')} *</label>
                <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner" min={0} autoFocus placeholder="0" />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('expense_reason')} *</label>
                <textarea
                  value={expenseReason} onChange={e => setExpenseReason(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner resize-none"
                  rows={3} placeholder={t('expense_reason_placeholder')}
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setShowExpense(false); setExpenseAmount(''); setExpenseReason(''); }} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-2.5 font-medium transition-all shadow-sm">{t('cancel')}</button>
              <button
                onClick={async () => {
                  const amt = Number(expenseAmount);
                  if (!amt || amt <= 0 || !expenseReason.trim()) return;
                  const result = await window.electronAPI.createExpense(amt, expenseReason.trim());
                  if (result.success) {
                    setShowExpense(false);
                    setExpenseAmount('');
                    setExpenseReason('');
                    window.electronAPI.kickCashDrawer(printerReceipt).catch(() => {});
                  } else {
                    alert('Error: ' + (result.error || 'Failed'));
                  }
                }}
                disabled={!Number(expenseAmount) || Number(expenseAmount) <= 0 || !expenseReason.trim()}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl py-2.5 font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />{t('confirm_withdrawal')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CASH IN MODAL */}
      {showCashIn && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setShowCashIn(false)}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                <h2 className="font-semibold text-[var(--text-primary)]">{t('cash_in')}</h2>
              </div>
              <button onClick={() => { setShowCashIn(false); setCashInAmount(''); setCashInReason(''); }} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('amount')} *</label>
                <input type="number" value={cashInAmount} onChange={e => setCashInAmount(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" min={0} autoFocus placeholder="0" />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('cash_in_reason')}</label>
                <input type="text" value={cashInReason} onChange={e => setCashInReason(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                  placeholder={t('cash_in_reason_placeholder')} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setShowCashIn(false); setCashInAmount(''); setCashInReason(''); }} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-2.5 font-medium transition-all shadow-sm">{t('cancel')}</button>
              <button
                onClick={async () => {
                  const amt = Number(cashInAmount);
                  if (!amt || amt <= 0) return;
                  const r = await window.electronAPI.addCashMovement('in', amt, cashInReason || t('cash_in'));
                  if (r.success) {
                    setShowCashIn(false);
                    setCashInAmount('');
                    setCashInReason('');
                    window.electronAPI.kickCashDrawer(printerReceipt).catch(() => {});
                  } else {
                    alert('Error: ' + (r.error || 'Failed'));
                  }
                }}
                disabled={!Number(cashInAmount) || Number(cashInAmount) <= 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl py-2.5 font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />{t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODE BAR */}
      {returnMode && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-medium text-sm flex items-center gap-3 animate-in fade-in">
          <Undo2 className="w-4 h-4" />
          <span>{t('return_mode_active')}</span>
          <button onClick={() => setReturnMode(false)} className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors">{t('exit')}</button>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                {paymentType === 'cash'
                  ? <><Banknote className="w-5 h-5 text-emerald-500" /><h2 className="font-semibold text-[var(--text-primary)]">{t('cash')}</h2></>
                  : <><CreditCard className="w-5 h-5 text-violet-500" /><h2 className="font-semibold text-[var(--text-primary)]">{t('credit')}</h2></>
                }
              </div>
              <button onClick={() => setShowCheckout(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 space-y-1 text-sm shadow-inner">
                <div className="flex justify-between text-[var(--text-secondary)]"><span>{t('items_in_cart')}</span><span>{cart.length}</span></div>
                <div className="flex justify-between text-[var(--text-secondary)]"><span>{t('subtotal')}</span><span>{fmt(cartSubtotal)}</span></div>
                {orderDiscountAmt > 0 && <div className="flex justify-between text-red-500 font-medium"><span>{t('discount')} {orderDiscountType === 'percentage' ? `${orderDiscount}%` : ''}</span><span>-{fmt(orderDiscountAmt)}</span></div>}
                <div className="flex justify-between font-bold text-[var(--text-primary)] text-base pt-1 border-t border-[var(--border-color)]">
                  <span>{t('total')}</span><span className="text-indigo-500 font-extrabold">{fmt(paymentType === 'credit' ? instTotalPrice : cartTotal)}</span>
                </div>
              </div>

              {/* Amount Given (Cash & Debt) */}
              {(paymentType === 'cash' || paymentType === 'debt') && (
                <div className={`space-y-3 rounded-xl p-4 shadow-sm ${paymentType === 'cash' ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-amber-500/5 border border-amber-500/20'}`}>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('amount_given')}</label>
                    <input
                      type="number"
                      value={amountGiven}
                      onChange={e => setAmountGiven(e.target.value)}
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner transition-all"
                      min={0}
                      autoFocus={paymentType === 'cash'}
                      placeholder="0"
                    />
                  </div>
                  {paymentType === 'cash' && changeAmount > 0 && (
                    <div className="flex items-center justify-between bg-emerald-100 dark:bg-emerald-500/10 rounded-xl px-4 py-3 border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
                      <span className="text-emerald-700 dark:text-emerald-300 text-sm font-bold uppercase tracking-wider">{t('rest_to_return')}</span>
                      <span className="font-black text-xl text-emerald-600 dark:text-white">
                        {fmt(changeAmount)}
                      </span>
                    </div>
                  )}
                  {paymentType === 'debt' && (
                    <div className="flex items-center justify-between bg-amber-100 dark:bg-amber-500/10 rounded-xl px-4 py-3 border border-amber-200 dark:border-amber-500/20 shadow-sm">
                      <span className="text-amber-700 dark:text-amber-300 text-sm font-bold uppercase tracking-wider">{t('remaining_debt')}</span>
                      <span className="font-black text-xl text-amber-600 dark:text-white">
                        {fmt(Math.max(0, cartTotal - (Number(amountGiven) || 0)))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm text-[var(--text-secondary)] font-medium mb-2">{t('select_customer')} {(paymentType === 'credit' || paymentType === 'debt') ? '*' : ''}</label>
                <div className="flex gap-2">
                  <div className="flex-1 text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm shadow-inner">
                    {selectedCustomer ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{selectedCustomer.name}</div>
                          {selectedCustomer.phone && <div className="text-xs text-[var(--text-muted)]">{selectedCustomer.phone}</div>}
                        </div>
                        <button onClick={() => setSelectedCustomer(null)} className="text-[var(--text-muted)] hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)] italic">{t('no_customer')}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowQuickCustomer(true)}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3 py-2 text-xs font-semibold transition-all shadow-sm active:scale-95 shrink-0"
                    title={t('quick_add_customer')}
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('add')}</span>
                  </button>
                </div>
              </div>

              {paymentType === 'credit' && (
                <div className="space-y-4 bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-violet-600 dark:text-violet-300">{t('installment_contract')}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="text-[var(--text-secondary)] block mb-1.5">{t('total_credit_price')}</label>
                      <input type="number" value={instTotalPrice} onChange={e => setInstTotalPrice(Number(e.target.value))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-inner" min={0} />
                    </div>
                    <div>
                      <label className="text-[var(--text-secondary)] block mb-1.5">{t('advance')}</label>
                      <input type="number" value={instAdvance} onChange={e => setInstAdvance(Number(e.target.value))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-inner" min={0} />
                    </div>
                    <div>
                      <label className="text-[var(--text-secondary)] block mb-1.5">{t('months')}</label>
                      <input type="number" value={instMonths} onChange={e => setInstMonths(Number(e.target.value))} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-inner" min={1} max={60} />
                    </div>
                    <div>
                      <label className="text-[var(--text-secondary)] block mb-1.5">{t('remaining')}</label>
                      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-violet-600 dark:text-violet-300 font-bold rounded-xl px-3 py-2 shadow-inner">{fmt(instRemaining)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-violet-100 dark:bg-violet-500/10 rounded-xl px-4 py-3 border border-violet-200 dark:border-violet-500/20 shadow-sm">
                    <span className="text-violet-700 dark:text-violet-300 text-sm font-bold uppercase tracking-wider">{t('monthly_payment')}</span>
                    <span className="text-violet-600 dark:text-white font-black text-xl">{fmt(instMonthly)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowCheckout(false)} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-3 font-medium transition-all shadow-sm">{t('cancel')}</button>
              <button
                onClick={handleConfirm}
                disabled={(paymentType === 'credit' && (!selectedCustomer || !instTotalPrice || instMonths <= 0)) || (paymentType === 'debt' && !selectedCustomer)}
                className={`flex-1 text-white rounded-xl py-3 font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg ${paymentType === 'cash' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : paymentType === 'debt' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20' : 'bg-violet-600 hover:bg-violet-500 shadow-violet-500/20'}`}
              >
                {paymentType === 'cash' ? <Banknote className="w-5 h-5" /> : paymentType === 'debt' ? <FileText className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                {t('confirm_sale')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}