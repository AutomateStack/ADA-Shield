'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Save, Globe } from 'lucide-react';

interface AdminSite {
  id: string;
  user_id: string | null;
  user_email: string | null;
  site_type: 'authenticated' | 'free_scan';
  url: string;
  name: string | null;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  sales_contact_name: string | null;
  sales_contact_email: string | null;
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
  sales_contact_name: string;
  sales_contact_email: string;
}

export default function AdminSitesPage() {
  const [data, setData] = useState<SitesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  const fetchSites = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/sites?page=${page}&limit=20`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) throw new Error('Failed to fetch sites');
      const payload: SitesResponse = await res.json();
      setData(payload);

      const nextDrafts: Record<string, DraftRow> = {};
      for (const site of payload.sites) {
        nextDrafts[site.id] = {
          owner_name: site.owner_name || '',
          owner_email: site.owner_email || '',
          sales_contact_name: site.sales_contact_name || '',
          sales_contact_email: site.sales_contact_email || '',
        };
      }
      setDrafts(nextDrafts);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sites');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret, page]);

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
          sales_contact_name: '',
          sales_contact_email: '',
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sites</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track site owner & sales contact (includes free scans & authenticated users)
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
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Account Email</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Owner</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Owner Email</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Sales Contact</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Sales Email</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading sites...
                  </td>
                </tr>
              ) : !data || data.sites.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No sites found
                  </td>
                </tr>
              ) : (
                data.sites.map((site) => {
                  const draft = drafts[site.id] || {
                    owner_name: '',
                    owner_email: '',
                    sales_contact_name: '',
                    sales_contact_email: '',
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
                            site.site_type === 'free_scan'
                              ? 'bg-slate-500/10 text-slate-300'
                              : 'bg-brand-500/10 text-brand-300'
                          }`}
                        >
                          {site.site_type === 'free_scan' ? 'Free Scan' : 'User Account'}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-[200px] text-xs text-slate-400">
                        {site.user_email || '—'}
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
                      <td className="px-4 py-3 min-w-[170px]">
                        <input
                          value={draft.sales_contact_name}
                          onChange={(e) => updateDraft(site.id, 'sales_contact_name', e.target.value)}
                          placeholder="Sales person name"
                          className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <input
                          value={draft.sales_contact_email}
                          onChange={(e) => updateDraft(site.id, 'sales_contact_email', e.target.value)}
                          placeholder="sales@company.com"
                          className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
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
    </div>
  );
}
