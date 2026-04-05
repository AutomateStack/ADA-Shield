'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Globe, ChevronDown, ChevronUp, X } from 'lucide-react';

const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
};

type LeadStatus = 'cold' | 'warm' | 'hot';
type FollowUpStatus = 'none' | 'scheduled' | 'sent' | 'skipped' | 'canceled';

interface ContactEntry {
  id: string;
  recipient_email: string;
  subject: string;
  message: string;
  template_style: string | null;
  delivery_channel: string | null;
  delivery_status: 'sent' | 'failed' | null;
  opens_count: number;
  clicks_count: number;
  lead_score: number;
  lead_status: LeadStatus;
  follow_up_status: FollowUpStatus;
  follow_up_rule: string | null;
  follow_up_scheduled_for: string | null;
  last_engagement_at: string | null;
  created_at: string;
}

interface TopLead {
  id: string;
  siteId: string;
  recipientEmail: string;
  subject: string;
  leadScore: number;
  leadStatus: LeadStatus;
  opensCount: number;
  clicksCount: number;
  lastEngagementAt: string | null;
  followUpStatus: string | null;
  followUpScheduledFor: string | null;
  siteName: string | null;
  siteUrl: string | null;
}

interface RecentEvent {
  id: string;
  event_type: string;
  created_at: string;
}

interface OutreachOverview {
  summary: {
    sentCount: number;
    openedCount: number;
    clickedCount: number;
    openRate: number;
    clickRate: number;
    hotLeadCount: number;
    followUpsScheduled: number;
  };
  topLeads: TopLead[];
  recentEvents: RecentEvent[];
}

interface SiteOutreachAnalytics {
  site: { id: string; name: string | null; url: string } | null;
  summary: {
    sentCount: number;
    openedCount: number;
    clickedCount: number;
    openRate: number;
    clickRate: number;
    hotLeadCount: number;
    followUpsScheduled: number;
    topLeadScore: number;
    topLeadStatus: LeadStatus;
    lastEngagementAt: string | null;
  };
  entries: ContactEntry[];
  events: Array<{ id: string; event_type: string; created_at: string; metadata?: Record<string, unknown> }>;
}

function LeadBadge({ status, score }: { status: LeadStatus; score: number }) {
  const cls =
    status === 'hot'
      ? 'bg-red-500/15 text-red-300'
      : status === 'warm'
      ? 'bg-amber-500/15 text-amber-300'
      : 'bg-slate-500/15 text-slate-400';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {score} <span className="capitalize">{status}</span>
    </span>
  );
}

function FollowUpBadge({ status }: { status: FollowUpStatus }) {
  const cls =
    status === 'sent'
      ? 'bg-green-500/10 text-green-400'
      : status === 'scheduled'
      ? 'bg-brand-500/10 text-brand-300'
      : status === 'skipped' || status === 'canceled'
      ? 'bg-slate-500/10 text-slate-400'
      : 'bg-white/5 text-slate-500';
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

const STAT = ({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
    <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
    <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
  </div>
);

export default function AdminOutreachPage() {
  const [overview, setOverview] = useState<OutreachOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, SiteOutreachAnalytics>>({});
  const [analyticsLoading, setAnalyticsLoading] = useState<Record<string, boolean>>({});
  const [detailModal, setDetailModal] = useState<ContactEntry | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/outreach/overview?limit=20`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) throw new Error('Failed to fetch outreach overview');
      const payload: OutreachOverview = await res.json();
      setOverview(payload);
    } catch (err: any) {
      setError(err.message || 'Failed to load outreach data');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const toggleLeadRow = async (lead: TopLead) => {
    if (expandedLead === lead.id) {
      setExpandedLead(null);
      return;
    }
    setExpandedLead(lead.id);
    if (analytics[lead.siteId]) return;

    setAnalyticsLoading((prev) => ({ ...prev, [lead.siteId]: true }));
    try {
      const res = await fetch(`${apiUrl}/api/admin/sites/${lead.siteId}/outreach-analytics`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) throw new Error('Failed to load analytics');
      const payload: SiteOutreachAnalytics = await res.json();
      setAnalytics((prev) => ({ ...prev, [lead.siteId]: payload }));
    } catch {
      // silently skip
    } finally {
      setAnalyticsLoading((prev) => ({ ...prev, [lead.siteId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Outreach Tracking</h1>
          <p className="text-sm text-slate-400 mt-1">
            Email opens, clicks, lead scores, and automated follow-up status
          </p>
        </div>
        <button
          onClick={fetchOverview}
          className="p-2 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading && !overview && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Loading outreach data…
        </div>
      )}

      {overview && (
        <>
          {/* Summary stats */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <STAT label="Emails Sent" value={overview.summary.sentCount} />
            <STAT
              label="Open Rate"
              value={`${overview.summary.openRate}%`}
              sub={`${overview.summary.openedCount} recipients opened`}
            />
            <STAT
              label="Click Rate"
              value={`${overview.summary.clickRate}%`}
              sub={`${overview.summary.clickedCount} clicked a link`}
            />
            <STAT
              label="Hot Leads"
              value={overview.summary.hotLeadCount}
              sub={`${overview.summary.followUpsScheduled} follow-ups scheduled`}
            />
          </div>

          {/* Top leads table */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Top Leads by Engagement</h2>
              <p className="text-xs text-slate-400 mt-0.5">Highest-scoring recipients from tracked outreach emails.</p>
            </div>

            {overview.topLeads.length === 0 ? (
              <div className="px-5 py-12 text-center text-slate-500 text-sm">
                No tracked outreach activity yet. Send a tracked email from the Sites tab to start tracking.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {overview.topLeads.map((lead) => {
                  const isOpen = expandedLead === lead.id;
                  const siteData = analytics[lead.siteId];
                  const isLoadingAnalytics = analyticsLoading[lead.siteId];

                  return (
                    <div key={lead.id}>
                      <button
                        onClick={() => toggleLeadRow(lead)}
                        className="w-full text-left px-5 py-4 hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-slate-200 text-sm truncate">
                                {lead.siteName || lead.siteUrl || lead.recipientEmail}
                              </span>
                              <LeadBadge status={lead.leadStatus} score={lead.leadScore} />
                              <FollowUpBadge status={(lead.followUpStatus as FollowUpStatus) || 'none'} />
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500 truncate">
                              <Globe className="h-3 w-3 flex-shrink-0" />
                              {lead.siteUrl || lead.recipientEmail}
                            </div>
                          </div>
                          <div className="flex items-center gap-5 text-xs text-slate-400 flex-shrink-0">
                            <span>{lead.opensCount} opens</span>
                            <span>{lead.clicksCount} clicks</span>
                            <span>{formatRelativeTime(lead.lastEngagementAt)}</span>
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4 text-slate-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5 bg-black/20">
                          {isLoadingAnalytics && (
                            <div className="py-6 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                              <RefreshCw className="h-4 w-4 animate-spin" /> Loading analytics…
                            </div>
                          )}

                          {!isLoadingAnalytics && siteData && (
                            <div className="space-y-4 pt-4">
                              {/* Per-site summary */}
                              <div className="grid gap-3 sm:grid-cols-4">
                                {[
                                  { label: 'Sent', value: siteData.summary.sentCount },
                                  { label: 'Open Rate', value: `${siteData.summary.openRate}%` },
                                  { label: 'Click Rate', value: `${siteData.summary.clickRate}%` },
                                  { label: 'Top Score', value: siteData.summary.topLeadScore },
                                ].map((s) => (
                                  <div
                                    key={s.label}
                                    className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                                  >
                                    <div className="text-[11px] uppercase tracking-wider text-slate-500">
                                      {s.label}
                                    </div>
                                    <div className="mt-1.5 text-lg font-semibold text-white">{s.value}</div>
                                  </div>
                                ))}
                              </div>

                              {/* Email history list */}
                              <div className="space-y-3">
                                {siteData.entries.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="rounded-lg border border-white/10 bg-white/[0.02] p-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
                                    onClick={() => setDetailModal(entry)}
                                  >
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <LeadBadge status={entry.lead_status} score={entry.lead_score} />
                                      <FollowUpBadge status={entry.follow_up_status} />
                                      <span className="text-xs text-slate-500 ml-auto">
                                        {new Date(entry.created_at).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="text-sm font-medium text-slate-200">{entry.subject}</div>
                                    <div className="mt-1 text-xs text-slate-400">To: {entry.recipient_email}</div>
                                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                                      <span>{entry.opens_count} opens</span>
                                      <span>{entry.clicks_count} clicks</span>
                                      {entry.follow_up_rule && (
                                        <span>Rule: {entry.follow_up_rule.replace(/_/g, ' ')}</span>
                                      )}
                                      {entry.follow_up_scheduled_for && (
                                        <span>
                                          Follow-up: {formatRelativeTime(entry.follow_up_scheduled_for)}
                                        </span>
                                      )}
                                      {entry.last_engagement_at && (
                                        <span>
                                          Last activity: {formatRelativeTime(entry.last_engagement_at)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Recent events for site */}
                              {siteData.events.length > 0 && (
                                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                                  <div className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">
                                    Recent Tracking Events
                                  </div>
                                  <div className="space-y-2">
                                    {siteData.events.slice(0, 12).map((ev) => (
                                      <div
                                        key={ev.id}
                                        className="flex items-center justify-between gap-2 text-xs text-slate-400"
                                      >
                                        <span className="capitalize">
                                          {ev.event_type.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-slate-600">
                                          {formatRelativeTime(ev.created_at)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent global events */}
          {overview.recentEvents.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Recent Activity</h2>
              <div className="space-y-2">
                {overview.recentEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between text-xs text-slate-400">
                    <span className="capitalize">{ev.event_type.replace(/_/g, ' ')}</span>
                    <span className="text-slate-600">{formatRelativeTime(ev.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Message detail modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h3 className="text-base font-semibold text-white">{detailModal.subject}</h3>
                <div className="mt-1 flex gap-2 flex-wrap">
                  <LeadBadge status={detailModal.lead_status} score={detailModal.lead_score} />
                  <FollowUpBadge status={detailModal.follow_up_status} />
                </div>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs text-slate-400">
                <div>
                  <div className="text-slate-500 uppercase tracking-wider mb-1">To</div>
                  <div className="text-slate-200">{detailModal.recipient_email}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider mb-1">Sent</div>
                  <div className="text-slate-200">{new Date(detailModal.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider mb-1">Opens</div>
                  <div className="text-slate-200">{detailModal.opens_count}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider mb-1">Clicks</div>
                  <div className="text-slate-200">{detailModal.clicks_count}</div>
                </div>
              </div>
              {detailModal.follow_up_rule && (
                <div className="text-xs text-slate-400">
                  <span className="text-slate-500 uppercase tracking-wider">Follow-up rule: </span>
                  {detailModal.follow_up_rule.replace(/_/g, ' ')}
                </div>
              )}
              {detailModal.last_engagement_at && (
                <div className="text-xs text-slate-400">
                  <span className="text-slate-500 uppercase tracking-wider">Last activity: </span>
                  {formatRelativeTime(detailModal.last_engagement_at)}
                </div>
              )}
              <div className="border-t border-white/10 pt-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Message</div>
                <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {detailModal.message}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
