'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Save, Globe, Send, X } from 'lucide-react';

// Simple relative time formatter
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

interface AdminSite {
  id: string;
  user_id: string | null;
  user_email: string | null;
  is_registered: boolean;
  url: string;
  name: string | null;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  contacted_count: number;
  last_contacted_at: string | null;
}

interface SitesResponse {
  sites: AdminSite[];
  total: number;
  page: number;
  totalPages: number;
}

interface DraftRow {
  owner_name: string;
  owner_email: string;
}

interface EmailModal {
  siteId: string;
  siteName: string;
  ownerEmail: string;
  selectedStyle: EmailTemplateStyle;
  defaultStyle: EmailTemplateStyle;
  styleOptions: Array<{ key: EmailTemplateStyle; label: string }>;
  templates: Record<EmailTemplateStyle, { subject: string; message: string }>;
  subject: string;
  message: string;
}

interface ContactHistoryEntry {
  id: string;
  recipient_email: string;
  subject: string;
  message: string;
  template_style: EmailTemplateStyle | null;
  delivery_channel: 'supabase-function' | 'api-fallback' | null;
  delivery_status: 'sent' | 'failed' | null;
  provider_message_id: string | null;
  created_at: string;
}

interface ContactHistoryResponse {
  site: {
    id: string;
    name: string | null;
    url: string;
    owner_email: string | null;
  };
  entries: ContactHistoryEntry[];
  total: number;
  page: number;
  totalPages: number;
}

type EmailTemplateStyle = 'fear_urgency' | 'friendly_educational' | 'concise_direct';

interface EmailTemplateResponse {
  style: EmailTemplateStyle;
  defaultStyle: EmailTemplateStyle;
  styles: Array<{ key: EmailTemplateStyle; label: string }>;
  templates: Record<EmailTemplateStyle, { subject: string; message: string }>;
  subject: string;
  message: string;
}

export default function AdminSitesPage() {
  const [data, setData] = useState<SitesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [emailModal, setEmailModal] = useState<EmailModal | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailTemplateLoading, setEmailTemplateLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'created_at' | 'contacted_count' | 'last_contacted_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<ContactHistoryResponse | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  const fetchSites = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${apiUrl}/api/admin/sites?page=${page}&limit=20&sortBy=${sortBy}&sortOrder=${sortOrder}`,
        {
        headers: { 'x-admin-secret': adminSecret },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch sites');
      const payload: SitesResponse = await res.json();
      setData(payload);

      const nextDrafts: Record<string, DraftRow> = {};
      for (const site of payload.sites) {
        nextDrafts[site.id] = {
          owner_name: site.owner_name || '',
          owner_email: site.owner_email || '',
        };
      }
      setDrafts(nextDrafts);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sites');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret, page, sortBy, sortOrder]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const updateDraft = (siteId: string, key: keyof DraftRow, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [siteId]: {
        ...(prev[siteId] || {
          owner_name: '',
          owner_email: '',
        }),
        [key]: value,
      },
    }));
  };

  const saveSite = async (siteId: string) => {
    const row = drafts[siteId];
    if (!row) return;

    setSaving((prev) => ({ ...prev, [siteId]: true }));
    try {
      const res = await fetch(`${apiUrl}/api/admin/sites/${siteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save site metadata');
      }
      await fetchSites();
    } catch (err: any) {
      alert(err.message || 'Failed to save site metadata');
    } finally {
      setSaving((prev) => ({ ...prev, [siteId]: false }));
    }
  };

  const openEmailModal = async (site: AdminSite) => {
    setEmailModal({
      siteId: site.id,
      siteName: site.name || 'Unnamed site',
      ownerEmail: site.owner_email || '',
      selectedStyle: 'fear_urgency',
      defaultStyle: 'fear_urgency',
      styleOptions: [
        { key: 'fear_urgency', label: 'Fear + Urgency' },
        { key: 'friendly_educational', label: 'Friendly + Educational' },
        { key: 'concise_direct', label: 'Concise + Direct' },
      ],
      templates: {
        fear_urgency: { subject: 'Loading template...', message: '' },
        friendly_educational: { subject: '', message: '' },
        concise_direct: { subject: '', message: '' },
      },
      subject: 'Loading template...',
      message: 'Preparing a personalized outreach message from recent scan data...',
    });

    setEmailTemplateLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/sites/${site.id}/email-template`, {
        headers: { 'x-admin-secret': adminSecret },
      });

      if (!res.ok) {
        throw new Error('Failed to load email template');
      }

      const payload: EmailTemplateResponse = await res.json();
      setEmailModal((prev) => {
        if (!prev || prev.siteId !== site.id) return prev;
        return {
          ...prev,
          selectedStyle: payload.style,
          defaultStyle: payload.defaultStyle,
          styleOptions: payload.styles,
          templates: payload.templates,
          subject: payload.subject,
          message: payload.message,
        };
      });
    } catch (err: any) {
      setEmailModal((prev) => {
        if (!prev || prev.siteId !== site.id) return prev;
        return {
          ...prev,
          selectedStyle: 'fear_urgency',
          defaultStyle: 'fear_urgency',
          subject: `Is ${site.name || 'your restaurant'} protected from ADA lawsuits?`,
          message: `Hi there,\n\nQuick question - has anyone ever mentioned ADA website compliance to you?\n\nI ask because I scanned ${site.name || 'your website'} and found issues that match what plaintiff lawyers look for.\n\nFree scan here: https://ada-shield-dashboard.vercel.app\n\nThirmal\nADA Shield`,
        };
      });
    } finally {
      setEmailTemplateLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!emailModal) return;
    if (!emailModal.subject.trim() || !emailModal.message.trim()) {
      alert('Subject and message are required');
      return;
    }

    setEmailSending(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/sites/${emailModal.siteId}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          subject: emailModal.subject,
          message: emailModal.message,
          templateStyle: emailModal.selectedStyle,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to send email');
      }
      alert('Email sent successfully');
      setEmailModal(null);
      await fetchSites();
    } catch (err: any) {
      alert(err.message || 'Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const toggleSort = (column: 'contacted_count' | 'last_contacted_at') => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortBy(column);
    setSortOrder('desc');
  };

  const openContactHistory = async (site: AdminSite) => {
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryData(null);

    try {
      const res = await fetch(`${apiUrl}/api/admin/sites/${site.id}/contact-history?page=1&limit=20`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) throw new Error('Failed to load contact history');
      const payload: ContactHistoryResponse = await res.json();
      setHistoryData(payload);
    } catch (err: any) {
      alert(err.message || 'Failed to load contact history');
      setHistoryModalOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const onTemplateStyleChange = (style: EmailTemplateStyle) => {
    setEmailModal((prev) => {
      if (!prev) return prev;
      const selected = prev.templates[style];
      if (!selected) return prev;

      return {
        ...prev,
        selectedStyle: style,
        subject: selected.subject,
        message: selected.message,
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sites</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track site owner contact info (includes free scans & authenticated users)
          </p>
        </div>
        <button
          onClick={fetchSites}
          className="p-2 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Site</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Owner</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Owner Email</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  <button
                    onClick={() => toggleSort('contacted_count')}
                    className="inline-flex items-center gap-1 hover:text-slate-200"
                  >
                    Contacted
                    {sortBy === 'contacted_count' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  <button
                    onClick={() => toggleSort('last_contacted_at')}
                    className="inline-flex items-center gap-1 hover:text-slate-200"
                  >
                    Last Contact
                    {sortBy === 'last_contacted_at' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading sites...
                  </td>
                </tr>
              ) : !data || data.sites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No sites found
                  </td>
                </tr>
              ) : (
                data.sites.map((site) => {
                  const draft = drafts[site.id] || {
                    owner_name: '',
                    owner_email: '',
                  };

                  return (
                    <tr key={site.id} className="hover:bg-white/[0.02] transition-colors align-top">
                      <td className="px-4 py-3 min-w-[220px]">
                        <div className="font-medium text-slate-200">{site.name || 'Unnamed site'}</div>
                        <div className="text-xs text-slate-500 break-all mt-0.5 inline-flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {site.url}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[110px]">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            site.is_registered
                              ? 'bg-brand-500/10 text-brand-300'
                              : 'bg-slate-500/10 text-slate-300'
                          }`}
                        >
                          {site.is_registered ? 'Registered' : 'Free Scan'}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-[170px]">
                        <input
                          value={draft.owner_name}
                          onChange={(e) => updateDraft(site.id, 'owner_name', e.target.value)}
                          placeholder="Owner name"
                          className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <input
                          value={draft.owner_email}
                          onChange={(e) => updateDraft(site.id, 'owner_email', e.target.value)}
                          placeholder="owner@company.com"
                          className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openContactHistory(site)}
                          className="text-sm text-brand-300 hover:text-brand-200 font-medium underline underline-offset-2"
                        >
                          {site.contacted_count}
                        </button>
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <span className="text-xs text-slate-400">
                          {formatRelativeTime(site.last_contacted_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => openEmailModal(site)}
                          disabled={!site.owner_email}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed bg-slate-600/10 hover:bg-slate-600/30 border border-slate-500/30 rounded-md transition-colors disabled:opacity-50"
                          title={!site.owner_email ? 'Owner email required' : ''}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Email
                        </button>
                        <button
                          onClick={() => saveSite(site.id)}
                          disabled={!!saving[site.id]}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-300 hover:text-white bg-brand-600/10 hover:bg-brand-600/30 border border-brand-500/30 rounded-md transition-colors disabled:opacity-60"
                        >
                          {saving[site.id] ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl max-w-2xl w-full shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Send Email to {emailModal.siteName}</h2>
                <p className="text-sm text-slate-400 mt-1">{emailModal.ownerEmail}</p>
              </div>
              <button
                onClick={() => setEmailModal(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Template Style</label>
                <select
                  value={emailModal.selectedStyle}
                  onChange={(e) => onTemplateStyleChange(e.target.value as EmailTemplateStyle)}
                  disabled={emailTemplateLoading}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {emailModal.styleOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Default style is auto-selected from the latest risk score.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                <input
                  value={emailModal.subject}
                  onChange={(e) =>
                    setEmailModal({ ...emailModal, subject: e.target.value })
                  }
                  placeholder="Email subject"
                  disabled={emailTemplateLoading}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                <textarea
                  value={emailModal.message}
                  onChange={(e) =>
                    setEmailModal({ ...emailModal, message: e.target.value })
                  }
                  placeholder="Your message..."
                  rows={14}
                  disabled={emailTemplateLoading}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => setEmailModal(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendEmail}
                disabled={emailSending || emailTemplateLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {emailSending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {historyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl max-w-3xl w-full shadow-xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Contact History</h2>
                {historyData?.site && (
                  <p className="text-sm text-slate-400 mt-1">
                    {historyData.site.name || historyData.site.url}
                  </p>
                )}
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {historyLoading ? (
                <div className="text-center text-slate-400 py-8">Loading contact history...</div>
              ) : !historyData || historyData.entries.length === 0 ? (
                <div className="text-center text-slate-400 py-8">No contact history yet</div>
              ) : (
                <div className="space-y-4">
                  {historyData.entries.map((entry) => (
                    <div key={entry.id} className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-2">
                        <span>{new Date(entry.created_at).toLocaleString()}</span>
                        <span>Style: {entry.template_style || 'n/a'}</span>
                        <span>Channel: {entry.delivery_channel || 'n/a'}</span>
                        <span>Status: {entry.delivery_status || 'n/a'}</span>
                      </div>
                      <div className="text-sm text-slate-200 font-medium mb-1">{entry.subject}</div>
                      <div className="text-xs text-slate-400 mb-2">To: {entry.recipient_email}</div>
                      <div className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-6">{entry.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
