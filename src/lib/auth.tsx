import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword as fbSignInWithEmail,
  createUserWithEmailAndPassword as fbCreateUser,
  sendPasswordResetEmail as fbSendReset,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';
import { auth } from './firebase';

const ALLOWED_DOMAIN = 'finematrix.com';
const ALLOWED_EMAILS = ['dylanyeois@gmail.com'];

function isAllowed(email: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return lower.endsWith(`@${ALLOWED_DOMAIN}`) || ALLOWED_EMAILS.includes(lower);
}

function isAllowedForSignUp(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !isAllowed(firebaseUser.email)) {
        await fbSignOut(auth);
        setUser(null);
      } else {
        setUser(firebaseUser);
      }
      setLoading(false);
    });
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!isAllowed(email)) {
      throw new Error(`Only @${ALLOWED_DOMAIN} accounts are permitted.`);
    }
    await fbSignInWithEmail(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    if (!isAllowedForSignUp(email)) {
      throw new Error(`Sign-up is restricted to @${ALLOWED_DOMAIN} accounts.`);
    }
    await fbCreateUser(auth, email, password);
  };

  const resetPassword = async (email: string) => {
    await fbSendReset(auth, email);
  };

  const signOut = () => fbSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUp, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
