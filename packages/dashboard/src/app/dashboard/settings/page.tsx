'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, User, CreditCard, Shield, CheckCircle, ExternalLink, Bell, Mail } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

interface Subscription {
  plan: string;
  status: string | null;
  currentPeriodEnd: string | null;
  pagesLimit: number;
  sitesLimit: number;
}

interface NotificationPrefs {
  scanComplete: boolean;
  riskAlerts: boolean;
  weeklySummary: boolean;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    scanComplete: true,
    riskAlerts: true,
    weeklySummary: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get('checkout') === 'success';

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);

        // Fetch subscription from API
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
          const [subRes, notifRes] = await Promise.all([
            fetch(`${apiUrl}/api/billing/subscription`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }),
            fetch(`${apiUrl}/api/notifications`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }),
          ]);
          if (subRes.ok) {
            setSubscription(await subRes.json());
          }
          if (notifRes.ok) {
            setNotifPrefs(await notifRes.json());
          }
        } catch {
          // Fetch failed — show defaults
        }
      }

      setLoading(false);
    };
    load();
  }, []);

  const handleToggleNotification = async (
    key: 'scanComplete' | 'riskAlerts' | 'weeklySummary'
  ) => {
    const newPrefs = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(newPrefs);
    setNotifSaving(true);

    try {
      const supabase = createSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          scan_complete: newPrefs.scanComplete,
          risk_alerts: newPrefs.riskAlerts,
          weekly_summary: newPrefs.weeklySummary,
        }),
      });
      if (!res.ok) {
        // Revert optimistic update on API failure
        setNotifPrefs(notifPrefs);
      }
    } catch {
      // Revert on network failure
      setNotifPrefs(notifPrefs);
    } finally {
      setNotifSaving(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const supabase = createSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/billing/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Portal request failed
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  const isPaid = subscription && subscription.plan !== 'free' && subscription.status === 'active';
  const planLabel = subscription?.plan
    ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
    : 'Free';

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {checkoutSuccess && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
          <p className="text-green-300 text-sm">
            Payment successful! Your subscription is now active.
          </p>
        </div>
      )}

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

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white font-medium">{planLabel} Plan</p>
              {isPaid && subscription.currentPeriodEnd && (
                <p className="text-sm text-slate-400">
                  Renews on{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
              {!isPaid && (
                <p className="text-sm text-slate-400">
                  Upgrade to unlock full scan results, weekly monitoring, and more.
                </p>
              )}
            </div>
            <span
              className={`px-3 py-1 text-sm rounded-full ${
                isPaid
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-slate-500/20 text-slate-300'
              }`}
            >
              {isPaid ? 'Active' : 'Free'}
            </span>
          </div>

          {isPaid && (
            <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-white/5 rounded-lg">
              <div>
                <span className="text-xs text-slate-400">Sites Allowed</span>
                <p className="text-white font-medium">
                  {subscription.sitesLimit >= 9999 ? 'Unlimited' : subscription.sitesLimit}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Pages per Scan</span>
                <p className="text-white font-medium">
                  {subscription.pagesLimit >= 9999 ? 'Unlimited' : subscription.pagesLimit}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {isPaid ? (
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Manage Billing
              </button>
            ) : (
              <Link
                href="/dashboard/billing"
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Upgrade Plan
              </Link>
            )}
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Email Notifications</h2>
            {notifSaving && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>
          <div className="space-y-4">
            {([
              {
                key: 'scanComplete' as const,
                label: 'Scan Complete',
                description: 'Get notified when a scan finishes with results summary.',
                icon: <CheckCircle className="h-4 w-4 text-green-400" />,
              },
              {
                key: 'riskAlerts' as const,
                label: 'High Risk Alerts',
                description: 'Receive urgent alerts when a site scores 70+ risk.',
                icon: <Shield className="h-4 w-4 text-red-400" />,
              },
              {
                key: 'weeklySummary' as const,
                label: 'Weekly Summary',
                description: 'Get a weekly email summarizing all monitored sites.',
                icon: <Mail className="h-4 w-4 text-brand-400" />,
              },
            ]).map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{item.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleNotification(item.key)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    notifPrefs[item.key] ? 'bg-brand-600' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifPrefs[item.key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
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
