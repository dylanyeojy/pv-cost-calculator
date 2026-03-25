import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Calculator } from 'lucide-react';
import { AnimatedBackground } from '@/components/AnimatedBackground';

type View = 'signin' | 'signup' | 'forgot';

export default function LoginPage() {
  const { signInWithEmail, signUp, resetPassword } = useAuth();
  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = (next: View) => {
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setView(next);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess('Password reset email sent. Check your inbox.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <AnimatedBackground />
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-card border border-border/60 rounded-2xl shadow-xl p-8 flex flex-col gap-6">

          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <Calculator className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">Pressure Vessel Costing</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {view === 'signin' && 'Sign in to your account'}
                {view === 'signup' && 'Create a new account'}
                {view === 'forgot' && 'Reset your password'}
              </p>
            </div>
          </div>

          {/* Sign In */}
          {view === 'signin' && (
            <form onSubmit={handleSignIn} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@finematrix.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground" htmlFor="password">Password</label>
                  <button
                    type="button"
                    onClick={() => reset('forgot')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="h-9 w-full rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Don't have an account?{' '}
                <button type="button" onClick={() => reset('signup')} className="text-foreground hover:underline font-medium">
                  Sign up
                </button>
              </p>
            </form>
          )}

          {/* Sign Up */}
          {view === 'signup' && (
            <form onSubmit={handleSignUp} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground" htmlFor="su-email">Email</label>
                <input
                  id="su-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@finematrix.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground" htmlFor="su-password">Password</label>
                <input
                  id="su-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground" htmlFor="su-confirm">Confirm password</label>
                <input
                  id="su-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="h-9 w-full rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{' '}
                <button type="button" onClick={() => reset('signin')} className="text-foreground hover:underline font-medium">
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* Forgot Password */}
          {view === 'forgot' && (
            <form onSubmit={handleForgot} className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground" htmlFor="fp-email">Email</label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@finematrix.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}
              <button
                type="submit"
                disabled={loading}
                className="h-9 w-full rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send reset email'}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                <button type="button" onClick={() => reset('signin')} className="text-foreground hover:underline font-medium">
                  Back to sign in
                </button>
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
