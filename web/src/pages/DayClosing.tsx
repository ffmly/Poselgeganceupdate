import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Lock, TrendingUp, CreditCard, FileText, AlertTriangle, Undo2, Wallet, CheckCircle, X, Calendar } from 'lucide-react';

export default function DayClosing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [currency, setCurrency] = useState('DZD');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [alreadyClosed, setAlreadyClosed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const setSnap = await getDocs(collection(db, 'settings'));
    const sMap: Record<string, string> = {};
    setSnap.forEach(d => sMap[d.id] = d.data().value);
    setCurrency(sMap.currency || 'DZD');

    const today = new Date().toISOString().slice(0, 10);

    // Check if already closed today
    const closeSnap = await getDocs(query(collection(db, 'day_closing'), orderBy('created_at', 'desc'), limit(1)));
    let closed = false;
    closeSnap.forEach(d => {
      if (d.data().created_at?.startsWith(today)) closed = true;
    });
    setAlreadyClosed(closed);

    if (!closed) {
      const [sSnap, expSnap, retSnap, dSnap, iSnap] = await Promise.all([
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'product_returns')),
        getDocs(collection(db, 'credit_debts')),
        getDocs(collection(db, 'installments')),
      ]);

      let cashTotal = 0, creditTotal = 0, debtTotal = 0;
      let totalSales = 0, transCount = 0;
      sSnap.forEach(d => {
        const s = d.data();
        if (!s.created_at?.startsWith(today)) return;
        const amt = (s.total || 0) - (s.discount || 0);
        totalSales += amt;
        transCount++;
        if (s.type === 'cash') cashTotal += amt;
        else if (s.type === 'credit') creditTotal += amt;
        else if (s.type === 'debt') debtTotal += amt;
      });

      let expensesTotal = 0;
      expSnap.forEach(d => {
        if (d.data().created_at?.startsWith(today)) expensesTotal += (d.data().amount || 0);
      });

      let returnsTotal = 0;
      retSnap.forEach(d => {
        if (d.data().created_at?.startsWith(today)) returnsTotal += (d.data().total || 0);
      });

      let debtCollected = 0;
      const now = new Date();
      dSnap.forEach(d => {
        const debt = d.data();
        const lastPay = debt.updated_at || debt.created_at;
        if (lastPay?.startsWith(today) && debt.paid) {
          debtCollected += (debt.paid || 0);
        }
      });

      setSummary({
        totalSales, cashTotal, creditTotal, debtTotal,
        expensesTotal, returnsTotal,
        debtCollected,
        netCash: totalSales - returnsTotal - expensesTotal,
        transactionCount: transCount,
      });
    }

    setLoading(false);
  };

  const handleConfirm = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const openSnap = await getDocs(query(collection(db, 'day_closing'), orderBy('created_at', 'desc'), limit(1)));
    let openedAt = null;
    openSnap.forEach(d => { openedAt = d.data().created_at; });

    await addDoc(collection(db, 'day_closing'), {
      closed_at: new Date().toISOString(),
      opened_at: openedAt,
      total_sales: summary.totalSales,
      cash_total: summary.cashTotal,
      credit_total: summary.creditTotal,
      debt_total: summary.debtTotal,
      returns_total: summary.returnsTotal,
      expenses_total: summary.expensesTotal,
      debt_collected: summary.debtCollected,
      net_cash: summary.netCash,
      transaction_count: summary.transactionCount,
      notes: notes || '',
      closed_by: user?.id || null,
      created_at: new Date().toISOString(),
    });
    setDone(true);
    setShowConfirm(false);
  };

  const fmt = (n: number) => (n || 0).toLocaleString() + ' ' + currency;

  if (loading) return <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  if (done) return (
    <div className="h-full flex items-center justify-center">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center max-w-md">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t('day_closed_success')}</h2>
        <p className="text-slate-400 text-sm">{new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );

  if (alreadyClosed) return (
    <div className="h-full flex items-center justify-center">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center max-w-md">
        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t('already_closed')}</h2>
        <p className="text-slate-400 text-sm">{new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );

  const cards = summary ? [
    { label: t('total_sales'), value: fmt(summary.totalSales), icon: TrendingUp, color: 'indigo' },
    { label: t('net_cash'), value: fmt(summary.netCash), icon: Calendar, color: 'emerald' },
    { label: t('cash') + ' ' + t('sales'), value: fmt(summary.cashTotal), icon: TrendingUp, color: 'blue' },
    { label: t('credit') + ' ' + t('sales'), value: fmt(summary.creditTotal), icon: CreditCard, color: 'violet' },
    { label: t('debt') + ' ' + t('sales'), value: fmt(summary.debtTotal), icon: FileText, color: 'amber' },
    { label: t('total_expenses'), value: fmt(summary.expensesTotal), icon: AlertTriangle, color: 'red' },
    { label: t('returns'), value: fmt(summary.returnsTotal), icon: Undo2, color: 'orange' },
    { label: t('debt_collected'), value: fmt(summary.debtCollected), icon: Wallet, color: 'teal' },
  ] : [];

  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{t('day_closing')}</h1>
          <p className="text-sm text-slate-400">{new Date().toLocaleDateString()} — {summary?.transactionCount || 0} {t('transactions')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl border ${colorMap[card.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-1 truncate">{card.value}</div>
              <div className="text-sm text-slate-400">{card.label}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">{t('close_day')}</h2>
        </div>
        <p className="text-slate-400 text-sm mb-4">{t('close_day_desc')}</p>
        <button onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl px-6 py-3 font-bold transition-all active:scale-[0.98]">
          <Lock className="w-5 h-5" />{t('confirm_close')}
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h2 className="font-semibold text-white">{t('confirm_close')}</h2>
              </div>
              <button onClick={() => setShowConfirm(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-300">{t('close_day_warning')}</p>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('notes')}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm resize-none" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowConfirm(false)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button onClick={handleConfirm} className="flex-1 bg-amber-600 hover:bg-amber-500 rounded-xl py-2.5 text-sm font-bold">{t('confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}