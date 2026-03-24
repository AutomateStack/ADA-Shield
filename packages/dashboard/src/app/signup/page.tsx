'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Shield, Loader2, AlertCircle, CheckCircle, Check, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

// ── Password strength helpers ────────────────────────────────────────────────
function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!pw) return { level: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const map: [string, string][] = [
    ['Weak', 'bg-red-500'],
    ['Fair', 'bg-orange-500'],
    ['Good', 'bg-yellow-500'],
    ['Strong', 'bg-green-500'],
    ['Very Strong', 'bg-emerald-500'],
  ];
  return { level: score as 0 | 1 | 2 | 3 | 4, label: map[score][0], color: map[score][1] };
}

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userExists, setUserExists] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUserExists(false);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (authError) {
        // Supabase may return an explicit "already registered" error
        const msg = authError.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('email address is already')) {
          setUserExists(true);
          return;
        }
        throw authError;
      }

      // When email confirmation is on, Supabase returns a user with no identities
      // for an already-existing email — detect that case
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        setUserExists(true);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          {/* Back to home */}
          <div className="mb-4 text-left">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
          <Link href="/" className="flex items-center justify-center gap-2 mb-8">
            <Shield className="h-8 w-8 text-brand-400" />
            <span className="text-2xl font-bold text-white">ADA Shield</span>
          </Link>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
            <p className="text-slate-400 text-sm mb-6">
              We&apos;ve sent a confirmation link to <strong className="text-white">{email}</strong>.
              Click the link to activate your account.
            </p>

            {/* Step 2 — pay after confirming */}
            <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-brand-300 uppercase tracking-wide mb-1">
                Step 2 — Complete your purchase
              </p>
              <p className="text-sm text-slate-300 mb-3">
                Once you confirm your email, activate your plan on Gumroad to unlock full access.
              </p>
              <a
                href="https://thirmal.gumroad.com/l/onvhab"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Activate Your Plan
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Back to home */}
        <div className="mb-4">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Shield className="h-8 w-8 text-brand-400" />
          <span className="text-2xl font-bold text-white">ADA Shield</span>
        </Link>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Create Your Account
          </h1>
          <p className="text-slate-400 text-center text-sm mb-6">
            Start monitoring your sites for ADA compliance.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {userExists && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
              <p className="text-yellow-300 font-medium mb-1">Account already exists</p>
              <p className="text-slate-400">
                An account with <strong className="text-white">{email}</strong> already exists.{' '}
                <Link href="/login" className="text-brand-400 hover:text-brand-300 underline">
                  Sign in instead
                </Link>{' '}
                or{' '}
                <Link href="/forgot-password" className="text-brand-400 hover:text-brand-300 underline">
                  reset your password
                </Link>.
              </p>
            </div>
          )}

          {/* Google OAuth */}
          <button
            type="button"
            onClick={async () => {
              const supabase = createSupabaseBrowser();
              await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/api/auth/callback`,
                },
              });
            }}
            disabled={loading}
            className="w-full py-3 mb-4 bg-white hover:bg-slate-100 disabled:bg-slate-200 disabled:cursor-not-allowed text-slate-800 font-semibold rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white/5 px-2 text-slate-500">or</span>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-4 py-3 pr-11 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Password strength meter */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((seg) => (
                      <div
                        key={seg}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          strength.level >= seg ? strength.color : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Strength: <span className="text-white font-medium">{strength.label}</span>
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className={`w-full px-4 py-3 pr-11 rounded-lg bg-white/10 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-red-500/60'
                      : 'border-white/20'
                  }`}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>

        {/* Trust Signals */}
        <div className="flex flex-col items-center gap-2 mt-6">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Check className="h-4 w-4 text-green-400" />
            No credit card required
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Check className="h-4 w-4 text-green-400" />
            Free scan included
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Check className="h-4 w-4 text-green-400" />
            Cancel anytime
          </div>
        </div>
      </div>
    </div>
  );
}
