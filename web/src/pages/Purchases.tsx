import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, X, Trash2, ChevronDown } from 'lucide-react';

export default function Purchases() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [currency, setCurrency] = useState('DZD');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [expanding, setExpanding] = useState<string | null>(null);
  const [expandItems, setExpandItems] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const snap = await getDocs(query(collection(db, 'purchases'), orderBy('created_at', 'desc')));
    const list: any[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    setPurchases(list);
    const supSnap = await getDocs(query(collection(db, 'suppliers'), orderBy('name')));
    const sList: any[] = [];
    supSnap.forEach(d => sList.push({ id: d.id, ...d.data() }));
    setSuppliers(sList);
    const prodSnap = await getDocs(query(collection(db, 'products'), orderBy('name')));
    const pList: any[] = [];
    prodSnap.forEach(d => pList.push({ id: d.id, ...d.data() }));
    setProducts(pList);
    const setSnap = await getDocs(collection(db, 'settings'));
    setSnap.forEach(d => { if (d.id === 'currency') setCurrency(d.data().value); });
  };

  const addItem = () => {
    if (products.length === 0) return;
    setItems(prev => [...prev, { product_id: products[0].id, name: products[0].name, quantity: 1, cost_price: 0, subtotal: 0 }]);
  };

  const updateItem = (idx: number, field: string, val: any) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: val };
      if (field === 'product_id') {
        const prod = products.find(p => p.id === val);
        if (prod) updated.name = prod.name;
      }
      updated.subtotal = updated.cost_price * updated.quantity;
      return updated;
    }));
  };

  const total = items.reduce((s: number, i: any) => s + i.subtotal, 0);
  const fmt = (n: number) => (n || 0).toLocaleString() + ' ' + currency;

  const confirm = async () => {
    if (items.length === 0) return;
    const purchaseRef = await addDoc(collection(db, 'purchases'), {
      supplier_id: selectedSupplier || null, total, notes: notes || null,
      created_at: new Date().toISOString(), created_by: user?.id || null,
    });
    for (const item of items) {
      await addDoc(collection(db, 'purchase_items'), {
        purchase_id: purchaseRef.id, product_id: item.product_id,
        quantity: item.quantity, cost_price: item.cost_price, subtotal: item.subtotal,
      });
      const prodRef = doc(db, 'products', item.product_id);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        await updateDoc(prodRef, { stock: (prodSnap.data().stock || 0) + item.quantity });
      }
    }
    setModal(false); setItems([]); setSelectedSupplier(''); setNotes('');
    load();
  };

  const loadExpand = async (id: string) => {
    if (expanding === id) { setExpanding(null); return; }
    const snap = await getDocs(query(collection(db, 'purchase_items'), orderBy('product_id')));
    const list: any[] = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.purchase_id === id) list.push({ id: d.id, ...data });
    });
    const pMap: any = {};
    products.forEach(p => pMap[p.id] = p.name);
    setExpandItems(list.map(i => ({ ...i, name: pMap[i.product_id] || '-' })));
    setExpanding(id);
  };

  const filtered = purchases.filter(p => {
    const supplier = suppliers.find(s => s.id === p.supplier_id);
    return (supplier?.name || '').toLowerCase().includes(search.toLowerCase()) || (p.notes || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-4 py-2.5 text-sm" />
        </div>
        <button onClick={() => setModal(true)} className="bg-indigo-600 rounded-xl p-2.5"><Plus className="w-5 h-5" /></button>
      </div>

      <div className="space-y-2">
        {filtered.map(p => {
          const supplier = suppliers.find(s => s.id === p.supplier_id);
          return (
            <div key={p.id}>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-indigo-500/30 transition-all">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{supplier?.name || '-'}</div>
                  <div className="text-xs text-slate-500">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}</div>
                </div>
                <div className="text-sm font-bold text-emerald-400">{fmt(p.total)}</div>
                <button onClick={() => loadExpand(p.id)} className="p-1.5 text-slate-500 hover:text-indigo-400">
                  <ChevronDown className={`w-5 h-5 transition-transform ${expanding === p.id ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {expanding === p.id && (
                <div className="mx-4 mt-1 bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-800/80">
                        <th className="text-start px-3 py-2 text-slate-500 font-medium">{t('product')}</th>
                        <th className="text-end px-3 py-2 text-slate-500 font-medium">{t('qty')}</th>
                        <th className="text-end px-3 py-2 text-slate-500 font-medium">{t('cost_price')}</th>
                        <th className="text-end px-3 py-2 text-slate-500 font-medium">{t('total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {expandItems.map((i: any) => (
                        <tr key={i.id}>
                          <td className="px-3 py-2 text-white font-medium">{i.name}</td>
                          <td className="px-3 py-2 text-end text-slate-400">{i.quantity}</td>
                          <td className="px-3 py-2 text-end text-slate-400">{fmt(i.cost_price)}</td>
                          <td className="px-3 py-2 text-end text-indigo-400 font-bold">{fmt(i.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">{t('no_data')}</div>}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
              <h2 className="font-semibold text-white">{t('add_purchase')}</h2>
              <button onClick={() => setModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('select_supplier')}</label>
                <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm">
                  <option value="">{t('no_supplier')}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400">{t('products')}</label>
                  <button onClick={addItem} className="text-xs font-medium text-indigo-400 flex items-center gap-1">
                    <Plus className="w-3 h-3" />{t('add_item')}
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_70px_100px_36px] gap-2 items-center bg-slate-900/50 p-2.5 rounded-xl border border-slate-700/50">
                      <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm">
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} min={1}
                        placeholder={t('qty')} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-center" />
                      <input type="number" value={item.cost_price} onChange={e => updateItem(idx, 'cost_price', Number(e.target.value))} min={0}
                        placeholder={t('cost_price')} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-center" />
                      <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-xs text-slate-500 text-center py-6 border-2 border-dashed border-slate-700 rounded-xl">
                      {t('no_items_added')}
                    </div>
                  )}
                </div>
              </div>

              {items.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-indigo-600/20 rounded-xl border border-indigo-500/30">
                  <span className="text-xs font-bold text-indigo-400 uppercase">{t('total_to_pay')}</span>
                  <span className="text-lg font-bold text-white">{fmt(total)}</span>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('notes')}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setModal(false)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button onClick={confirm} disabled={items.length === 0}
                className="flex-1 bg-indigo-600 rounded-xl py-2.5 text-sm font-medium disabled:opacity-40">{t('confirm_purchase')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
