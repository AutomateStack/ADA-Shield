'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Share2,
  Download,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { RiskGauge } from '@/components/scan/risk-gauge';
import { ViolationCard } from '@/components/scan/violation-card';
import { ShieldLogo } from '@/components/ui/shield-logo';

const MAX_FREE_VIOLATIONS = 3;

function getRiskColor(score: number) {
  return score <= 29 ? 'green' : score <= 59 ? 'amber' : 'red';
}
function getRiskLevel(score: number) {
  return score <= 29 ? 'Low' : score <= 59 ? 'Medium' : 'High';
}

export default function PublicReportPage() {
  const params = useParams();
  const token = params.token as string;

  const [scan, setScan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/scan/report/${token}`
        );
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setScan(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center gap-4 px-4">
        <AlertTriangle className="h-16 w-16 text-slate-600" />
        <h1 className="text-2xl font-bold text-white">Report Not Found</h1>
        <p className="text-slate-400">This report link may have expired or never existed.</p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors"
        >
          Scan Your Site Free
        </Link>
      </div>
    );
  }

  const shownViolations = scan.violations?.slice(0, MAX_FREE_VIOLATIONS) ?? [];
  const hiddenCount = (scan.total_violations ?? 0) - shownViolations.length;
  const scannedAt = scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : '';

  return (
    <>
      {/* Print-only header */}
      <div className="hidden print:flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
        <ShieldLogo className="h-8 w-8" />
        <span className="text-xl font-bold text-slate-900">ADA Shield — Accessibility Report</span>
      </div>

      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 print:bg-white print:text-slate-900">
        {/* Navbar */}
        <header className="print:hidden border-b border-white/10 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <ShieldLogo className="h-7 w-7" />
              <span className="text-lg font-bold text-white">ADA Shield</span>
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              >
                <Share2 className="h-4 w-4" />
                {copied ? 'Copied!' : 'Share'}
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Save PDF
              </button>
              <Link
                href="/signup"
                className="px-4 py-2 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
              >
                Get Full Report
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-12 space-y-10">
          {/* Title */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-medium mb-4 print:hidden">
              <Shield className="h-3.5 w-3.5" />
              Public Accessibility Report
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white print:text-slate-900 mb-1">
              Accessibility Scan Results
            </h1>
            <div className="flex items-center gap-2 text-sm text-slate-400 print:text-slate-600">
              <a
                href={scan.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-300 flex items-center gap-1 break-all print:text-slate-700"
              >
                {scan.url}
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 print:hidden" />
              </a>
              <span>·</span>
              <span>{scannedAt}</span>
            </div>
          </div>

          {/* Score + Stats */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 print:bg-slate-50 print:border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Gauge */}
              <div className="flex justify-center">
                <RiskGauge
                  score={scan.risk_score}
                  color={getRiskColor(scan.risk_score)}
                  level={getRiskLevel(scan.risk_score)}
                  size="sm"
                />
              </div>

              {/* Stat cards */}
              <div className="md:col-span-3 grid grid-cols-3 gap-4">
                <MiniStat
                  icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
                  label="Violations"
                  value={scan.total_violations ?? 0}
                  sub={
                    <span className="text-xs">
                      <span className="text-red-400">{scan.critical_count ?? 0} critical</span>{' · '}
                      <span className="text-orange-400">{scan.serious_count ?? 0} serious</span>
                    </span>
                  }
                />
                <MiniStat
                  icon={<CheckCircle className="h-5 w-5 text-green-400" />}
                  label="Rules Passed"
                  value={scan.passed_rules ?? 0}
                  sub={<span className="text-xs text-slate-500">WCAG 2.1 AA checks</span>}
                />
                <MiniStat
                  icon={<Clock className="h-5 w-5 text-brand-400" />}
                  label="Scan Time"
                  value={`${((scan.scan_duration_ms ?? 0) / 1000).toFixed(1)}s`}
                  sub={<span className="text-xs text-slate-500">Full page analysis</span>}
                />
              </div>
            </div>
          </div>

          {/* Violations preview */}
          {shownViolations.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-white print:text-slate-900 mb-4">
                Top Violations
              </h2>
              <div className="space-y-3">
                {shownViolations.map((v: any, i: number) => (
                  <ViolationCard key={i} violation={v} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* Upsell gate */}
          {hiddenCount > 0 && (
            <div className="print:hidden p-8 bg-gradient-to-r from-brand-600/10 to-purple-600/10 border border-brand-500/30 rounded-xl text-center">
              <AlertTriangle className="h-9 w-9 text-brand-400 mx-auto mb-3" />
              <p className="text-lg font-semibold text-white mb-2">
                {hiddenCount} more violation{hiddenCount !== 1 ? 's' : ''} on this page
              </p>
              <p className="text-slate-300 mb-5 max-w-lg mx-auto">
                Sign up free to see all violations with exact code fixes, download a compliance PDF, and monitor your site weekly.
              </p>
              <Link
                href="/signup"
                className="inline-block px-7 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors"
              >
                Get Full Report — Free
              </Link>
            </div>
          )}

          {/* Footer attribution */}
          <div className="print:hidden text-center pt-4 pb-8">
            <p className="text-sm text-slate-500">
              Report generated by{' '}
              <Link href="/" className="text-brand-400 hover:underline">
                ADA Shield
              </Link>{' '}
              · Scan your own site at{' '}
              <Link href="/" className="text-brand-400 hover:underline">
                adashield.io
              </Link>
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col items-center justify-center text-center print:bg-slate-100 print:border-slate-200">
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-bold text-white print:text-slate-900">{value}</div>
      <div className="text-xs text-slate-400 mt-1 print:text-slate-600">{label}</div>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}
