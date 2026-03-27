import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStoredUser, logout as apiLogout, login as apiLogin, StoredUser } from '../utils/api';

interface AuthContextType {
  user: StoredUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isJudge: boolean;
  judgeType: 'red' | 'blue' | null;
  canScoreRed: boolean;
  canScoreBlue: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const data = await apiLogin(username, password);
    setUser(data.user);
  };

  const logout = () => { apiLogout(); setUser(null); };

  const isAdmin  = user?.role === 'admin';
  const isJudge  = user?.role === 'judge';
  const judgeType = user?.judge_type ?? null;

  // Admin can score both; red judge can only score red; blue judge only blue
  const canScoreRed  = isAdmin || judgeType === 'red';
  const canScoreBlue = isAdmin || judgeType === 'blue';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isJudge, judgeType, canScoreRed, canScoreBlue }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
