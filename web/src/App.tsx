import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Installments from './pages/Installments';
import Debts from './pages/Debts';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import SoonExpired from './pages/SoonExpired';
import Users from './pages/Users';
import Settings from './pages/Settings';
import DayClosing from './pages/DayClosing';

function RequireAuth({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/pos" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/dashboard' : '/pos'} replace /> : <Login />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to={user?.role === 'admin' ? '/dashboard' : '/pos'} replace />} />
        <Route path="dashboard" element={<RequireAuth adminOnly><Dashboard /></RequireAuth>} />
        <Route path="pos" element={<RequireAuth><POS /></RequireAuth>} />
        <Route path="products" element={<RequireAuth adminOnly><Products /></RequireAuth>} />
        <Route path="customers" element={<RequireAuth><Customers /></RequireAuth>} />
        <Route path="debts" element={<RequireAuth><Debts /></RequireAuth>} />
        <Route path="installments" element={<RequireAuth><Installments /></RequireAuth>} />
        <Route path="suppliers" element={<RequireAuth><Suppliers /></RequireAuth>} />
        <Route path="purchases" element={<RequireAuth><Purchases /></RequireAuth>} />
        <Route path="reports" element={<RequireAuth adminOnly><Reports /></RequireAuth>} />
        <Route path="expenses" element={<RequireAuth><Expenses /></RequireAuth>} />
        <Route path="day-closing" element={<RequireAuth adminOnly><DayClosing /></RequireAuth>} />
        <Route path="soon-expired" element={<RequireAuth adminOnly><SoonExpired /></RequireAuth>} />
        <Route path="users" element={<RequireAuth adminOnly><Users /></RequireAuth>} />
        <Route path="settings" element={<RequireAuth adminOnly><Settings /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
