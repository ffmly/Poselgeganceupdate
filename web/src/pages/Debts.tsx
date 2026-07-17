import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Wallet, Filter, Clock, User, Phone, CheckCircle, X, Plus, ArrowLeft } from 'lucide-react';

export default function Debts() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [debts, setDebts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currency, setCurrency] = useState('DZD');
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const snap = await getDocs(query(collection(db, 'credit_debts'), orderBy('created_at', 'desc')));
    const list: any[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    const sSnap = await getDocs(collection(db, 'settings'));
    sSnap.forEach(d => { if (d.id === 'currency') setCurrency(d.data().value); });
    const cSnap = await getDocs(collection(db, 'customers'));
    const cMap: any = {};
    cSnap.forEach(d => cMap[d.id] = d.data());
    setDebts(list.map(d => ({ ...d, customer_name: cMap[d.customer_id]?.name || '-', customer_phone: cMap[d.customer_id]?.phone || '' })));
    if (selectedDebt) {
      const updated = list.find((d: any) => d.id === selectedDebt.id);
      if (updated) setSelectedDebt({ ...updated, customer_name: cMap[updated.customer_id]?.name || '-', customer_phone: cMap[updated.customer_id]?.phone || '' });
    }
  };

  const loadPayments = async (debtId: string) => {
    const snap = await getDocs(query(collection(db, 'credit_debts', debtId, 'payments'), orderBy('payment_date', 'desc')));
    const list: any[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    setPayments(list);
  };

  const fmt = (n: number) => (n || 0).toLocaleString() + ' ' + currency;

  const filtered = debts.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(d.customer_name || '').toLowerCase().includes(q) && !(d.customer_phone || '').includes(q)) return false;
    }
    return true;
  });

  const statusColors: Record<string, string> = {
    active: 'bg-blue-500/10 text-blue-400',
    partial: 'bg-amber-500/10 text-amber-400',
    paid: 'bg-emerald-500/10 text-emerald-400',
    overdue: 'bg-red-500/10 text-red-400',
  };

  const handlePayment = async () => {
    if (!selectedDebt || !paymentAmount || Number(paymentAmount) <= 0) return;
    const remaining = selectedDebt.remaining;
    if (Number(paymentAmount) > remaining) { alert(t('amount_exceeds_remaining')); return; }
    const newRemaining = remaining - Number(paymentAmount);
    const newStatus = newRemaining <= 0 ? 'paid' : newRemaining < selectedDebt.original_amount ? 'partial' : 'active';
    await addDoc(collection(db, 'credit_debts', selectedDebt.id, 'payments'), {
      amount: Number(paymentAmount), notes: paymentNotes || '',
      payment_date: new Date().toISOString(), created_by: user?.id || null,
    });
    await updateDoc(doc(db, 'credit_debts', selectedDebt.id), { remaining: newRemaining, status: newStatus });
    setShowPaymentModal(false); setPaymentAmount(''); setPaymentNotes('');
    await load();
    await loadPayments(selectedDebt.id);
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-4 py-2.5 text-sm" />
        </div>
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm">
          <Filter className="w-4 h-4 text-slate-500" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent text-slate-300 focus:outline-none">
            <option value="all">{t('all')}</option>
            <option value="active">{t('active')}</option>
            <option value="partial">{t('partial')}</option>
            <option value="overdue">{t('overdue')}</option>
            <option value="paid">{t('paid')}</option>
          </select>
        </div>
      </div>

      {selectedDebt ? (
        <div className="space-y-4">
          <button onClick={() => { setSelectedDebt(null); setPayments([]); }} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />{t('back')}
          </button>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">{selectedDebt.customer_name}</h2>
                </div>
                {selectedDebt.customer_phone && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-400 ms-7">
                    <Phone className="w-3.5 h-3.5" />{selectedDebt.customer_phone}
                  </div>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[selectedDebt.status] || ''}`}>
                {t(selectedDebt.status)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-500 mb-1">{t('original_amount')}</div>
                <div className="text-lg font-bold text-white">{fmt(selectedDebt.original_amount)}</div>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-500 mb-1">{t('remaining_debt')}</div>
                <div className="text-lg font-bold text-amber-400">{fmt(selectedDebt.remaining)}</div>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-500 mb-1">{t('paid')}</div>
                <div className="text-lg font-bold text-emerald-400">{fmt(selectedDebt.original_amount - selectedDebt.remaining)}</div>
              </div>
            </div>
            {selectedDebt.remaining > 0 && (
              <button onClick={() => { setPaymentAmount(''); setPaymentNotes(''); setShowPaymentModal(true); }}
                className="mt-4 w-full bg-indigo-600 rounded-xl py-3 font-bold flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />{t('register_debt_payment')}
              </button>
            )}
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-white">{t('payment_history')}</h3>
            </div>
            <div className="divide-y divide-slate-700/50">
              {payments.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-emerald-400">+{fmt(p.amount)}</div>
                    <div className="text-xs text-slate-500">{p.payment_date ? new Date(p.payment_date).toLocaleString() : '-'}{p.notes ? ` — ${p.notes}` : ''}</div>
                  </div>
                </div>
              ))}
              {payments.length === 0 && <div className="px-5 py-8 text-center text-slate-500 text-sm">{t('no_data')}</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <div key={d.id} onClick={() => { setSelectedDebt(d); loadPayments(d.id); }}
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3 hover:border-indigo-500/30 cursor-pointer transition-all">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white">{d.customer_name}</div>
                  <div className="text-xs text-slate-500">{d.customer_phone || '-'}</div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-bold text-amber-400">{fmt(d.remaining)}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[d.status] || ''}`}>{t(d.status)}</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">{t('no_data')}</div>}
        </div>
      )}

      {showPaymentModal && selectedDebt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold text-white">{t('register_debt_payment')}</h2>
              </div>
              <button onClick={() => setShowPaymentModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-500/10 rounded-xl px-4 py-3 text-center border border-amber-500/20">
                <div className="text-xs text-amber-400 font-medium uppercase">{t('remaining_debt')}</div>
                <div className="text-2xl font-black text-amber-400 mt-1">{fmt(selectedDebt.remaining)}</div>
              </div>
              <div>
                <label className="text-sm text-slate-400 font-medium block mb-1.5">{t('amount')}</label>
                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500" min={0} autoFocus />
              </div>
              <div>
                <label className="text-sm text-slate-400 font-medium block mb-1.5">{t('notes')}</label>
                <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowPaymentModal(false)} className="flex-1 bg-slate-700 rounded-xl py-2.5 font-medium">{t('cancel')}</button>
              <button onClick={handlePayment} disabled={!paymentAmount || Number(paymentAmount) <= 0}
                className="flex-1 bg-emerald-600 rounded-xl py-2.5 font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />{t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
