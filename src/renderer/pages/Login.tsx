import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Monitor } from 'lucide-react';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(t('invalid_credentials'));
    }
  };

  const langs = [{ code: 'ar', label: 'عربي' }, { code: 'fr', label: 'FR' }, { code: 'en', label: 'EN' }];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Language switcher */}
      <div className="absolute top-6 right-6 flex gap-2">
        {langs.map(l => (
          <button
            key={l.code}
            onClick={() => { i18n.changeLanguage(l.code); localStorage.setItem('pos_lang', l.code); document.documentElement.dir = l.code === 'ar' ? 'rtl' : 'ltr'; }}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${i18n.language === l.code ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/25">
            <Monitor className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">POS System</h1>
          <p className="text-gray-500 mt-1 text-sm">Electronics Store Management</p>
        </div>

        <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">{t('username')}</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              required
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">{t('password')}</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-600"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><LogIn className="w-4 h-4" />{t('login')}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
