import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Sun, Moon, Globe, LogOut, User, Clock, X, Calendar } from 'lucide-react';

const languages = [
  { code: 'ar', label: 'عربي' },
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
];

interface DayCloseSummary {
  totalSales: number;
  cashTotal: number;
  creditTotal: number;
  debtTotal: number;
  count: number;
  sales: any[];
  returnsTotal: number;
  expensesTotal: number;
  debtCollected: number;
  cashIn: number;
  cashOut: number;
  netCash: number;
  isClosed: boolean;
  closedAt?: string;
  closedBy?: string;
}

export default function Topbar() {
  const { t, i18n } = useTranslation();
  const { user, logout, isAdmin } = useAuth();
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('pos_theme');
    if (saved) return saved === 'dark';
    return false;
  });
  const [showLang, setShowLang] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [showDayClose, setShowDayClose] = useState(false);
  const [daySummary, setDaySummary] = useState<DayCloseSummary | null>(null);
  const [closeNotes, setCloseNotes] = useState('');
  const [currency, setCurrency] = useState('DZD');
  const [licenseInfo, setLicenseInfo] = useState<{daysLeft?: number; expiryDate?: string; message: string} | null>(null);
  const [showLicense, setShowLicense] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    window.electronAPI.checkLicense().then(info => {
      if (info.activated) setLicenseInfo(info);
    });
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem('pos_theme', newDark ? 'dark' : 'light');
  };

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('pos_lang', code);
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    setShowLang(false);
  };

  const openDayClose = async () => {
    const settings = await window.electronAPI.getSettings();
    setCurrency(settings?.currency || 'DZD');
    const summary = await window.electronAPI.getDayCloseSummary();
    setDaySummary(summary);
    setCloseNotes('');
    setShowDayClose(true);
  };

  const confirmDayClose = async () => {
    const result = await window.electronAPI.confirmDayClose(closeNotes);
    if (result.success) {
      openDayClose();
    }
  };

  const fmt = (n: number) => (n || 0).toLocaleString('fr-DZ') + ' ' + currency;

  return (
    <>
      <header className="h-16 bg-[var(--bg-surface)] border-b border-[var(--border-color)] flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
        <div className="text-lg font-semibold text-[var(--text-primary)]">
          {isAdmin && (
            <button
              onClick={openDayClose}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                daySummary?.isClosed
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              <Clock className="w-4 h-4" />
              {daySummary?.isClosed ? t('day_closed') : t('finish_day')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {licenseInfo && !licenseInfo.daysLeft && (
            <span className="text-[10px] text-emerald-500/50 font-mono">{licenseInfo.message}</span>
          )}
          {licenseInfo && licenseInfo.daysLeft !== undefined && (
            <div className="relative">
              <button
                onClick={() => { setShowLicense(!showLicense); setShowLang(false); setShowUser(false); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  (licenseInfo.daysLeft ?? 0) <= 7
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {licenseInfo.daysLeft}j
              </button>
              {showLicense && (
                <div className="absolute end-0 top-full mt-1 w-56 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden p-3 space-y-1.5">
                  <div className="text-xs text-[var(--text-muted)]">{licenseInfo.message}</div>
                  {licenseInfo.expiryDate && (
                    <div className="text-xs text-[var(--text-secondary)]">
                      Expire le {new Date(licenseInfo.expiryDate).toLocaleDateString('fr-DZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <button onClick={() => { setShowLang(!showLang); setShowUser(false); setShowLicense(false); }} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all flex items-center gap-1">
              <Globe className="w-5 h-5" />
              <span className="text-xs font-medium uppercase">{i18n.language}</span>
            </button>
            {showLang && (
              <div className="absolute end-0 top-full mt-1 w-28 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden">
                {languages.map(l => (
                  <button key={l.code} onClick={() => changeLanguage(l.code)}
                    className={`w-full text-start px-4 py-2.5 text-sm transition-colors ${i18n.language === l.code ? 'bg-indigo-600 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-[var(--border-color)] mx-1" />

          <div className="relative">
            <button onClick={() => { setShowUser(!showUser); setShowLang(false); setShowLicense(false); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-all">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="text-start hidden sm:block">
                <div className="text-sm font-bold text-[var(--text-primary)]">{user?.username}</div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-tight">{t(user?.role || '')}</div>
              </div>
            </button>
            {showUser && (
              <div className="absolute end-0 top-full mt-1 w-44 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden">
                <button onClick={logout} className="w-full text-start px-4 py-3 text-sm text-red-500 hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors">
                  <LogOut className="w-4 h-4" />
                  {t('logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* DAY CLOSE MODAL */}
      {showDayClose && daySummary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                <h2 className="font-semibold text-[var(--text-primary)]">{t('day_closing_report')}</h2>
              </div>
              <button onClick={() => setShowDayClose(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {daySummary.isClosed && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
                  ✓ {t('day_already_closed')} {daySummary.closedAt ? `— ${new Date(daySummary.closedAt).toLocaleString()}` : ''}
                  {daySummary.closedBy ? `— ${daySummary.closedBy}` : ''}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center shadow-inner border border-[var(--border-color)]/20">
                  <div className="text-2xl font-bold text-[var(--text-primary)]">{fmt(daySummary.totalSales)}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('total_sales')}</div>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center shadow-inner border border-[var(--border-color)]/20">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(daySummary.cashTotal)}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('cash_sales')}</div>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center shadow-inner border border-[var(--border-color)]/20">
                  <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{fmt(daySummary.creditTotal)}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('credit_sales')}</div>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center shadow-inner border border-[var(--border-color)]/20">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmt(daySummary.debtTotal)}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('debt_sales')}</div>
                </div>
              </div>

              {/* Returns, Expenses, Debt Collected, Net Cash */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-red-500/5 rounded-xl p-4 text-center shadow-inner border border-red-500/10">
                  <div className="text-2xl font-bold text-red-500">{fmt(daySummary.returnsTotal)}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('total_returns')}</div>
                </div>
                <div className="bg-amber-500/5 rounded-xl p-4 text-center shadow-inner border border-amber-500/10">
                  <div className="text-2xl font-bold text-amber-500">{fmt(daySummary.expensesTotal)}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('total_expenses')}</div>
                </div>
                <div className="bg-emerald-500/5 rounded-xl p-4 text-center shadow-inner border border-emerald-500/10">
                  <div className="text-2xl font-bold text-emerald-500">{fmt(daySummary.debtCollected)}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('debt_collected')}</div>
                </div>
                <div className="bg-indigo-500/5 rounded-xl p-4 text-center shadow-inner border border-indigo-500/10">
                  <div className="text-2xl font-bold text-indigo-500">{fmt(daySummary.netCash)}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('net_cash')}</div>
                </div>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
                  <h3 className="font-semibold text-sm text-[var(--text-primary)]">{t('today_sales')}</h3>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)]/50">
                        <th className="text-start px-4 py-2 text-[var(--text-muted)] text-[10px] font-bold uppercase">#</th>
                        <th className="text-start px-4 py-2 text-[var(--text-muted)] text-[10px] font-bold uppercase">{t('customer')}</th>
                        <th className="text-center px-4 py-2 text-[var(--text-muted)] text-[10px] font-bold uppercase">{t('payment_method')}</th>
                        <th className="text-end px-4 py-2 text-[var(--text-muted)] text-[10px] font-bold uppercase">{t('total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {daySummary.sales.map((sale: any) => (
                        <tr key={sale.id} className="hover:bg-[var(--bg-primary)]/50">
                          <td className="px-4 py-2 text-[var(--text-muted)] font-mono text-xs">#{sale.id}</td>
                          <td className="px-4 py-2 text-[var(--text-primary)] font-medium">{sale.customer_name || t('walk_in_customer')}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sale.type === 'cash' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : sale.type === 'debt' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'}`}>
                              {t(sale.type)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-end font-bold text-[var(--text-primary)]">{fmt(sale.total - (sale.discount || 0))}</td>
                        </tr>
                      ))}
                      {daySummary.sales.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)] text-xs">{t('no_data')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {!daySummary.isClosed && (
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] font-medium mb-2">{t('close_day_notes')}</label>
                  <textarea
                    value={closeNotes}
                    onChange={e => setCloseNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    placeholder={t('close_day_notes')}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowDayClose(false)} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-3 font-medium transition-all shadow-sm">{t('close')}</button>
              {!daySummary.isClosed && (
                <button
                  onClick={confirmDayClose}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />{t('close_day_confirm')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}