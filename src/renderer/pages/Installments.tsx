import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, AlertTriangle, CheckCircle, Clock, X, Printer } from 'lucide-react';
import { printInstallmentContract } from '../utils/invoicePrinter';

interface Installment {
  id: string; sale_id: string; customer_id: string; customer_name: string; customer_phone?: string;
  total_amount: number; advance: number; remaining: number; months: number;
  monthly_payment: number; paid_amount: number; status: string; created_at: string;
}

export default function Installments() {
  const { t } = useTranslation();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [selected, setSelected] = useState<Installment | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [currency, setCurrency] = useState('DZD');
  const [storeName, setStoreName] = useState('');
  const [storeLogo, setStoreLogo] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await window.electronAPI.query(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone
      FROM installments i LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
    `);
    setInstallments(data || []);
    const s = await window.electronAPI.getSettings();
    setCurrency(s?.currency || 'DZD');
    setStoreName(s?.store_name || '');
    setStoreLogo(s?.store_logo || '');
  };

  const loadPayments = async (id: string) => {
    const data = await window.electronAPI.query(`
      SELECT ip.*, u.username FROM installment_payments ip
      LEFT JOIN users u ON ip.recorded_by = u.id
      WHERE ip.installment_id = ? ORDER BY ip.payment_date DESC
    `, id);
    setPayments(data || []);
  };

  const openDetail = async (inst: Installment) => {
    setSelected(inst); await loadPayments(inst.id);
  };

  const registerPayment = async () => {
    if (!selected || !payAmount || Number(payAmount) <= 0) return;
    await window.electronAPI.run(
      "INSERT INTO installment_payments (installment_id, amount, notes) VALUES (?,?,?)",
      selected.id, Number(payAmount), payNotes || null
    );
    setPayModal(false); setPayAmount(''); setPayNotes('');
    await load();
    const updated = (await window.electronAPI.query("SELECT i.*, c.name as customer_name, c.phone as customer_phone FROM installments i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ?", selected.id))[0];
    if (updated) {
      setSelected(updated);
      await loadPayments(updated.id);
    }
  };

  const handlePrintContract = async () => {
    if (!selected) return;
    const items = await window.electronAPI.query(`
      SELECT si.*, p.name FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?
    `, selected.sale_id);
    const inv = await window.electronAPI.get("SELECT invoice_number FROM invoices WHERE sale_id = ? AND type='final' LIMIT 1", selected.sale_id);
    printInstallmentContract({
      storeName, storeLogo, customer: { name: selected.customer_name, phone: selected.customer_phone },
      installment: selected, items: (items || []).map((i: any) => ({ ...i, unitPrice: i.price_override || i.price, subtotal: i.subtotal })),
      invoiceNumber: inv?.invoice_number || selected.sale_id.toString(), currency,
    });
  };

  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;
  const filtered = installments
    .filter(i => filter === 'all' || i.status === filter)
    .filter(i => i.customer_name?.toLowerCase().includes(search.toLowerCase()));

  const statusIcon = (s: string) => s === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : s === 'overdue' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <Clock className="w-4 h-4 text-amber-400" />;
  const statusColor = (s: string) => s === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : s === 'overdue' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400';

  return (
    <div className="flex gap-4 h-full -m-6 overflow-hidden">
      {/* List */}
      <div className="flex flex-col flex-1 min-w-0 p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl ps-9 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all" />
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'completed', 'overdue'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-secondary)]'}`}>
                {t(f === 'all' ? 'all' : f)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pe-1">
          {filtered.map(inst => {
            const progress = inst.total_amount > 0 ? Math.min(100, (inst.paid_amount + inst.advance) / inst.total_amount * 100) : 0;
            return (
              <div key={inst.id} onClick={() => openDetail(inst)}
                className={`bg-[var(--bg-surface)] border rounded-2xl p-4 cursor-pointer hover:border-indigo-500/30 transition-all shadow-sm ${selected?.id === inst.id ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-[var(--border-color)]'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-[var(--text-primary)]">{inst.customer_name}</div>
                    {inst.customer_phone && <div className="text-xs text-[var(--text-muted)]">{inst.customer_phone}</div>}
                  </div>
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor(inst.status)}`}>
                    {statusIcon(inst.status)} {t(inst.status)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                  <div><div className="text-[var(--text-muted)] mb-0.5">{t('total')}</div><div className="text-[var(--text-primary)] font-bold">{fmt(inst.total_amount)}</div></div>
                  <div><div className="text-[var(--text-muted)] mb-0.5">{t('paid')}</div><div className="text-emerald-600 dark:text-emerald-400 font-bold">{fmt(inst.paid_amount + inst.advance)}</div></div>
                  <div><div className="text-[var(--text-muted)] mb-0.5">{t('remaining')}</div><div className="text-red-500 font-bold">{fmt(inst.remaining)}</div></div>
                </div>
                <div className="w-full bg-[var(--bg-secondary)] rounded-full h-1.5 shadow-inner">
                  <div className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-1.5 rounded-full transition-all shadow-sm" style={{ width: `${progress}%` }} />
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-2 font-medium">{fmt(inst.monthly_payment)}/{t('month')} × {inst.months}</div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-16 text-[var(--text-muted)]">{t('no_data')}</div>}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-[380px] border-s border-[var(--border-color)] flex flex-col bg-[var(--bg-surface)] p-6 overflow-hidden shadow-2xl z-10 transition-all animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-xl text-[var(--text-primary)]">{selected.customer_name}</h2>
            <button onClick={() => setSelected(null)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
            {[
              [t('total'), fmt(selected.total_amount), 'text-[var(--text-primary)]'],
              [t('advance'), fmt(selected.advance), 'text-indigo-600 dark:text-indigo-400'],
              [t('paid'), fmt(selected.paid_amount), 'text-emerald-600 dark:text-emerald-400'],
              [t('remaining'), fmt(selected.remaining), 'text-red-500'],
              [t('monthly_payment'), fmt(selected.monthly_payment), 'text-indigo-500'],
              [t('months'), selected.months.toString(), 'text-[var(--text-secondary)]'],
            ].map(([label, value, color]) => (
              <div key={label as string} className="bg-[var(--bg-secondary)] rounded-xl p-3 shadow-inner border border-[var(--border-color)]/20">
                <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-1">{label}</div>
                <div className={`font-bold text-sm ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-6">
            <button onClick={() => setPayModal(true)} disabled={selected.status === 'completed'} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />{t('register_payment')}
            </button>
            <button onClick={handlePrintContract} className="p-3 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] rounded-xl transition-all border border-[var(--border-color)] shadow-sm">
              <Printer className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">{t('payment_history')}</h3>
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl px-4 py-3 flex items-center justify-between shadow-inner">
                  <div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{fmt(p.amount)}</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{new Date(p.payment_date).toLocaleDateString()}{p.notes ? ` — ${p.notes}` : ''}</div>
                  </div>
                  {p.username && <div className="text-[10px] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] font-medium">{p.username}</div>}
                </div>
              ))}
              {payments.length === 0 && <div className="text-xs text-[var(--text-muted)] text-center py-8 opacity-50">{t('no_data')}</div>}
            </div>
          </div>

          {payModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                  <h3 className="font-bold text-[var(--text-primary)]">{t('register_payment')}</h3>
                  <button onClick={() => setPayModal(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('amount')}</label>
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={fmt(selected.monthly_payment)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-inner transition-all" autoFocus />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('notes')}</label>
                    <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-inner transition-all" />
                  </div>
                </div>
                <div className="flex gap-3 px-6 pb-6">
                  <button onClick={() => setPayModal(false)} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-2.5 text-sm font-medium transition-all">{t('cancel')}</button>
                  <button onClick={registerPayment} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2.5 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all">{t('confirm')}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
