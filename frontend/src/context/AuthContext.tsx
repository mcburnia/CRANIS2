import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  orgId: string | null;
  orgRole: string | null;
  preferredLanguage: string | null;
  isPlatformAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (session: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    const token = localStorage.getItem('session_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('session_token');
        setUser(null);
      }
    } catch {
      // Network error — keep token, try again later
    } finally {
      setLoading(false);
    }
  }

  async function login(session: string) {
    localStorage.setItem('session_token', session);
    setLoading(true);
    await checkSession();
  }

  function logout() {
    localStorage.removeItem('session_token');
    setUser(null);
  }

  async function refreshUser() {
    await checkSession();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
