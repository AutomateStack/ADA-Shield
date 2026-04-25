'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Send, Eye, MousePointerClick, MessageSquare } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

interface DayPoint {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
}

interface Funnel {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

interface AnalyticsData {
  timeSeries: DayPoint[];
  funnel: Funnel;
  days: number;
}

const FUNNEL_STEPS = [
  { key: 'sent' as const,    label: 'Sent',    icon: Send,               color: '#6366f1', rateKey: null },
  { key: 'opened' as const,  label: 'Opened',  icon: Eye,                color: '#22c55e', rateKey: 'openRate' as const },
  { key: 'clicked' as const, label: 'Clicked', icon: MousePointerClick,  color: '#f59e0b', rateKey: 'clickRate' as const },
  { key: 'replied' as const, label: 'Replied', icon: MessageSquare,      color: '#ec4899', rateKey: 'replyRate' as const },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300 capitalize">{p.dataKey}:</span>
          <span className="text-white font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/analytics?days=${days}`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret, days]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const funnelMax = data?.funnel.sent || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Outreach Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">Email funnel performance over time</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">{error}</div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading analytics…
        </div>
      ) : data ? (
        <>
          {/* Funnel cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FUNNEL_STEPS.map(({ key, label, icon: Icon, color, rateKey }) => (
              <div key={key} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4" style={{ color }} />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{data.funnel[key].toLocaleString()}</div>
                {rateKey && (
                  <div className="text-xs text-slate-500">{data.funnel[rateKey]}% of sent</div>
                )}
                <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.round((data.funnel[key] / funnelMax) * 100)}%`, background: color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Bar chart — daily volumes */}
          {data.timeSeries.length > 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-white mb-4">Daily Volume</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.timeSeries} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Bar dataKey="sent"   fill="#6366f1" radius={[3,3,0,0]} maxBarSize={24} />
                  <Bar dataKey="opened" fill="#22c55e" radius={[3,3,0,0]} maxBarSize={24} />
                  <Bar dataKey="clicked" fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={24} />
                  <Bar dataKey="replied" fill="#ec4899" radius={[3,3,0,0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center text-slate-500 text-sm">
              No email activity in the last {days} days
            </div>
          )}

          {/* Line chart — engagement rates */}
          {data.timeSeries.length > 1 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-white mb-4">Engagement Trend</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={data.timeSeries.map((d) => ({
                    ...d,
                    openPct: d.sent > 0 ? Math.round((d.opened / d.sent) * 100) : 0,
                    clickPct: d.sent > 0 ? Math.round((d.clicked / d.sent) * 100) : 0,
                  }))}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    unit="%"
                    domain={[0, 100]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="openPct"  stroke="#22c55e" strokeWidth={2} dot={false} name="Open %" />
                  <Line type="monotone" dataKey="clickPct" stroke="#f59e0b" strokeWidth={2} dot={false} name="Click %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
