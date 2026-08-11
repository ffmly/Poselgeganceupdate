import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator, Wallet, Building2, TrendingUp, Package, ArrowRightLeft, HandCoins, RotateCcw, Coins, AlertCircle, CheckCircle } from 'lucide-react';

interface ZakatForm {
  cashInHand: number;
  bankBalance: number;
  investments: number;
  inventoryValue: number;
  receivables: number;
  payables: number;
}

export default function ZakatCalculator() {
  const { t } = useTranslation();
  const [form, setForm] = useState<ZakatForm>({
    cashInHand: 0, bankBalance: 0, investments: 0, inventoryValue: 0, receivables: 0, payables: 0,
  });
  const [goldPrice, setGoldPrice] = useState(75);
  const [nisabGrams, setNisabGrams] = useState(85);
  const [currency, setCurrency] = useState('DZD');
  const [calculated, setCalculated] = useState(false);
  const [totalAssets, setTotalAssets] = useState(0);
  const [nisabThreshold, setNisabThreshold] = useState(0);
  const [zakatAmount, setZakatAmount] = useState(0);

  useEffect(() => {
    (async () => {
      const s = await window.electronAPI.getSettings();
      setCurrency(s?.currency || 'DZD');
      if (s?.gold_price) setGoldPrice(Number(s.gold_price));
      if (s?.nisab_grams) setNisabGrams(Number(s.nisab_grams));

      const products = await window.electronAPI.query("SELECT stock, price_purchase FROM products");
      let totalValue = 0;
      (products || []).forEach((p: any) => totalValue += (p.stock || 0) * (p.price_purchase || 0));
      setForm(prev => ({ ...prev, inventoryValue: totalValue }));
    })();
  }, []);

  const calculateZakat = () => {
    const assets = (form.cashInHand || 0) + (form.bankBalance || 0) +
      (form.investments || 0) + (form.inventoryValue || 0) + (form.receivables || 0);
    const liabilities = (form.payables || 0);
    const netAssets = assets - liabilities;
    const threshold = nisabGrams * goldPrice;
    const zakat = netAssets >= threshold ? netAssets * 0.025 : 0;
    setTotalAssets(netAssets);
    setNisabThreshold(threshold);
    setZakatAmount(zakat);
    setCalculated(true);
  };

  const resetForm = () => {
    setForm({ cashInHand: 0, bankBalance: 0, investments: 0, inventoryValue: 0, receivables: 0, payables: 0 });
    setCalculated(false);
  };

  const fmt = (n: number) => n.toLocaleString('fr-DZ') + ' ' + currency;

  const inputClass = "w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-end transition-all";

  const inputs: { key: keyof ZakatForm; icon: any; label: string }[] = [
    { key: 'cashInHand', icon: Wallet, label: t('zakat_cash_in_hand') },
    { key: 'bankBalance', icon: Building2, label: t('zakat_bank_balance') },
    { key: 'investments', icon: TrendingUp, label: t('zakat_investments') },
    { key: 'inventoryValue', icon: Package, label: t('zakat_inventory_value') },
    { key: 'receivables', icon: ArrowRightLeft, label: t('zakat_receivables') },
    { key: 'payables', icon: HandCoins, label: t('zakat_payables') },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <Calculator className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('zakat_title')}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('zakat_desc')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-sm text-[var(--text-secondary)] flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />{t('zakat_nisab_label')}
          </h2>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">{t('zakat_gold_price')}</label>
            <input type="number" value={goldPrice} onChange={e => setGoldPrice(Number(e.target.value))}
              className={inputClass} min={0} />
          </div>
          <div className="flex items-center justify-between text-sm bg-[var(--bg-primary)]/50 rounded-xl px-4 py-3">
            <span className="text-[var(--text-secondary)]">{t('zakat_nisab_threshold')}</span>
            <span className="text-amber-400 font-bold">{fmt(nisabGrams * goldPrice)}</span>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3">
          {inputs.map(({ key, icon: Icon, label }) => (
            <div key={key}>
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
                <Icon className="w-3.5 h-3.5" />{label}
              </label>
              <input type="number" value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })}
                className={inputClass} min={0} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={calculateZakat}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-6 py-2.5 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
          <Calculator className="w-4 h-4" />{t('zakat_calculate')}
        </button>
        <button onClick={resetForm}
          className="flex items-center gap-2 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl px-6 py-2.5 text-sm font-medium transition-all">
          <RotateCcw className="w-4 h-4" />{t('zakat_reset')}
        </button>
      </div>

      {calculated && (
        <div className="space-y-4">
          {zakatAmount > 0 ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-emerald-400 font-bold mb-1">{t('zakat_eligible')}</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm bg-[var(--bg-primary)]/50 rounded-xl px-4 py-3">
                  <span className="text-[var(--text-secondary)]">{t('zakat_total_assets')}</span>
                  <span className="text-[var(--text-primary)] font-bold">{fmt(totalAssets)}</span>
                </div>
                <div className="flex items-center justify-between text-sm bg-[var(--bg-primary)]/50 rounded-xl px-4 py-3">
                  <span className="text-[var(--text-secondary)]">{t('zakat_payable')}</span>
                  <span className="text-emerald-400 text-lg font-bold">{fmt(zakatAmount)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 text-center">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-sm text-amber-400 font-bold mb-1">{t('zakat_not_eligible')}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {t('zakat_total_assets')}: {fmt(totalAssets)} &lt; {t('zakat_nisab_threshold')}: {fmt(nisabThreshold)}
              </p>
            </div>
          )}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
            <p className="text-xs text-indigo-400 leading-relaxed">{t('zakat_note')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
