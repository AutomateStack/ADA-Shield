'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Globe,
  ChevronDown,
  ChevronUp,
  X,
  Mail,
  Eye,
  MousePointerClick,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Send,
  Clock,
  TrendingUp,
  Flame,
  AlertCircle,
  BarChart3,
  RotateCcw,
  ArrowRight,
  Loader2,
  ChevronRight,
} from 'lucide-react';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return 'â€”';
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

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'â€”';
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type LeadStatus = 'cold' | 'warm' | 'hot';
type FollowUpStatus = 'none' | 'scheduled' | 'sent' | 'skipped' | 'canceled';
type EventType = 'sent' | 'open' | 'click' | 'follow_up_scheduled' | 'follow_up_sent' | 'follow_up_canceled' | string;
type Tab = 'overview' | 'clicks' | 'followup';

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
  event_type: EventType;
  created_at: string;
  site_id?: string;
  contact_history_id?: string;
  metadata?: Record<string, unknown>;
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
  events: Array<{ id: string; event_type: EventType; created_at: string; metadata?: Record<string, unknown> }>;
}

interface ClickAnalytics {
  funnel: {
    sent: number;
    opened: number;
    clicked: number;
    totalClicks: number;
    openRate: number;
    clickRate: number;
    clickToOpenRate: number;
  };
  sitesWithClicks: Array<{
    siteId: string;
    siteName: string | null;
    siteUrl: string | null;
    emailsSent: number;
    opened: number;
    clicked: number;
    totalClicks: number;
    clickRate: number;
    lastClickAt: string | null;
    uniqueRecipients: number;
  }>;
  recentClicks: Array<{
    id: string;
    site_id: string;
    contact_history_id: string;
    event_type: string;
    url: string | null;
    created_at: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface FollowUpSite {
  siteId: string;
  siteName: string | null;
  siteUrl: string;
  ownerEmail: string | null;
  recipients: string[];
  hasEmail: boolean;
  contactedCount: number;
  lastContactedAt: string;
  daysSinceLastContact: number;
  totalEmailsSent: number;
  bestLeadScore: number;
  bestLeadStatus: LeadStatus;
  totalOpens: number;
  totalClicks: number;
  lastEngagementAt: string | null;
}

// â”€â”€â”€ Event display config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EVENT_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    label: string;
    dotColor: string;
    textColor: string;
    bgColor: string;
    getDescription: (meta?: Record<string, unknown>) => string | null;
  }
> = {
  sent: { icon: Send, label: 'Email Sent', dotColor: 'bg-brand-400', textColor: 'text-brand-300', bgColor: 'bg-brand-500/10', getDescription: (meta) => meta?.recipient ? `To: ${meta.recipient}` : null },
  open: { icon: Eye, label: 'Email Opened', dotColor: 'bg-green-400', textColor: 'text-green-300', bgColor: 'bg-green-500/10', getDescription: () => 'Recipient opened the email' },
  click: { icon: MousePointerClick, label: 'Link Clicked', dotColor: 'bg-cyan-400', textColor: 'text-cyan-300', bgColor: 'bg-cyan-500/10', getDescription: () => 'Recipient clicked a tracked link' },
  follow_up_scheduled: {
    icon: CalendarClock, label: 'Follow-up Scheduled', dotColor: 'bg-amber-400', textColor: 'text-amber-300', bgColor: 'bg-amber-500/10',
    getDescription: (meta) => {
      const rule = meta?.rule as string | undefined;
      const when = meta?.scheduledFor as string | undefined;
      const ruleLabel = rule === 'no_open' ? 'No open after 72h' : rule === 'opened_no_click' ? 'Opened but no click after 24h' : rule === 'clicked_report' ? 'Clicked â€” check-in after 48h' : rule?.replace(/_/g, ' ') ?? null;
      return [ruleLabel, when ? `for ${formatRelativeTime(when)}` : null].filter(Boolean).join(' Â· ') || null;
    },
  },
  follow_up_sent: { icon: CheckCircle2, label: 'Follow-up Sent', dotColor: 'bg-green-400', textColor: 'text-green-300', bgColor: 'bg-green-500/10', getDescription: (meta) => (meta?.rule as string)?.replace(/_/g, ' ') ?? 'Automated follow-up delivered' },
  follow_up_canceled: { icon: XCircle, label: 'Follow-up Canceled', dotColor: 'bg-slate-400', textColor: 'text-slate-400', bgColor: 'bg-slate-500/10', getDescription: (meta) => (meta?.reason as string)?.replace(/_/g, ' ') ?? 'No longer needed' },
};

const DEFAULT_EVENT_CONFIG = { icon: AlertCircle, label: '', dotColor: 'bg-slate-500', textColor: 'text-slate-400', bgColor: 'bg-slate-500/10', getDescription: () => null };

function getEventConfig(eventType: string) {
  return EVENT_CONFIG[eventType] ?? { ...DEFAULT_EVENT_CONFIG, label: eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) };
}

// â”€â”€â”€ Shared micro-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EventRow({ event, compact = false }: { event: { id: string; event_type: EventType; created_at: string; metadata?: Record<string, unknown> }; compact?: boolean }) {
  const cfg = getEventConfig(event.event_type);
  const Icon = cfg.icon;
  const description = cfg.getDescription(event.metadata);
  return (
    <div className={`flex items-start gap-3 ${compact ? 'py-2' : 'py-3'}`}>
      <div className={`flex-shrink-0 rounded-full p-1.5 ${cfg.bgColor} mt-0.5`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.textColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${cfg.textColor}`}>{cfg.label}</span>
          <span className="text-[11px] text-slate-600 flex-shrink-0">{formatRelativeTime(event.created_at)}</span>
        </div>
        {description && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{description}</p>}
      </div>
    </div>
  );
}

function LeadBadge({ status, score }: { status: LeadStatus; score: number }) {
  const cfg = status === 'hot' ? { bg: 'bg-red-500/15', text: 'text-red-300', icon: Flame } : status === 'warm' ? { bg: 'bg-amber-500/15', text: 'text-amber-300', icon: TrendingUp } : { bg: 'bg-slate-500/15', text: 'text-slate-400', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.icon && <cfg.icon className="h-3 w-3" />}
      {score} <span className="capitalize">{status}</span>
    </span>
  );
}

function FollowUpBadge({ status }: { status: FollowUpStatus }) {
  const cfg = status === 'sent' ? { bg: 'bg-green-500/10', text: 'text-green-400', icon: CheckCircle2 } : status === 'scheduled' ? { bg: 'bg-brand-500/10', text: 'text-brand-300', icon: Clock } : status === 'skipped' || status === 'canceled' ? { bg: 'bg-slate-500/10', text: 'text-slate-400', icon: XCircle } : { bg: 'bg-white/5', text: 'text-slate-500', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.icon && <cfg.icon className="h-3 w-3" />}
      <span className="capitalize">{status}</span>
    </span>
  );
}

const STAT = ({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
    <div className="flex items-center gap-2 mb-2">
      {icon && <span className="opacity-70">{icon}</span>}
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
  </div>
);

const FOLLOW_UP_RULE_LABELS: Record<string, string> = {
  no_open: 'No open after 72h â€” remind them',
  opened_no_click: 'Opened but no click after 24h â€” follow up',
  clicked_report: 'Clicked report link â€” check in after 48h',
};

function followUpRuleLabel(rule: string | null): string {
  if (!rule) return 'â€”';
  return FOLLOW_UP_RULE_LABELS[rule] ?? rule.replace(/_/g, ' ');
}

// â”€â”€â”€ Follow-up composition modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FollowUpModal({
  site,
  onClose,
  onSent,
  apiUrl,
  adminSecret,
}: {
  site: FollowUpSite;
  onClose: () => void;
  onSent: (siteId: string) => void;
  apiUrl: string;
  adminSecret: string;
}) {
  const defaultSubject = 'Following up on your website accessibility report';
  const defaultMessage = `Hi there,

I wanted to follow up on the accessibility report I sent over for ${site.siteName || site.siteUrl}.

${site.totalClicks > 0 ? "I noticed you had a chance to look at the report â€” I hope it was useful! If you have any questions about the issues flagged or need help prioritizing the fixes, I'm happy to help.\n\n" : site.totalOpens > 0 ? "I noticed you opened my previous email. If you haven't had a chance to review the report yet, here it is again â€” it shows exactly which issues to fix and how.\n\n" : "I wanted to make sure this didn't get buried in your inbox. "}The report shows the specific accessibility issues on your site and how to fix them.

Thirmal
ADA Shield`;

  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const handleSend = async () => {
    setSending(true);
    setSendError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/sites/${site.siteId}/send-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ subject, message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      onSent(site.siteId);
      onClose();
    } catch (err: any) {
      setSendError(err.message || 'Failed to send follow-up');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 border border-white/10 rounded-xl max-w-2xl w-full shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="text-base font-semibold text-white">Send Follow-up Email</h3>
            <p className="text-xs text-slate-400 mt-1">
              To: <span className="text-slate-300">{site.ownerEmail || site.recipients.join(', ') || '(no email set)'}</span>
              {' Â· '}{site.siteName || site.siteUrl}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Context strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">{site.contactedCount}</div>
              <div className="text-[11px] text-slate-500">times contacted</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-400">{site.totalOpens}</div>
              <div className="text-[11px] text-slate-500">opens</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-cyan-400">{site.totalClicks}</div>
              <div className="text-[11px] text-slate-500">link clicks</div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
              placeholder="Email subject"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors resize-y"
              placeholder="Email message (the report link will be appended automatically)"
            />
            <p className="text-[11px] text-slate-600 mt-1">A tracked report link is automatically appended.</p>
          </div>

          {sendError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-lg text-sm text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {sendError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-slate-400 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !message.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Sendingâ€¦' : 'Send Follow-up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main page component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function AdminOutreachPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Overview state
  const [overview, setOverview] = useState<OutreachOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [siteAnalytics, setSiteAnalytics] = useState<Record<string, SiteOutreachAnalytics>>({});
  const [siteAnalyticsLoading, setSiteAnalyticsLoading] = useState<Record<string, boolean>>({});
  const [detailModal, setDetailModal] = useState<ContactEntry | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Click analytics state
  const [clickData, setClickData] = useState<ClickAnalytics | null>(null);
  const [clickLoading, setClickLoading] = useState(false);
  const [clickError, setClickError] = useState('');

  // Follow-up queue state
  const [followUpSites, setFollowUpSites] = useState<FollowUpSite[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState('');
  const [followUpModal, setFollowUpModal] = useState<FollowUpSite | null>(null);
  const [sentSiteIds, setSentSiteIds] = useState<Set<string>>(new Set());

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';
  const headers = { 'x-admin-secret': adminSecret };

  // â”€â”€ Data fetchers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/outreach/overview?limit=20`, { headers });
      if (!res.ok) throw new Error('Failed to fetch outreach overview');
      setOverview(await res.json());
      setLastRefreshed(new Date());
    } catch (err: any) {
      setOverviewError(err.message || 'Failed to load outreach data');
    } finally {
      setOverviewLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, adminSecret]);

  const fetchClickAnalytics = useCallback(async () => {
    setClickLoading(true);
    setClickError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/outreach/click-analytics`, { headers });
      if (!res.ok) throw new Error('Failed to fetch click analytics');
      setClickData(await res.json());
    } catch (err: any) {
      setClickError(err.message || 'Failed to load click data');
    } finally {
      setClickLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, adminSecret]);

  const fetchFollowUpQueue = useCallback(async () => {
    setFollowUpLoading(true);
    setFollowUpError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/outreach/followup-due?minDays=10`, { headers });
      if (!res.ok) throw new Error('Failed to fetch follow-up queue');
      const data = await res.json();
      setFollowUpSites(data.sites || []);
    } catch (err: any) {
      setFollowUpError(err.message || 'Failed to load follow-up queue');
    } finally {
      setFollowUpLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, adminSecret]);

  // Load overview on mount; load other tabs lazily when first visited
  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  useEffect(() => {
    if (activeTab === 'clicks' && !clickData && !clickLoading) fetchClickAnalytics();
    if (activeTab === 'followup' && followUpSites.length === 0 && !followUpLoading) fetchFollowUpQueue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // â”€â”€ Overview helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const toggleLeadRow = async (lead: TopLead) => {
    if (expandedLead === lead.id) { setExpandedLead(null); return; }
    setExpandedLead(lead.id);
    if (siteAnalytics[lead.siteId]) return;
    setSiteAnalyticsLoading((p) => ({ ...p, [lead.siteId]: true }));
    try {
      const res = await fetch(`${apiUrl}/api/admin/sites/${lead.siteId}/outreach-analytics`, { headers });
      if (!res.ok) throw new Error();
      setSiteAnalytics((p) => ({ ...p, [lead.siteId]: {} as SiteOutreachAnalytics }));
      setSiteAnalytics((p) => ({ ...p, [lead.siteId]: null as any })); // force refetch fix
      const payload: SiteOutreachAnalytics = await res.json();
      setSiteAnalytics((p) => ({ ...p, [lead.siteId]: payload }));
    } catch { /* silently skip */ } finally {
      setSiteAnalyticsLoading((p) => ({ ...p, [lead.siteId]: false }));
    }
  };

  const currentRefresh = activeTab === 'overview' ? fetchOverview : activeTab === 'clicks' ? fetchClickAnalytics : fetchFollowUpQueue;
  const isLoading = activeTab === 'overview' ? overviewLoading : activeTab === 'clicks' ? clickLoading : followUpLoading;

  const TABS: Array<{ key: Tab; label: string; icon: React.ElementType; count?: number }> = [
    { key: 'overview', label: 'Overview', icon: Mail },
    { key: 'clicks', label: 'Click Analysis', icon: MousePointerClick, count: clickData?.funnel.clicked },
    { key: 'followup', label: 'Follow-up Queue', icon: RotateCcw, count: followUpSites.filter(s => s.hasEmail && !sentSiteIds.has(s.siteId)).length || undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Outreach Tracking</h1>
          <p className="text-sm text-slate-400 mt-1">Monitor sends, clicks, lead scores, and manage follow-up campaigns.</p>
          {lastRefreshed && activeTab === 'overview' && (
            <p className="text-xs text-slate-600 mt-0.5">Updated {formatRelativeTime(lastRefreshed.toISOString())}</p>
          )}
        </div>
        <button
          onClick={currentRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-white/10 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-brand-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-brand-500/20 text-brand-300 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* â”€â”€ OVERVIEW TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeTab === 'overview' && (
        <>
          {overviewError && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{overviewError}
            </div>
          )}
          {overviewLoading && !overview && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />Loading outreach dataâ€¦
            </div>
          )}
          {overview && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <STAT label="Emails Sent" value={overview.summary.sentCount} icon={<Mail className="h-4 w-4 text-slate-400" />} />
                <STAT label="Open Rate" value={`${overview.summary.openRate}%`} sub={`${overview.summary.openedCount} of ${overview.summary.sentCount} opened`} icon={<Eye className="h-4 w-4 text-green-400" />} />
                <STAT label="Click Rate" value={`${overview.summary.clickRate}%`} sub={`${overview.summary.clickedCount} clicked`} icon={<MousePointerClick className="h-4 w-4 text-cyan-400" />} />
                <STAT label="Hot Leads" value={overview.summary.hotLeadCount} sub={`${overview.summary.followUpsScheduled} follow-up${overview.summary.followUpsScheduled !== 1 ? 's' : ''} queued`} icon={<Flame className="h-4 w-4 text-red-400" />} />
              </div>

              {/* Top leads */}
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Top Leads by Engagement</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Expand a row to see full email history and activity timeline.</p>
                  </div>
                  {overview.topLeads.length > 0 && <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded-full">{overview.topLeads.length} leads</span>}
                </div>
                {overview.topLeads.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <Mail className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm font-medium">No outreach activity yet</p>
                    <p className="text-slate-600 text-xs mt-1">Send a tracked email from the Sites tab to start building your lead pipeline.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {overview.topLeads.map((lead) => {
                      const isOpen = expandedLead === lead.id;
                      const siteData = siteAnalytics[lead.siteId];
                      const isLoadingAnalytics = siteAnalyticsLoading[lead.siteId];
                      return (
                        <div key={lead.id}>
                          <button onClick={() => toggleLeadRow(lead)} className="w-full text-left px-5 py-4 hover:bg-white/[0.03] transition-colors" aria-expanded={isOpen}>
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-slate-200 text-sm truncate">{lead.siteName || lead.siteUrl || lead.recipientEmail}</span>
                                  <LeadBadge status={lead.leadStatus} score={lead.leadScore} />
                                  <FollowUpBadge status={(lead.followUpStatus as FollowUpStatus) || 'none'} />
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                                  <span className="flex items-center gap-1"><Globe className="h-3 w-3" /><span className="truncate max-w-xs">{lead.siteUrl || 'â€”'}</span></span>
                                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.recipientEmail}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-400 flex-shrink-0">
                                <div className="text-center hidden sm:block"><div className="font-semibold text-slate-200">{lead.opensCount}</div><div className="text-slate-600">opens</div></div>
                                <div className="text-center hidden sm:block"><div className="font-semibold text-slate-200">{lead.clicksCount}</div><div className="text-slate-600">clicks</div></div>
                                <div className="text-center hidden sm:block"><div className="text-slate-300">{formatRelativeTime(lead.lastEngagementAt)}</div><div className="text-slate-600">last active</div></div>
                                {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                              </div>
                            </div>
                          </button>

                          {isOpen && (
                            <div className="px-5 pb-5 bg-black/20 border-t border-white/5">
                              {isLoadingAnalytics && (
                                <div className="py-6 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading analyticsâ€¦
                                </div>
                              )}
                              {!isLoadingAnalytics && siteData && (
                                <div className="space-y-4 pt-4">
                                  <div className="grid gap-3 sm:grid-cols-4">
                                    {[
                                      { label: 'Emails Sent', value: siteData.summary.sentCount },
                                      { label: 'Open Rate', value: `${siteData.summary.openRate}%` },
                                      { label: 'Click Rate', value: `${siteData.summary.clickRate}%` },
                                      { label: 'Top Lead Score', value: siteData.summary.topLeadScore },
                                    ].map((s) => (
                                      <div key={s.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                        <div className="text-[11px] uppercase tracking-wider text-slate-500">{s.label}</div>
                                        <div className="mt-1.5 text-lg font-semibold text-white">{s.value}</div>
                                      </div>
                                    ))}
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email History</div>
                                    <div className="space-y-2">
                                      {siteData.entries.map((entry) => (
                                        <div key={entry.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4 cursor-pointer hover:bg-white/[0.05] transition-colors group" onClick={() => setDetailModal(entry)}>
                                          <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <LeadBadge status={entry.lead_status} score={entry.lead_score} />
                                            <FollowUpBadge status={entry.follow_up_status} />
                                            {entry.delivery_status === 'failed' && <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 rounded px-1.5 py-0.5 text-[11px] font-medium"><XCircle className="h-3 w-3" /> Delivery failed</span>}
                                            <span className="text-xs text-slate-500 ml-auto">{formatDate(entry.created_at)}</span>
                                          </div>
                                          <div className="text-sm font-medium text-slate-200">{entry.subject}</div>
                                          <div className="mt-1 text-xs text-slate-400 flex items-center gap-1"><Mail className="h-3 w-3" />{entry.recipient_email}</div>
                                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {entry.opens_count} opens</span>
                                            <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {entry.clicks_count} clicks</span>
                                            {entry.follow_up_rule && <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{followUpRuleLabel(entry.follow_up_rule)}</span>}
                                            {entry.last_engagement_at && <span className="text-slate-600">Last active {formatRelativeTime(entry.last_engagement_at)}</span>}
                                          </div>
                                          <div className="mt-2 text-[11px] text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">Click to view full message â†’</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {siteData.events.length > 0 && (
                                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                                      <div className="text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">Activity Timeline</div>
                                      <p className="text-[11px] text-slate-600 mb-3">All tracked interactions for this site</p>
                                      <div className="divide-y divide-white/5">
                                        {siteData.events.slice(0, 12).map((ev) => <EventRow key={ev.id} event={ev} compact />)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {!isLoadingAnalytics && !siteData && <div className="py-6 text-center text-slate-500 text-xs">No analytics data available for this site yet.</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent global activity */}
              {overview.recentEvents.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-brand-400" />
                    <div>
                      <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Latest outreach interactions across all sites</p>
                    </div>
                  </div>
                  <div className="px-5 divide-y divide-white/5">
                    {overview.recentEvents.map((ev) => <EventRow key={ev.id} event={ev} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* â”€â”€ CLICK ANALYSIS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeTab === 'clicks' && (
        <>
          {clickError && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{clickError}
            </div>
          )}
          {clickLoading && !clickData && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />Loading click dataâ€¦
            </div>
          )}
          {clickData && (
            <>
              {/* Conversion funnel */}
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                  <BarChart3 className="h-4 w-4 text-brand-400" />
                  <div>
                    <h2 className="text-sm font-semibold text-white">Email Funnel</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Sent â†’ Opened â†’ Clicked conversion rates</p>
                  </div>
                </div>
                <div className="p-5">
                  {/* Visual funnel bar */}
                  <div className="space-y-3">
                    {[
                      { label: 'Sent', count: clickData.funnel.sent, pct: 100, color: 'bg-slate-500' },
                      { label: 'Opened', count: clickData.funnel.opened, pct: clickData.funnel.openRate, color: 'bg-green-500', rate: `${clickData.funnel.openRate}% open rate` },
                      { label: 'Clicked (unique)', count: clickData.funnel.clicked, pct: clickData.funnel.clickRate, color: 'bg-cyan-500', rate: `${clickData.funnel.clickRate}% click rate Â· ${clickData.funnel.clickToOpenRate}% click-to-open` },
                    ].map((step) => (
                      <div key={step.label}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-300 font-medium">{step.label}</span>
                          <div className="flex items-center gap-3">
                            {step.rate && <span className="text-slate-500">{step.rate}</span>}
                            <span className="font-semibold text-white">{step.count.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full ${step.color}`} style={{ width: `${step.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total clicks */}
                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total link clicks (all recipients combined)</span>
                    <span className="text-lg font-bold text-cyan-400">{clickData.funnel.totalClicks}</span>
                  </div>
                </div>
              </div>

              {/* Sites that clicked */}
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Sites That Clicked</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Ranked by total link clicks â€” highest intent prospects.</p>
                  </div>
                  {clickData.sitesWithClicks.length > 0 && (
                    <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded-full">{clickData.sitesWithClicks.length} sites</span>
                  )}
                </div>
                {clickData.sitesWithClicks.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <MousePointerClick className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No link clicks recorded yet</p>
                    <p className="text-slate-600 text-xs mt-1">Clicks will appear here as recipients engage with tracked links.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {clickData.sitesWithClicks.map((site, idx) => {
                      const maxClicks = clickData.sitesWithClicks[0]?.totalClicks || 1;
                      const barPct = Math.round((site.totalClicks / maxClicks) * 100);
                      return (
                        <div key={site.siteId} className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <span className="text-xs text-slate-600 font-mono w-5 text-right mt-1 flex-shrink-0">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-slate-200 truncate">{site.siteName || site.siteUrl}</div>
                                  {site.siteName && <div className="text-xs text-slate-500 truncate">{site.siteUrl}</div>}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-400 flex-shrink-0">
                                  <div className="text-center">
                                    <div className="font-bold text-cyan-400 text-base">{site.totalClicks}</div>
                                    <div className="text-slate-600">clicks</div>
                                  </div>
                                  <div className="text-center hidden sm:block">
                                    <div className="font-semibold text-white">{site.opened}</div>
                                    <div className="text-slate-600">opens</div>
                                  </div>
                                  <div className="text-center hidden sm:block">
                                    <div className="font-semibold text-slate-300">{site.clickRate}%</div>
                                    <div className="text-slate-600">click rate</div>
                                  </div>
                                  <div className="text-center hidden md:block">
                                    <div className="text-slate-300">{formatRelativeTime(site.lastClickAt)}</div>
                                    <div className="text-slate-600">last click</div>
                                  </div>
                                </div>
                              </div>
                              {/* Relative bar */}
                              <div className="mt-2.5 w-full bg-white/5 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-cyan-500/70" style={{ width: `${barPct}%` }} />
                              </div>
                              <div className="mt-1.5 flex gap-3 text-[11px] text-slate-600">
                                <span>{site.emailsSent} emails sent</span>
                                <span>{site.uniqueRecipients} recipient{site.uniqueRecipients !== 1 ? 's' : ''}</span>
                                <span>{site.clicked} clicked</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent click events */}
              {clickData.recentClicks.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                    <MousePointerClick className="h-4 w-4 text-cyan-400" />
                    <div>
                      <h2 className="text-sm font-semibold text-white">Recent Clicks</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Most recent link click events</p>
                    </div>
                  </div>
                  <div className="divide-y divide-white/5">
                    {clickData.recentClicks.map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between px-5 py-3 gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                          <span className="text-xs text-slate-300 truncate">{ev.url || 'Report link'}</span>
                        </div>
                        <span className="text-[11px] text-slate-600 flex-shrink-0">{formatRelativeTime(ev.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* â”€â”€ FOLLOW-UP QUEUE TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeTab === 'followup' && (
        <>
          {followUpError && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{followUpError}
            </div>
          )}
          {followUpLoading && followUpSites.length === 0 && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />Loading follow-up queueâ€¦
            </div>
          )}

          {/* Explanation banner */}
          {!followUpLoading && (
            <div className="flex items-start gap-3 p-4 bg-brand-500/5 border border-brand-500/15 rounded-xl">
              <RotateCcw className="h-5 w-5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-300">10-Day Re-engagement Cycle</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sites listed here were last contacted 10+ days ago and are eligible for a follow-up email. Each follow-up is tracked separately â€” opens and clicks will appear in the Overview and Click Analysis tabs.
                </p>
              </div>
            </div>
          )}

          {followUpSites.length === 0 && !followUpLoading ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500/60 mx-auto mb-3" />
              <p className="text-slate-300 text-sm font-medium">No sites due for follow-up</p>
              <p className="text-slate-600 text-xs mt-1">Sites that were contacted 10+ days ago will appear here.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Sites Due for Follow-up</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Last contacted 10+ days ago. Sorted by oldest contact first.
                  </p>
                </div>
                <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded-full">
                  {followUpSites.filter(s => !sentSiteIds.has(s.siteId)).length} eligible
                </span>
              </div>

              <div className="divide-y divide-white/5">
                {followUpSites.map((site) => {
                  const alreadySent = sentSiteIds.has(site.siteId);
                  const leadCfg = site.bestLeadStatus === 'hot'
                    ? { bg: 'bg-red-500/15', text: 'text-red-300', icon: Flame }
                    : site.bestLeadStatus === 'warm'
                    ? { bg: 'bg-amber-500/15', text: 'text-amber-300', icon: TrendingUp }
                    : { bg: 'bg-slate-500/15', text: 'text-slate-500', icon: null };

                  return (
                    <div key={site.siteId} className={`px-5 py-4 ${alreadySent ? 'opacity-40' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-200 truncate">{site.siteName || site.siteUrl}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${leadCfg.bg} ${leadCfg.text}`}>
                              {leadCfg.icon && <leadCfg.icon className="h-3 w-3" />}
                              {site.bestLeadScore} <span className="capitalize">{site.bestLeadStatus}</span>
                            </span>
                            {alreadySent && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-green-400 bg-green-500/10 rounded px-1.5 py-0.5">
                                <CheckCircle2 className="h-3 w-3" /> Sent this session
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{site.siteUrl}</span>
                            {site.ownerEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{site.ownerEmail}</span>}
                            {!site.hasEmail && <span className="text-red-400/70">No email configured</span>}
                          </div>
                          <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 text-amber-400/80">
                              <Clock className="h-3 w-3" />
                              {site.daysSinceLastContact}d since last contact
                            </span>
                            <span>{site.contactedCount} email{site.contactedCount !== 1 ? 's' : ''} sent total</span>
                            {site.totalOpens > 0 && <span className="flex items-center gap-1 text-green-400/70"><Eye className="h-3 w-3" />{site.totalOpens} opens</span>}
                            {site.totalClicks > 0 && <span className="flex items-center gap-1 text-cyan-400/70"><MousePointerClick className="h-3 w-3" />{site.totalClicks} clicks</span>}
                            {site.lastEngagementAt && <span>Last engaged {formatRelativeTime(site.lastEngagementAt)}</span>}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          {site.hasEmail && !alreadySent ? (
                            <button
                              onClick={() => setFollowUpModal(site)}
                              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Follow up</span>
                            </button>
                          ) : !site.hasEmail ? (
                            <span className="text-xs text-slate-600 italic">No email</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* â”€â”€ Detail modal (email body) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setDetailModal(null)}>
          <div className="bg-slate-900 border border-white/10 rounded-xl max-w-2xl w-full shadow-2xl">
            <div className="flex items-start justify-between p-5 border-b border-white/10">
              <div>
                <h3 className="text-base font-semibold text-white">{detailModal.subject}</h3>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <LeadBadge status={detailModal.lead_status} score={detailModal.lead_score} />
                  <FollowUpBadge status={detailModal.follow_up_status} />
                  {detailModal.delivery_status === 'failed' && <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 rounded px-1.5 py-0.5 text-[11px] font-medium"><XCircle className="h-3 w-3" /> Delivery failed</span>}
                </div>
              </div>
              <button onClick={() => setDetailModal(null)} className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Recipient', value: detailModal.recipient_email },
                  { label: 'Sent', value: formatDate(detailModal.created_at) },
                  { label: 'Opens', value: detailModal.opens_count.toString() },
                  { label: 'Clicks', value: detailModal.clicks_count.toString() },
                ].map((item) => (
                  <div key={item.label} className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">{item.label}</div>
                    <div className="text-xs text-slate-200 truncate font-medium">{item.value}</div>
                  </div>
                ))}
              </div>
              {(detailModal.delivery_channel || detailModal.follow_up_rule || detailModal.follow_up_scheduled_for || detailModal.last_engagement_at) && (
                <div className="space-y-2 bg-white/[0.02] rounded-lg p-4 border border-white/5">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Delivery &amp; Follow-up</div>
                  {detailModal.delivery_channel && <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Channel</span><span className="text-slate-300 capitalize">{detailModal.delivery_channel}</span></div>}
                  {detailModal.follow_up_rule && <div className="flex items-center justify-between text-xs gap-4"><span className="text-slate-500 flex-shrink-0">Follow-up rule</span><span className="text-slate-300 text-right">{followUpRuleLabel(detailModal.follow_up_rule)}</span></div>}
                  {detailModal.follow_up_scheduled_for && <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Scheduled</span><span className="text-slate-300">{formatDate(detailModal.follow_up_scheduled_for)}</span></div>}
                  {detailModal.last_engagement_at && <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Last engagement</span><span className="text-slate-300">{formatRelativeTime(detailModal.last_engagement_at)}</span></div>}
                </div>
              )}
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Message</div>
                <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-black/30 rounded-lg p-4 border border-white/5 max-h-60 overflow-y-auto">{detailModal.message}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Follow-up compose modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {followUpModal && (
        <FollowUpModal
          site={followUpModal}
          onClose={() => setFollowUpModal(null)}
          onSent={(siteId) => setSentSiteIds((prev) => new Set([...prev, siteId]))}
          apiUrl={apiUrl}
          adminSecret={adminSecret}
        />
      )}
    </div>
  );
}

