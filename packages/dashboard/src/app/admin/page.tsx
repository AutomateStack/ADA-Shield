'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  Globe,
  Users,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Clock,
  BarChart3,
  RefreshCw,
  Mail,
  Upload,
  FileText,
  Zap,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';

interface AdminStats {
  totalScans: number;
  freeScans: number;
  authenticatedScans: number;
  scansLast24h: number;
  scansLast7d: number;
  totalSites: number;
  activeSubscriptions: number;
  avgRiskScore: number;
}

interface TopUrl {
  hostname: string;
  scanCount: number;
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [topUrls, setTopUrls] = useState<TopUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { 'x-admin-secret': adminSecret };
      const [statsRes, topRes] = await Promise.all([
        fetch(`${apiUrl}/api/admin/stats`, { headers }),
        fetch(`${apiUrl}/api/admin/scans/top-urls?limit=10`, { headers }),
      ]);

      if (!statsRes.ok || !topRes.ok) {
        throw new Error('Failed to fetch admin data');
      }

      setStats(await statsRes.json());
      setTopUrls(await topRes.json());
      setLastRefreshed(new Date().toISOString());
    } catch (err: any) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
        <p className="font-medium">Error loading admin data</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const conversionRate =
    stats.totalScans > 0
      ? Math.round((stats.authenticatedScans / stats.totalScans) * 100)
      : 0;

  const riskColor =
    stats.avgRiskScore >= 70
      ? 'text-red-400'
      : stats.avgRiskScore >= 40
      ? 'text-amber-400'
      : 'text-green-400';

  const riskBarColor =
    stats.avgRiskScore >= 70
      ? 'bg-risk-high'
      : stats.avgRiskScore >= 40
      ? 'bg-risk-medium'
      : 'bg-risk-low';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Platform-wide analytics and metrics</p>
          {lastRefreshed && (
            <p className="text-xs text-slate-600 mt-0.5">
              Updated {formatRelativeTime(lastRefreshed)}
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="h-5 w-5 text-brand-400" />}
          label="Total Scans"
          value={stats.totalScans.toLocaleString()}
          sub={`${stats.freeScans.toLocaleString()} free Â· ${stats.authenticatedScans.toLocaleString()} paid`}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-green-400" />}
          label="Scans (24h)"
          value={stats.scansLast24h.toLocaleString()}
          sub={`${stats.scansLast7d.toLocaleString()} this week`}
          highlight={stats.scansLast24h > 0}
        />
        <StatCard
          icon={<Globe className="h-5 w-5 text-purple-400" />}
          label="Registered Sites"
          value={stats.totalSites.toLocaleString()}
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5 text-amber-400" />}
          label="Active Subscriptions"
          value={stats.activeSubscriptions.toLocaleString()}
          sub={`${conversionRate}% free-to-paid conversion`}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Risk Score */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h3 className="text-sm font-medium text-slate-300">Avg Risk Score</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${riskColor}`}>{stats.avgRiskScore}</span>
            <span className="text-sm text-slate-500">/ 100</span>
          </div>
          <div className="mt-3 w-full bg-white/10 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${riskBarColor}`}
              style={{ width: `${Math.min(stats.avgRiskScore, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {stats.avgRiskScore >= 70
              ? 'High average â€” many sites at lawsuit risk'
              : stats.avgRiskScore >= 40
              ? 'Moderate average â€” some compliance gaps'
              : 'Low average â€” sites generally compliant'}
          </p>
        </div>

        {/* Scan breakdown */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-5 w-5 text-green-400" />
            <h3 className="text-sm font-medium text-slate-300">Free vs Paid Scans</h3>
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-bold text-white">{stats.freeScans.toLocaleString()}</div>
              <div className="text-xs text-slate-500">Free Scans</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.authenticatedScans.toLocaleString()}</div>
              <div className="text-xs text-slate-500">Paid Scans</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${conversionRate >= 20 ? 'text-green-400' : conversionRate >= 10 ? 'text-amber-400' : 'text-slate-300'}`}>
                {conversionRate}%
              </div>
              <div className="text-xs text-slate-500">Conversion</div>
            </div>
          </div>
          {stats.totalScans > 0 && (
            <div className="mt-4 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 bg-brand-500 rounded-full"
                style={{ width: `${conversionRate}%` }}
              />
            </div>
          )}
        </div>

        {/* Velocity card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="h-5 w-5 text-yellow-400" />
            <h3 className="text-sm font-medium text-slate-300">Scan Velocity</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Last 24 hours</span>
              <span className="text-sm font-semibold text-white">{stats.scansLast24h}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Last 7 days</span>
              <span className="text-sm font-semibold text-white">{stats.scansLast7d}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Daily avg (7d)</span>
              <span className="text-sm font-semibold text-white">
                {stats.scansLast7d > 0 ? Math.round(stats.scansLast7d / 7) : 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Quick Access
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/admin/users', icon: Users, label: 'Users', color: 'text-purple-400' },
            { href: '/admin/outreach', icon: Mail, label: 'Outreach', color: 'text-brand-400' },
            { href: '/admin/bulk-import', icon: Upload, label: 'Bulk Import', color: 'text-green-400' },
            { href: '/admin/blog', icon: FileText, label: 'Blog', color: 'text-amber-400' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group"
            >
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-sm text-slate-300">{item.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-600 ml-auto group-hover:text-slate-400 transition-colors" />
            </Link>
          ))}
        </div>
      </div>

      {/* Top Scanned URLs */}
      <div className="bg-white/5 border border-white/10 rounded-xl">
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-brand-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Top Scanned Sites</h3>
            <p className="text-xs text-slate-500 mt-0.5">Domains scanned most often across all users</p>
          </div>
        </div>
        {topUrls.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <ShieldCheck className="h-7 w-7 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No scans recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {topUrls.map((item, i) => {
              const maxCount = topUrls[0]?.scanCount || 1;
              const pct = Math.round((item.scanCount / maxCount) * 100);
              return (
                <div key={item.hostname} className="px-6 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-5 text-right font-mono">{i + 1}</span>
                      <span className="text-sm text-slate-300">{item.hostname}</span>
                    </div>
                    <span className="text-sm font-medium text-white">
                      {item.scanCount.toLocaleString()} {item.scanCount === 1 ? 'scan' : 'scans'}
                    </span>
                  </div>
                  <div className="ml-8 w-full bg-white/5 rounded-full h-1">
                    <div
                      className="h-1 bg-brand-500/60 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`border rounded-xl p-5 transition-colors ${highlight ? 'bg-brand-500/5 border-brand-500/20' : 'bg-white/5 border-white/10'}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
