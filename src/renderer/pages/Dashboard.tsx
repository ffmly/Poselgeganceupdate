import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Users, Package, HandCoins, CreditCard, AlertTriangle, DollarSign, Calendar, Wallet, X } from 'lucide-react';

interface Stats {
  totalSales: number;
  cashSales: number;
  creditSales: number;
  debtSales: number;
  totalCustomers: number;
  totalProducts: number;
  activeInstallments: number;
  lowStockCount: number;
  overdueCount: number;
  soonExpired: number;
  todayRevenue: number;
  todayExpenses: number;
  todayReturns: number;
  netCash: number;
  netProfit: number;
  recentSales: any[];
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({
    totalSales: 0, cashSales: 0, creditSales: 0, debtSales: 0,
    totalCustomers: 0, totalProducts: 0, activeInstallments: 0,
    lowStockCount: 0, overdueCount: 0, soonExpired: 0, todayRevenue: 0, todayExpenses: 0, todayReturns: 0, netCash: 0, netProfit: 0, recentSales: []
  });
  const [currency, setCurrency] = useState('DZD');
  const [alertDays, setAlertDays] = useState(4);
  const [showCashIn, setShowCashIn] = useState(false);
  const [cashInAmount, setCashInAmount] = useState('');
  const [cashInReason, setCashInReason] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [salesData, totalCash, totalCredit, customers, products, installments, lowStock, profitData, recent, settings] = await Promise.all([
      window.electronAPI.get("SELECT COUNT(*) as count, COALESCE(SUM(total - discount),0) as revenue FROM sales"),
      window.electronAPI.get("SELECT COALESCE(SUM(total - discount),0) as total FROM sales WHERE type='cash'"),
      window.electronAPI.get("SELECT COALESCE(SUM(total - discount),0) as total FROM sales WHERE type='credit'"),
      window.electronAPI.get("SELECT COUNT(*) as count FROM customers"),
      window.electronAPI.get("SELECT COUNT(*) as count FROM products"),
      window.electronAPI.get(`
        SELECT 
          COUNT(*) as active,
          SUM(CASE WHEN (
            SELECT COALESCE(MAX(payment_date), i.start_date) 
            FROM installment_payments 
            WHERE installment_id = i.id
          ) < date('now', '-30 days') AND i.remaining > 0 THEN 1 ELSE 0 END) as overdue
        FROM installments i 
        WHERE i.status != 'completed'
      `),
      window.electronAPI.get("SELECT COUNT(*) as count FROM products WHERE stock <= 3"),
      window.electronAPI.get("SELECT COALESCE(SUM(si.subtotal - (si.quantity * COALESCE(p.price_purchase, 0))), 0) as profit FROM sale_items si JOIN products p ON si.product_id = p.id"),
      window.electronAPI.query(`
        SELECT s.id, s.type, s.total, s.discount, s.created_at, c.name as customer_name
        FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
        ORDER BY s.created_at DESC LIMIT 8
      `),
      window.electronAPI.getSettings(),
    ]);
    const todayRev = await window.electronAPI.get("SELECT COALESCE(SUM(total - discount),0) as total FROM sales WHERE DATE(created_at) = DATE('now', 'localtime')");
    const todayExp = await window.electronAPI.get("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE DATE(created_at) = DATE('now', 'localtime')");
    const todayRet = await window.electronAPI.get("SELECT COALESCE(SUM(total),0) as total FROM product_returns WHERE DATE(created_at) = DATE('now', 'localtime')");
    const totalDebt = await window.electronAPI.get("SELECT COALESCE(SUM(total - discount),0) as total FROM sales WHERE type='debt'");

    const alertDays = Number(settings?.expiry_alert_days) || 4;
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + alertDays);
    const expDateStr = expDate.toISOString().split('T')[0];
    const soonExp = await window.electronAPI.get("SELECT COUNT(*) as count FROM products WHERE expiry_date IS NOT NULL AND expiry_date != '' AND DATE(expiry_date) BETWEEN DATE('now') AND ?", expDateStr);
    setAlertDays(alertDays);

    setCurrency(settings?.currency || 'DZD');
    const revenue = todayRev?.total || 0;
    const expenses = todayExp?.total || 0;
    const returns = todayRet?.total || 0;
    setStats({
      totalSales: salesData?.count || 0,
      cashSales: totalCash?.total || 0,
      creditSales: totalCredit?.total || 0,
      debtSales: totalDebt?.total || 0,
      totalCustomers: customers?.count || 0,
      totalProducts: products?.count || 0,
      activeInstallments: installments?.active || 0,
      lowStockCount: lowStock?.count || 0,
      overdueCount: installments?.overdue || 0,
      soonExpired: soonExp?.count || 0,
      todayRevenue: revenue,
      todayExpenses: expenses,
      todayReturns: returns,
      netCash: revenue - returns - expenses,
      netProfit: profitData?.profit || 0,
      recentSales: recent || [],
    });
  };

  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;

  const cards = [
    { label: t('total_sales'), value: fmt(stats.cashSales + stats.creditSales + stats.debtSales), icon: TrendingUp, color: 'indigo', sub: `${stats.totalSales} orders` },
    { label: t('net_cash'), value: fmt(stats.netCash), icon: Calendar, color: 'emerald', sub: `${t('today')} — ${fmt(stats.todayRevenue)} ${t('sales')}` },
    { label: t('net_profit'), value: fmt(stats.netProfit), icon: TrendingUp, color: 'green', sub: '', profit: true },
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
      {/* Cash In Button */}
      <div className="flex justify-end">
        <button onClick={() => setShowCashIn(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5 py-2.5 font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-sm">
          <Wallet className="w-4 h-4" />{t('cash_in')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 hover:border-indigo-500/30 transition-all shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl border ${colorMap[card.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)] mb-1 truncate">{card.value}</div>
              <div className="text-sm text-[var(--text-secondary)]">{card.label}</div>
              {card.sub && <div className="text-xs text-[var(--text-muted)] mt-0.5">{card.sub}</div>}
            </div>
          );
        })}
      </div>

      {/* Recent Sales */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="font-semibold text-[var(--text-primary)]">{t('recent_sales')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-secondary)]/50">
                <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">#{t('invoice_number')}</th>
                <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('customer_name')}</th>
                <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('payment_method')}</th>
                <th className="text-end px-6 py-3 text-[var(--text-secondary)] font-medium">{t('total')}</th>
                <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {stats.recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                  <td className="px-6 py-3 text-[var(--text-muted)]">#{sale.id}</td>
                  <td className="px-6 py-3 text-[var(--text-primary)]">{sale.customer_name || '-'}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sale.type === 'cash' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : sale.type === 'debt' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'}`}>
                      {t(sale.type)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-end text-[var(--text-primary)] font-medium">
                    {fmt(sale.total - (sale.discount || 0))}
                  </td>
                  <td className="px-6 py-3 text-[var(--text-muted)] text-xs">{new Date(sale.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {stats.recentSales.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">{t('no_data')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('reason')}</label>
                <input type="text" value={cashInReason} onChange={e => setCashInReason(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                  placeholder={t('reason_placeholder')} />
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
                    loadStats();
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
    </div>
  );
}
