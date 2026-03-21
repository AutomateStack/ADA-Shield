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
} from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { RiskGauge } from '@/components/scan/risk-gauge';

interface Site {
  id: string;
  url: string;
  name: string;
  last_scanned_at: string | null;
  created_at: string;
}

interface LatestScan {
  risk_score: number;
  total_violations: number;
  critical_count: number;
  serious_count: number;
  passed_rules: number;
  scanned_at: string;
}

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

          // Fetch latest scan for each site
          const scans: Record<string, LatestScan> = {};
          for (const site of sitesData) {
            const { data: scanData } = await supabase
              .from('scan_results')
              .select('risk_score, total_violations, critical_count, serious_count, passed_rules, scanned_at')
              .eq('site_id', site.id)
              .order('scanned_at', { ascending: false })
              .limit(1)
              .single();

            if (scanData) {
              scans[site.id] = scanData;
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

  // Calculate overview stats
  const totalViolations = Object.values(latestScans).reduce(
    (sum, s) => sum + (s.total_violations || 0),
    0
  );
  const avgRiskScore = sites.length > 0
    ? Math.round(
        Object.values(latestScans).reduce((sum, s) => sum + (s.risk_score || 0), 0) /
          Math.max(Object.values(latestScans).length, 1)
      )
    : 0;

  const getRiskColor = (score: number) =>
    score <= 29 ? 'green' : score <= 59 ? 'amber' : 'red';
  const getRiskLevel = (score: number) =>
    score <= 29 ? 'Low' : score <= 59 ? 'Medium' : 'High';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Welcome back{user?.email ? `, ${user.email}` : ''}.
          </p>
        </div>
        <Link
          href="/dashboard/sites"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Site
        </Link>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="h-5 w-5 text-brand-400" />
            <span className="text-sm text-slate-400">Total Sites</span>
          </div>
          <div className="text-3xl font-bold text-white">{sites.length}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <span className="text-sm text-slate-400">Total Violations</span>
          </div>
          <div className="text-3xl font-bold text-white">{totalViolations}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="h-5 w-5 text-amber-400" />
            <span className="text-sm text-slate-400">Avg Risk Score</span>
          </div>
          <div className="text-3xl font-bold text-white">{avgRiskScore}</div>
        </div>
      </div>

      {/* Sites List */}
      {sites.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <Globe className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Sites Yet</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Add your first website to start monitoring it for ADA compliance violations.
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
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Your Sites</h2>
          {sites.map((site) => {
            const scan = latestScans[site.id];
            const riskColor = scan ? getRiskColor(scan.risk_score) : 'green';
            const riskLevel = scan ? getRiskLevel(scan.risk_score) : 'N/A';

            return (
              <Link
                key={site.id}
                href={`/dashboard/sites/${site.id}`}
                className="block bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/[0.07] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <Globe className="h-8 w-8 text-brand-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">{site.name}</h3>
                      <p className="text-sm text-slate-500 truncate">{site.url}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                    {scan ? (
                      <>
                        <div className="text-right hidden sm:block">
                          <div
                            className={`text-2xl font-bold ${
                              riskColor === 'green'
                                ? 'text-green-400'
                                : riskColor === 'amber'
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}
                          >
                            {scan.risk_score}
                          </div>
                          <div className="text-xs text-slate-500">Risk Score</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-lg font-semibold text-white">
                            {scan.total_violations}
                          </div>
                          <div className="text-xs text-slate-500">Violations</div>
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">Not scanned</span>
                    )}
                    <ArrowRight className="h-5 w-5 text-slate-500" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
