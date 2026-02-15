import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  username: string;
  fullName: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (username: string, fullName: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored session on mount
    const storedUser = localStorage.getItem('lineaccurate_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('lineaccurate_user');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (username: string, fullName: string, password: string) => {
    // Simple mock authentication - in production, replace with actual auth
    if (username && fullName && password) {
      const newUser = {
        username,
        fullName,
      };
      setUser(newUser);
      localStorage.setItem('lineaccurate_user', JSON.stringify(newUser));
    } else {
      throw new Error('Invalid credentials');
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('lineaccurate_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
