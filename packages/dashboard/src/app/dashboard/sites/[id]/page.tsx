'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { RiskGauge } from '@/components/scan/risk-gauge';
import { ViolationCard } from '@/components/scan/violation-card';

interface Site {
  id: string;
  url: string;
  name: string;
  last_scanned_at: string | null;
}

interface ScanResult {
  id: string;
  risk_score: number;
  total_violations: number;
  critical_count: number;
  serious_count: number;
  moderate_count: number;
  minor_count: number;
  violations: any[];
  passed_rules: number;
  scan_duration_ms: number;
  scanned_at: string;
}

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;

  const [site, setSite] = useState<Site | null>(null);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedScan, setSelectedScan] = useState<ScanResult | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowser();

      const { data: siteData } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single();

      if (!siteData) {
        router.push('/dashboard/sites');
        return;
      }
      setSite(siteData);

      const { data: scanData } = await supabase
        .from('scan_results')
        .select('*')
        .eq('site_id', siteId)
        .order('scanned_at', { ascending: false })
        .limit(20);

      if (scanData && scanData.length > 0) {
        setScans(scanData);
        setSelectedScan(scanData[0]);
      }

      setLoading(false);
    };

    load();
  }, [siteId, router]);

  const handleScan = async () => {
    if (!site) return;
    setScanning(true);

    try {
      const supabase = createSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error('Not authenticated');

      // Use the authenticated scan endpoint — it enforces plan limits,
      // saves the result to the database, and sends notification emails.
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/scan/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ siteId }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Scan failed');
      }

      const data = await res.json();

      if (data.status === 'queued') {
        // BullMQ job enqueued — poll until the worker finishes
        // Allow up to 60 attempts × 2 s = 2 minutes before timing out
        const maxAttempts = 60;
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const statusRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/scan/status/${data.jobId}`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );
          if (!statusRes.ok) throw new Error('Failed to check scan status');
          const statusData = await statusRes.json();
          if (statusData.status === 'completed') break;
          if (statusData.status === 'failed') throw new Error('Scan job failed');
          if (i === maxAttempts - 1) throw new Error('Scan timed out');
        }
      }

      // Reload scan history — the API has already persisted the result
      const { data: scanData, error: scanError } = await supabase
        .from('scan_results')
        .select('*')
        .eq('site_id', siteId)
        .order('scanned_at', { ascending: false })
        .limit(20);

      if (scanError) throw new Error(scanError.message);

      if (scanData && scanData.length > 0) {
        setScans(scanData);
        setSelectedScan(scanData[0]);
      }
    } catch (err: any) {
      alert(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!site) return null;

  const getRiskColor = (score: number) =>
    score <= 29 ? 'green' : score <= 59 ? 'amber' : 'red';
  const getRiskLevel = (score: number) =>
    score <= 29 ? 'Low' : score <= 59 ? 'Medium' : 'High';

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/sites"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sites
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Globe className="h-8 w-8 text-brand-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">{site.name}</h1>
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-400 hover:text-brand-300 inline-flex items-center gap-1"
              >
                {site.url}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-800 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* No Scans */}
      {scans.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Scans Yet</h2>
          <p className="text-slate-400 mb-6">
            Run your first scan to check this site for accessibility violations.
          </p>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Run First Scan
          </button>
        </div>
      )}

      {/* Selected Scan Results */}
      {selectedScan && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex justify-center">
              <RiskGauge
                score={selectedScan.risk_score}
                color={getRiskColor(selectedScan.risk_score)}
                level={getRiskLevel(selectedScan.risk_score)}
                size="sm"
              />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400 mb-2" />
              <div className="text-3xl font-bold text-white">{selectedScan.total_violations}</div>
              <div className="text-sm text-slate-400 mt-1">Violations</div>
              <div className="text-xs mt-2">
                <span className="text-red-400">{selectedScan.critical_count} crit</span>
                {' · '}
                <span className="text-orange-400">{selectedScan.serious_count} serious</span>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
              <div className="text-3xl font-bold text-white">{selectedScan.passed_rules}</div>
              <div className="text-sm text-slate-400 mt-1">Rules Passed</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center">
              <Clock className="h-5 w-5 text-brand-400 mb-2" />
              <div className="text-3xl font-bold text-white">
                {(selectedScan.scan_duration_ms / 1000).toFixed(1)}s
              </div>
              <div className="text-sm text-slate-400 mt-1">Scan Time</div>
            </div>
          </div>

          {/* Scan History Selector */}
          {scans.length > 1 && (
            <div className="mb-6">
              <label htmlFor="scan-select" className="text-sm text-slate-400 mr-3">Scan History:</label>
              <select
                id="scan-select"
                value={selectedScan.id}
                onChange={(e) => {
                  const scan = scans.find((s) => s.id === e.target.value);
                  if (scan) setSelectedScan(scan);
                }}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {scans.map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    {new Date(scan.scanned_at).toLocaleString()} — Score: {scan.risk_score}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Violations */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              Violations ({selectedScan.violations.length})
            </h2>
            {selectedScan.violations.map((violation: any, i: number) => (
              <ViolationCard key={i} violation={violation} index={i} />
            ))}
            {selectedScan.violations.length === 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 text-center">
                <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                <p className="text-green-300 font-semibold">No Violations Found!</p>
                <p className="text-slate-400 text-sm mt-1">
                  This site passed all accessibility checks.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
