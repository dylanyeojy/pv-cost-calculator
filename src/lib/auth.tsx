import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword as fbSignInWithEmail,
  createUserWithEmailAndPassword as fbCreateUser,
  sendPasswordResetEmail as fbSendReset,
  sendEmailVerification as fbSendVerification,
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

function requiresVerification(email: string | null): boolean {
  // Gmail admin accounts bypass verification — finematrix accounts must verify
  if (!email) return false;
  return !ALLOWED_EMAILS.includes(email.toLowerCase());
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
      } else if (!isAllowed(firebaseUser.email)) {
        // Wrong domain entirely — boot out
        await fbSignOut(auth);
        setUser(null);
      } else if (requiresVerification(firebaseUser.email) && !firebaseUser.emailVerified) {
        // Registered but hasn't verified yet — sign out silently, UI handles messaging
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
    const result = await fbSignInWithEmail(auth, email, password);
    if (requiresVerification(result.user.email) && !result.user.emailVerified) {
      await fbSignOut(auth);
      throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!isAllowedForSignUp(email)) {
      throw new Error(`Sign-up is restricted to @${ALLOWED_DOMAIN} accounts.`);
    }
    const result = await fbCreateUser(auth, email, password);
    await fbSendVerification(result.user);
    // Sign out immediately — they must verify before accessing the app
    await fbSignOut(auth);
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      await fbSendVerification(auth.currentUser);
    }
  };

  const resetPassword = async (email: string) => {
    await fbSendReset(auth, email);
  };

  const signOut = () => fbSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUp, resendVerification, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
