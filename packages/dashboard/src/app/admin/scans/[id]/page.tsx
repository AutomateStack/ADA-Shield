'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { RiskGauge } from '@/components/scan/risk-gauge';
import { ViolationCard } from '@/components/scan/violation-card';

interface AdminScanDetail {
  id: string;
  url: string;
  scanned_at: string;
  risk_score: number;
  total_violations: number;
  critical_count: number;
  serious_count: number;
  moderate_count: number;
  minor_count: number;
  passed_rules: number;
  incomplete_rules: number;
  scan_duration_ms: number;
  user_id: string | null;
  site_id: string | null;
  violations: any[];
}

function getRiskColor(score: number) {
  return score <= 29 ? 'green' : score <= 59 ? 'amber' : 'red';
}

function getRiskLevel(score: number) {
  return score <= 29 ? 'Low' : score <= 59 ? 'Medium' : 'High';
}

export default function AdminScanDetailPage() {
  const params = useParams();
  const scanId = params.id as string;

  const [scan, setScan] = useState<AdminScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${apiUrl}/api/admin/scans/${scanId}`, {
          headers: { 'x-admin-secret': adminSecret },
        });
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Scan not found' : 'Failed to load scan');
        }
        const data = await res.json();
        setScan(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load scan');
      } finally {
        setLoading(false);
      }
    };

    if (scanId) {
      load();
    }
  }, [apiUrl, adminSecret, scanId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/scans"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Scans
        </Link>
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          {error || 'Scan not found'}
        </div>
      </div>
    );
  }

  const scannedAt = new Date(scan.scanned_at).toLocaleString();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/admin/scans"
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Scans
          </Link>
          <h1 className="text-2xl font-bold text-white">Scan Detail</h1>
          <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
            <a
              href={scan.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-300 inline-flex items-center gap-1 break-all"
            >
              {scan.url}
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
            <span>·</span>
            <span>{scannedAt}</span>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="print:hidden inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex justify-center">
          <RiskGauge
            score={scan.risk_score}
            color={getRiskColor(scan.risk_score)}
            level={getRiskLevel(scan.risk_score)}
            size="sm"
          />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-red-400 mb-2" />
          <div className="text-3xl font-bold text-white">{scan.total_violations}</div>
          <div className="text-sm text-slate-400 mt-1">Violations</div>
          <div className="text-xs mt-2">
            <span className="text-red-400">{scan.critical_count} crit</span>
            {' · '}
            <span className="text-orange-400">{scan.serious_count} serious</span>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center">
          <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
          <div className="text-3xl font-bold text-white">{scan.passed_rules}</div>
          <div className="text-sm text-slate-400 mt-1">Rules Passed</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center">
          <Clock className="h-5 w-5 text-brand-400 mb-2" />
          <div className="text-3xl font-bold text-white">
            {(scan.scan_duration_ms / 1000).toFixed(1)}s
          </div>
          <div className="text-sm text-slate-400 mt-1">Scan Time</div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          Violations ({scan.violations?.length || 0})
        </h2>
        {scan.violations?.length ? (
          scan.violations.map((violation: any, i: number) => (
            <ViolationCard key={i} violation={violation} index={i} />
          ))
        ) : (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 text-center">
            <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-green-300 font-semibold">No Violations Found</p>
          </div>
        )}
      </div>
    </div>
  );
}
