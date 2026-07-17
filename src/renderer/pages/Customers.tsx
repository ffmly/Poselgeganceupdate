import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Trash2, X, Phone, MapPin } from 'lucide-react';

interface Customer { id: string; name: string; phone?: string; address?: string; notes?: string; }
const empty: Omit<Customer, 'id'> = { name: '', phone: '', address: '', notes: '' };

export default function Customers() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Omit<Customer, 'id'>>(empty);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const data = await window.electronAPI.query("SELECT * FROM customers ORDER BY name");
    setCustomers(data || []);
  };

  const openAdd = () => { setForm(empty); setEditing(null); setModal(true); };
  const openEdit = (c: Customer) => { setForm({ name: c.name, phone: c.phone || '', address: c.address || '', notes: c.notes || '' }); setEditing(c); setModal(true); };
  
  const save = async () => {
    if (!form.name.trim()) return;
    if (editing) {
      await window.electronAPI.run("UPDATE customers SET name=?,phone=?,address=?,notes=? WHERE id=?", form.name, form.phone || null, form.address || null, form.notes || null, editing.id);
    } else {
      await window.electronAPI.run("INSERT INTO customers (name,phone,address,notes) VALUES(?,?,?,?)", form.name, form.phone || null, form.address || null, form.notes || null);
    }
    setModal(false); load();
  };

  const del = async (c: Customer) => {
    if (!confirm(`${t('confirm_delete')} "${c.name}"?`)) return;
    await window.electronAPI.run("DELETE FROM customers WHERE id=?", c.id);
    load();
  };

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl ps-9 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-all shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" />{t('add_customer')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 hover:border-indigo-500/30 transition-all group shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">{c.name}</h3>
                {c.phone && <div className="flex items-center gap-1 text-sm text-[var(--text-secondary)] mt-1"><Phone className="w-3 h-3 text-indigo-400" />{c.phone}</div>}
                {c.address && <div className="flex items-center gap-1 text-sm text-[var(--text-muted)] mt-0.5"><MapPin className="w-3 h-3" />{c.address}</div>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(c)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => del(c)} className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {c.notes && <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] rounded-lg p-2 mt-2 leading-relaxed">{c.notes}</p>}
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full py-16 text-center text-[var(--text-muted)]">{t('no_data')}</div>}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <h2 className="font-semibold text-[var(--text-primary)]">{editing ? t('edit_customer') : t('add_customer')}</h2>
              <button onClick={() => setModal(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: t('customer_name'), key: 'name', type: 'text' },
                { label: t('phone'), key: 'phone', type: 'tel' },
                { label: t('address'), key: 'address', type: 'text' },
                { label: t('notes'), key: 'notes', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm text-[var(--text-secondary)] font-medium mb-1.5">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner transition-all" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModal(false)} className="flex-1 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl py-2.5 text-sm font-medium transition-all">{t('cancel')}</button>
              <button onClick={save} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-medium transition-all shadow-lg shadow-indigo-500/20">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
