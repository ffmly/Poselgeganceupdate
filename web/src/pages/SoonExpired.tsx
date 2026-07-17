import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Search } from 'lucide-react';

export default function SoonExpired() {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [alertDays, setAlertDays] = useState(4);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const setSnap = await getDocs(collection(db, 'settings'));
    setSnap.forEach(d => { if (d.id === 'expiry_alert_days') setAlertDays(Number(d.data().value) || 4); });

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + alertDays);
    const endDateStr = endDate.toISOString().split('T')[0];

    const pSnap = await getDocs(query(
      collection(db, 'products'),
      where('expiry_date', '>=', now.toISOString().split('T')[0]),
      where('expiry_date', '<=', endDateStr),
      orderBy('expiry_date')
    ));
    const list: any[] = [];
    pSnap.forEach(d => {
      const p = d.data();
      const days = Math.ceil((new Date(p.expiry_date).getTime() - now.getTime()) / 86400000);
      list.push({ id: d.id, ...p, days, stock: p.stock || 0, price_cash: p.price_cash || 0 });
    });
    setData(list);
  };

  const fmt = (n: number) => (n || 0).toLocaleString();
  const filtered = data.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 pb-8">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-4 py-2.5 text-sm" />
      </div>
      <div className="space-y-2">
        {filtered.map(p => (
          <div key={p.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${p.days === 0 ? 'bg-red-900/50 text-red-400' : p.days <= 2 ? 'bg-amber-900/50 text-amber-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
              {p.days}d
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{p.name}</div>
              <div className="text-xs text-slate-500">{t('expiry_date')}: {p.expiry_date} | {t('stock')}: {fmt(p.stock)}</div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">{t('no_data')}</div>}
      </div>
    </div>
  );
}
