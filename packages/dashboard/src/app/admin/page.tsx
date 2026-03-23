'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [topUrls, setTopUrls] = useState<TopUrl[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Platform-wide analytics and metrics
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="h-5 w-5 text-brand-400" />}
          label="Total Scans"
          value={stats.totalScans.toLocaleString()}
          sub={`${stats.freeScans} free / ${stats.authenticatedScans} auth`}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-green-400" />}
          label="Scans (24h)"
          value={stats.scansLast24h.toLocaleString()}
          sub={`${stats.scansLast7d} in last 7 days`}
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
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h3 className="text-sm font-medium text-slate-300">Avg Risk Score</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">{stats.avgRiskScore}</span>
            <span className="text-sm text-slate-500">/ 100</span>
          </div>
          <div className="mt-3 w-full bg-white/10 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                stats.avgRiskScore >= 70
                  ? 'bg-risk-high'
                  : stats.avgRiskScore >= 40
                  ? 'bg-risk-medium'
                  : 'bg-risk-low'
              }`}
              style={{ width: `${Math.min(stats.avgRiskScore, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-5 w-5 text-green-400" />
            <h3 className="text-sm font-medium text-slate-300">Free vs Paid Scans</h3>
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-bold text-white">{stats.freeScans}</div>
              <div className="text-xs text-slate-500">Free Scans</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.authenticatedScans}</div>
              <div className="text-xs text-slate-500">Paid Scans</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {stats.totalScans > 0
                  ? `${Math.round((stats.freeScans / stats.totalScans) * 100)}%`
                  : '0%'}
              </div>
              <div className="text-xs text-slate-500">Free Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Scanned URLs */}
      <div className="bg-white/5 border border-white/10 rounded-xl">
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-brand-400" />
          <h3 className="text-sm font-semibold text-white">Top Scanned Sites</h3>
        </div>
        {topUrls.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">
            No scans recorded yet
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {topUrls.map((item, i) => (
              <div key={item.hostname} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-5 text-right">{i + 1}.</span>
                  <span className="text-sm text-slate-300">{item.hostname}</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {item.scanCount} {item.scanCount === 1 ? 'scan' : 'scans'}
                </span>
              </div>
            ))}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">{icon}
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
