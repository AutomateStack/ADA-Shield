'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

interface Site {
  id: string;
  url: string;
  name: string;
  last_scanned_at: string | null;
  created_at: string;
}

export default function SitesPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadSites = async () => {
    const supabase = createSupabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from('sites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setSites(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSites();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError('');

    try {
      let siteUrl = url.trim();
      if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
        siteUrl = `https://${siteUrl}`;
      }

      const supabase = createSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await supabase.from('sites').insert({
        user_id: user.id,
        url: siteUrl,
        name: name.trim() || new URL(siteUrl).hostname,
      });

      if (insertError) throw insertError;

      setUrl('');
      setName('');
      setShowForm(false);
      await loadSites();
    } catch (err: any) {
      setError(err.message || 'Failed to add site');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (siteId: string) => {
    if (!confirm('Delete this site and all its scan results?')) return;

    setDeleting(siteId);
    try {
      const supabase = createSupabaseBrowser();
      const { error: deleteError } = await supabase.from('sites').delete().eq('id', siteId);
      if (deleteError) throw deleteError;
      setSites(sites.filter((s) => s.id !== siteId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete site');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Sites</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Site
        </button>
      </div>

      {/* Add Site Form */}
      {showForm && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Add New Site</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label htmlFor="site-url" className="block text-sm font-medium text-slate-300 mb-1.5">
                Website URL
              </label>
              <input
                id="site-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
                disabled={adding}
              />
            </div>
            <div>
              <label htmlFor="site-name" className="block text-sm font-medium text-slate-300 mb-1.5">
                Name (optional)
              </label>
              <input
                id="site-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Website"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                disabled={adding}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={adding}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-800 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Site'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError('');
                }}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sites List */}
      {sites.length === 0 && !showForm ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <Globe className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Sites Added</h2>
          <p className="text-slate-400 mb-6">
            Add a website to start scanning it for accessibility violations.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Your First Site
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between group"
            >
              <button
                onClick={() => router.push(`/dashboard/sites/${site.id}`)}
                className="flex items-center gap-4 min-w-0 flex-1 text-left"
              >
                <Globe className="h-8 w-8 text-brand-400 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-white truncate group-hover:text-brand-300 transition-colors">
                    {site.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm text-slate-500 truncate">{site.url}</p>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-600 hover:text-slate-400"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {site.last_scanned_at
                      ? `Last scanned ${new Date(site.last_scanned_at).toLocaleDateString()}`
                      : 'Never scanned'}
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleDelete(site.id)}
                disabled={deleting === site.id}
                className="p-2 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 ml-4"
                title="Delete site"
              >
                {deleting === site.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
