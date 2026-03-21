'use client';

import { useEffect, useState } from 'react';
import { Loader2, User, CreditCard, Shield } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Account Section */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="h-5 w-5 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Account</h2>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Email</span>
              <p className="text-white">{user?.email || '—'}</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Account ID</span>
              <p className="text-slate-500 text-sm font-mono">{user?.id || '—'}</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Created</span>
              <p className="text-white">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription Section */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="h-5 w-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Subscription</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Free Plan</p>
              <p className="text-sm text-slate-400">
                Upgrade to unlock full scan results, weekly monitoring, and more.
              </p>
            </div>
            <span className="px-3 py-1 bg-slate-500/20 text-slate-300 text-sm rounded-full">
              Free
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-4">
            Billing integration coming soon with Stripe.
          </p>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-semibold text-white">Danger Zone</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Deleting your account will permanently remove all sites and scan data.
          </p>
          <button
            disabled
            className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
          >
            Delete Account (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );
}
