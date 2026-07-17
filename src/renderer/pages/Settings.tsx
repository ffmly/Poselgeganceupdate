import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Store, Globe, Database, Phone, MapPin, Building2, Printer, ToggleLeft, Image as ImageIcon, Upload, Download, RefreshCw, ArrowUpCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PrinterInfo {
  name: string;
  displayName: string;
  status: number;
  isDefault: boolean;
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({
    store_name: '', store_phone: '', store_address: '', store_capital: '', store_logo: '',
    currency: 'DZD', language: 'ar', theme: 'dark',
    printer_barcode: '', printer_receipt: '', printer_invoice: '',
    auto_print_receipt: '1',
    label_height_mm: '20',
    expiry_alert_days: '4',
  });
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [manualPrinterNames, setManualPrinterNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
    loadPrinters();
  }, []);

  const loadSettings = async () => {
    const s = await window.electronAPI.getSettings();
    if (s) {
      setForm({
        store_name: s.store_name || '',
        store_phone: s.store_phone || '',
        store_address: s.store_address || '',
        store_capital: s.store_capital || '',
        store_logo: s.store_logo || '',
        currency: s.currency || 'DZD',
        language: s.language || 'ar',
        theme: s.theme || 'dark',
        printer_barcode: s.printer_barcode || '',
        printer_receipt: s.printer_receipt || '',
        printer_invoice: s.printer_invoice || '',
        auto_print_receipt: s.auto_print_receipt || '1',
        label_height_mm: s.label_height_mm || '20',
        expiry_alert_days: s.expiry_alert_days || '4',
      });
    }
  };

  const loadPrinters = async () => {
    setLoadingPrinters(true);
    const p = await window.electronAPI.getPrinters();
    setPrinters(p || []);
    setLoadingPrinters(false);
  };

  const save = async () => {
    for (const [k, v] of Object.entries(form)) {
      await window.electronAPI.setSetting(k, String(v));
    }
    i18n.changeLanguage(form.language);
    localStorage.setItem('pos_lang', form.language);
    document.documentElement.dir = form.language === 'ar' ? 'rtl' : 'ltr';
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exportToExcel = async () => {
    const path = await window.electronAPI.showSaveDialog(`pos-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    if (!path) return;
    try {
      const tables: Record<string, string> = {
        Products: 'SELECT * FROM products ORDER BY name',
        Sales: 'SELECT * FROM sales ORDER BY created_at DESC',
        SaleItems: 'SELECT * FROM sale_items ORDER BY sale_id',
        Purchases: 'SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id ORDER BY p.created_at DESC',
        PurchaseItems: 'SELECT * FROM purchase_items ORDER BY purchase_id',
        Customers: 'SELECT * FROM customers ORDER BY name',
        Suppliers: 'SELECT * FROM suppliers ORDER BY name',
        Expenses: 'SELECT * FROM expenses ORDER BY created_at DESC',
        CashMovements: 'SELECT * FROM cash_movements ORDER BY created_at DESC',
        Installments: 'SELECT i.*, c.name as customer_name, c.phone as customer_phone FROM installments i LEFT JOIN customers c ON i.customer_id=c.id ORDER BY i.created_at DESC',
        InstallmentPayments: 'SELECT * FROM installment_payments ORDER BY payment_date DESC',
        CreditDebts: 'SELECT cd.*, c.name as customer_name FROM credit_debts cd LEFT JOIN customers c ON cd.customer_id=c.id ORDER BY cd.created_at DESC',
        DebtPayments: 'SELECT * FROM debt_payments ORDER BY payment_date DESC',
        ProductReturns: 'SELECT * FROM product_returns ORDER BY created_at DESC',
        Invoices: 'SELECT * FROM invoices ORDER BY created_at DESC',
        DayClosing: 'SELECT * FROM day_closing ORDER BY closed_at DESC',
        Users: 'SELECT * FROM users ORDER BY username',
      };
      const wb = XLSX.utils.book_new();
      for (const [name, sql] of Object.entries(tables)) {
        const data = await window.electronAPI.query(sql);
        const ws = XLSX.utils.json_to_sheet(data || []);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const result = await window.electronAPI.writeFile(path, b64);
      if (result.success) {
        setMessage({ type: 'success', text: t('export_success') });
      } else {
        setMessage({ type: 'error', text: t('export_error') + ': ' + result.error });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: t('export_error') + ': ' + e.message });
    }
  };

  const testPrinter = async (printerName: string) => {
    const testHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{font-family:Arial;padding:20px;text-align:center}h1{color:#4f46e5}p{color:#666}</style></head><body><h1>Test Print</h1><p>If you see this, your printer is working correctly!</p><p>${new Date().toLocaleString()}</p></body></html>`;
    const r = await window.electronAPI.printToPrinter(testHtml, printerName);
    if (r.success) {
      setMessage({ type: 'success', text: t('print_test_sent') });
    } else {
      setMessage({ type: 'error', text: t('print_test_failed') + (r.error ? ': ' + r.error : '') });
    }
  };

  const languages = [{ code: 'ar', label: 'العربية' }, { code: 'fr', label: 'Français' }, { code: 'en', label: 'English' }];
  const currencies = ['DZD', 'EUR', 'USD', 'MAD', 'TND'];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Store Info */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-2 bg-[var(--bg-secondary)]/30">
          <Store className="w-5 h-5 text-indigo-500" />
          <h2 className="font-bold text-[var(--text-primary)]">{t('store_info')}</h2>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-sm text-[var(--text-secondary)] font-medium block mb-2">{t('store_name')}</label>
            <input type="text" value={form.store_name} onChange={e => setForm({ ...form, store_name: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[var(--text-secondary)] font-medium block mb-2 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{t('phone')}</label>
              <input type="text" value={form.store_phone} onChange={e => setForm({ ...form, store_phone: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner transition-all" />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] font-medium block mb-2 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{t('capital')}</label>
              <input type="text" value={form.store_capital} onChange={e => setForm({ ...form, store_capital: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner transition-all" />
            </div>
          </div>
          <div>
            <label className="text-sm text-[var(--text-secondary)] font-medium block mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{t('address')}</label>
            <textarea value={form.store_address} onChange={e => setForm({ ...form, store_address: e.target.value })} rows={2} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner transition-all resize-none" />
          </div>
          <div>
            <label className="text-sm text-[var(--text-secondary)] font-medium block mb-2">{t('currency')}</label>
            <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition-all appearance-none cursor-pointer">
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-[var(--text-secondary)] font-medium block mb-2 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" />{t('store_logo')}</label>
            <div className="flex items-center gap-4">
              {form.store_logo ? (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] flex-shrink-0">
                  <img src={form.store_logo} alt="Logo" className="w-full h-full object-contain p-2" />
                  <button onClick={() => setForm({ ...form, store_logo: '' })} className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors">&times;</button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] bg-[var(--bg-secondary)]/30 flex-shrink-0">
                  <ImageIcon className="w-8 h-8 opacity-30" />
                </div>
              )}
              <label className="flex-1 flex items-center justify-center gap-2 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl py-3 font-medium cursor-pointer transition-all active:scale-[0.98]">
                <Upload className="w-4 h-4" />
                {t('upload_logo')}
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
            {form.store_logo && (
              <p className="text-xs text-[var(--text-muted)] mt-1.5">{t('logo_preview')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Language & Theme */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-2 bg-[var(--bg-secondary)]/30">
          <Globe className="w-5 h-5 text-indigo-500" />
          <h2 className="font-bold text-[var(--text-primary)]">{t('language')} / {t('theme')}</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {languages.map(l => (
              <button key={l.code} onClick={() => setForm({ ...form, language: l.code })}
                className={`py-6 rounded-2xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${form.language === l.code ? 'border-indigo-600 bg-indigo-600/5 text-indigo-600 shadow-lg shadow-indigo-500/10 scale-[1.02]' : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-indigo-400/50 hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}`}>
                <span className="text-xl">{l.code === 'ar' ? '🇸🇦' : l.code === 'fr' ? '🇫🇷' : '🇺🇸'}</span>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Printer Configuration */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-2 bg-[var(--bg-secondary)]/30">
          <Printer className="w-5 h-5 text-indigo-500" />
          <h2 className="font-bold text-[var(--text-primary)]">{t('printer_config')}</h2>
          <button onClick={loadPrinters} className="ml-auto text-xs text-indigo-500 hover:text-indigo-400 font-medium flex items-center gap-1">
            <Printer className="w-3 h-3" /> {t('refresh_printers')}
          </button>
        </div>
        <div className="p-6 space-y-5">
          {loadingPrinters ? (
            <div className="text-center text-[var(--text-muted)] text-sm py-4">{t('loading')}</div>
          ) : printers.length === 0 ? (
            <div className="text-center text-[var(--text-muted)] text-sm py-4 bg-amber-500/10 rounded-xl border border-amber-500/20 px-4 py-3">
              {t('no_printers_found')}
            </div>
          ) : (
            <div className="bg-[var(--bg-secondary)] rounded-xl p-3 space-y-1 max-h-32 overflow-y-auto">
              {printers.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5">
                  <span className="text-[var(--text-primary)] font-medium">{p.displayName || p.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {p.status === 0 ? '✓ ' + t('ready') : t('offline')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <ToggleLeft className="w-4 h-4 text-indigo-500" />
              {t('printer_assignment')}
            </h3>
            {[
              { key: 'printer_receipt', label: t('receipt_printer') },
              { key: 'printer_invoice', label: t('invoice_printer') },
              { key: 'printer_barcode', label: t('barcode_printer') },
            ].map(pc => (
              <div key={pc.key}>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[var(--text-secondary)] font-medium w-40">{pc.label}</label>
                  <div className="flex-1 flex items-center gap-2">
                    <select
                      value={(form as any)[pc.key] || ''}
                      onChange={e => setForm({ ...form, [pc.key]: e.target.value })}
                      className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition-all appearance-none cursor-pointer"
                    >
                      <option value="">{t('default_printer')}</option>
                      {printers.map((p, i) => (
                        <option key={i} value={p.name}>{p.displayName || p.name}</option>
                      ))}
                      <option value="__manual__">{t('manual_entry')}...</option>
                    </select>
                    {(form as any)[pc.key] && (form as any)[pc.key] !== '__manual__' && (
                      <button onClick={() => testPrinter((form as any)[pc.key])} className="text-xs text-indigo-500 hover:text-indigo-400 font-medium whitespace-nowrap flex-shrink-0">
                        {t('test_print')}
                      </button>
                    )}
                  </div>
                </div>
                {(form as any)[pc.key] === '__manual__' && (
                  <div className="flex items-center gap-3 mt-2 ml-[10.5rem]">
                    <input
                      type="text"
                      value={manualPrinterNames[pc.key] || ''}
                      onChange={e => {
                        setManualPrinterNames({ ...manualPrinterNames, [pc.key]: e.target.value });
                        setForm({ ...form, [pc.key]: e.target.value });
                      }}
                      placeholder={t('printer_placeholder')}
                      className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition-all"
                    />
                    {manualPrinterNames[pc.key] && (
                      <button onClick={() => testPrinter(manualPrinterNames[pc.key])} className="text-xs text-indigo-500 hover:text-indigo-400 font-medium whitespace-nowrap flex-shrink-0">
                        {t('test_print')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-[var(--text-secondary)] font-medium w-40">{t('label_height_mm')}</label>
            <input type="number" min="10" max="60" value={form.label_height_mm}
              onChange={e => setForm({ ...form, label_height_mm: e.target.value })}
              className="w-24 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition-all"
            />
            <span className="text-xs text-[var(--text-muted)]">mm ({t('restart_required')})</span>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-[var(--border-color)]">
            <label className="text-sm text-[var(--text-secondary)] font-medium">{t('auto_print_receipt')}</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.auto_print_receipt === '1'} onChange={e => setForm({ ...form, auto_print_receipt: e.target.checked ? '1' : '0' })} className="sr-only peer" />
              <div className="w-11 h-6 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
            <span className="text-xs text-[var(--text-muted)]">{form.auto_print_receipt === '1' ? t('enabled') : t('disabled')}</span>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-[var(--border-color)]">
            <label className="text-sm text-[var(--text-secondary)] font-medium w-40">{t('expiry_alert_days')}</label>
            <input type="number" min="1" max="90" value={form.expiry_alert_days}
              onChange={e => setForm({ ...form, expiry_alert_days: e.target.value })}
              className="w-24 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition-all"
            />
            <span className="text-xs text-[var(--text-muted)]">{t('days')}</span>
          </div>
        </div>
      </div>

      {message && (
        <div className={`px-6 py-4 rounded-2xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
          {message.text}
        </div>
      )}

      {/* Export Data */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-2 bg-[var(--bg-secondary)]/30">
          <Download className="w-5 h-5 text-indigo-500" />
          <h2 className="font-bold text-[var(--text-primary)]">{t('export_data')}</h2>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm text-[var(--text-muted)] mb-4">{t('export_all_data_desc')}</p>
          <button onClick={exportToExcel} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-4 font-bold transition-all shadow-xl shadow-emerald-500/25 active:scale-[0.98]">
            <Download className="w-5 h-5" />
            {t('export_to_excel')}
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 text-center text-sm text-[var(--text-muted)]">
          <Database className="w-6 h-6 mx-auto mb-2 text-indigo-500" />
          {t('data_stored_in_cloud')}
        </div>
      </div>

      {/* Updates */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-2 bg-[var(--bg-secondary)]/30">
          <ArrowUpCircle className="w-5 h-5 text-indigo-500" />
          <h2 className="font-bold text-[var(--text-primary)]">Updates</h2>
        </div>
        <div className="p-6">
          <UpdateSection />
        </div>
      </div>

      <button onClick={save} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-4 font-bold transition-all shadow-xl shadow-indigo-500/25 active:scale-[0.98]">
        <Save className="w-5 h-5" />
        {saved ? '✓ ' + t('saved') : t('save_settings')}
      </button>
    </div>
  );
}

function UpdateSection() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'uptodate' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onUpdateAvailable((info) => {
      setStatus('available');
      setVersion(info.version);
      setMessage(`Version ${info.version} available`);
    });
    window.electronAPI.onUpdateNotAvailable(() => {
      setStatus('uptodate');
      setMessage('You have the latest version');
    });
    window.electronAPI.onUpdateError((msg) => {
      setStatus('error');
      setMessage(msg);
    });
    window.electronAPI.onUpdateDownloadProgress((p) => {
      setProgress(p.percent);
      setStatus('downloading');
      setMessage(`Downloading... ${p.percent}%`);
    });
    window.electronAPI.onUpdateDownloaded(() => {
      setStatus('downloaded');
      setMessage('Update downloaded');
    });
  }, []);

  const handleCheck = async () => {
    setStatus('checking');
    setMessage('Checking for updates...');
    const r = await window.electronAPI.checkForUpdates();
    if (!r.success) {
      setStatus('error');
      setMessage(r.message);
    }
  };

  const handleDownload = async () => {
    setStatus('downloading');
    setProgress(0);
    setMessage('Starting download...');
    const r = await window.electronAPI.downloadUpdate();
    if (!r.success) {
      setStatus('error');
      setMessage(r.message);
    }
  };

  const handleInstall = async () => {
    await window.electronAPI.installUpdate();
  };

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-[var(--text-muted)]">Check for app updates</p>
      {status === 'idle' && (
        <button onClick={handleCheck} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 py-3 font-bold transition-all shadow-lg shadow-indigo-500/20">
          <RefreshCw className="w-4 h-4" /> Check for Updates
        </button>
      )}
      {status === 'checking' && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <RefreshCw className="w-4 h-4 animate-spin" /> {message}
        </div>
      )}
      {status === 'available' && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-emerald-500 font-medium">{message}</p>
          <button onClick={handleDownload} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-6 py-3 font-bold transition-all shadow-lg shadow-emerald-500/20">
            <Download className="w-4 h-4" /> Download Update
          </button>
        </div>
      )}
      {status === 'downloading' && (
        <div className="w-full space-y-2">
          <p className="text-sm text-[var(--text-muted)]">{message}</p>
          <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {status === 'downloaded' && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-emerald-500 font-medium">{message}</p>
          <button onClick={handleInstall} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 py-3 font-bold transition-all shadow-lg shadow-indigo-500/20">
            <ArrowUpCircle className="w-4 h-4" /> Restart & Install
          </button>
        </div>
      )}
      {status === 'uptodate' && (
        <p className="text-sm text-emerald-500">{message}</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-500">{message}</p>
      )}
    </div>
  );
}