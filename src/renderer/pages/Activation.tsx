import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, ShieldCheck, AlertTriangle, CheckCircle, Monitor } from 'lucide-react';

interface Props {
  onActivated: () => void;
}

export default function Activation({ onActivated }: Props) {
  const { t, i18n } = useTranslation();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    check();
  }, []);

  const check = async () => {
    setChecking(true);
    const info = await window.electronAPI.checkLicense();
    setLicenseInfo(info);
    if (info.activated) {
      onActivated();
      return;
    }
    setChecking(false);
  };

  const handleActivate = async () => {
    setError('');
    if (!key.trim()) { setError('Please enter a license key'); return; }
    setLoading(true);
    const result = await window.electronAPI.activateLicense(key.trim());
    setLoading(false);
    if (result.success) {
      await check();
    } else {
      setError(result.message);
    }
  };

  const langs = [{ code: 'ar', label: 'عربي' }, { code: 'fr', label: 'FR' }, { code: 'en', label: 'EN' }];

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="absolute top-6 right-6 flex gap-2">
        {langs.map(l => (
          <button key={l.code}
            onClick={() => { i18n.changeLanguage(l.code); localStorage.setItem('pos_lang', l.code); document.documentElement.dir = l.code === 'ar' ? 'rtl' : 'ltr'; }}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${i18n.language === l.code ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-600 rounded-2xl mb-4 shadow-lg shadow-amber-500/25">
            <Key className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('activation')}</h1>
          <p className="text-gray-500 mt-1 text-sm">POS Installment ERP</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl space-y-5">
          {licenseInfo && !licenseInfo.activated && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {licenseInfo.message}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {licenseInfo?.daysLeft !== undefined && licenseInfo.daysLeft > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {t('days_remaining')}: {licenseInfo.daysLeft}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">{t('license_key')}</label>
            <input
              type="text"
              value={key}
              onChange={e => setKey(e.target.value.toUpperCase())}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all placeholder-gray-600 text-center tracking-widest"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              autoFocus
            />
          </div>

          <button
            onClick={handleActivate}
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-amber-500/20"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><ShieldCheck className="w-4 h-4" />{t('activate')}</>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          <Monitor className="w-3 h-3 inline me-1" />
          {t('contact_vendor')}
        </p>
      </div>
    </div>
  );
}