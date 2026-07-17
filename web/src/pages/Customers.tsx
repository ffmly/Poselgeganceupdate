import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, Edit2, Trash2, X, Phone, MapPin, FileText } from 'lucide-react';

export default function Customers() {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });

  useEffect(() => { load(); }, []);
  const load = async () => {
    const snap = await getDocs(query(collection(db, 'customers'), orderBy('name')));
    const list: any[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    setData(list);
  };

  const openEdit = (item: any) => {
    setForm({ name: item.name, phone: item.phone || '', address: item.address || '', notes: item.notes || '' });
    setEditing(item); setModal(true);
  };
  const save = async () => {
    if (!form.name.trim()) return;
    if (editing) await updateDoc(doc(db, 'customers', editing.id), form);
    else await addDoc(collection(db, 'customers'), form);
    setModal(false); load();
  };
  const del = async (item: any) => {
    if (!confirm(t('confirm_delete') + ' "' + item.name + '"?')) return;
    await deleteDoc(doc(db, 'customers', item.id)); load();
  };

  const filtered = data.filter(x =>
    x.name.toLowerCase().includes(search.toLowerCase()) ||
    (x.phone || '').includes(search));

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <button onClick={() => { setForm({ name: '', phone: '', address: '', notes: '' }); setEditing(null); setModal(true); }}
          className="bg-indigo-600 rounded-xl p-2.5"><Plus className="w-5 h-5" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(item => (
          <div key={item.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 hover:border-indigo-500/30 transition-all group">
            <div className="flex items-start justify-between mb-2">
              <div className="font-medium text-sm text-white">{item.name}</div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(item)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => del(item)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {item.phone && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                <Phone className="w-3 h-3" />{item.phone}
              </div>
            )}
            {item.address && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                <MapPin className="w-3 h-3" />{item.address}
              </div>
            )}
            {item.notes && (
              <div className="flex items-start gap-1.5 text-xs text-slate-500 mt-1">
                <FileText className="w-3 h-3 mt-0.5 shrink-0" />{item.notes}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 text-sm">{t('no_data')}</div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold text-white">{editing ? t('edit_customer') : t('add_customer')}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: t('customer_name'), key: 'name', type: 'text' },
                { label: t('phone'), key: 'phone', type: 'text' },
                { label: t('address'), key: 'address', type: 'text' },
                { label: t('notes'), key: 'notes', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                  <input type={f.type} value={form[f.key as keyof typeof form]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setModal(false)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button onClick={save} className="flex-1 bg-indigo-600 rounded-xl py-2.5 text-sm font-medium">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
