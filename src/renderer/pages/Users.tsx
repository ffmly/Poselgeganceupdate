import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Key, X, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Users() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [resetModal, setResetModal] = useState<any>(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'seller' });
  const [resetPass, setResetPass] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => { setUsers(await window.electronAPI.getUsers() || []); };

  const createUser = async () => {
    setError('');
    if (!form.username.trim() || !form.password.trim()) { setError('All fields required'); return; }
    const res = await window.electronAPI.createUser(form.username, form.password, form.role);
    if (res.success) { setAddModal(false); setForm({ username: '', password: '', role: 'seller' }); load(); }
    else setError(res.error || 'Error');
  };

  const deleteUser = async (id: string) => {
    if (id === currentUser?.id) { alert(t('cannot_delete_self')); return; }
    if (!confirm(t('confirm_delete'))) return;
    await window.electronAPI.deleteUser(id);
    load();
  };

  const resetPassword = async () => {
    if (!resetPass.trim()) return;
    await window.electronAPI.resetPassword(resetModal.id, resetPass);
    setResetModal(null); setResetPass('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAddModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" />{t('create_user')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {users.map(u => (
          <div key={u.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 hover:border-indigo-500/30 transition-all shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${u.role === 'admin' ? 'bg-indigo-600/10' : 'bg-[var(--bg-secondary)]'}`}>
                  {u.role === 'admin' ? <ShieldCheck className="w-5 h-5 text-indigo-600" /> : <User className="w-5 h-5 text-[var(--text-secondary)]" />}
                </div>
                <div>
                  <div className="font-bold text-[var(--text-primary)]">{u.username}</div>
                  <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>{t(u.role)}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setResetModal(u)} className="p-2 text-[var(--text-muted)] hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"><Key className="w-4 h-4" /></button>
                {u.id !== currentUser?.id && (
                  <button onClick={() => deleteUser(u.id)} className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{new Date(u.created_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>

      {/* Add User Modal */}
      {addModal && (
        <div className="fixed inset-0 bg-[var(--text-primary)]/20 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
              <h2 className="font-black text-[var(--text-primary)] uppercase tracking-tight">{t('create_user')}</h2>
              <button onClick={() => setAddModal(false)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <div className="p-8 space-y-5">
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3 font-medium">{error}</div>}
              <div>
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-2">{t('username')}</label>
                <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold transition-all" autoFocus />
              </div>
              <div>
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-2">{t('password')}</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-2">{t('role')}</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold transition-all cursor-pointer">
                  <option value="seller">{t('seller')}</option>
                  <option value="admin">{t('admin')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 px-8 pb-8">
              <button onClick={() => setAddModal(false)} className="flex-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl py-3 text-sm font-bold hover:bg-[var(--bg-primary)] transition-all border border-[var(--border-color)]">{t('cancel')}</button>
              <button onClick={createUser} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-[var(--text-primary)]/20 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
              <h2 className="font-black text-[var(--text-primary)] uppercase tracking-tight">{t('reset_password')}</h2>
              <button onClick={() => setResetModal(null)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <div className="p-8">
              <p className="text-sm font-bold text-[var(--text-secondary)] mb-4">{t('reset_password_for')}: <span className="text-indigo-600">{resetModal.username}</span></p>
              <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-2">{t('new_password')}</label>
              <input type="password" value={resetPass} onChange={e => setResetPass(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold transition-all" autoFocus />
            </div>
            <div className="flex gap-4 px-8 pb-8">
              <button onClick={() => setResetModal(null)} className="flex-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl py-3 text-sm font-bold hover:bg-[var(--bg-primary)] transition-all border border-[var(--border-color)]">{t('cancel')}</button>
              <button onClick={resetPassword} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-3 text-sm font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all">{t('confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
