import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Customers from './pages/Customers';
import SoonExpired from './pages/SoonExpired';
import Installments from './pages/Installments';
import Debts from './pages/Debts';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Zakat from './pages/Zakat';
import Activation from './pages/Activation';

function RequireAuth({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/pos" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  const [licenseOk, setLicenseOk] = useState(false);
  const [licenseChecking, setLicenseChecking] = useState(true);

  useEffect(() => {
    async function checkLicense() {
      try {
        const info = await window.electronAPI.checkLicense();
        if (info.activated) {
          setLicenseOk(true);
        } else {
          setLicenseOk(false);
        }
      } catch {
        setLicenseOk(true);
      }
      setLicenseChecking(false);
    }
    checkLicense();
  }, []);

  if (licenseChecking) {
    return <div className="flex h-screen items-center justify-center bg-gray-950"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div></div>;
  }

  if (!licenseOk) {
    return <Activation onActivated={() => setLicenseOk(true)} />;
  }

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div></div>;

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
        <Route path="soon-expired" element={<RequireAuth adminOnly><SoonExpired /></RequireAuth>} />
        <Route path="users" element={<RequireAuth adminOnly><Users /></RequireAuth>} />
        <Route path="settings" element={<RequireAuth adminOnly><Settings /></RequireAuth>} />
        <Route path="zakat" element={<RequireAuth><Zakat /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}