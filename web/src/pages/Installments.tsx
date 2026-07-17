import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Search, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';

export default function Installments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [selected, setSelected] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [currency, setCurrency] = useState('DZD');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const snap = await getDocs(query(collection(db, 'installments'), orderBy('start_date', 'desc')));
    const list: any[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    const sSnap = await getDocs(collection(db, 'settings'));
    let cur = 'DZD';
    sSnap.forEach(d => { if (d.id === 'currency') cur = d.data().value; });
    setCurrency(cur);
    const cSnap = await getDocs(collection(db, 'customers'));
    const cMap: any = {};
    cSnap.forEach(d => cMap[d.id] = d.data());
    setData(list.map(d => ({ ...d, customerName: cMap[d.customer_id]?.name || '-', customerPhone: cMap[d.customer_id]?.phone || '' })));
    if (selected) {
      const updated = list.find((d: any) => d.id === selected.id);
      if (updated) setSelected({ ...updated, customerName: cMap[updated.customer_id]?.name || '-', customerPhone: cMap[updated.customer_id]?.phone || '' });
    }
  };

  const loadPayments = async (id: string) => {
    const snap = await getDocs(query(collection(db, 'installments', id, 'payments'), orderBy('payment_date', 'desc')));
    const list: any[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    setPayments(list);
  };

  const registerPayment = async () => {
    if (!selected || !payAmount || Number(payAmount) <= 0) return;
    const newPaid = (selected.paid_amount || 0) + Number(payAmount);
    const newRemaining = Math.max(0, selected.total_amount - newPaid);
    const newStatus = newRemaining <= 0 ? 'completed' : 'active';
    await addDoc(collection(db, 'installments', selected.id, 'payments'), {
      amount: Number(payAmount), notes: payNotes || '',
      payment_date: new Date().toISOString(), created_by: user?.id || null,
    });
    await updateDoc(doc(db, 'installments', selected.id), { paid_amount: newPaid, remaining: newRemaining, status: newStatus });
    setPayModal(false); setPayAmount(''); setPayNotes('');
    await load();
    await loadPayments(selected.id);
  };

  const fmt = (n: number) => (n || 0).toLocaleString() + ' ' + currency;
  const filtered = data
    .filter(i => filter === 'all' || i.status === filter)
    .filter(i => (i.customerName || '').toLowerCase().includes(search.toLowerCase()));

  const statusIcon = (s: string) =>
    s === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
    s === 'overdue' ? <AlertTriangle className="w-4 h-4 text-red-400" /> :
    <Clock className="w-4 h-4 text-amber-400" />;

  const statusColor = (s: string) =>
    s === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
    s === 'overdue' ? 'bg-red-500/10 text-red-400' :
    'bg-amber-500/10 text-amber-400';

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-4 py-2.5 text-sm" />
        </div>
        <div className="flex gap-1">
          {(['all', 'active', 'completed', 'overdue'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>{t(f)}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(inst => {
          const progress = inst.total_amount > 0 ? Math.min(100, ((inst.paid_amount || 0) + (inst.advance || 0)) / inst.total_amount * 100) : 0;
          return (
            <div key={inst.id} onClick={() => { setSelected(inst); loadPayments(inst.id); }}
              className={`bg-slate-800/50 border rounded-2xl p-4 cursor-pointer hover:border-indigo-500/30 transition-all ${
                selected?.id === inst.id ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-slate-700/50'
              }`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-white">{inst.customerName}</div>
                  {inst.customerPhone && <div className="text-xs text-slate-500">{inst.customerPhone}</div>}
                </div>
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusColor(inst.status)}`}>
                  {statusIcon(inst.status)} {t(inst.status)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div><div className="text-slate-500 mb-0.5">{t('total')}</div><div className="text-white font-bold">{fmt(inst.total_amount)}</div></div>
                <div><div className="text-slate-500 mb-0.5">{t('paid')}</div><div className="text-emerald-400 font-bold">{fmt((inst.paid_amount || 0) + (inst.advance || 0))}</div></div>
                <div><div className="text-slate-500 mb-0.5">{t('remaining')}</div><div className="text-red-400 font-bold">{fmt(inst.remaining)}</div></div>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-slate-500 mt-2">{fmt(inst.monthly_payment)}/{t('month')} × {inst.months}</div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full py-12 text-center text-slate-500 text-sm">{t('no_data')}</div>}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
              <h2 className="font-bold text-white">{selected.customerName}</h2>
              <button onClick={() => setSelected(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  [t('total'), fmt(selected.total_amount), 'text-white'],
                  [t('advance'), fmt(selected.advance), 'text-indigo-400'],
                  [t('paid'), fmt(selected.paid_amount || 0), 'text-emerald-400'],
                  [t('remaining'), fmt(selected.remaining), 'text-red-400'],
                  [t('monthly_payment'), fmt(selected.monthly_payment), 'text-indigo-400'],
                  [t('months'), selected.months.toString(), 'text-slate-400'],
                ].map(([label, value, color]) => (
                  <div key={label as string} className="bg-slate-900/50 rounded-xl p-3">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{label}</div>
                    <div className={`font-bold text-sm ${color}`}>{value}</div>
                  </div>
                ))}
              </div>

              {selected.status !== 'completed' && (
                <button onClick={() => { setPayAmount(''); setPayNotes(''); setPayModal(true); }}
                  className="w-full bg-emerald-600 rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />{t('register_payment')}
                </button>
              )}

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{t('payment_history')}</h3>
                <div className="space-y-2">
                  {payments.map(p => (
                    <div key={p.id} className="bg-slate-900/30 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-emerald-400">+{fmt(p.amount)}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : ''}{p.notes ? ` — ${p.notes}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                  {payments.length === 0 && <div className="text-xs text-slate-500 text-center py-4">{t('no_data')}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {payModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h3 className="font-bold text-white">{t('register_payment')}</h3>
              <button onClick={() => setPayModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm text-slate-400 font-medium block mb-1.5">{t('amount')}</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" autoFocus />
              </div>
              <div>
                <label className="text-sm text-slate-400 font-medium block mb-1.5">{t('notes')}</label>
                <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setPayModal(false)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button onClick={registerPayment} className="flex-1 bg-emerald-600 rounded-xl py-2.5 text-sm font-bold">{t('confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
