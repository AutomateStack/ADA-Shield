'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  Plus,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  ArrowRight,
  Loader2,
  Clock,
  ShieldCheck,
  Flame,
  TrendingDown,
} from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

interface Site {
  id: string;
  url: string;
  name: string;
  last_scanned_at: string | null;
  created_at: string;
}

interface LatestScan {
  site_id: string;
  risk_score: number;
  total_violations: number;
  critical_count: number;
  serious_count: number;
  passed_rules: number;
  scanned_at: string;
}

const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return 'Never';
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
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function DashboardPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [latestScans, setLatestScans] = useState<Record<string, LatestScan>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowser();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: sitesData } = await supabase
          .from('sites')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (sitesData) {
          setSites(sitesData);

          const siteIds = sitesData.map((s) => s.id);
          const { data: allScans } = await supabase
            .from('scan_results')
            .select('risk_score, total_violations, critical_count, serious_count, passed_rules, scanned_at, site_id')
            .in('site_id', siteIds)
            .order('scanned_at', { ascending: false });

          const scans: Record<string, LatestScan> = {};
          if (allScans) {
            for (const scan of allScans) {
              if (!scans[scan.site_id]) {
                scans[scan.site_id] = scan;
              }
            }
          }
          setLatestScans(scans);
        }
      }
      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  const scannedSites = sites.filter((s) => latestScans[s.id]);
  const unscannedSites = sites.filter((s) => !latestScans[s.id]);

  const totalViolations = Object.values(latestScans).reduce(
    (sum, s) => sum + (s.total_violations || 0),
    0
  );
  const avgRiskScore =
    scannedSites.length > 0
      ? Math.round(
          scannedSites.reduce((sum, s) => sum + (latestScans[s.id]?.risk_score || 0), 0) /
            scannedSites.length
        )
      : 0;

  const highRiskSites = scannedSites.filter((s) => (latestScans[s.id]?.risk_score || 0) >= 60);
  const cleanSites = scannedSites.filter((s) => (latestScans[s.id]?.risk_score || 0) < 30);

  const getRiskVariant = (score: number): { color: string; label: string; bar: string } => {
    if (score >= 60) return { color: 'text-red-400', label: 'High Risk', bar: 'bg-red-500' };
    if (score >= 30) return { color: 'text-amber-400', label: 'Medium Risk', bar: 'bg-amber-500' };
    return { color: 'text-green-400', label: 'Low Risk', bar: 'bg-green-500' };
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {displayName ? `Welcome back, ${displayName}` : 'Dashboard'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {sites.length === 0
              ? 'Get started by adding your first website.'
              : `Monitoring ${sites.length} site${sites.length !== 1 ? 's' : ''} for ADA compliance.`}
          </p>
        </div>
        <Link
          href="/dashboard/sites"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Site
        </Link>
      </div>

      {/* Overview Stats â€” only when there are sites */}
      {sites.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-brand-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">Sites</span>
            </div>
            <div className="text-3xl font-bold text-white">{sites.length}</div>
            {unscannedSites.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">{unscannedSites.length} not yet scanned</p>
            )}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">Violations</span>
            </div>
            <div className="text-3xl font-bold text-white">{totalViolations}</div>
            {totalViolations === 0 && scannedSites.length > 0 && (
              <p className="text-xs text-green-400 mt-1">All clear!</p>
            )}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">Avg Risk</span>
            </div>
            <div className={`text-3xl font-bold ${getRiskVariant(avgRiskScore).color}`}>
              {scannedSites.length > 0 ? avgRiskScore : 'â€”'}
            </div>
            {scannedSites.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">{getRiskVariant(avgRiskScore).label}</p>
            )}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-green-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">Clean Sites</span>
            </div>
            <div className="text-3xl font-bold text-white">{cleanSites.length}</div>
            {scannedSites.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                of {scannedSites.length} scanned
              </p>
            )}
          </div>
        </div>
      )}

      {/* High-risk alert banner */}
      {highRiskSites.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-xl">
          <Flame className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">
              {highRiskSites.length} site{highRiskSites.length !== 1 ? 's' : ''} at high ADA lawsuit risk
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              Review and fix violations to reduce your compliance exposure.
            </p>
          </div>
        </div>
      )}

      {/* Sites List */}
      {sites.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <Globe className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Sites Yet</h2>
          <p className="text-slate-400 mb-2 max-w-md mx-auto">
            Add your first website to start monitoring it for ADA &amp; WCAG 2.1 AA violations.
          </p>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            We'll calculate your lawsuit risk score and show you exactly which issues to fix.
          </p>
          <Link
            href="/dashboard/sites"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Your First Site
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Your Sites</h2>
            <Link href="/dashboard/sites" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              Manage sites â†’
            </Link>
          </div>

          {sites.map((site) => {
            const scan = latestScans[site.id];
            const variant = scan ? getRiskVariant(scan.risk_score) : null;

            return (
              <Link
                key={site.id}
                href={`/dashboard/sites/${site.id}`}
                className="block bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.08] transition-colors group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                      !scan ? 'bg-slate-600' : variant?.bar ?? 'bg-green-500'
                    }`} />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate text-sm">{site.name}</h3>
                      <p className="text-xs text-slate-500 truncate">{site.url}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0">
                    {scan ? (
                      <>
                        <div className="text-right hidden sm:block">
                          <div className={`text-xl font-bold ${variant?.color}`}>
                            {scan.risk_score}
                          </div>
                          <div className="text-[11px] text-slate-600">risk score</div>
                        </div>
                        <div className="text-right hidden md:block">
                          <div className="text-lg font-semibold text-white">
                            {scan.total_violations}
                          </div>
                          <div className="text-[11px] text-slate-600">violations</div>
                        </div>
                        <div className="text-right hidden lg:block">
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(scan.scanned_at)}
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">{variant?.label}</div>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded">
                        Not scanned
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>

                {scan && (
                  <div className="mt-3 ml-5">
                    <div className="w-full bg-white/5 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full ${variant?.bar}`}
                        style={{ width: `${Math.min(scan.risk_score, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Tip for new users */}
      {sites.length > 0 && unscannedSites.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-brand-500/5 border border-brand-500/15 rounded-xl text-sm">
          <TrendingDown className="h-4 w-4 text-brand-400 flex-shrink-0 mt-0.5" />
          <p className="text-slate-400">
            <span className="text-slate-300 font-medium">{unscannedSites.length} site{unscannedSites.length !== 1 ? 's need' : ' needs'} its first scan.</span>{' '}
            Go to{' '}
            <Link href="/dashboard/sites" className="text-brand-400 hover:underline">
              Sites
            </Link>{' '}
            and run a scan to see your risk score and violations.
          </p>
        </div>
      )}
    </div>
  );
}
