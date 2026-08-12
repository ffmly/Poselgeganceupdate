import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BarChart3, TrendingUp, AlertTriangle, Printer, 
  FileText, Download, Search, Calculator, Package
} from 'lucide-react';

type ReportType = 'sales' | 'overdue' | 'inventory' | 'top_products' | 'expenses' | 'expiring' | 'cash_in' | 'annual_inventory';
type DateFilter = 'today' | 'this_week' | 'this_month' | 'this_year' | 'all_time' | 'custom';

export default function Reports() {
  const { t } = useTranslation();
  const [type, setType] = useState<ReportType>('sales');
  const [dateFilter, setDateFilter] = useState<DateFilter>('this_month');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [data, setData] = useState<any>({
    summary: { total: 0, count: 0, discount: 0 },
    items: [],
    overdue: [],
    lowStock: []
  });
  const [currency, setCurrency] = useState('DZD');
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [type, dateFilter, dateRange]);

  const load = async () => {
    setLoading(true);
    const s = await window.electronAPI.getSettings();
    setCurrency(s?.currency || 'DZD');
    setStoreName(s?.store_name || 'My Store');

    const buildDateCond = (alias = '') => {
      const col = alias ? `${alias}.created_at` : 'created_at';
      if (dateFilter === 'today') return `DATE(${col}) = DATE('now', 'localtime')`;
      if (dateFilter === 'this_week') {
        return `${col} >= datetime('now', 'localtime', 'weekday 0', '-6 days', 'start of day')`;
      }
      if (dateFilter === 'this_month') return `strftime('%m-%Y', ${col}) = strftime('%m-%Y', 'now')`;
      if (dateFilter === 'this_year') return `strftime('%Y', ${col}) = strftime('%Y', 'now')`;
      if (dateFilter === 'all_time') return "1=1";
      if (dateFilter === 'custom' && dateRange.start && dateRange.end) {
        return `DATE(${col}) BETWEEN '${dateRange.start}' AND '${dateRange.end}'`;
      }
      return "1=1";
    };

    if (type === 'sales') {
      const summary = await window.electronAPI.get(`
        SELECT COUNT(*) as count, 
               COALESCE(SUM(total), 0) as total, 
               COALESCE(SUM(discount), 0) as discount 
        FROM sales WHERE ${buildDateCond()}
      `);
      const profitTotal = await window.electronAPI.get(`
        SELECT COALESCE(SUM(si.subtotal - (si.quantity * COALESCE(p.price_purchase, 0))), 0) as profit
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE ${buildDateCond('s')}
      `);
      const items = await window.electronAPI.query(`
        SELECT s.*, c.name as customer_name,
          (SELECT COALESCE(SUM(si2.subtotal - (si2.quantity * COALESCE(p2.price_purchase, 0))), 0)
           FROM sale_items si2 JOIN products p2 ON si2.product_id = p2.id
           WHERE si2.sale_id = s.id) as profit
        FROM sales s LEFT JOIN customers c ON s.customer_id = c.id 
        WHERE ${buildDateCond('s')} ORDER BY s.created_at DESC
      `);
      const profit = profitTotal?.profit || 0;
      setData({ 
        summary: summary ? { ...summary, profit } : { count: 0, total: 0, discount: 0, profit: 0 }, 
        items: items || [], 
        overdue: [], 
        lowStock: [] 
      });
    } else if (type === 'overdue') {
      const overdue = await window.electronAPI.query(`
        SELECT i.*, c.name as customer_name, c.phone as customer_phone
        FROM installments i LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.remaining > 0 AND (
          SELECT COALESCE(MAX(payment_date), i.start_date) 
          FROM installment_payments WHERE installment_id = i.id
        ) < date('now', '-30 days')
      `);
      setData({ 
        summary: { count: overdue?.length || 0 }, 
        items: [], 
        overdue: overdue || [], 
        lowStock: [] 
      });
    } else if (type === 'inventory') {
      const lowStock = await window.electronAPI.query("SELECT * FROM products WHERE stock <= 5 ORDER BY stock ASC");
      setData({ 
        summary: { count: lowStock?.length || 0 }, 
        items: [], 
        overdue: [], 
        lowStock: lowStock || [] 
      });
    } else if (type === 'expenses') {
      const summary = await window.electronAPI.get(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
        FROM expenses WHERE ${buildDateCond()}
      `);
      const items = await window.electronAPI.query(`
        SELECT e.*, u.username as recorded_by_name
        FROM expenses e
        LEFT JOIN users u ON e.recorded_by = u.id
        WHERE ${buildDateCond('e')} ORDER BY e.created_at DESC
      `);
      setData({
        summary: summary || { count: 0, total: 0 },
        items: items || [],
        overdue: [],
        lowStock: [],
      });
    } else if (type === 'top_products') {
      const dateCond = buildDateCond('s');
      const topProducts = await window.electronAPI.query(`
        SELECT p.id, p.name, p.price_cash, p.price_purchase,
               SUM(si.quantity) as total_qty,
               SUM(si.subtotal) as total_revenue,
               SUM(si.subtotal - (si.quantity * COALESCE(p.price_purchase, 0))) as total_profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE ${dateCond}
        GROUP BY si.product_id
        ORDER BY total_qty DESC
        LIMIT 50
      `);
      setData({
        summary: { count: topProducts?.length || 0 },
        items: topProducts || [],
        overdue: [],
        lowStock: [],
      });
    } else if (type === 'expiring') {
      const alertDays = Number(s?.expiry_alert_days) || 4;
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + alertDays);
      const expDateStr = expDate.toISOString().split('T')[0];
      const expiring = await window.electronAPI.query(`
        SELECT *, 
          CAST(julianday(expiry_date) - julianday('now') AS INTEGER) as days_left
        FROM products 
        WHERE expiry_date IS NOT NULL AND expiry_date != ''
          AND DATE(expiry_date) BETWEEN DATE('now') AND ?
        ORDER BY expiry_date ASC
      `, [expDateStr]);
      setData({
        summary: { count: expiring?.length || 0 },
        items: expiring || [],
        overdue: [],
        lowStock: [],
      });
    } else if (type === 'cash_in') {
      const all = await window.electronAPI.getAllCashMovements();
      const filterDate = (d: string) => {
        const dateStr = new Date(d).toISOString().split('T')[0];
        const now = new Date();
        if (dateFilter === 'today') return dateStr === now.toISOString().split('T')[0];
        if (dateFilter === 'this_week') {
          const day = now.getDay();
          const monday = new Date(now);
          monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
          monday.setHours(0, 0, 0, 0);
          return new Date(dateStr) >= monday;
        }
        if (dateFilter === 'this_month') return dateStr.substring(0, 7) === now.toISOString().substring(0, 7);
        if (dateFilter === 'this_year') return dateStr.substring(0, 4) === now.toISOString().substring(0, 4);
        if (dateFilter === 'all_time') return true;
        if (dateFilter === 'custom' && dateRange.start && dateRange.end) return dateStr >= dateRange.start && dateStr <= dateRange.end;
        return true;
      };
      const cashInItems = (all || []).filter(m => m.type === 'in' && filterDate(m.created_at));
      const total = cashInItems.reduce((s: number, m: any) => s + (m.amount || 0), 0);
      setData({
        summary: { count: cashInItems.length, total },
        items: cashInItems,
        overdue: [],
        lowStock: [],
      });
    } else if (type === 'annual_inventory') {
      // Closing Stock
      const allProducts = await window.electronAPI.query(`
        SELECT *, (stock * COALESCE(price_purchase, 0)) as stock_value
        FROM products ORDER BY stock_value DESC
      `);
      const totalInventoryValue = (allProducts || []).reduce((s: number, p: any) => s + (p.stock_value || 0), 0);

      // Profit & Loss
      const dateCond = buildDateCond('s');
      const pnl = await window.electronAPI.get(`
        SELECT 
          COALESCE(SUM(s.total - s.discount), 0) as totalRevenue,
          COUNT(*) as salesCount
        FROM sales s WHERE ${dateCond}
      `);
      const cogsData = await window.electronAPI.get(`
        SELECT COALESCE(SUM(si.quantity * COALESCE(p.price_purchase, 0)), 0) as cogs
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE ${dateCond}
      `);
      const expData = await window.electronAPI.get(`
        SELECT COALESCE(SUM(amount), 0) as totalExpenses
        FROM expenses WHERE ${buildDateCond('e')}
      `);
      const netRevenue = (pnl?.totalRevenue || 0);
      const cogs = (cogsData?.cogs || 0);
      const totalExpenses = (expData?.totalExpenses || 0);
      const netProfitLoss = netRevenue - cogs - totalExpenses;

      setData({
        summary: {
          count: allProducts?.length || 0,
          totalInventoryValue,
          totalRevenue: netRevenue,
          cogs,
          totalExpenses,
          netProfitLoss,
          salesCount: pnl?.salesCount || 0,
        },
        items: allProducts || [],
        overdue: [],
        lowStock: [],
      });
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const fmt = (n: number) => (n || 0).toLocaleString('fr-DZ') + ' ' + currency;

  if (loading) return <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div>
      {/* 1. APP UI SECTION (HIDDEN ON PRINT) */}
      <div className="space-y-6 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--test-primary)] flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-indigo-600" />
              {t('reports')}
            </h1>
            <p className="text-[var(--text-muted)] text-sm">{t('detailed_business_analytics')}</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)} className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm font-bold focus:outline-none shadow-sm cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors">
              <option value="today">{t('today')}</option>
              <option value="this_week">{t('this_week')}</option>
              <option value="this_month">{t('this_month')}</option>
              <option value="this_year">{t('this_year')}</option>
              <option value="all_time">{t('all_time')}</option>
              <option value="custom">{t('custom_range')}</option>
            </select>
            <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-5 py-2 font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
              <Printer className="w-4 h-4" /> {t('print_report')}
            </button>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl flex items-center gap-6 animate-in fade-in slide-in-from-top-2 border-s-4 border-s-indigo-600">
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{t('from')}</label>
              <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{t('to')}</label>
              <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>
        )}

        {/* Report Type Tabs */}
        <div className="flex items-center gap-2 bg-[var(--bg-secondary)]/50 p-1.5 rounded-2xl">
          {(['sales', 'overdue', 'inventory', 'top_products', 'expenses', 'expiring', 'cash_in', 'annual_inventory'] as ReportType[]).map(t_ => (
            <button 
              key={t_} 
              onClick={() => setType(t_)} 
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-black transition-all rounded-xl ${type === t_ ? 'bg-[var(--bg-surface)] text-indigo-600 shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              {t_ === 'sales' && <TrendingUp className="w-4 h-4" />}
              {t_ === 'overdue' && <AlertTriangle className="w-4 h-4" />}
                  {t_ === 'inventory' && <FileText className="w-4 h-4" />}
                  {t_ === 'top_products' && <TrendingUp className="w-4 h-4" />}
              {t_ === 'expenses' && <AlertTriangle className="w-4 h-4" />}
              {t_ === 'expiring' && <AlertTriangle className="w-4 h-4" />}
              {t_ === 'cash_in' && <TrendingUp className="w-4 h-4" />}
              {t_ === 'annual_inventory' && <Calculator className="w-4 h-4" />}
              {t(t_ + '_report')}
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {type === 'expenses' ? (
            <>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('total_expenses')}</div>
                <div className="text-3xl font-black text-red-500">{fmt(data.summary.total)}</div>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><FileText className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('total_transactions')}</div>
                <div className="text-3xl font-black text-[var(--text-primary)]">{data.summary.count}</div>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('average_expense')}</div>
                <div className="text-3xl font-black text-orange-500">{fmt(data.summary.count > 0 ? data.summary.total / data.summary.count : 0)}</div>
              </div>
            </>
          ) : type === 'sales' ? (
            <>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('total_revenue')}</div>
                <div className="text-3xl font-black text-[var(--text-primary)]">{fmt(data.summary.total)}</div>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('net_profit')}</div>
                <div className="text-3xl font-black text-green-500">{fmt(data.summary.profit || 0)}</div>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Download className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('total_discount')}</div>
                <div className="text-3xl font-black text-red-500">-{fmt(data.summary.discount)}</div>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><FileText className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('order_count')}</div>
                <div className="text-3xl font-black text-[var(--text-primary)]">{data.summary.count}</div>
              </div>
            </>
          ) : type === 'cash_in' ? (
            <>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('total_cash_in')}</div>
                <div className="text-3xl font-black text-emerald-500">{fmt(data.summary.total)}</div>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><FileText className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('total_transactions')}</div>
                <div className="text-3xl font-black text-[var(--text-primary)]">{data.summary.count}</div>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><BarChart3 className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('average_cash_in')}</div>
                <div className="text-3xl font-black text-indigo-500">{fmt(data.summary.count > 0 ? data.summary.total / data.summary.count : 0)}</div>
              </div>
            </>
          ) : type === 'annual_inventory' ? (
            <>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Package className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('total_inventory_value')}</div>
                <div className="text-3xl font-black text-amber-500">{fmt(data.summary.totalInventoryValue)}</div>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><FileText className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('total_products')}</div>
                <div className="text-3xl font-black text-[var(--text-primary)]">{data.summary.count}</div>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Calculator className="w-16 h-16" /></div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('net_profit_loss')}</div>
                <div className={`text-3xl font-black ${(data.summary.netProfitLoss || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{fmt(data.summary.netProfitLoss)}</div>
              </div>
            </>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-8 rounded-3xl shadow-sm col-span-full flex items-center justify-between">
              <div>
                <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('item_count')}</div>
                <div className="text-4xl font-black text-indigo-600">{data.summary.count}</div>
              </div>
              <BarChart3 className="w-16 h-16 text-indigo-600/10" />
            </div>
          )}
        </div>

        {/* Detailed Table */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
          <div className="px-8 py-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]/30">
            <div>
              <h2 className="font-black text-[var(--text-primary)] text-xl uppercase tracking-tight">
                {t(type + '_detailed_report')}
              </h2>
              <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mt-1">
                {dateFilter === 'custom' ? `${dateRange.start} — ${dateRange.end}` : dateFilter === 'all_time' ? t('all_time') : t(dateFilter)}
              </p>
            </div>
            <div className="text-end">
              <div className="text-xs font-black text-[var(--text-primary)]">{new Date().toLocaleDateString()}</div>
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{new Date().toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
          {type === 'expenses' ? (
                <>
                  <thead>
                    <tr className="bg-[var(--bg-secondary)]/50">
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">#</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('reason')}</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('recorded_by')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('amount')}</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('date')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {data.items.map((e: any) => (
                      <tr key={e.id} className="hover:bg-red-500/[0.02] transition-colors group">
                        <td className="px-8 py-4 font-mono text-xs text-red-500 font-bold">#{e.id}</td>
                        <td className="px-8 py-4 font-black text-[var(--text-primary)]">{e.reason}</td>
                        <td className="px-8 py-4 text-[var(--text-muted)]">{e.recorded_by_name || '-'}</td>
                        <td className="px-8 py-4 text-end font-black text-red-500 text-base">{fmt(e.amount)}</td>
                        <td className="px-8 py-4 text-[var(--text-muted)] text-xs">{new Date(e.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : type === 'sales' ? (
                <>
                  <thead>
                    <tr className="bg-[var(--bg-secondary)]/50">
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('invoice')}</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('customer')}</th>
                      <th className="text-center px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('type')}</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('date')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('total')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('discount')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('net_total')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('profit')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {data.items.map((s: any) => (
                      <tr key={s.id} className="hover:bg-indigo-500/[0.02] transition-colors group">
                        <td className="px-8 py-4 font-mono text-xs text-indigo-500 font-bold">#{s.id}</td>
                        <td className="px-8 py-4 font-black text-[var(--text-primary)]">{s.customer_name || t('walk_in_customer')}</td>
                        <td className="px-8 py-4 text-center"><span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase ring-1 ${s.type === 'cash' ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' : s.type === 'debt' ? 'bg-amber-500/10 text-amber-500 ring-amber-500/20' : 'bg-violet-500/10 text-violet-500 ring-violet-500/20'}`}>{t(s.type)}</span></td>
                        <td className="px-8 py-4 text-[var(--text-muted)] text-xs">{new Date(s.created_at).toLocaleString()}</td>
                        <td className="px-8 py-4 text-end text-[var(--text-secondary)] font-medium">{fmt(s.total + s.discount)}</td>
                        <td className="px-8 py-4 text-end text-red-500 font-bold">-{fmt(s.discount)}</td>
                        <td className="px-8 py-4 text-end font-black text-[var(--text-primary)] text-base">{fmt(s.total)}</td>
                        <td className="px-8 py-4 text-end font-black text-green-600">{fmt(s.profit || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : type === 'overdue' ? (
                <>
                  <thead>
                    <tr className="bg-[var(--bg-secondary)]/50">
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('customer')}</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('phone')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('remaining')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('monthly_payment')}</th>
                      <th className="text-center px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('status')}</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('date')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {data.overdue.map((i: any) => (
                      <tr key={i.id} className="hover:bg-red-500/[0.02] transition-colors">
                        <td className="px-8 py-5 font-black text-[var(--text-primary)]">{i.customer_name}</td>
                        <td className="px-8 py-5 text-[var(--text-muted)] font-medium">{i.customer_phone || '-'}</td>
                        <td className="px-8 py-5 text-end text-red-600 font-black text-base">{fmt(i.remaining)}</td>
                        <td className="px-8 py-5 text-end text-indigo-600 font-black">{fmt(i.monthly_payment)}</td>
                        <td className="px-8 py-5 text-center">
                          <span className="bg-red-500/10 text-red-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ring-1 ring-red-500/20">
                            {t('overdue')}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-[var(--text-muted)] text-xs">{new Date(i.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : type === 'inventory' ? (
                <>
                  <thead>
                    <tr className="bg-[var(--bg-secondary)]/50">
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('product_name')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('price')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('stock')}</th>
                      <th className="text-center px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {data.lowStock.map((p: any) => (
                      <tr key={p.id} className="hover:bg-amber-500/[0.02] transition-colors">
                        <td className="px-8 py-5 font-black text-[var(--text-primary)]">{p.name}</td>
                        <td className="px-8 py-5 text-end text-indigo-600 font-black">{fmt(p.price_cash)}</td>
                        <td className="px-8 py-5 text-end font-black text-red-600 text-base">{p.stock}</td>
                        <td className="px-8 py-5 text-center">
                          <span className="bg-amber-500/10 text-amber-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ring-1 ring-amber-500/20">
                            {t('low_stock')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : type === 'cash_in' ? (
                <>
                  <thead>
                    <tr className="bg-[var(--bg-secondary)]/50">
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">#</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('reason')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('amount')}</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('recorded_by')}</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('date')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {data.items.map((e: any) => (
                      <tr key={e.id} className="hover:bg-emerald-500/[0.02] transition-colors group">
                        <td className="px-8 py-4 font-mono text-xs text-emerald-500 font-bold">#{e.id}</td>
                        <td className="px-8 py-4 font-black text-[var(--text-primary)]">{e.reason}</td>
                        <td className="px-8 py-4 text-end font-black text-emerald-500 text-base">{fmt(e.amount)}</td>
                        <td className="px-8 py-4 text-[var(--text-muted)]">{e.recorded_by_name || '-'}</td>
                        <td className="px-8 py-4 text-[var(--text-muted)] text-xs">{new Date(e.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : type === 'expiring' ? (
                <>
                  <thead>
                    <tr className="bg-[var(--bg-secondary)]/50">
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('product_name')}</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('barcode')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('stock')}</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('expiry_date')}</th>
                      <th className="text-center px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('days_to_expiry')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {data.items.map((p: any) => {
                      const days = p.days_left !== undefined ? Number(p.days_left) : Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000);
                      return (
                        <tr key={p.id} className="hover:bg-red-500/[0.02] transition-colors">
                          <td className="px-8 py-5 font-black text-[var(--text-primary)]">{p.name}</td>
                          <td className="px-8 py-5 font-mono text-sm text-[var(--text-muted)]">{p.barcode || '-'}</td>
                          <td className="px-8 py-5 text-end font-black text-[var(--text-primary)]">{p.stock}</td>
                          <td className="px-8 py-5 font-black text-red-500">{p.expiry_date}</td>
                          <td className="px-8 py-5 text-center">
                            <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase ring-1 ${
                              days <= 0 ? 'bg-red-500/10 text-red-600 ring-red-500/20' :
                              days <= 2 ? 'bg-orange-500/10 text-orange-600 ring-orange-500/20' :
                              'bg-amber-500/10 text-amber-600 ring-amber-500/20'
                            }`}>
                              {days <= 0 ? t('expired') : `${days} ${t('days')}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr className="bg-[var(--bg-secondary)]/50">
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">#</th>
                      <th className="text-start px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('product_name')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('quantity_sold')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('total_revenue')}</th>
                      <th className="text-end px-8 py-5 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('profit')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {data.items.map((p: any, idx: number) => (
                      <tr key={p.id} className="hover:bg-indigo-500/[0.02] transition-colors">
                        <td className="px-8 py-5 text-[var(--text-muted)] font-black text-lg">{idx + 1}</td>
                        <td className="px-8 py-5 font-black text-[var(--text-primary)]">{p.name}</td>
                        <td className="px-8 py-5 text-end font-black text-indigo-600 text-base">{p.total_qty}</td>
                        <td className="px-8 py-5 text-end font-black text-[var(--text-primary)]">{fmt(p.total_revenue)}</td>
                        <td className="px-8 py-5 text-end font-black text-green-600">{fmt(p.total_profit || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
            {((type === 'sales' && data.items.length === 0) || 
              (type === 'overdue' && data.overdue.length === 0) || 
              (type === 'inventory' && data.lowStock.length === 0) ||
              (type === 'top_products' && data.items.length === 0) ||
              (type === 'expenses' && data.items.length === 0) ||
              (type === 'expiring' && data.items.length === 0) ||
              (type === 'cash_in' && data.items.length === 0)) && (
              <div className="px-8 py-24 text-center text-[var(--text-muted)] flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center">
                  <Search className="w-10 h-10 opacity-20" />
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-sm">{t('no_records_found')}</p>
                  <p className="text-xs mt-1">{t('try_adjusting_filters')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Annual Inventory - Closing Stock + P&L */}
      {type === 'annual_inventory' && (
        <div className="space-y-6">
          {/* Closing Stock */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
              <h3 className="font-black text-[var(--text-primary)] text-lg flex items-center gap-3">
                <Package className="w-6 h-6 text-amber-500" />{t('closing_stock')}
              </h3>
              <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mt-1">{t('closing_stock_desc')}</p>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-secondary)]/50">
                  <th className="text-start px-6 py-4 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('product')}</th>
                  <th className="text-start px-6 py-4 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('barcode')}</th>
                  <th className="text-end px-6 py-4 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('purchase_price')}</th>
                  <th className="text-end px-6 py-4 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('stock')}</th>
                  <th className="text-end px-6 py-4 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {data.items.filter((p: any) => (p.stock || 0) > 0).map((p: any) => (
                  <tr key={p.id} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                    <td className="px-6 py-3 text-[var(--text-primary)] font-medium">{p.name}</td>
                    <td className="px-6 py-3 text-[var(--text-muted)] text-xs font-mono">{p.barcode || '-'}</td>
                    <td className="px-6 py-3 text-end text-amber-600 dark:text-amber-400">{fmt(p.price_purchase)}</td>
                    <td className={`px-6 py-3 text-end font-bold ${p.stock <= 0 ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{p.stock}</td>
                    <td className="px-6 py-3 text-end text-amber-600 dark:text-amber-400 font-bold">{fmt(p.stock_value)}</td>
                  </tr>
                ))}
                {data.items.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">{t('no_data')}</td></tr>}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--bg-secondary)]/50 font-black border-t-2 border-[var(--border-color)]">
                  <td colSpan={4} className="px-6 py-4 text-end text-[var(--text-secondary)] text-sm uppercase tracking-widest">{t('total_inventory_value')}</td>
                  <td className="px-6 py-4 text-end text-amber-500 text-xl">{fmt(data.summary.totalInventoryValue)}</td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>

          {/* Profit & Loss */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
              <h3 className="font-black text-[var(--text-primary)] text-lg flex items-center gap-3">
                <Calculator className="w-6 h-6 text-indigo-500" />{t('profit_and_loss')}
              </h3>
              <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mt-1">{t('profit_and_loss_desc')}</p>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border-color)]">
                <tr className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                  <td className="px-6 py-4 text-[var(--text-secondary)] font-medium">{t('total_sales_revenue')}</td>
                  <td className="px-6 py-4 text-end text-[var(--text-primary)] font-bold text-lg">{fmt(data.summary.totalRevenue)}</td>
                </tr>
                <tr className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                  <td className="px-6 py-4 text-[var(--text-secondary)] font-medium">{t('cost_of_goods_sold')}</td>
                  <td className="px-6 py-4 text-end text-red-500 font-bold text-lg">-{fmt(data.summary.cogs)}</td>
                </tr>
                <tr className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                  <td className="px-6 py-4 text-[var(--text-secondary)] font-medium">{t('other_expenses')}</td>
                  <td className="px-6 py-4 text-end text-red-500 font-bold text-lg">-{fmt(data.summary.totalExpenses)}</td>
                </tr>
                <tr className="bg-[var(--bg-secondary)]/30 font-black border-t-2 border-[var(--border-color)]">
                  <td className="px-6 py-4 text-[var(--text-primary)] text-sm uppercase tracking-widest">{t('net_profit_loss')}</td>
                  <td className={`px-6 py-4 text-end text-2xl ${(data.summary.netProfitLoss || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {fmt(data.summary.netProfitLoss)}
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. MINIMALIST PRINT-ONLY REPORT */}
      <div className="hidden print:block font-serif text-black p-0 m-0">
        <div className="text-center mb-8 border-b-2 border-black pb-6">
          <h1 className="text-3xl font-bold mb-1 uppercase tracking-wider">{storeName}</h1>
          <h2 className="text-xl font-bold uppercase tracking-[0.3em] mt-2 underline">{t(type + '_report')}</h2>
          <div className="flex justify-between mt-6 text-sm">
            <span>{t('date')}: {new Date().toLocaleDateString()}</span>
            <span>{t('filter_by')}: {dateFilter === 'custom' ? `${dateRange.start} - ${dateRange.end}` : dateFilter === 'all_time' ? t('all_time') : t(dateFilter)}</span>
          </div>
        </div>

        <table className="w-full text-xs border-collapse">
          {type === 'sales' && (
            <>
              <thead>
                <tr className="border-y-2 border-black bg-gray-50">
                  <th className="border border-black p-2 text-start uppercase">{t('invoice')}</th>
                  <th className="border border-black p-2 text-start uppercase">{t('customer')}</th>
                  <th className="border border-black p-2 text-start uppercase">{t('date')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('total')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('discount')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('net_total')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('profit')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s: any) => (
                  <tr key={s.id} className="border-b border-black">
                    <td className="border border-black p-2 font-bold">#{s.id}</td>
                    <td className="border border-black p-2">{s.customer_name || t('walk_in_customer')}</td>
                    <td className="border border-black p-2">{new Date(s.created_at).toLocaleString()}</td>
                    <td className="border border-black p-2 text-end">{fmt(s.total + s.discount)}</td>
                    <td className="border border-black p-2 text-end">-{fmt(s.discount)}</td>
                    <td className="border border-black p-2 text-end font-bold">{fmt(s.total)}</td>
                    <td className="border border-black p-2 text-end font-bold text-green-700">{fmt(s.profit || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-gray-50 font-bold">
                  <td colSpan={3} className="border border-black p-2 text-end uppercase">{t('total')}</td>
                  <td className="border border-black p-2 text-end">{fmt(data.summary.total + data.summary.discount)}</td>
                  <td className="border border-black p-2 text-end text-red-600">-{fmt(data.summary.discount)}</td>
                  <td className="border border-black p-2 text-end text-lg">{fmt(data.summary.total)}</td>
                  <td className="border border-black p-2 text-end text-lg text-green-700">{fmt(data.summary.profit || 0)}</td>
                </tr>
              </tfoot>
            </>
          )}

          {type === 'overdue' && (
            <>
              <thead>
                <tr className="border-y-2 border-black bg-gray-50">
                  <th className="border border-black p-2 text-start uppercase">{t('customer')}</th>
                  <th className="border border-black p-2 text-start uppercase">{t('phone')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('remaining')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('monthly_payment')}</th>
                </tr>
              </thead>
              <tbody>
                {data.overdue.map((i: any) => (
                  <tr key={i.id} className="border-b border-black">
                    <td className="border border-black p-2 font-bold">{i.customer_name}</td>
                    <td className="border border-black p-2">{i.customer_phone || '-'}</td>
                    <td className="border border-black p-2 text-end font-bold">{fmt(i.remaining)}</td>
                    <td className="border border-black p-2 text-end">{fmt(i.monthly_payment)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {type === 'inventory' && (
            <>
              <thead>
                <tr className="border-y-2 border-black bg-gray-50">
                  <th className="border border-black p-2 text-start uppercase">{t('product_name')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('price')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('stock')}</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStock.map((p: any) => (
                  <tr key={p.id} className="border-b border-black">
                    <td className="border border-black p-2 font-bold">{p.name}</td>
                    <td className="border border-black p-2 text-end">{fmt(p.price_cash)}</td>
                    <td className="border border-black p-2 text-end font-bold text-red-600">{p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {type === 'top_products' && (
            <>
              <thead>
                <tr className="border-y-2 border-black bg-gray-50">
                  <th className="border border-black p-2 text-start uppercase">#</th>
                  <th className="border border-black p-2 text-start uppercase">{t('product_name')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('quantity_sold')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('total_revenue')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('profit')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p: any, idx: number) => (
                  <tr key={p.id} className="border-b border-black">
                    <td className="border border-black p-2 font-bold text-center">{idx + 1}</td>
                    <td className="border border-black p-2 font-bold">{p.name}</td>
                    <td className="border border-black p-2 text-end">{p.total_qty}</td>
                    <td className="border border-black p-2 text-end font-bold">{fmt(p.total_revenue)}</td>
                    <td className="border border-black p-2 text-end font-bold text-green-700">{fmt(p.total_profit || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {type === 'expenses' && (
            <>
              <thead>
                <tr className="border-y-2 border-black bg-gray-50">
                  <th className="border border-black p-2 text-start uppercase">#</th>
                  <th className="border border-black p-2 text-start uppercase">{t('reason')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('amount')}</th>
                  <th className="border border-black p-2 text-start uppercase">{t('recorded_by')}</th>
                  <th className="border border-black p-2 text-start uppercase">{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e: any) => (
                  <tr key={e.id} className="border-b border-black">
                    <td className="border border-black p-2 font-bold">#{e.id}</td>
                    <td className="border border-black p-2">{e.reason}</td>
                    <td className="border border-black p-2 text-end font-bold text-red-700">{fmt(e.amount)}</td>
                    <td className="border border-black p-2">{e.recorded_by_name || '-'}</td>
                    <td className="border border-black p-2">{new Date(e.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-gray-50 font-bold">
                  <td colSpan={2} className="border border-black p-2 text-end uppercase">{t('total')}</td>
                  <td className="border border-black p-2 text-end text-lg text-red-700">{fmt(data.summary.total)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </>
          )}

          {type === 'cash_in' && (
            <>
              <thead>
                <tr className="border-y-2 border-black bg-gray-50">
                  <th className="border border-black p-2 text-start uppercase">#</th>
                  <th className="border border-black p-2 text-start uppercase">{t('reason')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('amount')}</th>
                  <th className="border border-black p-2 text-start uppercase">{t('recorded_by')}</th>
                  <th className="border border-black p-2 text-start uppercase">{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e: any) => (
                  <tr key={e.id} className="border-b border-black">
                    <td className="border border-black p-2 font-bold">#{e.id}</td>
                    <td className="border border-black p-2">{e.reason}</td>
                    <td className="border border-black p-2 text-end font-bold text-emerald-700">{fmt(e.amount)}</td>
                    <td className="border border-black p-2">{e.recorded_by_name || '-'}</td>
                    <td className="border border-black p-2">{new Date(e.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-gray-50 font-bold">
                  <td colSpan={2} className="border border-black p-2 text-end uppercase">{t('total')}</td>
                  <td className="border border-black p-2 text-end text-lg text-emerald-700">{fmt(data.summary.total)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </>
          )}

          {type === 'expiring' && (
            <>
              <thead>
                <tr className="border-y-2 border-black bg-gray-50">
                  <th className="border border-black p-2 text-start uppercase">{t('product_name')}</th>
                  <th className="border border-black p-2 text-end uppercase">{t('stock')}</th>
                  <th className="border border-black p-2 text-start uppercase">{t('expiry_date')}</th>
                  <th className="border border-black p-2 text-center uppercase">{t('days_to_expiry')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p: any) => {
                  const days = p.days_left !== undefined ? Number(p.days_left) : Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000);
                  return (
                    <tr key={p.id} className="border-b border-black">
                      <td className="border border-black p-2 font-bold">{p.name}</td>
                      <td className="border border-black p-2 text-end font-bold">{p.stock}</td>
                      <td className="border border-black p-2 font-bold text-red-600">{p.expiry_date}</td>
                      <td className="border border-black p-2 text-center font-bold">{days <= 0 ? t('expired') : `${days} ${t('days')}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          )}

          {type === 'annual_inventory' && (
            <>
              {/* Closing Stock Print */}
              <thead><tr className="border-y-2 border-black bg-gray-50"><th colSpan={5} className="border border-black p-2 text-center uppercase font-bold">{t('closing_stock')}</th></tr></thead>
              <thead><tr className="bg-gray-50">
                <th className="border border-black p-2 text-start uppercase">{t('product_name')}</th>
                <th className="border border-black p-2 text-start uppercase">{t('barcode')}</th>
                <th className="border border-black p-2 text-end uppercase">{t('purchase_price')}</th>
                <th className="border border-black p-2 text-end uppercase">{t('stock')}</th>
                <th className="border border-black p-2 text-end uppercase">{t('total')}</th>
              </tr></thead>
              <tbody>
                {data.items.filter((p: any) => (p.stock || 0) > 0).map((p: any) => (
                  <tr key={p.id} className="border-b border-black">
                    <td className="border border-black p-2 font-bold">{p.name}</td>
                    <td className="border border-black p-2">{p.barcode || '-'}</td>
                    <td className="border border-black p-2 text-end">{fmt(p.price_purchase)}</td>
                    <td className="border border-black p-2 text-end font-bold">{p.stock}</td>
                    <td className="border border-black p-2 text-end font-bold">{fmt(p.stock_value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-gray-50 font-bold">
                  <td colSpan={4} className="border border-black p-2 text-end uppercase">{t('total_inventory_value')}</td>
                  <td className="border border-black p-2 text-end text-lg">{fmt(data.summary.totalInventoryValue)}</td>
                </tr>
              </tfoot>

              {/* P&L Print */}
              <thead><tr className="border-y-2 border-black bg-gray-50"><th colSpan={2} className="border border-black p-2 text-center uppercase font-bold">{t('profit_and_loss')}</th></tr></thead>
              <tbody>
                <tr className="border-b border-black">
                  <td className="border border-black p-2 font-bold">{t('total_sales_revenue')}</td>
                  <td className="border border-black p-2 text-end font-bold">{fmt(data.summary.totalRevenue)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border border-black p-2">{t('cost_of_goods_sold')}</td>
                  <td className="border border-black p-2 text-end text-red-700">-{fmt(data.summary.cogs)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border border-black p-2">{t('other_expenses')}</td>
                  <td className="border border-black p-2 text-end text-red-700">-{fmt(data.summary.totalExpenses)}</td>
                </tr>
                <tr className="border-t-2 border-black bg-gray-50 font-bold">
                  <td className="border border-black p-2 uppercase">{t('net_profit_loss')}</td>
                  <td className="border border-black p-2 text-end text-lg">{(data.summary.netProfitLoss || 0) >= 0 ? fmt(data.summary.netProfitLoss) : '(' + fmt(Math.abs(data.summary.netProfitLoss)) + ')'}</td>
                </tr>
              </tbody>
            </>
          )}
        </table>

        <div className="mt-12 grid grid-cols-2 gap-20">
          <div className="text-center">
            <div className="border-b border-black h-12 mb-2"></div>
            <p className="text-xs uppercase font-bold">{t('admin')}</p>
          </div>
          <div className="text-center">
            <div className="border-b border-black h-12 mb-2"></div>
            <p className="text-xs uppercase font-bold">{t('customer')}</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4 portrait; }
          body { 
            background: white !important; 
            color: black !important; 
            padding: 0 !important; 
            margin: 0 !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
