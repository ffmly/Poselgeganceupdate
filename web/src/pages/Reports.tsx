import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { BarChart3, TrendingUp, AlertTriangle, Printer, FileText } from 'lucide-react';

const userCache: Record<string, string> = {};

type ReportType = 'sales' | 'overdue' | 'inventory' | 'top_products' | 'expenses' | 'expiring' | 'cash_in';
type DateFilter = 'today' | 'this_month' | 'this_year' | 'all_time' | 'custom';

export default function Reports() {
  const { t } = useTranslation();
  const [type, setType] = useState<ReportType>('sales');
  const [dateFilter, setDateFilter] = useState<DateFilter>('this_month');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [data, setData] = useState<any>({ summary: {}, items: [], overdue: [], lowStock: [] });
  const [currency, setCurrency] = useState('DZD');
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [type, dateFilter, dateRange]);

  const inRange = (dateStr: string) => {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (dateFilter === 'today') return d === new Date().toISOString().slice(0, 10);
    if (dateFilter === 'this_month') return d.slice(0, 7) === new Date().toISOString().slice(0, 7);
    if (dateFilter === 'this_year') return d.slice(0, 4) === new Date().toISOString().slice(0, 4);
    if (dateFilter === 'all_time') return true;
    if (dateFilter === 'custom' && dateRange.start && dateRange.end) {
      return d >= dateRange.start && d <= dateRange.end;
    }
    return true;
  };

  const load = async () => {
    setLoading(true);
    const setSnap = await getDocs(collection(db, 'settings'));
    const sMap: Record<string, string> = {};
    setSnap.forEach(d => sMap[d.id] = d.data().value);
    setCurrency(sMap.currency || 'DZD');
    setStoreName(sMap.store_name || 'My Store');

    try {
      if (Object.keys(userCache).length === 0) {
        const uSnap = await getDocs(collection(db, 'users'));
        uSnap.forEach(d => userCache[d.id] = d.data().username);
      }

      if (type === 'sales') {
        const sSnap = await getDocs(collection(db, 'sales'));
        let total = 0, count = 0, discount = 0, profit = 0;
        const items: any[] = [];
        const pSnap = await getDocs(collection(db, 'products'));
        const pMap: any = {};
        pSnap.forEach(d => pMap[d.id] = d.data());
        const siSnap = await getDocs(collection(db, 'sale_items'));

        sSnap.forEach(d => {
          const s = d.data();
          if (!inRange(s.created_at)) return;
          count++;
          total += s.total || 0;
          discount += s.discount || 0;
          items.push({ id: d.id, ...s, saleProfit: 0 });
        });

        siSnap.forEach(d => {
          const si = d.data();
          const sale = items.find((s: any) => s.id === si.sale_id) as any;
          if (sale && pMap[si.product_id]) {
            const itemProfit = si.subtotal - (si.quantity * (pMap[si.product_id].price_purchase || 0));
            sale.saleProfit = (sale.saleProfit || 0) + itemProfit;
            profit += itemProfit;
          }
        });

        const cSnap = await getDocs(collection(db, 'customers'));
        const cMap: any = {};
        cSnap.forEach(d => cMap[d.id] = d.data().name);
        items.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));

        setData({ summary: { count, total, discount, profit }, items: items.map((s: any) => ({ ...s, customer_name: cMap[s.customer_id] || '-' })), overdue: [], lowStock: [] });
      } else if (type === 'overdue') {
        const iSnap = await getDocs(collection(db, 'installments'));
        const overdue: any[] = [];
        const cSnap = await getDocs(collection(db, 'customers'));
        const cMap: any = {};
        cSnap.forEach(d => cMap[d.id] = d.data());
        iSnap.forEach(d => {
          const inst = d.data();
          if (inst.remaining > 0 && inst.status !== 'completed') {
            const lastPay = inst.updated_at || inst.start_date;
            if (lastPay) {
              const daysSince = Math.floor((Date.now() - new Date(lastPay).getTime()) / 86400000);
              if (daysSince > 30) overdue.push({ id: d.id, ...inst, customer_name: cMap[inst.customer_id]?.name || '-', customer_phone: cMap[inst.customer_id]?.phone || '' });
            }
          }
        });
        setData({ summary: { count: overdue.length }, items: [], overdue, lowStock: [] });
      } else if (type === 'inventory') {
        const pSnap = await getDocs(collection(db, 'products'));
        const lowStock: any[] = [];
        pSnap.forEach(d => {
          const p = d.data();
          if (p.stock <= 5) lowStock.push({ id: d.id, ...p });
        });
        lowStock.sort((a, b) => a.stock - b.stock);
        setData({ summary: { count: lowStock.length }, items: [], overdue: [], lowStock });
      } else if (type === 'expenses') {
        const eSnap = await getDocs(collection(db, 'expenses'));
        let total = 0, count = 0;
        const items: any[] = [];
        eSnap.forEach(d => {
          const e = d.data();
          if (!inRange(e.created_at)) return;
          count++;
          total += e.amount || 0;
          items.push({ id: d.id, ...e, recorded_by_name: userCache[e.created_by] || '-' });
        });
        items.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
        setData({ summary: { count, total }, items, overdue: [], lowStock: [] });
      } else if (type === 'top_products') {
        const sSnap = await getDocs(collection(db, 'sales'));
        const saleIds = new Set<string>();
        sSnap.forEach(d => { if (inRange(d.data().created_at)) saleIds.add(d.id); });
        const siSnap = await getDocs(collection(db, 'sale_items'));
        const pMap: any = {};
        const pSnap = await getDocs(collection(db, 'products'));
        pSnap.forEach(d => pMap[d.id] = { ...d.data(), id: d.id });
        const prodCounts: Record<string, any> = {};
        siSnap.forEach(d => {
          const si = d.data();
          if (!saleIds.has(si.sale_id)) return;
          const prod = pMap[si.product_id];
          if (!prod) return;
          if (!prodCounts[si.product_id]) {
            prodCounts[si.product_id] = { id: si.product_id, name: prod.name, price_cash: prod.price_cash, price_purchase: prod.price_purchase, total_qty: 0, total_revenue: 0, total_profit: 0 };
          }
          prodCounts[si.product_id].total_qty += si.quantity;
          prodCounts[si.product_id].total_revenue += si.subtotal;
          prodCounts[si.product_id].total_profit += (si.subtotal - (si.quantity * (prod.price_purchase || 0)));
        });
        const items = Object.values(prodCounts).sort((a: any, b: any) => b.total_qty - a.total_qty).slice(0, 50);
        setData({ summary: { count: items.length }, items, overdue: [], lowStock: [] });
      } else if (type === 'cash_in') {
        const cmSnap = await getDocs(collection(db, 'cash_movements'));
        const items: any[] = [];
        cmSnap.forEach(d => {
          const m = d.data();
          if (m.type !== 'in') return;
          if (!inRange(m.created_at)) return;
          items.push({ id: d.id, ...m, recorded_by_name: userCache[m.recorded_by] || '-' });
        });
        items.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
        const total = items.reduce((s: number, m: any) => s + (m.amount || 0), 0);
        setData({ summary: { count: items.length, total }, items, overdue: [], lowStock: [] });
      } else if (type === 'expiring') {
        const ad = Number(sMap.expiry_alert_days) || 4;
        const now = new Date();
        const endDate = new Date(now.getTime() + ad * 86400000);
        const pSnap = await getDocs(collection(db, 'products'));
        const items: any[] = [];
        pSnap.forEach(d => {
          const p = d.data();
          if (p.expiry_date) {
            const exp = new Date(p.expiry_date);
            if (exp >= now && exp <= endDate) {
              items.push({ id: d.id, ...p, days_left: Math.ceil((exp.getTime() - now.getTime()) / 86400000) });
            }
          }
        });
        items.sort((a, b) => a.days_left - b.days_left);
        setData({ summary: { count: items.length }, items, overdue: [], lowStock: [] });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fmt = (n: number) => (n || 0).toLocaleString() + ' ' + currency;

  if (loading) return <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" /></div>;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-400" />{t('reports')}
        </h1>
        <div className="flex items-center gap-2">
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none">
            <option value="today">{t('today')}</option>
            <option value="this_month">{t('this_month')}</option>
            <option value="this_year">{t('this_year')}</option>
            <option value="all_time">{t('all_time')}</option>
            <option value="custom">{t('custom_range')}</option>
          </select>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-indigo-600 rounded-xl px-4 py-2 text-sm font-medium">
            <Printer className="w-4 h-4" />{t('print_report')}
          </button>
        </div>
      </div>

      {dateFilter === 'custom' && (
        <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl flex items-center gap-4 print:hidden">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">{t('from')}</label>
            <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">{t('to')}</label>
            <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-2xl overflow-x-auto print:hidden">
        {(['sales', 'overdue', 'inventory', 'top_products', 'expenses', 'expiring', 'cash_in'] as ReportType[]).map(t_ => (
          <button key={t_} onClick={() => setType(t_)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap rounded-xl transition-all ${
              type === t_ ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {t_ === 'sales' && <TrendingUp className="w-3.5 h-3.5" />}
            {t_ === 'overdue' && <AlertTriangle className="w-3.5 h-3.5" />}
            {t_ === 'inventory' && <FileText className="w-3.5 h-3.5" />}
            {t_ === 'top_products' && <TrendingUp className="w-3.5 h-3.5" />}
            {t_ === 'expenses' && <AlertTriangle className="w-3.5 h-3.5" />}
            {t_ === 'expiring' && <AlertTriangle className="w-3.5 h-3.5" />}
            {t_ === 'cash_in' && <TrendingUp className="w-3.5 h-3.5" />}
            {t(t_ + '_report')}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {type === 'sales' ? (
          <>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('total_revenue')}</div>
              <div className="text-2xl font-bold text-white">{fmt(data.summary.total)}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('net_profit')}</div>
              <div className="text-2xl font-bold text-emerald-400">{fmt(data.summary.profit || 0)}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('total_discount')}</div>
              <div className="text-2xl font-bold text-red-400">-{fmt(data.summary.discount)}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('order_count')}</div>
              <div className="text-2xl font-bold text-white">{data.summary.count}</div>
            </div>
          </>
        ) : type === 'expenses' ? (
          <>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('total_expenses')}</div>
              <div className="text-2xl font-bold text-red-400">{fmt(data.summary.total)}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('total_transactions')}</div>
              <div className="text-2xl font-bold text-white">{data.summary.count}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('average_expense')}</div>
              <div className="text-2xl font-bold text-orange-400">{fmt(data.summary.count > 0 ? data.summary.total / data.summary.count : 0)}</div>
            </div>
          </>
        ) : type === 'cash_in' ? (
          <>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('total_cash_in')}</div>
              <div className="text-2xl font-bold text-emerald-400">{fmt(data.summary.total)}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('total_transactions')}</div>
              <div className="text-2xl font-bold text-white">{data.summary.count}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('average_cash_in')}</div>
              <div className="text-2xl font-bold text-indigo-400">{fmt(data.summary.count > 0 ? data.summary.total / data.summary.count : 0)}</div>
            </div>
          </>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 col-span-full">
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('item_count')}</div>
            <div className="text-3xl font-bold text-indigo-400">{data.summary.count}</div>
          </div>
        )}
      </div>

      {/* Detail Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white">{t(type + '_detailed_report')}</h2>
            <p className="text-[10px] text-slate-500">
              {dateFilter === 'custom' ? `${dateRange.start} — ${dateRange.end}` : dateFilter === 'all_time' ? t('all_time') : t(dateFilter)}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {type === 'sales' && (
              <>
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">#{t('invoice_number')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('customer')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('type')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('total')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('net_total')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('profit')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.items.map((s: any) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2 font-mono text-xs text-indigo-400 font-bold">#{s.id.slice(0, 6)}</td>
                      <td className="px-4 py-2 text-white font-medium">{s.customer_name || '-'}</td>
                      <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.type === 'cash' ? 'bg-emerald-500/10 text-emerald-400' : s.type === 'debt' ? 'bg-amber-500/10 text-amber-400' : 'bg-violet-500/10 text-violet-400'}`}>{t(s.type)}</span></td>
                      <td className="px-4 py-2 text-end text-slate-400">{fmt(s.total + (s.discount || 0))}</td>
                      <td className="px-4 py-2 text-end text-white font-bold">{fmt(s.total - (s.discount || 0))}</td>
                      <td className="px-4 py-2 text-end text-emerald-400">{fmt(s.saleProfit || 0)}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{s.created_at?.slice(0, 10) || '-'}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">{t('no_data')}</td></tr>}
                </tbody>
              </>
            )}
            {type === 'expenses' && (
              <>
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">#</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('description')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('recorded_by')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('amount')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.items.map((e: any) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2 font-mono text-xs text-red-400 font-bold">#</td>
                      <td className="px-4 py-2 text-white">{e.description || '-'}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{e.recorded_by_name}</td>
                      <td className="px-4 py-2 text-end text-red-400 font-medium">{fmt(e.amount)}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{e.created_at?.slice(0, 10) || '-'}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{t('no_data')}</td></tr>}
                </tbody>
              </>
            )}
            {type === 'cash_in' && (
              <>
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">#</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('reason')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('amount')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('recorded_by')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.items.map((e: any) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2 font-mono text-xs text-emerald-400 font-bold">#</td>
                      <td className="px-4 py-2 text-white">{e.reason || '-'}</td>
                      <td className="px-4 py-2 text-end text-emerald-400 font-medium">{fmt(e.amount)}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{e.recorded_by_name}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{e.created_at?.slice(0, 10) || '-'}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{t('no_data')}</td></tr>}
                </tbody>
              </>
            )}
            {type === 'overdue' && (
              <>
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('customer')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('phone')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('remaining')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('monthly_payment')}</th>
                    <th className="text-center px-4 py-2 text-slate-500 text-xs font-medium">{t('status')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.overdue.map((o: any) => (
                    <tr key={o.id}>
                      <td className="px-4 py-2 text-white font-medium">{o.customer_name}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{o.customer_phone || '-'}</td>
                      <td className="px-4 py-2 text-end text-red-400 font-bold">{fmt(o.remaining)}</td>
                      <td className="px-4 py-2 text-end text-slate-400">{fmt(o.monthly_payment)}</td>
                      <td className="px-4 py-2 text-center"><span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold">{t('overdue').toUpperCase()}</span></td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{o.created_at?.slice(0, 10) || '-'}</td>
                    </tr>
                  ))}
                  {data.overdue.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">{t('no_data')}</td></tr>}
                </tbody>
              </>
            )}
            {type === 'inventory' && (
              <>
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('product')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('stock')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('price')}</th>
                    <th className="text-center px-4 py-2 text-slate-500 text-xs font-medium">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.lowStock.map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-white font-medium">{p.name}</td>
                      <td className="px-4 py-2 text-end"><span className={`font-bold ${p.stock <= 0 ? 'text-red-400' : 'text-amber-400'}`}>{p.stock}</span></td>
                      <td className="px-4 py-2 text-end text-slate-400">{fmt(p.price_cash)}</td>
                      <td className="px-4 py-2 text-center"><span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold">{t('low_stock').toUpperCase()}</span></td>
                    </tr>
                  ))}
                  {data.lowStock.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">{t('no_data')}</td></tr>}
                </tbody>
              </>
            )}
            {type === 'top_products' && (
              <>
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-center px-4 py-2 text-slate-500 text-xs font-medium">#</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('product')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('qty_sold')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('revenue')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('profit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.items.map((p: any, idx: number) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-2 text-white font-medium">{p.name}</td>
                      <td className="px-4 py-2 text-end text-white font-bold">{p.total_qty}</td>
                      <td className="px-4 py-2 text-end text-emerald-400">{fmt(p.total_revenue)}</td>
                      <td className="px-4 py-2 text-end text-indigo-400">{fmt(p.total_profit)}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{t('no_data')}</td></tr>}
                </tbody>
              </>
            )}
            {type === 'expiring' && (
              <>
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('product')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('barcode')}</th>
                    <th className="text-end px-4 py-2 text-slate-500 text-xs font-medium">{t('stock')}</th>
                    <th className="text-start px-4 py-2 text-slate-500 text-xs font-medium">{t('expiry_date')}</th>
                    <th className="text-center px-4 py-2 text-slate-500 text-xs font-medium">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.items.map((p: any) => {
                    const days = p.days_left !== undefined ? Number(p.days_left) : Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000);
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-2 text-white font-medium">{p.name}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs font-mono">{p.barcode || '-'}</td>
                        <td className="px-4 py-2 text-end text-white font-bold">{p.stock}</td>
                        <td className={`px-4 py-2 ${days <= 0 ? 'text-red-400' : 'text-slate-400'}`}>{p.expiry_date}</td>
                        <td className="px-4 py-2 text-center">
                          {days <= 0
                            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold">{t('expired')}</span>
                            : <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${days <= 4 ? 'bg-red-500/10 text-red-400' : days <= 14 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400'}`}>{days} {t('days')}</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                  {data.items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{t('no_data')}</td></tr>}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>

      {/* PRINT-ONLY REPORT */}
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
                    <td className="border border-black p-2">{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</td>
                    <td className="border border-black p-2 text-end">{fmt(s.total + (s.discount || 0))}</td>
                    <td className="border border-black p-2 text-end">-{fmt(s.discount || 0)}</td>
                    <td className="border border-black p-2 text-end font-bold">{fmt(s.total - (s.discount || 0))}</td>
                    <td className="border border-black p-2 text-end font-bold text-green-700">{fmt(s.saleProfit || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-gray-50 font-bold">
                  <td colSpan={3} className="border border-black p-2 text-end uppercase">{t('total')}</td>
                  <td className="border border-black p-2 text-end">{fmt(data.summary.total + (data.summary.discount || 0))}</td>
                  <td className="border border-black p-2 text-end text-red-600">-{fmt(data.summary.discount || 0)}</td>
                  <td className="border border-black p-2 text-end text-lg">{fmt(data.summary.total)}</td>
                  <td className="border border-black p-2 text-end text-lg text-green-700">{fmt(data.summary.profit || 0)}</td>
                </tr>
              </tfoot>
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
                    <td className="border border-black p-2">{e.description || '-'}</td>
                    <td className="border border-black p-2 text-end font-bold text-red-700">{fmt(e.amount)}</td>
                    <td className="border border-black p-2">{e.recorded_by_name || '-'}</td>
                    <td className="border border-black p-2">{e.created_at ? new Date(e.created_at).toLocaleString() : '-'}</td>
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
                    <td className="border border-black p-2 font-bold">#</td>
                    <td className="border border-black p-2">{e.reason || '-'}</td>
                    <td className="border border-black p-2 text-end font-bold text-emerald-700">{fmt(e.amount)}</td>
                    <td className="border border-black p-2">{e.recorded_by_name || '-'}</td>
                    <td className="border border-black p-2">{e.created_at ? new Date(e.created_at).toLocaleString() : '-'}</td>
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
          body { background: white !important; color: black !important; padding: 0 !important; margin: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
