'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan: string;
  status: string;
  pages_limit: number;
  sites_limit: number;
  current_period_end: string;
  created_at: string;
}

interface SubsResponse {
  subscriptions: Subscription[];
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminSubscriptionsPage() {
  const [data, setData] = useState<SubsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/subscriptions?page=${page}&limit=20`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) throw new Error('Failed to fetch subscriptions');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret, page]);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  // Revenue calculation
  const monthlyRevenue = data
    ? data.subscriptions
        .filter((s) => s.status === 'active')
        .reduce((sum, s) => {
          const prices: Record<string, number> = { starter: 29, business: 99, agency: 199 };
          return sum + (prices[s.plan] || 0);
        }, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="text-sm text-slate-400 mt-1">
            {data ? `${data.total} total subscriptions` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={fetchSubs}
          className="p-2 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Revenue Summary */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">MRR (This Page)</div>
            <div className="text-2xl font-bold text-green-400">${monthlyRevenue}</div>
            <div className="text-xs text-slate-500 mt-1">/month from active subs</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Active</div>
            <div className="text-2xl font-bold text-white">
              {data.subscriptions.filter((s) => s.status === 'active').length}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Canceled / Past Due</div>
            <div className="text-2xl font-bold text-red-400">
              {data.subscriptions.filter((s) => s.status !== 'active').length}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">User ID</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Plan</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Limits</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Period End</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading subscriptions...
                  </td>
                </tr>
              ) : !data || data.subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                data.subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-slate-400 text-xs font-mono" title={sub.user_id}>
                        {sub.user_id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={sub.plan} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {sub.sites_limit >= 9999 ? '∞' : sub.sites_limit} sites, {sub.pages_limit >= 9999 ? '∞' : sub.pages_limit} pages
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                      {sub.current_period_end
                        ? new Date(sub.current_period_end).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="border-t border-white/10 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page {data.page} of {data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed bg-white/5 rounded"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed bg-white/5 rounded"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    agency: 'bg-purple-500/10 text-purple-400',
    business: 'bg-brand-500/10 text-brand-300',
    starter: 'bg-green-500/10 text-green-400',
  };

  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize', colors[plan] || 'bg-slate-500/10 text-slate-400')}>
      {plan}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400',
    trialing: 'bg-blue-500/10 text-blue-400',
    past_due: 'bg-amber-500/10 text-amber-400',
    canceled: 'bg-red-500/10 text-red-400',
  };

  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize', colors[status] || 'bg-slate-500/10 text-slate-400')}>
      {status?.replace('_', ' ')}
    </span>
  );
}
