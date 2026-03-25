import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword as fbSignInWithEmail,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

const ALLOWED_DOMAIN = 'finematrix.com';
const ALLOWED_EMAILS = ['dylanyeois@gmail.com'];

function isAllowed(email: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return lower.endsWith(`@${ALLOWED_DOMAIN}`) || ALLOWED_EMAILS.includes(lower);
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !isAllowed(firebaseUser.email)) {
        // Signed in with a disallowed domain — boot them out immediately
        await fbSignOut(auth);
        setUser(null);
      } else {
        setUser(firebaseUser);
      }
      setLoading(false);
    });
  }, []);

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (!isAllowed(result.user.email)) {
      await fbSignOut(auth);
      throw new Error(`Only @${ALLOWED_DOMAIN} accounts are allowed.`);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!isAllowed(email)) {
      throw new Error(`Only @${ALLOWED_DOMAIN} accounts are allowed.`);
    }
    await fbSignInWithEmail(auth, email, password);
  };

  const signOut = () => fbSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
