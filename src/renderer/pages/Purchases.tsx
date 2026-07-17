import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Trash2, ChevronDown, Search, Printer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { printPurchaseInvoice } from '../utils/invoicePrinter';

interface PurchaseItem { product_id: string; name: string; quantity: number; cost_price: number; subtotal: number; }

export default function Purchases() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [currency, setCurrency] = useState('DZD');
  const [storeName, setStoreName] = useState('');
  const [storeInfo, setStoreInfo] = useState<any>({});
  const [printerInvoice, setPrinterInvoice] = useState('');
  const [modal, setModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [notes, setNotes] = useState('');
  const [expanding, setExpanding] = useState<number | null>(null);
  const [expandItems, setExpandItems] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [p, s, prod, settings] = await Promise.all([
      window.electronAPI.query("SELECT p.*,s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id ORDER BY p.created_at DESC"),
      window.electronAPI.query("SELECT * FROM suppliers ORDER BY name"),
      window.electronAPI.query("SELECT * FROM products ORDER BY name"),
      window.electronAPI.getSettings(),
    ]);
    setPurchases(p || []); setSuppliers(s || []); setProducts(prod || []);
    setCurrency(settings?.currency || 'DZD');
    setStoreName(settings?.store_name || '');
    setStoreInfo({ phone: settings?.store_phone, address: settings?.store_address, logo: settings?.store_logo });
    setPrinterInvoice(settings?.printer_invoice || '');
  };

  const addItem = () => { if (products.length === 0) return; const p = products[0]; setItems(prev => [...prev, { product_id: p.id, name: p.name, quantity: 1, cost_price: 0, subtotal: 0 }]); };
  const updateItem = (idx: number, field: string, val: any) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: val };
      if (field === 'product_id') { const prod = products.find(p => p.id === Number(val)); if (prod) { updated.name = prod.name; } }
      updated.subtotal = updated.cost_price * updated.quantity;
      return updated;
    }));
  };

  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;

  const confirm = async () => {
    if (items.length === 0) return;
    const res = await window.electronAPI.run("INSERT INTO purchases (supplier_id,total,notes,created_by) VALUES(?,?,?,?)", selectedSupplier || null, total, notes || null, user?.id || null);
    const purchase_id = (res as any).lastInsertRowid;
    for (const item of items) {
      await window.electronAPI.run("INSERT INTO purchase_items (purchase_id,product_id,quantity,cost_price,subtotal) VALUES(?,?,?,?,?)",
        purchase_id, item.product_id, item.quantity, item.cost_price, item.subtotal);
    }
    setModal(false); setItems([]); setSelectedSupplier(null); setNotes('');
    load();
  };

  const loadExpand = async (id: number) => {
    if (expanding === id) { setExpanding(null); return; }
    const data = await window.electronAPI.query("SELECT pi.*,p.name FROM purchase_items pi JOIN products p ON pi.product_id=p.id WHERE pi.purchase_id=?", id);
    setExpandItems(data || []); setExpanding(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-5 py-2.5 text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
          <Plus className="w-4 h-4" />{t('add_purchase')}
        </button>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-secondary)]/50">
                <th className="text-start px-8 py-4 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">#</th>
                <th className="text-start px-8 py-4 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('supplier_name')}</th>
                <th className="text-end px-8 py-4 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('total')}</th>
                <th className="text-start px-8 py-4 text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-widest">{t('date')}</th>
                <th className="px-8 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {purchases.map(p => (
                <React.Fragment key={p.id}>
                  <tr className="hover:bg-[var(--bg-secondary)]/30 transition-colors group">
                    <td className="px-8 py-4 text-[var(--text-muted)] font-mono text-xs">#{p.id}</td>
                    <td className="px-8 py-4 text-[var(--text-primary)] font-bold">{p.supplier_name || '-'}</td>
                    <td className="px-8 py-4 text-end text-[var(--text-primary)] font-black text-base">{fmt(p.total)}</td>
                    <td className="px-8 py-4 text-[var(--text-muted)] text-xs font-medium">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-8 py-4 text-end flex items-center justify-end gap-1">
                      <button onClick={async () => {
                        const items = await window.electronAPI.query("SELECT pi.*,p.name as name FROM purchase_items pi JOIN products p ON pi.product_id=p.id WHERE pi.purchase_id=?", p.id);
                        const supplier = p.supplier_name ? { name: p.supplier_name } : null;
                        printPurchaseInvoice({
                          purchaseId: p.id, storeName, storeInfo,
                          supplier, items: items || [], total: p.total,
                          notes: p.notes, currency,
                          date: new Date(p.created_at).toLocaleDateString(),
                          printerName: printerInvoice,
                        });
                      }} className="p-2 text-[var(--text-muted)] hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-all" title={t('print_invoice')}>
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => loadExpand(p.id)} className="p-2 text-[var(--text-muted)] hover:text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-all">
                        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${expanding === p.id ? 'rotate-180 text-indigo-600' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  {expanding === p.id && (
                    <tr key={`ex-${p.id}`}>
                      <td colSpan={5} className="bg-[var(--bg-secondary)]/30 px-8 py-6 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-color)]">
                                <th className="text-start px-4 py-2 font-black uppercase tracking-widest text-[9px] text-[var(--text-muted)]">{t('product')}</th>
                                <th className="text-end px-4 py-2 font-black uppercase tracking-widest text-[9px] text-[var(--text-muted)]">{t('qty')}</th>
                                <th className="text-end px-4 py-2 font-black uppercase tracking-widest text-[9px] text-[var(--text-muted)]">{t('cost_price')}</th>
                                <th className="text-end px-4 py-2 font-black uppercase tracking-widest text-[9px] text-[var(--text-muted)]">{t('total')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                              {expandItems.map((i: any) => (
                                <tr key={i.id}>
                                  <td className="px-4 py-3 font-bold text-[var(--text-primary)]">{i.name}</td>
                                  <td className="px-4 py-3 text-end text-[var(--text-secondary)] font-mono">{i.quantity}</td>
                                  <td className="px-4 py-3 text-end text-[var(--text-secondary)] font-mono">{fmt(i.cost_price)}</td>
                                  <td className="px-4 py-3 text-end text-indigo-600 font-black">{fmt(i.subtotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-[var(--text-muted)]">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-10 h-10 opacity-10" />
                      <p className="font-black uppercase tracking-widest text-xs">{t('no_records_found')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-[var(--text-primary)]/20 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-8 py-5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
              <h2 className="font-black text-[var(--text-primary)] uppercase tracking-tight text-xl">{t('add_purchase')}</h2>
              <button onClick={() => setModal(false)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="p-8 space-y-6 flex-1 overflow-y-auto">
              <div>
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-2">{t('select_supplier')}</label>
                <select 
                  value={selectedSupplier || ''} 
                  onChange={e => setSelectedSupplier(Number(e.target.value) || null)} 
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  <option value="">{t('no_customer')}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{t('products')}</label>
                  <button onClick={addItem} className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-500 uppercase tracking-tighter">
                    <Plus className="w-3.5 h-3.5" />{t('add_item')}
                  </button>
                </div>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_90px_120px_48px] gap-3 items-center bg-[var(--bg-secondary)]/30 p-3 rounded-2xl border border-[var(--border-color)]/50 group hover:border-indigo-500/30 transition-all">
                      <select 
                        value={item.product_id} 
                        onChange={e => updateItem(idx, 'product_id', Number(e.target.value))} 
                        className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                      >
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} 
                        min={1} 
                        placeholder={t('qty')} 
                        className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm font-black text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                      />
                      <input 
                        type="number" 
                        value={item.cost_price} 
                        onChange={e => updateItem(idx, 'cost_price', Number(e.target.value))} 
                        min={0} 
                        placeholder={t('cost_price')} 
                        className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm font-black text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                      />
                      <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 p-2 rounded-xl transition-all">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest text-center py-8 border-2 border-dashed border-[var(--border-color)] rounded-2xl">
                      {t('no_items_added')}
                    </div>
                  )}
                </div>
              </div>

              {items.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                  <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">{t('total_to_pay')}</span>
                  <span className="text-white text-2xl font-black">{fmt(total)}</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-2">{t('notes')}</label>
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  rows={2}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" 
                  placeholder={t('additional_notes')}
                />
              </div>
            </div>
            <div className="flex gap-4 px-8 pb-8 bg-[var(--bg-surface)] border-t border-[var(--border-color)] pt-6">
              <button 
                onClick={() => setModal(false)} 
                className="flex-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl py-3.5 text-sm font-bold hover:bg-[var(--bg-primary)] transition-all border border-[var(--border-color)] active:scale-95"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={confirm} 
                disabled={items.length === 0} 
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-3.5 text-sm font-black shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:active:scale-100"
              >
                {t('confirm_purchase')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
