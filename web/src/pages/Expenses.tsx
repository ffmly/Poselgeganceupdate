import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Wallet, Plus, X, FileText } from 'lucide-react';

export default function Expenses() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState('DZD');
  const [modal, setModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const snap = await getDocs(query(collection(db, 'expenses'), orderBy('created_at', 'desc')));
    const list: any[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    setData(list);
    const sSnap = await getDocs(collection(db, 'settings'));
    sSnap.forEach(d => { if (d.id === 'currency') setCurrency(d.data().value); });
  };

  const handleAdd = async () => {
    if (!amount || Number(amount) <= 0 || !description.trim()) return;
    await addDoc(collection(db, 'expenses'), {
      amount: Number(amount), description: description.trim(),
      created_at: new Date().toISOString(), created_by: user?.id || null,
    });
    setModal(false); setAmount(''); setDescription('');
    load();
  };

  const fmt = (n: number) => (n || 0).toLocaleString() + ' ' + currency;

  const filtered = data.filter(d =>
    (d.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-4 py-2.5 text-sm" />
        </div>
        <button onClick={() => { setAmount(''); setDescription(''); setModal(true); }}
          className="bg-indigo-600 rounded-xl p-2.5"><Plus className="w-5 h-5" /></button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="divide-y divide-slate-700/50">
          {filtered.map(d => (
            <div key={d.id} className="px-4 py-3 flex items-center gap-3">
              <Wallet className="w-5 h-5 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{d.description || '-'}</div>
                <div className="text-xs text-slate-500">{d.created_at ? new Date(d.created_at).toLocaleString() : '-'}</div>
              </div>
              <div className="text-sm font-bold text-red-400">{fmt(d.amount)}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-slate-500 text-sm">{t('no_data')}</div>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-400" />
                <h2 className="font-semibold text-white">{t('add_expense')}</h2>
              </div>
              <button onClick={() => setModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('amount')}</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm" min={0} autoFocus />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t('description')}</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm resize-none" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setModal(false)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button onClick={handleAdd} disabled={!amount || Number(amount) <= 0 || !description.trim()}
                className="flex-1 bg-amber-600 rounded-xl py-2.5 text-sm font-bold disabled:opacity-40">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}