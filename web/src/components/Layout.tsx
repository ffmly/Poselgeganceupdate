import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, ShoppingCart, Package, Users, HandCoins,
  Truck, ShoppingBag, BarChart3, Settings, UserCog, Wallet,
  AlertTriangle, LogOut, Menu, X, Monitor, Lock
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
  { to: '/expenses', icon: Wallet, key: 'expenses' },
  { to: '/reports', icon: BarChart3, key: 'reports' },
  { to: '/day-closing', icon: Lock, key: 'day_closing' },
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
  { to: '/expenses', icon: Wallet, key: 'expenses' },
];

export default function Layout() {
  const { t } = useTranslation();
  const { isAdmin, logout, user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = isAdmin ? adminLinks : sellerLinks;

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 hover:bg-slate-800 rounded-xl">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-indigo-500" />
            <span className="font-bold text-sm">POS</span>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Sidebar Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <nav className="relative w-64 bg-slate-900 border-r border-slate-800 p-4 overflow-y-auto">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <Monitor className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm">POS System</div>
                <div className="text-xs text-slate-500">{user?.username} ({t(user?.role || '')})</div>
              </div>
            </div>
            <div className="space-y-1">
              {links.map(({ to, icon: Icon, key }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span>{t(key)}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
