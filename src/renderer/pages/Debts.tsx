import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Wallet, Filter, Clock, User, Phone, CheckCircle, X, Plus, ArrowLeft } from 'lucide-react';

interface Debt {
  id: string; sale_id: string; customer_id: string;
  original_amount: number; remaining: number;
  status: 'active' | 'partial' | 'paid' | 'overdue';
  created_at: string; customer_name?: string; customer_phone?: string;
}

interface DebtPayment {
  id: string; debt_id: string; amount: number;
  notes?: string; payment_date: string; username?: string;
}

export default function Debts() {
  const { t } = useTranslation();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currency, setCurrency] = useState('DZD');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [all, settings] = await Promise.all([
      window.electronAPI.getAllDebts(),
      window.electronAPI.getSettings(),
    ]);
    setDebts(all || []);
    setCurrency(settings?.currency || 'DZD');
  };

  const loadPayments = async (debtId: string) => {
    const result = await window.electronAPI.getDebtPayments(debtId);
    setPayments(result || []);
  };

  const fmt = (n: number) => (n || 0).toLocaleString('fr-DZ') + ' ' + currency;

  const filtered = debts.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (d.customer_name || '').toLowerCase();
      const phone = (d.customer_phone || '').toLowerCase();
      if (!name.includes(q) && !phone.includes(q)) return false;
    }
    return true;
  });

  const statusColors: Record<string, string> = {
    active: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
  };

  const handlePayment = async () => {
    if (!selectedDebt || !paymentAmount || Number(paymentAmount) <= 0) return;
    const result = await window.electronAPI.createDebtPayment(selectedDebt.id, Number(paymentAmount), paymentNotes.trim() || undefined);
    if (result.success) {
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
      await loadData();
      if (selectedDebt) {
        const updated = (await window.electronAPI.getAllDebts()).find((d: Debt) => d.id === selectedDebt.id);
        if (updated) setSelectedDebt(updated);
        await loadPayments(selectedDebt.id);
      }
    } else {
      alert('Error: ' + (result.error || 'Failed'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('debts')}</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('search')} className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-9 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
          </div>
          <div className="flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-[var(--text-primary)] focus:outline-none">
              <option value="all">{t('all')}</option>
              <option value="active">{t('active')}</option>
              <option value="partial">{t('partial')}</option>
              <option value="overdue">{t('overdue')}</option>
              <option value="paid">{t('paid')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Debt List */}
      {selectedDebt ? (
        /* Debt Detail View */
        <div className="space-y-4">
          <button onClick={() => { setSelectedDebt(null); setPayments([]); }} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />{t('back')}
          </button>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <User className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{selectedDebt.customer_name || '—'}</h2>
                </div>
                {selectedDebt.customer_phone && (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] ms-8">
                    <Phone className="w-3.5 h-3.5" />{selectedDebt.customer_phone}
                  </div>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[selectedDebt.status]}`}>
                {t(selectedDebt.status)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] mb-1">{t('original_amount')}</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">{fmt(selectedDebt.original_amount)}</div>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] mb-1">{t('remaining_debt')}</div>
                <div className="text-xl font-bold text-amber-500">{fmt(selectedDebt.remaining)}</div>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] mb-1">{t('paid')}</div>
                <div className="text-xl font-bold text-emerald-500">{fmt(selectedDebt.original_amount - selectedDebt.remaining)}</div>
              </div>
            </div>

            {selectedDebt.remaining > 0 && (
              <button onClick={() => { setPaymentAmount(''); setPaymentNotes(''); setShowPaymentModal(true); }}
                className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />{t('register_debt_payment')}
              </button>
            )}
          </div>

          {/* Payment History */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <h3 className="font-semibold text-[var(--text-primary)]">{t('payment_history')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--bg-secondary)]/50">
                    <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('date')}</th>
                    <th className="text-end px-6 py-3 text-[var(--text-secondary)] font-medium">{t('amount')}</th>
                    <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('notes')}</th>
                    <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('recorded_by')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-[var(--bg-primary)]/50">
                      <td className="px-6 py-3 text-[var(--text-muted)] text-xs">{new Date(p.payment_date).toLocaleString()}</td>
                      <td className="px-6 py-3 text-end font-bold text-emerald-600 dark:text-emerald-400">{fmt(p.amount)}</td>
                      <td className="px-6 py-3 text-[var(--text-muted)]">{p.notes || '—'}</td>
                      <td className="px-6 py-3 text-[var(--text-primary)]">{p.username || '—'}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-[var(--text-muted)]">{t('no_data')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Debt Table */
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-secondary)]/50">
                  <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('customer_name')}</th>
                  <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('phone')}</th>
                  <th className="text-end px-6 py-3 text-[var(--text-secondary)] font-medium">{t('original_amount')}</th>
                  <th className="text-end px-6 py-3 text-[var(--text-secondary)] font-medium">{t('remaining_debt')}</th>
                  <th className="text-center px-6 py-3 text-[var(--text-secondary)] font-medium">{t('status')}</th>
                  <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filtered.map(d => (
                  <tr key={d.id} onClick={() => { setSelectedDebt(d); loadPayments(d.id); }}
                    className="hover:bg-[var(--bg-secondary)]/50 cursor-pointer transition-colors">
                    <td className="px-6 py-3 text-[var(--text-primary)] font-medium">{d.customer_name || '—'}</td>
                    <td className="px-6 py-3 text-[var(--text-muted)] text-xs">{d.customer_phone || '—'}</td>
                    <td className="px-6 py-3 text-end text-[var(--text-primary)]">{fmt(d.original_amount)}</td>
                    <td className="px-6 py-3 text-end font-bold text-amber-600 dark:text-amber-400">{fmt(d.remaining)}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusColors[d.status]}`}>
                        {t(d.status)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-[var(--text-muted)] text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">{t('no_data')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedDebt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                <h2 className="font-semibold text-[var(--text-primary)]">{t('register_debt_payment')}</h2>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-500/10 rounded-xl px-4 py-3 text-center border border-amber-500/20">
                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider">{t('remaining_debt')}</div>
                <div className="text-2xl font-black text-amber-500 mt-1">{fmt(selectedDebt.remaining)}</div>
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('amount')} *</label>
                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" min={0} autoFocus placeholder="0" max={selectedDebt.remaining} />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] font-medium block mb-1.5">{t('notes')}</label>
                <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner resize-none" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowPaymentModal(false)} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-2.5 font-medium transition-all shadow-sm">{t('cancel')}</button>
              <button onClick={handlePayment} disabled={!paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > selectedDebt.remaining}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl py-2.5 font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />{t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
