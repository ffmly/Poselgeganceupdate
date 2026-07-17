import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Trash2, X, Phone, MapPin } from 'lucide-react';

interface Supplier { id: string; name: string; phone?: string; address?: string; notes?: string; }
const empty = { name: '', phone: '', address: '', notes: '' };

export default function Suppliers() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(empty);

  useEffect(() => { load(); }, []);
  const load = async () => { setSuppliers(await window.electronAPI.query("SELECT * FROM suppliers ORDER BY name") || []); };

  const openAdd = () => { setForm(empty); setEditing(null); setModal(true); };
  const openEdit = (s: Supplier) => { setForm({ name: s.name, phone: s.phone || '', address: s.address || '', notes: s.notes || '' }); setEditing(s); setModal(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    if (editing) await window.electronAPI.run("UPDATE suppliers SET name=?,phone=?,address=?,notes=? WHERE id=?", form.name, form.phone || null, form.address || null, form.notes || null, editing.id);
    else await window.electronAPI.run("INSERT INTO suppliers (name,phone,address,notes) VALUES(?,?,?,?)", form.name, form.phone || null, form.address || null, form.notes || null);
    setModal(false); load();
  };

  const del = async (s: Supplier) => { if (!confirm(`${t('confirm_delete')} "${s.name}"?`)) return; await window.electronAPI.run("DELETE FROM suppliers WHERE id=?", s.id); load(); };

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl ps-9 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
        </div>
        <button onClick={openAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-5 py-2.5 text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
          <Plus className="w-4 h-4" />{t('add_supplier')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(s => (
          <div key={s.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 hover:border-indigo-500/30 transition-all group shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-lg">{s.name}</h3>
                {s.phone && (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mt-1 font-medium">
                    <Phone className="w-3 h-3 text-indigo-500" />
                    {s.phone}
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mt-1 font-bold uppercase tracking-widest">
                    <MapPin className="w-3 h-3 text-indigo-400" />
                    {s.address}
                  </div>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => openEdit(s)} className="p-2 text-[var(--text-muted)] hover:text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => del(s)} className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-20 text-[var(--text-muted)] flex flex-col items-center gap-3">
            <Search className="w-12 h-12 opacity-10" />
            <p className="font-black uppercase tracking-widest text-sm">{t('no_records_found')}</p>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-[var(--text-primary)]/20 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
              <h2 className="font-black text-[var(--text-primary)] uppercase tracking-tight">{editing ? t('edit') : t('add_supplier')}</h2>
              <button onClick={() => setModal(false)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors">
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="p-8 space-y-5">
              {[{ label: t('supplier_name'), key: 'name' }, { label: t('phone'), key: 'phone' }, { label: t('address'), key: 'address' }, { label: t('notes'), key: 'notes' }].map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">{f.label}</label>
                  <input 
                    type="text" 
                    value={(form as any)[f.key]} 
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })} 
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold transition-all" 
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-4 px-8 pb-8">
              <button onClick={() => setModal(false)} className="flex-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl py-3 text-sm font-bold hover:bg-[var(--bg-primary)] transition-all border border-[var(--border-color)]">{t('cancel')}</button>
              <button onClick={save} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
