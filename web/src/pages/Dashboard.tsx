import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TrendingUp, Users, Package, HandCoins, CreditCard, AlertTriangle, DollarSign, Calendar, Wallet, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Stats {
  totalSales: number; cashSales: number; creditSales: number; debtSales: number;
  totalCustomers: number; totalProducts: number; activeInstallments: number;
  lowStockCount: number; overdueCount: number; soonExpired: number;
  todayRevenue: number; todayExpenses: number; todayReturns: number;
  netCash: number; netProfit: number; recentSales: any[];
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [showCashIn, setShowCashIn] = useState(false);
  const [cashInAmount, setCashInAmount] = useState('');
  const [cashInReason, setCashInReason] = useState('');
  const [stats, setStats] = useState<Stats>({
    totalSales: 0, cashSales: 0, creditSales: 0, debtSales: 0,
    totalCustomers: 0, totalProducts: 0, activeInstallments: 0,
    lowStockCount: 0, overdueCount: 0, soonExpired: 0,
    todayRevenue: 0, todayExpenses: 0, todayReturns: 0, netCash: 0, netProfit: 0, recentSales: [],
  });
  const [currency, setCurrency] = useState('DZD');
  const [alertDays, setAlertDays] = useState(4);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [sSnap, pSnap, cSnap, iSnap, setSnap] = await Promise.all([
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'customers')),
        getDocs(query(collection(db, 'installments'), orderBy('created_at', 'desc'))),
        getDocs(collection(db, 'settings')),
      ]);

      const settings: Record<string, string> = {};
      setSnap.forEach(d => settings[d.id] = d.data().value);
      setCurrency(settings.currency || 'DZD');
      const ad = Number(settings.expiry_alert_days) || 4;
      setAlertDays(ad);

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      let totalSales = 0, cashSales = 0, creditSales = 0, debtSales = 0;
      let todayRevenue = 0, allSales: any[] = [];

      sSnap.forEach(d => {
        const s = d.data();
        const amt = s.total - (s.discount || 0);
        totalSales++;
        if (s.type === 'cash') cashSales += amt;
        else if (s.type === 'credit') creditSales += amt;
        else if (s.type === 'debt') debtSales += amt;
        if (s.created_at?.startsWith(today)) todayRevenue += amt;
        allSales.push({ id: d.id, ...s });
      });

      const cMap: any = {};
      cSnap.forEach(d => cMap[d.id] = d.data().name);

      allSales.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const recentSales = allSales.slice(0, 8).map(s => ({
        ...s, customer_name: cMap[s.customer_id] || '-'
      }));

      const totalProducts = pSnap.size;
      const totalCustomers = cSnap.size;
      let lowStockCount = 0, soonExpired = 0;
      pSnap.forEach(d => {
        const p = d.data();
        if (p.stock <= 3) lowStockCount++;
        if (p.expiry_date) {
          const exp = new Date(p.expiry_date);
          const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
          if (days >= 0 && days <= ad) soonExpired++;
        }
      });

      let activeInstallments = 0, overdueCount = 0;
      iSnap.forEach(d => {
        const inst = d.data();
        if (inst.status !== 'completed' && inst.remaining > 0) {
          activeInstallments++;
          const lastPay = inst.updated_at || inst.start_date;
          if (lastPay) {
            const daysSince = Math.floor((now.getTime() - new Date(lastPay).getTime()) / 86400000);
            if (daysSince > 30) overdueCount++;
          }
        }
      });

      // Profit calculation
      const siSnap = await getDocs(collection(db, 'sale_items'));
      let netProfit = 0;
      const pMap: any = {};
      pSnap.forEach(d => pMap[d.id] = d.data());
      siSnap.forEach(d => {
        const si = d.data();
        const prod = pMap[si.product_id];
        if (prod) netProfit += (si.subtotal - (si.quantity * (prod.price_purchase || 0)));
      });

      // Today's expenses
      const expSnap = await getDocs(collection(db, 'expenses'));
      let todayExpenses = 0;
      expSnap.forEach(d => {
        if (d.data().created_at?.startsWith(today)) todayExpenses += (d.data().amount || 0);
      });

      // Today's returns
      const retSnap = await getDocs(collection(db, 'product_returns'));
      let todayReturns = 0;
      retSnap.forEach(d => {
        if (d.data().created_at?.startsWith(today)) todayReturns += (d.data().total || 0);
      });

      setStats({
        totalSales, cashSales, creditSales, debtSales,
        totalCustomers, totalProducts, activeInstallments,
        lowStockCount, overdueCount, soonExpired,
        todayRevenue, todayExpenses, todayReturns,
        netCash: todayRevenue - todayReturns - todayExpenses,
        netProfit, recentSales,
      });
    } catch (e) { console.error('Dashboard load error:', e); }
  };

  const fmt = (n: number) => (n || 0).toLocaleString() + ' ' + currency;

  const cards = [
    { label: t('total_sales'), value: fmt(stats.cashSales + stats.creditSales + stats.debtSales), icon: TrendingUp, color: 'indigo', sub: `${stats.totalSales} orders` },
    { label: t('net_cash'), value: fmt(stats.netCash), icon: Calendar, color: 'emerald', sub: `${t('today')} — ${fmt(stats.todayRevenue)} ${t('sales')}` },
    { label: t('net_profit'), value: fmt(stats.netProfit), icon: TrendingUp, color: 'green', sub: '' },
    { label: t('cash_sales'), value: fmt(stats.cashSales), icon: DollarSign, color: 'blue', sub: '' },
    { label: t('credit_sales'), value: fmt(stats.creditSales), icon: CreditCard, color: 'violet', sub: '' },
    { label: t('debt_sales'), value: fmt(stats.debtSales), icon: CreditCard, color: 'amber', sub: '' },
    { label: t('total_expenses'), value: fmt(stats.todayExpenses), icon: AlertTriangle, color: 'red', sub: t('today') },
    { label: t('total_customers'), value: stats.totalCustomers.toString(), icon: Users, color: 'orange', sub: '' },
    { label: t('total_products'), value: stats.totalProducts.toString(), icon: Package, color: 'teal', sub: '' },
    { label: t('active_installments'), value: stats.activeInstallments.toString(), icon: HandCoins, color: 'amber', sub: '' },
    { label: t('low_stock'), value: stats.lowStockCount.toString(), icon: AlertTriangle, color: 'red', sub: '' },
    { label: t('soon_expired'), value: stats.soonExpired.toString(), icon: AlertTriangle, color: 'red', sub: `${t('within_n_days', { n: alertDays })}` },
  ];

  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => setShowCashIn(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 py-2 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
          <Wallet className="w-4 h-4" />{t('cash_in')}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:border-indigo-500/30 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl border ${colorMap[card.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-1 truncate">{card.value}</div>
              <div className="text-sm text-slate-400">{card.label}</div>
              {card.sub && <div className="text-xs text-slate-500 mt-0.5">{card.sub}</div>}
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">{t('recent_sales')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/80">
                <th className="text-start px-6 py-3 text-slate-400 font-medium">#{t('invoice_number')}</th>
                <th className="text-start px-6 py-3 text-slate-400 font-medium">{t('customer_name')}</th>
                <th className="text-start px-6 py-3 text-slate-400 font-medium">{t('payment_method')}</th>
                <th className="text-end px-6 py-3 text-slate-400 font-medium">{t('total')}</th>
                <th className="text-start px-6 py-3 text-slate-400 font-medium">{t('date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {stats.recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-3 text-slate-500">#{sale.id?.slice(0, 6)}</td>
                  <td className="px-6 py-3 text-white">{sale.customer_name || '-'}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      sale.type === 'cash' ? 'bg-emerald-500/10 text-emerald-400' :
                      sale.type === 'debt' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-violet-500/10 text-violet-400'
                    }`}>{t(sale.type)}</span>
                  </td>
                  <td className="px-6 py-3 text-end text-white font-medium">
                    {fmt(sale.total - (sale.discount || 0))}
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs">
                    {sale.created_at ? new Date(sale.created_at).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
              {stats.recentSales.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">{t('no_data')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showCashIn && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4" onClick={() => setShowCashIn(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
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
                  loadStats();
                }}
                disabled={!Number(cashInAmount) || Number(cashInAmount) <= 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-bold">{t('confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
