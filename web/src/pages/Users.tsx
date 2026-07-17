import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Shield, Search, Plus, X, Trash2, KeyRound } from 'lucide-react';

function btoa(s: string) {
  if (typeof window !== 'undefined') return window.btoa(s);
  return Buffer.from(s, 'binary').toString('base64');
}

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', is_admin: false });
  const [resetPw, setResetPw] = useState<any>(null);
  const [resetForm, setResetForm] = useState({ password: '' });

  useEffect(() => { load(); }, []);
  const load = async () => {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('username')));
    const list: any[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    setUsers(list);
  };

  const create = async () => {
    if (!form.username.trim() || !form.password) return;
    const base64pw = btoa(form.password);
    await addDoc(collection(db, 'users'), { username: form.username, password: base64pw, is_admin: form.is_admin, role: form.is_admin ? 'admin' : 'user' });
    setModal(false);
    setForm({ username: '', password: '', is_admin: false });
    load();
  };

  const del = async (u: any) => {
    if (!confirm(t('confirm_delete') + ' "' + u.username + '"?')) return;
    await deleteDoc(doc(db, 'users', u.id));
    load();
  };

  const doReset = async () => {
    if (!resetForm.password) return;
    const base64pw = btoa(resetForm.password);
    await updateDoc(doc(db, 'users', resetPw.id), { password: base64pw });
    setResetPw(null);
    setResetForm({ password: '' });
  };

  const toggleAdmin = async (u: any) => {
    const newAdmin = !u.is_admin;
    await updateDoc(doc(db, 'users', u.id), { is_admin: newAdmin, role: newAdmin ? 'admin' : 'user' });
    load();
  };

  const filtered = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-4 py-2.5 text-sm" />
        </div>
        <button onClick={() => { setForm({ username: '', password: '', is_admin: false }); setModal(true); }}
          className="bg-indigo-600 rounded-xl p-2.5"><Plus className="w-5 h-5" /></button>
      </div>
      <div className="space-y-2">
        {filtered.map(u => (
          <div key={u.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3 flex items-center gap-3 group">
            <Shield className={`w-5 h-5 ${u.is_admin ? 'text-indigo-400' : 'text-slate-600'}`} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-white">{u.username}</div>
              <div className="text-xs text-slate-500">{u.is_admin ? t('admin') : t('user')}</div>
            </div>
            <button onClick={() => { setResetPw(u); setResetForm({ password: '' }); }}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-all hidden group-hover:inline-flex items-center gap-1">
              <KeyRound className="w-3 h-3" />{t('reset_password')}
            </button>
            <button onClick={() => toggleAdmin(u)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${u.is_admin ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600/30 text-indigo-400'}`}>
              {u.is_admin ? t('remove_admin') : t('make_admin')}
            </button>
            <button onClick={() => del(u)} className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">{t('no_data')}</div>}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold text-white">{t('add_user')}</h2>
              <button onClick={() => setModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('username')}</label>
                <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('password')}</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.is_admin} onChange={e => setForm({ ...form, is_admin: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700" />
                {t('admin')}
              </label>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setModal(false)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button onClick={create} className="flex-1 bg-indigo-600 rounded-xl py-2.5 text-sm font-medium">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {resetPw && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold text-white">{t('reset_password')} — {resetPw.username}</h2>
              <button onClick={() => setResetPw(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('new_password')}</label>
                <input type="password" value={resetForm.password} onChange={e => setResetForm({ password: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setResetPw(null)} className="flex-1 bg-slate-700 rounded-xl py-2.5 text-sm font-medium">{t('cancel')}</button>
              <button onClick={doReset} className="flex-1 bg-indigo-600 rounded-xl py-2.5 text-sm font-medium">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
