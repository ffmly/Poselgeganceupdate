import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

interface Product { id: string; name: string; barcode?: string; price_purchase: number; price_cash: number; stock: number; fabrication_date?: string; expiry_date: string; }

export default function SoonExpired() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [alertDays, setAlertDays] = useState(4);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const s = await window.electronAPI.getSettings();
    const days = Number(s?.expiry_alert_days) || 4;
    setAlertDays(days);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    const expiryDateStr = expiryDate.toISOString().split('T')[0];
    const data = await window.electronAPI.query(`
      SELECT * FROM products 
      WHERE expiry_date IS NOT NULL AND expiry_date != ''
        AND DATE(expiry_date) BETWEEN DATE('now') AND ?
      ORDER BY expiry_date ASC
    `, [expiryDateStr]);
    setProducts(data || []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('soon_expired')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('products_expiring_within_days', { count: alertDays })}</p>
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[var(--bg-secondary)]/50">
              <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('product_name')}</th>
              <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('barcode')}</th>
              <th className="text-end px-6 py-3 text-[var(--text-secondary)] font-medium">{t('stock')}</th>
              <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('fabrication_date')}</th>
              <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('expiry_date')}</th>
              <th className="text-start px-6 py-3 text-[var(--text-secondary)] font-medium">{t('days_to_expiry')}</th>
            </tr></thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {products.map(p => {
                const days = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000);
                return (
                  <tr key={p.id} className="hover:bg-red-500/[0.02] transition-colors">
                    <td className="px-6 py-3 text-[var(--text-primary)] font-medium">{p.name}</td>
                    <td className="px-6 py-3 text-[var(--text-primary)] font-mono text-sm">{p.barcode || '-'}</td>
                    <td className="px-6 py-3 text-end font-semibold text-[var(--text-primary)]">{p.stock}</td>
                    <td className="px-6 py-3 text-[var(--text-muted)]">{p.fabrication_date || '-'}</td>
                    <td className="px-6 py-3">
                      <span className={`font-bold ${days <= 0 ? 'text-red-600' : 'text-red-500'}`}>{p.expiry_date}</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        days <= 0 ? 'bg-red-500/20 text-red-600 ring-1 ring-red-500/30' :
                        days <= 2 ? 'bg-orange-500/20 text-orange-600 ring-1 ring-orange-500/30' :
                        'bg-amber-500/20 text-amber-600 ring-1 ring-amber-500/30'
                      }`}>
                        {days <= 0 ? t('expired') : `${days} ${t('days')}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <p className="font-medium">{t('no_expiring_products')}</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
