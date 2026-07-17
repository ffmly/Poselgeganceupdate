import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, Edit2, Trash2, AlertTriangle, X, Printer, RefreshCw } from 'lucide-react';

interface Product { id: string; name: string; barcode?: string; price_purchase: number; price_cash: number; stock: number; fabrication_date?: string; expiry_date?: string; }

export default function Products() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<any>({ name: '', barcode: '', price_purchase: 0, price_cash: 0, stock: 0, fabrication_date: '', expiry_date: '' });
  const [currency, setCurrency] = useState('DZD');
  const [storeName, setStoreName] = useState('');
  const [alertDays, setAlertDays] = useState(4);
  const [printCount, setPrintCount] = useState(1);
  const [printModal, setPrintModal] = useState<Product | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('name')));
    const list: Product[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() as any }));
    setProducts(list);
    const sSnap = await getDocs(collection(db, 'settings'));
    sSnap.forEach(d => {
      if (d.id === 'currency') setCurrency(d.data().value);
      if (d.id === 'store_name') setStoreName(d.data().value);
      if (d.id === 'expiry_alert_days') setAlertDays(Number(d.data().value) || 4);
    });
  };

  const openAdd = async () => {
    const maxSnap = await getDocs(query(collection(db, 'products'), orderBy('barcode', 'desc')));
    let nextId = 1;
    maxSnap.forEach(d => { const bc = d.data().barcode; if (bc) nextId = Math.max(nextId, parseInt(bc) + 1); });
    setForm({ name: '', barcode: String(nextId).padStart(6, '0'), price_purchase: 0, price_cash: 0, stock: 0, fabrication_date: '', expiry_date: '' });
    setEditing(null);
    setModal(true);
  };

  const openEdit = (p: Product) => {
    setForm({ name: p.name, barcode: p.barcode || '', price_purchase: p.price_purchase, price_cash: p.price_cash, stock: p.stock, fabrication_date: p.fabrication_date || '', expiry_date: p.expiry_date || '' });
    setEditing(p);
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    try {
      if (form.barcode) {
        const q = query(collection(db, 'products'), where('barcode', '==', form.barcode));
        const snap = await getDocs(q);
        const dup = snap.docs.find(d => editing ? d.id !== editing.id : true);
        if (dup) { alert(t('barcode_duplicate')); return; }
      }
      if (editing) {
        await updateDoc(doc(db, 'products', editing.id), form);
      } else {
        await addDoc(collection(db, 'products'), form);
      }
      setModal(false);
      load();
    } catch (e) { console.error(e); }
  };

  const del = async (p: Product) => {
    if (!confirm(t('confirm_delete') + ' "' + p.name + '"?')) return;
    await deleteDoc(doc(db, 'products', p.id));
    load();
  };

  const doPrint = async (p: Product, count: number) => {
    const mod = await import('jsbarcode');
    const JsBarcode = mod.default;
    const priceStr = (p.price_cash || 0).toLocaleString() + ' ' + currency;
    const dpm = 8;
    const px = (mm: number) => Math.round(mm * dpm);
    const labelWmm = 40, labelHmm = 20;
    const labelW = px(labelWmm), labelH = px(labelHmm);
    const bc = document.createElement('canvas');
    JsBarcode(bc, p.barcode || String(p.id).padStart(8, '0'), { format: 'CODE128', width: 2, height: 60, displayValue: false, margin: 3 });
    const m = px(1);
    const c = document.createElement('canvas');
    c.width = labelW; c.height = labelH;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, labelW, labelH);
    ctx.fillStyle = '#000000';
    const priceAreaH = px(3), storeAreaH = px(9);
    const bcAreaH = labelH - priceAreaH - storeAreaH;
    const bcAreaW = labelW - m * 2;
    const s = Math.min(bcAreaW / bc.width, bcAreaH / bc.height);
    ctx.save();
    ctx.translate(labelW / 2, priceAreaH + (bc.height * s) / 2);
    ctx.scale(s, s);
    ctx.drawImage(bc, -bc.width / 2, -bc.height / 2);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.font = `bold ${px(2.5)}px sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.fillText(priceStr, m, priceAreaH);
    ctx.font = `bold ${px(2.5)}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(storeName || 'Store', m, labelH - storeAreaH + m);
    const url = c.toDataURL('image/png');
    let imgs = '';
    for (let i = 0; i < count; i++) imgs += `<img src="${url}" style="display:block;width:${labelWmm}mm;height:${labelHmm}mm;" />`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>*{margin:0;padding:0}html,body{width:${labelWmm}mm;margin:0;padding:0;background:#fff}</style></head><body>${imgs}</body></html>`);
      win.document.close();
      win.print();
    }
    setPrintModal(null);
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || '').includes(search));

  const fmt = (n: number) => (n || 0).toLocaleString() + ' ' + currency;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <button onClick={openAdd} className="bg-indigo-600 rounded-xl p-2.5">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="divide-y divide-slate-700/50">
          {filtered.map(p => {
            const days = p.expiry_date ? Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000) : 99;
            return (
              <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {p.barcode && <span className="font-mono">{p.barcode}</span>}
                    {p.expiry_date && (
                      <span className={`ms-2 ${days <= alertDays ? 'text-red-400' : 'text-slate-500'}`}>
                        {p.expiry_date}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-medium text-emerald-400">{fmt(p.price_cash)}</div>
                  <div className="text-xs text-slate-500">{t('purchase')}: {fmt(p.price_purchase)}</div>
                  <div className={`text-xs ${p.stock <= 0 ? 'text-red-400' : 'text-slate-500'}`}>
                    {p.stock <= 0 ? t('out_of_stock') : p.stock + ' ' + t('stock')}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setPrintCount(1); setPrintModal(p); }} className="p-2 text-slate-500 hover:text-indigo-400"><Printer className="w-4 h-4" /></button>
                  <button onClick={() => openEdit(p)} className="p-2 text-slate-500 hover:text-white"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => del(p)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="px-4 py-12 text-center text-slate-500 text-sm">{t('no_data')}</div>}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold">{editing ? t('edit_product') : t('add_product')}</h2>
              <button onClick={() => setModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: t('product_name'), key: 'name', type: 'text' },
                { label: t('barcode'), key: 'barcode', type: 'text' },
                { label: t('purchase_price'), key: 'price_purchase', type: 'number' },
                { label: t('selling_price'), key: 'price_cash', type: 'number' },
                { label: t('stock'), key: 'stock', type: 'number' },
                { label: t('fabrication_date'), key: 'fabrication_date', type: 'date' },
                { label: t('expiry_date'), key: 'expiry_date', type: 'date' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                  <div className="flex gap-2">
                    <input type={f.type} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="flex-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    {f.key === 'barcode' && (
                      <button type="button" onClick={async () => {
                        let next: string;
                        let tries = 0;
                        do {
                          next = String(Math.floor(Math.random() * 900000) + 100000);
                          const q = query(collection(db, 'products'), where('barcode', '==', next));
                          const snap = await getDocs(q);
                          if (snap.empty) break;
                          tries++;
                        } while (tries < 10);
                        setForm({ ...form, barcode: next });
                      }} className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium flex items-center gap-1.5" title={t('generate_barcode')}>
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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

      {printModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xs">
            <div className="px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold">{t('print_barcode')}</h2>
            </div>
            <div className="p-5">
              <label className="block text-xs text-slate-400 mb-2">{t('how_many_labels')}</label>
              <input type="number" min={1} value={printCount} onChange={e => setPrintCount(Math.max(1, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setPrintModal(null)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button onClick={() => doPrint(printModal, printCount)} className="flex-1 bg-indigo-600 rounded-xl py-2.5 text-sm font-medium">{t('print')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
