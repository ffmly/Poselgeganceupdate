import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Save, Store, Globe, Phone, MapPin, Building2, Image, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({
    store_name: '', store_phone: '', store_address: '', store_capital: '', store_logo: '',
    currency: 'DZD', language: 'ar',
    label_height_mm: '20', expiry_alert_days: '4',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const snap = await getDocs(collection(db, 'settings'));
    const map: Record<string, string> = {};
    snap.forEach(d => map[d.id] = d.data().value);
    setForm({
      store_name: map.store_name || '',
      store_phone: map.store_phone || '',
      store_address: map.store_address || '',
      store_capital: map.store_capital || '',
      store_logo: map.store_logo || '',
      currency: map.currency || 'DZD',
      language: map.language || 'ar',
      label_height_mm: map.label_height_mm || '20',
      expiry_alert_days: map.expiry_alert_days || '4',
    });
  };

  const save = async () => {
    for (const [k, v] of Object.entries(form)) {
      await setDoc(doc(db, 'settings', k), { value: String(v) });
    }
    i18n.changeLanguage(form.language);
    localStorage.setItem('pos_lang', form.language);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exportToExcel = async () => {
    try {
      const collections = [
        'products', 'sales', 'sale_items', 'purchases', 'purchase_items',
        'customers', 'suppliers', 'expenses', 'cash_movements',
        'installments', 'installment_payments', 'credit_debts', 'debt_payments',
        'product_returns', 'invoices', 'day_closing', 'users', 'settings',
      ];
      const wb = XLSX.utils.book_new();
      for (const name of collections) {
        const snap = await getDocs(collection(db, name));
        const rows: any[] = [];
        snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
      }
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
      alert('Export failed: ' + (e as any).message);
    }
  };

  const languages = [
    { code: 'ar', label: 'العربية' },
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
  ];
  const currencies = ['DZD', 'EUR', 'USD', 'MAD', 'TND'];

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      {/* Store Info */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2 bg-slate-800/80">
          <Store className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-white">{t('store_info')}</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t('store_name')}</label>
            <input type="text" value={form.store_name} onChange={e => setForm({ ...form, store_name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Phone className="w-3 h-3" />{t('phone')}</label>
              <input type="text" value={form.store_phone} onChange={e => setForm({ ...form, store_phone: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Building2 className="w-3 h-3" />{t('capital')}</label>
              <input type="text" value={form.store_capital} onChange={e => setForm({ ...form, store_capital: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><MapPin className="w-3 h-3" />{t('address')}</label>
            <textarea value={form.store_address} onChange={e => setForm({ ...form, store_address: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm resize-none" rows={2} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t('currency')}</label>
            <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm">
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Image className="w-3 h-3" />{t('store_logo')}</label>
            <div className="flex items-center gap-3">
              {form.store_logo ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shrink-0">
                  <img src={form.store_logo} alt="Logo" className="w-full h-full object-contain p-1" />
                  <button onClick={() => setForm({ ...form, store_logo: '' })}
                    className="absolute top-0.5 right-0.5 bg-red-500/80 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">&times;</button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-600 bg-slate-900/50 shrink-0">
                  <Image className="w-6 h-6" />
                </div>
              )}
              <label className="flex-1 flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 rounded-xl py-2.5 text-sm cursor-pointer hover:bg-slate-800">
                <Upload className="w-4 h-4" />{t('upload_logo')}
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    if (dataUrl) setForm({ ...form, store_logo: dataUrl });
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2 bg-slate-800/80">
          <Globe className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-white">{t('language')}</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-2">
            {languages.map(l => (
              <button key={l.code} onClick={() => setForm({ ...form, language: l.code })}
                className={`py-4 rounded-xl border-2 font-bold transition-all ${form.language === l.code ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Other Settings */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2 bg-slate-800/80">
          <Store className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-white">{t('other_settings')}</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 w-32">{t('label_height_mm')}</label>
            <input type="number" min="10" max="60" value={form.label_height_mm}
              onChange={e => setForm({ ...form, label_height_mm: e.target.value })}
              className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-center" />
            <span className="text-xs text-slate-500">mm</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 w-32">{t('expiry_alert_days')}</label>
            <input type="number" min="1" max="90" value={form.expiry_alert_days}
              onChange={e => setForm({ ...form, expiry_alert_days: e.target.value })}
              className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-center" />
            <span className="text-xs text-slate-500">{t('days')}</span>
          </div>
        </div>
      </div>

      {/* Export Data */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2 bg-slate-800/80">
          <Download className="w-5 h-5 text-emerald-400" />
          <h2 className="font-bold text-white">{t('export_data')}</h2>
        </div>
        <div className="p-5 text-center">
          <p className="text-xs text-slate-400 mb-3">{t('export_all_data_desc')}</p>
          <button onClick={exportToExcel}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl py-3 font-bold transition-all active:scale-[0.98]">
            <Download className="w-4 h-4" />{t('export_to_excel')}
          </button>
        </div>
      </div>

      <button onClick={save}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 rounded-2xl py-4 font-bold transition-all active:scale-[0.98]">
        <Save className="w-5 h-5" />{saved ? '✓ ' + t('saved') : t('save_settings')}
      </button>
    </div>
  );
}
