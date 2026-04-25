'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Globe,
  Activity,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  createdAt: string;
  lastSignIn: string | null;
  siteCount: number;
  scanCount: number;
  plan: string;
  subscriptionStatus: string | null;
}

interface ScanSummary {
  id: string;
  risk_score: number;
  total_violations: number;
  critical_count: number;
  serious_count: number;
  created_at: string;
  public_token: string | null;
}

interface UserSite {
  id: string;
  url: string;
  name: string | null;
  createdAt: string;
  lastScannedAt: string | null;
  scanCount: number;
  latestScan: ScanSummary | null;
}

interface UserDetail {
  sites: UserSite[];
}

const formatDate = (d: string | null) => {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatRelative = (d: string | null) => {
  if (!d) return '—';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

function RiskBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-red-400 bg-red-500/10' : score >= 40 ? 'text-amber-400 bg-amber-500/10' : 'text-green-400 bg-green-500/10';
  const label = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${color}`}>
      {score >= 70 && <AlertTriangle className="h-3 w-3" />}
      {score < 40 && <CheckCircle className="h-3 w-3" />}
      {score}/100 · {label}
    </span>
  );
}

function UserDetailPanel({
  userId,
  apiUrl,
  adminSecret,
  dashboardUrl,
}: {
  userId: string;
  apiUrl: string;
  adminSecret: string;
  dashboardUrl: string;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${apiUrl}/api/admin/users/${userId}`, {
      headers: { 'x-admin-secret': adminSecret },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load user detail'))))
      .then((d) => { if (!cancelled) { setDetail(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [userId, apiUrl, adminSecret]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 px-6 text-slate-400 text-sm">
        <RefreshCw className="h-4 w-4 animate-spin" /> Loading sites…
      </div>
    );
  }

  if (error) {
    return <div className="px-6 py-4 text-red-400 text-sm">{error}</div>;
  }

  if (!detail || detail.sites.length === 0) {
    return <div className="px-6 py-6 text-slate-500 text-sm">No sites registered yet.</div>;
  }

  return (
    <div className="px-4 pb-4 pt-2 space-y-3">
      {detail.sites.map((site) => (
        <div key={site.id} className="bg-slate-800/60 border border-white/8 rounded-lg p-4">
          {/* Site header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-200 truncate">{site.name || site.url}</span>
              </div>
              {site.name && (
                <div className="text-xs text-slate-500 ml-5 truncate mt-0.5">{site.url}</div>
              )}
            </div>
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-indigo-400 flex-shrink-0"
              title="Open site"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" />
              {site.scanCount} scan{site.scanCount !== 1 ? 's' : ''}
            </span>
            {site.lastScannedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Last scanned {formatRelative(site.lastScannedAt)}
              </span>
            )}
          </div>

          {/* Latest scan result */}
          {site.latestScan ? (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Latest scan:</span>
                  <RiskBadge score={site.latestScan.risk_score} />
                  <span className="text-xs text-slate-500">
                    {site.latestScan.total_violations} issues
                    {site.latestScan.critical_count > 0 && (
                      <> · <span className="text-red-400">{site.latestScan.critical_count} critical</span></>
                    )}
                    {site.latestScan.serious_count > 0 && (
                      <> · <span className="text-amber-400">{site.latestScan.serious_count} serious</span></>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">{formatDate(site.latestScan.created_at)}</span>
                  {site.latestScan.public_token && (
                    <a
                      href={`${dashboardUrl}/report/${site.latestScan.public_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-300 hover:text-white bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded transition-colors"
                    >
                      View Report <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <a
                    href={`/admin/scans?siteId=${site.id}`}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors"
                  >
                    All Scans
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-white/5 text-xs text-slate-600">No scans yet</div>
          )}
        </div>
      ))}
    </div>
  );
}

function PlanBadge({ plan, status }: { plan: string; status: string | null }) {
  const colors: Record<string, string> = {
    agency: 'bg-purple-500/10 text-purple-400',
    business: 'bg-brand-500/10 text-brand-300',
    starter: 'bg-green-500/10 text-green-400',
    free: 'bg-slate-500/10 text-slate-400',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium capitalize', colors[plan] || colors.free)}>
      {plan}
      {status === 'canceled' && <span className="text-red-400 ml-1">(canceled)</span>}
    </span>
  );
}

export default function AdminUsersPage() {
  const [data, setData] = useState<{ users: User[]; page: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || '';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/users?page=${page}&limit=20`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleExpand = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-slate-400 mt-1">All registered users — click a row to see their sites and scan results</p>
        </div>
        <button onClick={fetchUsers} className="p-2 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">{error}</div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Plan</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Sites</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Scans</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Joined</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Last Sign In</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />Loading users...
                  </td>
                </tr>
              ) : !data || data.users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">No users found</td>
                </tr>
              ) : (
                data.users.map((user) => (
                  <>
                    <tr
                      key={user.id}
                      onClick={() => toggleExpand(user.id)}
                      className={cn(
                        'transition-colors cursor-pointer select-none',
                        expandedUserId === user.id
                          ? 'bg-indigo-600/5 border-indigo-500/20'
                          : 'hover:bg-white/[0.02]'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-indigo-600/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-indigo-300">
                            {user.email[0].toUpperCase()}
                          </div>
                          <span className="text-slate-200 text-sm">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={user.plan} status={user.subscriptionStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Globe className="h-3.5 w-3.5 text-slate-500" />
                          {user.siteCount}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Activity className="h-3.5 w-3.5 text-slate-500" />
                          {user.scanCount}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">
                        {user.lastSignIn ? formatDate(user.lastSignIn) : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {expandedUserId === user.id
                          ? <ChevronUp className="h-4 w-4 text-indigo-400" />
                          : <ChevronDown className="h-4 w-4" />}
                      </td>
                    </tr>

                    {expandedUserId === user.id && (
                      <tr key={`${user.id}-detail`} className="bg-slate-900/60">
                        <td colSpan={7} className="p-0">
                          <UserDetailPanel
                            userId={user.id}
                            apiUrl={apiUrl}
                            adminSecret={adminSecret}
                            dashboardUrl={dashboardUrl}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-white/10 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">Page {page}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed bg-white/5 rounded"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data || data.users.length < 20}
              className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed bg-white/5 rounded"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
