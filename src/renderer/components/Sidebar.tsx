import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, ShoppingCart, Package, Users, HandCoins,
  Truck, ShoppingBag, BarChart3, Settings, UserCog, Monitor, Wallet, AlertTriangle
} from 'lucide-react';

const adminLinks = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/pos', icon: ShoppingCart, key: 'pos' },
  { to: '/products', icon: Package, key: 'products' },
  { to: '/customers', icon: Users, key: 'customers' },
  { to: '/debts', icon: Wallet, key: 'debts' },
  { to: '/installments', icon: HandCoins, key: 'installments' },
  { to: '/suppliers', icon: Truck, key: 'suppliers' },
  { to: '/purchases', icon: ShoppingBag, key: 'purchases' },
  { to: '/reports', icon: BarChart3, key: 'reports' },
  { to: '/soon-expired', icon: AlertTriangle, key: 'soon_expired' },
  { to: '/users', icon: UserCog, key: 'users' },
  { to: '/settings', icon: Settings, key: 'settings' },
];

const sellerLinks = [
  { to: '/pos', icon: ShoppingCart, key: 'pos' },
  { to: '/customers', icon: Users, key: 'customers' },
  { to: '/debts', icon: Wallet, key: 'debts' },
  { to: '/installments', icon: HandCoins, key: 'installments' },
  { to: '/suppliers', icon: Truck, key: 'suppliers' },
  { to: '/purchases', icon: ShoppingBag, key: 'purchases' },
];

export default function Sidebar() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const links = isAdmin ? adminLinks : sellerLinks;

  return (
    <div className="w-[72px] hover:w-56 transition-all duration-300 group flex flex-col bg-[var(--bg-secondary)] border-e border-[var(--border-color)] overflow-hidden shrink-0 shadow-lg z-20">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 gap-3 border-b border-[var(--border-color)]">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
          <Monitor className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-[var(--text-primary)] text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">POS System</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 space-y-1 overflow-y-auto overflow-x-hidden px-2">
        {links.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group/item
              ${isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'}`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 truncate">{t(key)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
