import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'seller';
}

interface AuthContextType {
  user: AuthUser | null;
  isAdmin: boolean;
  isSeller: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const saved = localStorage.getItem('pos_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    console.log('window.electronAPI:', window.electronAPI);
    if (!window.electronAPI) {
      return { success: false, error: 'System error: Electron bridge not found' };
    }
    const result = await window.electronAPI.login(username, password);
    if (result.success && result.user) {
      setUser(result.user as AuthUser);
      localStorage.setItem('pos_user', JSON.stringify(result.user));
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pos_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin: user?.role === 'admin',
      isSeller: user?.role === 'seller',
      login,
      logout,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
