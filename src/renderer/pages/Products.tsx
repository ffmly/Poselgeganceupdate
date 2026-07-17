import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Trash2, AlertTriangle, X, Printer, RefreshCw } from 'lucide-react';

interface Product { id: string; name: string; barcode?: string; price_purchase: number; price_cash: number; price_credit: number; stock: number; fabrication_date?: string; expiry_date?: string; }
const empty: Omit<Product, 'id'> = { name: '', barcode: '', price_purchase: 0, price_cash: 0, price_credit: 0, stock: 0, fabrication_date: '', expiry_date: '' };

export default function Products() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id'>>(empty);
  const [currency, setCurrency] = useState('DZD');
  const [storeName, setStoreName] = useState('');
  const [printerBarcode, setPrinterBarcode] = useState('');
  const [printCountModal, setPrintCountModal] = useState<Product | null>(null);
  const [printCount, setPrintCount] = useState(1);
  const [alertDays, setAlertDays] = useState(4);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const data = await window.electronAPI.query("SELECT * FROM products ORDER BY name");
    setProducts(data || []);
    const s = await window.electronAPI.getSettings();
    setCurrency(s?.currency || 'DZD');
    setStoreName(s?.store_name || '');
    setPrinterBarcode(s?.printer_barcode || '');
    setAlertDays(Number(s?.expiry_alert_days) || 4);
  };

  const openAdd = async () => {
    const maxResult = await window.electronAPI.query("SELECT COALESCE(MAX(CAST(barcode AS INTEGER)), 0) + 1 AS next_id FROM products WHERE barcode IS NOT NULL AND barcode != '' AND barcode GLOB '[0-9]*'");
    const nextId = (maxResult?.[0]?.next_id) || 1;
    setForm({ ...empty, barcode: String(nextId).padStart(6, '0') });
    setEditing(null);
    setModal(true);
  };
  const openEdit = (p: Product) => { setForm({ name: p.name, barcode: p.barcode || '', price_purchase: p.price_purchase, price_cash: p.price_cash, price_credit: p.price_credit, stock: p.stock, fabrication_date: p.fabrication_date || '', expiry_date: p.expiry_date || '' }); setEditing(p); setModal(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    if (form.barcode) {
      const dup = editing
        ? await window.electronAPI.get("SELECT id FROM products WHERE barcode=? AND id!=?", form.barcode, editing.id)
        : await window.electronAPI.get("SELECT id FROM products WHERE barcode=?", form.barcode);
      if (dup) { alert(t('barcode_duplicate')); return; }
    }
    if (editing) {
      await window.electronAPI.run("UPDATE products SET name=?,barcode=?,price_purchase=?,price_cash=?,price_credit=?,stock=?,fabrication_date=?,expiry_date=? WHERE id=?",
        form.name, form.barcode || null, form.price_purchase, form.price_cash, form.price_credit, form.stock, form.fabrication_date || null, form.expiry_date || null, editing.id);
    } else {
      const result = await window.electronAPI.run("INSERT INTO products (name,barcode,price_purchase,price_cash,price_credit,stock,fabrication_date,expiry_date) VALUES(?,?,?,?,?,?,?,?)",
        form.name, form.barcode || null, form.price_purchase, form.price_cash, form.price_credit, form.stock, form.fabrication_date || null, form.expiry_date || null);
      if (result?.lastInsertRowid && !form.barcode) {
        const barcode = String(Number(result.lastInsertRowid)).padStart(6, '0');
        await window.electronAPI.run("UPDATE products SET barcode=? WHERE id=?", barcode, result.lastInsertRowid);
      }
    }
    setModal(false); load();
  };

  const del = async (p: Product) => {
    if (!confirm(`${t('confirm_delete')} "${p.name}"?`)) return;
    await window.electronAPI.run("DELETE FROM products WHERE id=?", p.id);
    load();
  };

  const printBarcode = async (p: Product) => {
    setPrintCount(1);
    setPrintCountModal(p);
  };

  const doPrint = async (p: Product, count: number) => {
    const barcodeValue = p.barcode || String(p.id).padStart(8, '0');
    const mod = await import('jsbarcode');
    const JsBarcode = mod.default;
    const priceStr = p.price_cash.toLocaleString() + ' ' + currency;

    if (!printerBarcode) { alert('No barcode printer configured'); return; }

    const dpm = 8;
    const px = (mm: number) => Math.round(mm * dpm);

    const labelWmm = 40;
    const labelHmm = 20;
    const labelW = px(labelWmm);
    const labelH = px(labelHmm);

    const bc = document.createElement('canvas');
    JsBarcode(bc, barcodeValue, { format: 'CODE128', width: 2, height: 60, displayValue: false, margin: 3 });

    const bcW = bc.width;
    const bcH = bc.height;
    const m = px(1);

    const c = document.createElement('canvas');
    c.width = labelW;
    c.height = labelH;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, labelW, labelH);
    ctx.fillStyle = '#000000';

    const priceAreaH = px(3);
    const storeAreaH = px(9);
    const bcAreaY = priceAreaH;
    const bcAreaH = labelH - priceAreaH - storeAreaH;
    const bcAreaW = labelW - m * 2;

    const s = Math.min(bcAreaW / bcW, bcAreaH / bcH);

    ctx.save();
    ctx.translate(labelW / 2, bcAreaY + (bcH * s) / 2);
    ctx.scale(s, s);
    ctx.drawImage(bc, -bcW / 2, -bcH / 2);
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
    for (let i = 0; i < count; i++) {
      imgs += `<img src="${url}" style="display:block;width:${labelWmm}mm;height:${labelHmm}mm;" />`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>
        * { margin: 0; padding: 0; }
        html, body { width: ${labelWmm}mm; margin: 0; padding: 0; background: #fff; }
      </style></head><body>${imgs}</body></html>`;

    const totalH = labelHmm * count;
    const ps = { width: labelWmm * 1000, height: totalH * 1000 };
    const result = await window.electronAPI.printToPrinter(html, printerBarcode, ps, false, count);
    if (!result.success) alert(result.error || 'Print failed');
    setPrintCountModal(null);
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search));
  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl ps-9 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-all shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" />{t('add_product')}
        </button>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[var(--bg-secondary)]/50">
              <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('product_name')}</th>
              <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('barcode')}</th>
              <th className="text-end px-6 py-3 text-[var(--text-secondary)] font-medium">{t('purchase_price')}</th>
              <th className="text-end px-6 py-3 text-[var(--text-secondary)] font-medium">{t('selling_price')}</th>
              <th className="text-end px-6 py-3 text-[var(--text-secondary)] font-medium">{t('stock')}</th>
              <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('expiry_date')}</th>
              <th className="text-center px-6 py-3 text-[var(--text-secondary)] font-medium">{t('actions')}</th>
            </tr></thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                  <td className="px-6 py-3 text-[var(--text-primary)] font-medium">{p.name}</td>
                  <td className="px-6 py-3 text-[var(--text-primary)] font-mono text-sm font-medium">{p.barcode || <span className="text-[var(--text-muted)]">-</span>}</td>
                  <td className="px-6 py-3 text-end text-amber-600 dark:text-amber-400">{fmt(p.price_purchase)}</td>
                  <td className="px-6 py-3 text-end text-emerald-600 dark:text-emerald-400">{fmt(p.price_cash)}</td>
                  <td className="px-6 py-3 text-end">
                    <span className={`font-semibold ${p.stock <= 0 ? 'text-red-500' : p.stock <= 3 ? 'text-amber-500' : 'text-[var(--text-primary)]'}`}>
                      {p.stock <= 0 ? <><AlertTriangle className="w-3 h-3 inline me-1" />{t('out_of_stock')}</> : p.stock}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {p.expiry_date ? (() => {
                      const days = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000);
                      const cls = days <= alertDays ? 'text-red-500 font-bold' : days <= 14 ? 'text-amber-500' : 'text-[var(--text-muted)]';
                      return <span className={cls}>{p.expiry_date}{days <= alertDays && <AlertTriangle className="w-3 h-3 inline ms-1" />}</span>;
                    })() : <span className="text-[var(--text-muted)]">-</span>}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => printBarcode(p)} className="p-2 text-[var(--text-muted)] hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all" title={t('print_barcode')}><Printer className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(p)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => del(p)} className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)]">{t('no_data')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <h2 className="font-semibold text-[var(--text-primary)]">{editing ? t('edit_product') : t('add_product')}</h2>
              <button onClick={() => setModal(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: t('product_name'), key: 'name', type: 'text', required: true },
                { label: t('barcode'), key: 'barcode', type: 'text' },
                { label: t('purchase_price'), key: 'price_purchase', type: 'number' },
                { label: t('selling_price'), key: 'price_cash', type: 'number' },
                { label: t('stock'), key: 'stock', type: 'number' },
                { label: t('fabrication_date'), key: 'fabrication_date', type: 'date' },
                { label: t('expiry_date'), key: 'expiry_date', type: 'date' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm text-[var(--text-secondary)] font-medium mb-1.5">{field.label}</label>
                  <div className="flex gap-2">
                    <input
                      type={field.type}
                      value={(form as any)[field.key]}
                      onChange={e => setForm({ ...form, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner transition-all"
                      min={field.type === 'number' ? 0 : undefined}
                    />
                    {field.key === 'barcode' && (
                      <button type="button" onClick={async () => {
                        let next: string;
                        let tries = 0;
                        do {
                          next = String(Math.floor(Math.random() * 900000) + 100000);
                          const dup = await window.electronAPI.get("SELECT id FROM products WHERE barcode=?", next);
                          if (!dup) break;
                          tries++;
                        } while (tries < 10);
                        setForm({ ...form, barcode: next });
                      }} className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5" title={t('generate_barcode')}>
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModal(false)} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-2.5 text-sm font-medium transition-all">{t('cancel')}</button>
              <button onClick={save} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-medium transition-all shadow-lg shadow-indigo-500/20">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {printCountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <h2 className="font-semibold text-[var(--text-primary)]">{t('print_barcode')}</h2>
              <button onClick={() => setPrintCountModal(null)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm text-[var(--text-secondary)] font-medium mb-1.5">{t('how_many_labels')}</label>
              <input type="number" min={1} max={999} value={printCount} onChange={e => setPrintCount(Math.max(1, Number(e.target.value)))}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner transition-all text-center text-lg font-bold" />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setPrintCountModal(null)} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-2.5 text-sm font-medium transition-all">{t('cancel')}</button>
              <button onClick={() => doPrint(printCountModal, printCount)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-medium transition-all shadow-lg shadow-indigo-500/20">{t('print')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}