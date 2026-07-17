import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, addDoc, query, orderBy, doc, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, ShoppingCart, Trash2, Plus, Minus, X, DollarSign, CreditCard, Printer, Camera, Scan, CheckCircle, FileText, Undo2, Wallet, PlusCircle, Tag, User, Percent } from 'lucide-react';

interface Product { id: string; name: string; barcode?: string; price_purchase: number; price_cash: number; stock: number; }
interface Customer { id: string; name: string; phone?: string; }
interface CartItem { product_id: string; name: string; price_cash: number; stock: number; quantity: number; unitPrice: number; discount: number; subtotal: number; }

export default function POS() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const scannerInstanceRef = useRef<any>(null);
  const barcodeBufferRef = useRef('');
  const barcodeTimerRef = useRef<any>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [orderDiscountType, setOrderDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'debt' | 'installment'>('cash');
  const [currency, setCurrency] = useState('DZD');

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

  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');

  const [returnMode, setReturnMode] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnProduct, setReturnProduct] = useState<any>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');

  const [showExpense, setShowExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');

  const [showCashIn, setShowCashIn] = useState(false);
  const [cashInAmount, setCashInAmount] = useState('');
  const [cashInReason, setCashInReason] = useState('');

  const [successMsg, setSuccessMsg] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);

  useEffect(() => { loadData(); }, []);

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
      if (returnMode) { setReturnProduct(product); setReturnQty(1); setReturnReason(''); setShowReturnDialog(true); }
      else { addToCart(product); }
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
        if (code) { if (!handleBarcodeEnter(code)) setSearch(code); return; }
        if (e.target instanceof HTMLInputElement) {
          const inputVal = (e.target as HTMLInputElement).value.trim();
          if (inputVal && handleBarcodeEnter(inputVal)) { (e.target as HTMLInputElement).value = ''; return; }
        }
        return;
      }
      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
        barcodeTimerRef.current = setTimeout(() => { barcodeBufferRef.current = ''; }, 100);
      }
    };
    window.addEventListener('keydown', handleBarcodeScan);
    return () => window.removeEventListener('keydown', handleBarcodeScan);
  }, [handleBarcodeEnter]);

  const loadData = async () => {
    const pSnap = await getDocs(query(collection(db, 'products'), orderBy('name')));
    const prods: Product[] = [];
    pSnap.forEach(d => prods.push({ id: d.id, ...d.data() as any }));
    setProducts(prods);

    const cSnap = await getDocs(query(collection(db, 'customers'), orderBy('name')));
    const custs: Customer[] = [];
    cSnap.forEach(d => custs.push({ id: d.id, ...d.data() as any }));
    setCustomers(custs);

    const setSnap = await getDocs(collection(db, 'settings'));
    setSnap.forEach(d => { if (d.id === 'currency') setCurrency(d.data().value); });
  };

  const filtered = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search)))
    : products.filter(p => p.stock > 0);

  const addToCart = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) return prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1, subtotal: calcSubtotal(i.unitPrice, i.quantity + 1, i.discount) } : i);
      return [...prev, { product_id: p.id, name: p.name, price_cash: p.price_cash, stock: p.stock, quantity: 1, unitPrice: p.price_cash, discount: 0, subtotal: p.price_cash }];
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
  const orderDiscountAmt = orderDiscountType === 'percentage' ? cartSubtotal * orderDiscount / 100 : orderDiscount;
  const cartTotal = Math.max(0, cartSubtotal - orderDiscountAmt);

  useEffect(() => {
    if ((paymentType === 'credit' || paymentType === 'installment') && cart.length > 0) {
      const cs = cart.reduce((s, i) => s + i.unitPrice * i.quantity * (1 - i.discount / 100), 0);
      const da = orderDiscountType === 'percentage' ? cs * orderDiscount / 100 : orderDiscount;
      setInstTotalPrice(Math.round(Math.max(0, cs - da)));
    }
  }, [cart, paymentType, orderDiscount, orderDiscountType]);

  const instRemaining = Math.max(0, instTotalPrice - instAdvance);
  const instMonthly = instMonths > 0 ? Math.round(instRemaining / instMonths) : 0;

  const loadTodaySales = async () => {
    setLoadingToday(true);
    setShowTodaySales(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const sSnap = await getDocs(collection(db, 'sales'));
      const sales: any[] = [];
      sSnap.forEach(d => {
        const s = d.data();
        if (s.created_at?.startsWith(today)) sales.push({ id: d.id, ...s });
      });
      sales.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      setTodaySales(sales);

      const itemsMap: Record<string, any[]> = {};
      const siSnap = await getDocs(collection(db, 'sale_items'));
      const pMap: any = {};
      products.forEach(p => pMap[p.id] = p.name);
      for (const sale of sales) {
        const items: any[] = [];
        siSnap.forEach(d => {
          const si = d.data();
          if (si.sale_id === sale.id) items.push({ id: d.id, ...si, name: pMap[si.product_id] || '-' });
        });
        itemsMap[sale.id] = items;
      }
      setTodaySalesItems(itemsMap);
    } catch (err) { console.error(err); }
    setLoadingToday(false);
  };

  const fmt = (n: number) => (n || 0).toLocaleString() + ' ' + currency;

  const handleConfirm = async () => {
    if ((paymentType === 'credit' || paymentType === 'debt' || paymentType === 'installment') && !selectedCustomer) { alert(t('select_customer')); return; }

    const finalTotal = paymentType === 'installment' ? instTotalPrice : cartTotal;
    const debtPaidAmount = paymentType === 'debt' ? (Number(amountGiven) || 0) : 0;

    const saleData: any = {
      type: paymentType === 'installment' ? 'credit' : paymentType,
      subtotal: cartSubtotal, discount: orderDiscountAmt, total: finalTotal,
      customer_id: selectedCustomer?.id || null,
      paid_amount: debtPaidAmount, created_at: new Date().toISOString(),
      status: 'completed', created_by: user?.id || null,
    };
    const saleRef = await addDoc(collection(db, 'sales'), saleData);

    for (const item of cart) {
      await addDoc(collection(db, 'sale_items'), {
        sale_id: saleRef.id, product_id: item.product_id, quantity: item.quantity,
        price: item.price_cash, price_override: item.unitPrice, discount: item.discount, subtotal: item.subtotal,
      });
      const prodRef = doc(db, 'products', item.product_id);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        await updateDoc(prodRef, { stock: Math.max(0, (prodSnap.data().stock || 0) - item.quantity) });
      }
    }

    if (paymentType === 'debt') {
      const debtRemaining = Math.max(0, finalTotal - debtPaidAmount);
      const debtStatus = debtPaidAmount >= finalTotal ? 'paid' : debtPaidAmount > 0 ? 'partial' : 'active';
      await addDoc(collection(db, 'credit_debts'), {
        sale_id: saleRef.id, customer_id: selectedCustomer?.id,
        original_amount: finalTotal, remaining: debtRemaining, status: debtStatus,
        created_at: new Date().toISOString(), created_by: user?.id || null,
      });
    }

    if (paymentType === 'installment') {
      await addDoc(collection(db, 'installments'), {
        sale_id: saleRef.id, customer_id: selectedCustomer?.id,
        total_amount: instTotalPrice, advance: instAdvance, remaining: instRemaining,
        months: instMonths, monthly_payment: instMonthly, paid_amount: instAdvance, status: 'active',
        start_date: new Date().toISOString(), created_by: user?.id || null,
      });
    }

    // Queue print command for Windows app
    try {
      await addDoc(collection(db, 'print_commands'), {
        type: 'print_receipt',
        data: {
          sale_id: saleRef.id, storeName: 'Store', customer: selectedCustomer,
          items: cart.map(i => ({ ...i })), subtotal: cartSubtotal,
          discountAmt: orderDiscountAmt, total: finalTotal, paymentType, currency,
        },
        status: 'pending', created_at: new Date().toISOString(),
      });
    } catch (e) { console.error('Failed to queue print command:', e); }

    setLastSaleData({
      id: saleRef.id, storeName: 'Store', customer: selectedCustomer,
      items: [...cart], subtotal: cartSubtotal, discountAmt: orderDiscountAmt,
      total: finalTotal, paymentType, currency,
      installment: paymentType === 'installment' ? { total: instTotalPrice, advance: instAdvance, remaining: instRemaining, months: instMonths, monthly: instMonthly } : null,
    });

    setCart([]); setOrderDiscount(0); setSelectedCustomer(null);
    setShowCheckout(false); setInstAdvance(0); setInstMonths(12);
    setAmountGiven(''); setShowPostSale(true);
    setSuccessMsg(t('sale_confirmed'));
    setTimeout(() => setSuccessMsg(''), 4000);
    loadData();
  };

  const handleReturn = async () => {
    if (!returnProduct || !returnReason.trim()) return;
    await addDoc(collection(db, 'product_returns'), {
      product_id: returnProduct.id, quantity: returnQty, price: returnProduct.price_cash,
      total: returnProduct.price_cash * returnQty, reason: returnReason.trim(),
      created_at: new Date().toISOString(), created_by: user?.id || null,
    });
    const prodRef = doc(db, 'products', returnProduct.id);
    const prodSnap = await getDoc(prodRef);
    if (prodSnap.exists()) {
      await updateDoc(prodRef, { stock: (prodSnap.data().stock || 0) + returnQty });
    }
    setShowReturnDialog(false); setReturnProduct(null); setReturnQty(1); setReturnReason('');
    loadData();
  };

  const handleExpense = async () => {
    if (!expenseAmount || Number(expenseAmount) <= 0 || !expenseReason.trim()) return;
    await addDoc(collection(db, 'expenses'), {
      amount: Number(expenseAmount), description: expenseReason.trim(),
      created_at: new Date().toISOString(), created_by: user?.id || null,
    });
    setShowExpense(false); setExpenseAmount(''); setExpenseReason('');
  };

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
            try { const data = JSON.parse(code); if (data.id) { const p = products.find(x => x.id === data.id); if (p) { addToCart(p); return; } } } catch {}
            const p = products.find(x => x.barcode === code);
            if (p) addToCart(p); else setSearch(code);
          },
          () => {}
        );
      } catch (err) { console.error('Scanner error:', err); setShowScanner(false); }
    }, 300);
  };

  const stopScanner = () => {
    if (scannerInstanceRef.current) { scannerInstanceRef.current.stop().catch(() => {}); scannerInstanceRef.current = null; }
    setShowScanner(false);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || '').includes(customerSearch)
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] -m-4 overflow-hidden">
      {successMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-medium text-sm animate-bounce">
          ✓ {successMsg}
        </div>
      )}

      {/* ─── PRODUCTS ─── */}
      <div className="flex flex-col flex-1 min-h-0 bg-slate-950 relative">
        {/* Search */}
        <div className="p-2.5 sm:p-3 border-b border-slate-700">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`${t('search_products')} (F2)`}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white" />
            <button onClick={startScanner} className="absolute end-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-indigo-400 rounded-lg touch-manipulation" title={t('camera_scan')}>
              <Camera className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-2.5 sm:p-3 grid grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2 content-start">
          {filtered.map(p => (
            <button key={p.id} onClick={() => {
              if (returnMode) { setReturnProduct(p); setReturnQty(1); setReturnReason(''); setShowReturnDialog(true); }
              else { addToCart(p); }
            }} disabled={p.stock <= 0 && !returnMode}
              className={`bg-slate-800/50 border rounded-xl p-2.5 sm:p-3 text-start transition-all hover:border-indigo-500/50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] touch-manipulation min-h-[90px] sm:min-h-0 ${returnMode ? 'ring-2 ring-red-500/30 hover:ring-red-500' : 'border-slate-700/50'}`}>
              <div className="font-medium text-xs sm:text-sm text-white mb-1 line-clamp-2 leading-tight">{p.name}</div>
              {p.barcode && <div className="text-[9px] sm:text-[10px] text-slate-500 font-mono mb-0.5 truncate">{p.barcode}</div>}
              <div className="text-sm sm:text-base font-bold text-emerald-400">{fmt(p.price_cash)}</div>
              {p.stock <= 3 && <div className={`text-[10px] sm:text-xs mt-0.5 font-medium ${p.stock <= 0 ? 'text-red-400' : 'text-amber-400'}`}>{p.stock <= 0 ? t('out_of_stock') : `${t('stock')}: ${p.stock}`}</div>}
            </button>
          ))}
          {filtered.length === 0 && search && <div className="col-span-full text-center text-slate-500 py-12 text-sm">{t('no_data')}</div>}
        </div>

        {/* Bottom toolbar */}
        <div className="px-2.5 sm:px-3 py-2 border-t border-slate-700 flex gap-1.5 sm:gap-2 text-[10px] text-slate-500 bg-slate-900/80 flex-wrap items-center">
          <span className="hidden sm:inline">F2 {t('search')}</span>
          <span className="hidden sm:inline">F8 {t('cash')}</span>
          <span className="hidden sm:inline">F9 {t('credit')}</span>
          <span className="hidden sm:inline">F10 {t('debt')}</span>
          <button onClick={() => setReturnMode(!returnMode)} className={`flex items-center gap-1 font-medium px-2 py-1.5 rounded-lg touch-manipulation ${returnMode ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-red-400 hover:bg-slate-800'}`}>
            <Undo2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t('return_mode')}</span>
          </button>
          <button onClick={() => setShowExpense(true)} className="flex items-center gap-1 text-slate-400 hover:text-amber-400 font-medium px-2 py-1.5 rounded-lg hover:bg-slate-800 touch-manipulation">
            <Wallet className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t('cash_withdrawal')}</span>
          </button>
          <button onClick={() => setShowCashIn(true)} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1.5 rounded-lg hover:bg-slate-800 touch-manipulation">
            <PlusCircle className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t('cash_in')}</span>
          </button>
          <button onClick={loadTodaySales} className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1.5 rounded-lg hover:bg-slate-800 touch-manipulation">
            <FileText className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t('today_sales')}</span>
          </button>
          <span className="ml-auto hidden sm:inline-flex items-center gap-0.5"><Scan className="w-3 h-3" />QR</span>
        </div>

        {/* Floating cart FAB — mobile only */}
        {cart.length > 0 && (
          <>
            {/* Cart count badge (top of product area) */}
            <div className="lg:hidden fixed top-16 right-3 z-30 flex items-center gap-2">
              <div className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                {cart.length} {t('items')} · {fmt(cartTotal)}
              </div>
            </div>
            {/* FAB button */}
            <button onClick={() => setShowCartMobile(true)}
              className="lg:hidden fixed bottom-4 right-4 z-30 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-2xl flex items-center justify-center active:scale-90 transition-all touch-manipulation shadow-indigo-600/30">
              <ShoppingCart className="w-7 h-7" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">{cart.length}</span>
            </button>
          </>
        )}
      </div>

      {/* ─── CART — Desktop side panel ─── */}
      <div className="hidden lg:flex flex-col w-[420px] bg-slate-900 border-l border-slate-700 min-h-0">
        <CartPanel
          cart={cart} t={t} fmt={fmt}
          selectedCustomer={selectedCustomer}
          showCustomerList={showCustomerList}
          customerSearch={customerSearch}
          filteredCustomers={filteredCustomers}
          setShowCustomerList={setShowCustomerList}
          setCustomerSearch={setCustomerSearch}
          setSelectedCustomer={setSelectedCustomer}
          setShowQuickCustomer={setShowQuickCustomer}
          removeItem={removeItem}
          updateQty={updateQty}
          updatePrice={updatePrice}
          updateDiscount={updateDiscount}
          cartSubtotal={cartSubtotal}
          orderDiscount={orderDiscount}
          orderDiscountType={orderDiscountType}
          orderDiscountAmt={orderDiscountAmt}
          cartTotal={cartTotal}
          setOrderDiscount={setOrderDiscount}
          setOrderDiscountType={setOrderDiscountType}
          setCart={setCart}
          setPaymentType={setPaymentType}
          setShowCheckout={setShowCheckout}
        />
      </div>

      {/* ─── CART — Mobile bottom sheet ─── */}
      {showCartMobile && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setShowCartMobile(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-slate-900 border-t border-slate-700 rounded-t-3xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: 'calc(100vh - 80px)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-sm text-white">{t('cart')}</span>
                <span className="bg-indigo-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{cart.length}</span>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-400 flex items-center gap-1 px-2 py-1 rounded-lg"><Trash2 className="w-3.5 h-3.5" />{t('clear_cart')}</button>}
                <button onClick={() => setShowCartMobile(false)} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 160px)' }}>
              <CartPanel
                cart={cart} t={t} fmt={fmt}
                selectedCustomer={selectedCustomer}
                showCustomerList={showCustomerList}
                customerSearch={customerSearch}
                filteredCustomers={filteredCustomers}
                setShowCustomerList={setShowCustomerList}
                setCustomerSearch={setCustomerSearch}
                setSelectedCustomer={setSelectedCustomer}
                setShowQuickCustomer={setShowQuickCustomer}
                removeItem={removeItem}
                updateQty={updateQty}
                updatePrice={updatePrice}
                updateDiscount={updateDiscount}
                cartSubtotal={cartSubtotal}
                orderDiscount={orderDiscount}
                orderDiscountType={orderDiscountType}
                orderDiscountAmt={orderDiscountAmt}
                cartTotal={cartTotal}
                setOrderDiscount={setOrderDiscount}
                setOrderDiscountType={setOrderDiscountType}
                setCart={setCart}
                setPaymentType={setPaymentType}
                setShowCheckout={setShowCheckout}
              />
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-end sm:items-center z-50" onClick={() => setShowCheckout(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md mx-auto p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">{t('checkout')}</h2>
              <button onClick={() => setShowCheckout(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(['cash', 'credit', 'debt', 'installment'] as const).map(type => (
                <button key={type} onClick={() => setPaymentType(type)}
                  className={`py-2.5 rounded-lg text-xs font-medium transition-all ${paymentType === type ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {t(type === 'installment' ? 'installment' : type)}
                </button>
              ))}
            </div>

            {(paymentType === 'credit' || paymentType === 'debt' || paymentType === 'installment') && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('select_customer')}</label>
                <select value={selectedCustomer?.id || ''} onChange={e => {
                  const c = customers.find(x => x.id === e.target.value);
                  setSelectedCustomer(c || null);
                }} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white">
                  <option value="">{t('no_customer')}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {paymentType === 'installment' && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t('advance')}</label>
                  <input type="number" value={instAdvance} onChange={e => setInstAdvance(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" min={0} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t('installment_months')}</label>
                  <select value={instMonths} onChange={e => setInstMonths(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    {[2, 3, 4, 6, 12].map(m => <option key={m} value={m}>{m} {t('months')}</option>)}
                  </select>
                </div>
                <div className="bg-indigo-500/10 rounded-lg p-2.5 text-xs text-slate-300 space-y-0.5 border border-indigo-500/20">
                  <div className="flex justify-between"><span>{t('total')}</span><span className="font-bold text-white">{fmt(instTotalPrice)}</span></div>
                  <div className="flex justify-between"><span>{t('advance')}</span><span className="font-bold text-indigo-400">{fmt(instAdvance)}</span></div>
                  <div className="flex justify-between"><span>{t('remaining')}</span><span className="font-bold text-amber-400">{fmt(instRemaining)}</span></div>
                  <div className="flex justify-between"><span>{t('monthly')}</span><span className="font-bold text-emerald-400">{fmt(instMonthly)}</span></div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Percent className="w-3 h-3" />{t('discount')}</label>
              <input type="number" value={orderDiscount} onChange={e => setOrderDiscount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" min={0} />
            </div>

            {(paymentType === 'cash' || paymentType === 'debt') && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{paymentType === 'cash' ? t('amount_given') : t('amount_paid_today')}</label>
                <input type="number" value={amountGiven} onChange={e => setAmountGiven(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" />
                {paymentType === 'cash' && Number(amountGiven) >= cartTotal && (
                  <div className="text-sm text-emerald-400 mt-1">{t('change')}: {fmt(Number(amountGiven) - cartTotal)}</div>
                )}
                {paymentType === 'debt' && Number(amountGiven) > 0 && Number(amountGiven) < cartTotal && (
                  <div className="text-sm text-amber-400 mt-1">{t('debt_remaining')}: {fmt(cartTotal - Number(amountGiven))}</div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-lg font-bold text-white">
              <span>{t('total')}:</span>
              <span>{fmt(paymentType === 'installment' ? instTotalPrice : cartTotal)}</span>
            </div>

            <button onClick={handleConfirm} className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl py-3 font-bold text-sm text-white active:scale-[0.98] transition-all">
              {t('confirm_sale')}
            </button>
          </div>
        </div>
      )}

      {/* POST-SALE DIALOG */}
      {showPostSale && lastSaleData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-700 text-center">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="font-bold text-white">{t('sale_confirmed')}</h2>
            </div>
            <div className="p-5 space-y-2">
              <button onClick={() => { window.print(); setShowPostSale(false); setLastSaleData(null); }}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 font-bold text-sm active:scale-[0.98]">
                <Printer className="w-4 h-4" />{t('print_receipt')}
              </button>
              <button onClick={() => { setShowPostSale(false); setLastSaleData(null); }}
                className="w-full bg-slate-700 text-slate-300 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-600">
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA SCANNER */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" />
                <h2 className="font-semibold text-sm text-white">{t('camera_scan')}</h2>
              </div>
              <button onClick={stopScanner} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3">
              <div id="qr-scanner-element" ref={scannerRef} className="w-full aspect-square bg-black rounded-xl overflow-hidden" />
            </div>
            <div className="px-5 pb-3 text-center text-xs text-slate-500">{t('scanning')}</div>
          </div>
        </div>
      )}

      {/* TODAY'S SALES */}
      {showTodaySales && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h2 className="font-semibold text-sm text-white">{t('today_sales')}</h2>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{todaySales.length}</span>
              </div>
              <button onClick={() => { setShowTodaySales(false); setTodaySalesItems({}); }} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingToday ? (
                <div className="text-center text-slate-500 py-12 text-sm">{t('loading')}</div>
              ) : todaySales.length === 0 ? (
                <div className="text-center text-slate-500 py-12 text-sm">{t('no_sales_today')}</div>
              ) : todaySales.map(sale => {
                const items = todaySalesItems[sale.id] || [];
                return (
                  <div key={sale.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">#{sale.id?.slice(0, 6)}</span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${sale.type === 'cash' ? 'bg-emerald-500/20 text-emerald-300' : sale.type === 'debt' ? 'bg-amber-500/20 text-amber-300' : 'bg-violet-500/20 text-violet-300'}`}>{t(sale.type)}</span>
                      </div>
                      <span className="font-bold text-white text-sm">{fmt(sale.total)}</span>
                    </div>
                    <div className="text-xs text-slate-500">{sale.created_at ? new Date(sale.created_at).toLocaleTimeString() : ''} — {items.length} {t('items')}</div>
                    <button onClick={() => {
                      setCart(items.map((i: any) => {
                        const prod = products.find(p => p.id === i.product_id);
                        return {
                          product_id: i.product_id, name: i.name, price_cash: prod?.price_cash || 0, stock: prod?.stock || 999,
                          quantity: i.quantity, unitPrice: i.price_override || i.price, discount: i.discount || 0, subtotal: i.subtotal,
                        };
                      }));
                      if (sale.customer_id) {
                        const c = customers.find(x => x.id === sale.customer_id);
                        if (c) setSelectedCustomer(c);
                      }
                      setShowTodaySales(false); setTodaySalesItems({});
                    }} className="text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg active:scale-95 inline-flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" />{t('return_to_cart')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* QUICK CUSTOMER */}
      {showQuickCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <h2 className="font-semibold text-sm text-white">{t('add_customer')}</h2>
              <button onClick={() => setShowQuickCustomer(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('customer_name')}</label>
                <input type="text" value={quickCustName} onChange={e => setQuickCustName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" autoFocus />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('phone')}</label>
                <input type="text" value={quickCustPhone} onChange={e => setQuickCustPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowQuickCustomer(false)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-sm font-medium text-white">{t('cancel')}</button>
              <button onClick={async () => {
                if (!quickCustName.trim()) return;
                const ref = await addDoc(collection(db, 'customers'), { name: quickCustName.trim(), phone: quickCustPhone.trim() || '' });
                const newCust = { id: ref.id, name: quickCustName.trim(), phone: quickCustPhone.trim() || '' };
                setSelectedCustomer(newCust);
                setCustomers(prev => [...prev, newCust]);
                setShowQuickCustomer(false);
              }} disabled={!quickCustName.trim()} className="flex-1 bg-indigo-600 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-40">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN DIALOG */}
      {showReturnDialog && returnProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Undo2 className="w-4 h-4 text-red-400" />
                <h2 className="font-semibold text-sm text-white">{t('return_product')}</h2>
              </div>
              <button onClick={() => { setShowReturnDialog(false); setReturnProduct(null); setReturnQty(1); setReturnReason(''); }} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-sm">
                <div className="font-semibold text-white">{returnProduct.name}</div>
                <div className="text-xs text-slate-400">{fmt(returnProduct.price_cash)}</div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('qty')}</label>
                <input type="number" value={returnQty} onChange={e => setReturnQty(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" min={1} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('reason')}</label>
                <input type="text" value={returnReason} onChange={e => setReturnReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" placeholder={t('reason_placeholder')} />
              </div>
              <div className="flex items-center justify-between bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                <span className="text-xs font-bold text-red-300 uppercase">{t('total_refund')}</span>
                <span className="font-bold text-lg text-red-400">{fmt(returnProduct.price_cash * returnQty)}</span>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { setShowReturnDialog(false); setReturnProduct(null); setReturnQty(1); setReturnReason(''); }} className="flex-1 bg-slate-700 text-white rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button onClick={handleReturn} disabled={!returnReason.trim()} className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40">{t('confirm_return')}</button>
            </div>
          </div>
        </div>
      )}

      {/* CASH IN DIALOG */}
      {showCashIn && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4" onClick={() => setShowCashIn(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <h2 className="font-semibold text-sm text-white">{t('cash_in')}</h2>
              </div>
              <button onClick={() => { setShowCashIn(false); setCashInAmount(''); setCashInReason(''); }} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('amount')}</label>
                <input type="number" value={cashInAmount} onChange={e => setCashInAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" min={0} autoFocus />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('cash_in_reason')}</label>
                <input type="text" value={cashInReason} onChange={e => setCashInReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder={t('cash_in_reason_placeholder')} />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { setShowCashIn(false); setCashInAmount(''); setCashInReason(''); }} className="flex-1 bg-slate-700 text-white rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button
                onClick={async () => {
                  const amt = Number(cashInAmount);
                  if (!amt || amt <= 0) return;
                  await addDoc(collection(db, 'cash_movements'), {
                    type: 'in', amount: amt, reason: cashInReason || t('cash_in'),
                    recorded_by: user?.id || null, created_at: new Date().toISOString(),
                  });
                  setShowCashIn(false); setCashInAmount(''); setCashInReason('');
                }}
                disabled={!Number(cashInAmount) || Number(cashInAmount) <= 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-bold">{t('confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* EXPENSE DIALOG */}
      {showExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                <h2 className="font-semibold text-sm text-white">{t('cash_withdrawal')}</h2>
              </div>
              <button onClick={() => setShowExpense(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('amount')}</label>
                <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" min={0} autoFocus />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('reason')}</label>
                <textarea value={expenseReason} onChange={e => setExpenseReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white resize-none" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowExpense(false)} className="flex-1 bg-slate-700 text-white rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button onClick={handleExpense} disabled={!expenseAmount || Number(expenseAmount) <= 0 || !expenseReason.trim()} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40">{t('confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CartPanel({ cart, t, fmt, selectedCustomer, showCustomerList, customerSearch, filteredCustomers, setShowCustomerList, setCustomerSearch, setSelectedCustomer, setShowQuickCustomer, removeItem, updateQty, updatePrice, updateDiscount, cartSubtotal, orderDiscount, orderDiscountType, orderDiscountAmt, cartTotal, setOrderDiscount, setOrderDiscountType, setCart, setPaymentType, setShowCheckout }: any) {
  return (
    <>
      <div className="px-3 py-2.5 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-sm text-white">{t('cart')}</span>
          {cart.length > 0 && <span className="bg-indigo-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{cart.length}</span>}
        </div>
        {cart.length > 0 && <button onClick={() => setCart([])} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 className="w-3 h-3" />{t('clear_cart')}</button>}
      </div>

      <div className="px-3 py-2 border-b border-slate-700">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <div onClick={() => setShowCustomerList(!showCustomerList)}
              className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-indigo-500/30 text-sm">
              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-xs text-slate-400 flex-1 truncate">{selectedCustomer ? selectedCustomer.name : t('no_customer')}</span>
              {selectedCustomer && <button onClick={e => { e.stopPropagation(); setSelectedCustomer(null); }} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>}
            </div>
            {showCustomerList && (
              <div className="absolute top-full start-0 end-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
                <div className="p-1.5">
                  <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder={t('search')} className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                </div>
                <div className="max-h-32 overflow-y-auto">
                  <button onClick={() => { setSelectedCustomer(null); setShowCustomerList(false); setCustomerSearch(''); }} className="w-full text-start px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-700">{t('no_customer')}</button>
                  {filteredCustomers.map((c: any) => (
                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); setCustomerSearch(''); }} className="w-full text-start px-3 py-1.5 text-xs text-white hover:bg-slate-700 border-t border-slate-700/30">
                      {c.name} {c.phone && <span className="text-slate-500">({c.phone})</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => { setShowQuickCustomer(true); }}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-2 py-1.5 text-xs font-semibold shrink-0 active:scale-95 touch-manipulation">
            <PlusCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-700/50">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2 py-16">
            <ShoppingCart className="w-10 h-10" />
            <span className="text-xs">{t('empty_cart')}</span>
          </div>
        ) : cart.map((item: any) => (
          <div key={item.product_id} className="px-3 py-2 space-y-1.5 hover:bg-slate-800/30">
            <div className="flex items-start justify-between">
              <div className="text-xs font-medium text-white flex-1 pr-2 truncate">{item.name}</div>
              <button onClick={() => removeItem(item.product_id)} className="text-slate-500 hover:text-red-400 shrink-0 touch-manipulation"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden bg-slate-800">
                <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white touch-manipulation"><Minus className="w-3.5 h-3.5" /></button>
                <span className="px-2 text-white text-xs min-w-[1.5rem] text-center font-medium">{item.quantity}</span>
                <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white touch-manipulation"><Plus className="w-3.5 h-3.5" /></button>
              </div>
              <input type="number" value={item.unitPrice} onChange={e => updatePrice(item.product_id, Number(e.target.value))} className="w-20 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-1.5 py-1.5 text-center" min={0} />
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <Tag className="w-3 h-3 text-slate-500 ms-1.5" />
                <input type="number" value={item.discount} onChange={e => updateDiscount(item.product_id, Math.min(100, Number(e.target.value)))} className="w-9 bg-transparent text-white text-xs py-1.5 text-center" min={0} max={100} />
                <span className="text-slate-500 text-[9px] font-bold pr-1.5">%</span>
              </div>
              <span className="text-xs font-semibold text-indigo-400 ml-auto">{fmt(item.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="border-t border-slate-700 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-400"><Tag className="w-3 h-3" />{t('order_discount')}</div>
            <div className="flex items-center gap-1">
              <div className="flex border border-slate-700 rounded-lg overflow-hidden text-[9px] font-bold">
                <button onClick={() => setOrderDiscountType('percentage')} className={`px-1.5 py-1 ${orderDiscountType === 'percentage' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>%</button>
                <button onClick={() => setOrderDiscountType('fixed')} className={`px-1.5 py-1 ${orderDiscountType === 'fixed' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>$</button>
              </div>
              <input type="number" value={orderDiscount} onChange={e => setOrderDiscount(Math.max(0, orderDiscountType === 'percentage' ? Math.min(100, Number(e.target.value)) : Number(e.target.value)))} className="w-14 bg-slate-800 border border-slate-700 text-white rounded-lg px-1.5 py-1 text-center text-xs" min={0} />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400"><span>{t('subtotal')}</span><span>{fmt(cartSubtotal)}</span></div>
          {orderDiscountAmt > 0 && <div className="flex items-center justify-between text-xs text-red-400"><span>-{t('discount')}</span><span>-{fmt(orderDiscountAmt)}</span></div>}
          <div className="flex items-center justify-between font-bold text-base text-white border-t border-slate-700 pt-1.5">
            <span>{t('total')}</span><span className="text-indigo-400">{fmt(cartTotal)}</span>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-slate-700 space-y-1.5 bg-slate-900/50">
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => { setPaymentType('cash'); setShowCheckout(true); }} disabled={cart.length === 0}
            className="flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg py-3 font-semibold text-sm active:scale-95 touch-manipulation">
            <DollarSign className="w-4 h-4" />{t('cash')}
          </button>
          <button onClick={() => { setPaymentType('credit'); setShowCheckout(true); }} disabled={cart.length === 0}
            className="flex items-center justify-center gap-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg py-3 font-semibold text-sm active:scale-95 touch-manipulation">
            <CreditCard className="w-4 h-4" />{t('credit')}
          </button>
          <button onClick={() => { setPaymentType('debt'); setShowCheckout(true); }} disabled={cart.length === 0}
            className="flex items-center justify-center gap-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg py-3 font-semibold text-sm active:scale-95 touch-manipulation">
            <FileText className="w-4 h-4" />{t('debt')}
          </button>
        </div>
      </div>
    </>
  );
}
