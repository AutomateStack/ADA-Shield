'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Flame, TrendingUp, Snowflake, Eye, MousePointerClick, Mail, Globe, Clock } from 'lucide-react';

interface PipelineLead {
  id: string;
  site_id: string;
  recipient_email: string;
  subject: string;
  lead_score: number;
  lead_status: 'hot' | 'warm' | 'cold';
  opens_count: number;
  clicks_count: number;
  last_engagement_at: string | null;
  created_at: string;
  follow_up_status: string;
  replied_at: string | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  sites: { id: string; name: string | null; url: string } | null;
}

interface PipelineData {
  hot: PipelineLead[];
  warm: PipelineLead[];
  cold: PipelineLead[];
  total: number;
}

const formatRelative = (d: string | null) => {
  if (!d) return '—';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const COLUMNS: { key: 'hot' | 'warm' | 'cold'; label: string; icon: React.ElementType; color: string; bg: string; border: string }[] = [
  { key: 'hot',  label: 'Hot',  icon: Flame,       color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
  { key: 'warm', label: 'Warm', icon: TrendingUp,   color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  { key: 'cold', label: 'Cold', icon: Snowflake,    color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/30' },
];

function LeadCard({ lead }: { lead: PipelineLead }) {
  const siteName = lead.sites?.name || lead.sites?.url || '—';
  const siteUrl = lead.sites?.url || '';
  const statusBadge = lead.replied_at
    ? <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/10 text-green-400">Replied</span>
    : lead.unsubscribed_at
    ? <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-500/10 text-slate-400">Unsub</span>
    : lead.bounced_at
    ? <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-500/10 text-red-400">Bounced</span>
    : null;

  return (
    <div className="bg-slate-800/60 border border-white/8 rounded-lg p-3 space-y-2 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-200 truncate">{siteName}</div>
          {siteUrl && siteName !== siteUrl && (
            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <Globe className="h-3 w-3 flex-shrink-0" />{siteUrl}
            </div>
          )}
        </div>
        <span className="text-xs font-bold text-white bg-indigo-500/20 px-1.5 py-0.5 rounded flex-shrink-0">
          {lead.lead_score}
        </span>
      </div>

      <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
        <Mail className="h-3 w-3 flex-shrink-0" />
        {lead.recipient_email}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{lead.opens_count}</span>
        <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{lead.clicks_count}</span>
        {lead.last_engagement_at && (
          <span className="flex items-center gap-1 ml-auto"><Clock className="h-3 w-3" />{formatRelative(lead.last_engagement_at)}</span>
        )}
      </div>

      {statusBadge && <div>{statusBadge}</div>}
    </div>
  );
}

export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/pipeline`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) throw new Error('Failed to fetch pipeline');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message || 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Pipeline</h1>
          <p className="text-sm text-slate-400 mt-1">
            Contacts grouped by engagement level — {data ? `${data.total} total` : '…'}
          </p>
        </div>
        <button
          onClick={fetchPipeline}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">{error}</div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading pipeline…
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {COLUMNS.map(({ key, label, icon: Icon, color, bg, border }) => (
            <div key={key} className={`rounded-xl border ${border} ${bg} overflow-hidden`}>
              <div className={`px-4 py-3 border-b ${border} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className={`text-sm font-semibold ${color}`}>{label}</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">{data[key].length}</span>
              </div>
              <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
                {data[key].length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No {label.toLowerCase()} leads</p>
                ) : (
                  data[key].map((lead) => <LeadCard key={lead.id} lead={lead} />)
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
