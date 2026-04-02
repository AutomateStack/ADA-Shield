'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Scan {
  id: string;
  url: string;
  scanned_at: string;
  risk_score: number;
  total_violations: number;
  critical_count: number;
  serious_count: number;
  moderate_count: number;
  minor_count: number;
  scan_duration_ms: number;
  user_id: string | null;
  site_id: string | null;
}

interface ScansResponse {
  scans: Scan[];
  total: number;
  page: number;
  totalPages: number;
}

interface AdminBulkScanResult {
  url: string;
  status: 'success' | 'failed';
  scanId?: string;
  riskScore?: number;
  totalViolations?: number;
  industry?: string;
  companyName?: string | null;
  contactEmail?: string | null;
  supportEmail?: string | null;
  allEmails?: string[];
  error?: string;
}

interface AdminBulkScanResponse {
  success: boolean;
  requestedCount: number;
  successCount: number;
  failedCount: number;
  results: AdminBulkScanResult[];
}

export default function AdminScansPage() {
  const [data, setData] = useState<ScansResponse | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'free' | 'authenticated'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [scanRunning, setScanRunning] = useState(false);
  const [scanSummary, setScanSummary] = useState('');
  const [scanResults, setScanResults] = useState<AdminBulkScanResult[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filter !== 'all') params.set('type', filter);

      const res = await fetch(`${apiUrl}/api/admin/scans?${params}`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) throw new Error('Failed to fetch scans');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret, page, filter]);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const runAdminScans = async () => {
    const urls = scanInput
      .split(/[\n,;]+/)
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setScanSummary('Please enter at least one URL.');
      return;
    }

    setScanRunning(true);
    setScanSummary('');
    setScanResults([]);
    try {
      const res = await fetch(`${apiUrl}/api/admin/scans/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ urls }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to run admin scans');
      }

      const typedPayload = payload as AdminBulkScanResponse;

      setScanSummary(`Completed: ${typedPayload.successCount} success, ${typedPayload.failedCount} failed (requested ${typedPayload.requestedCount}).`);
      setScanResults(typedPayload.results || []);
      await fetchScans();
    } catch (err: any) {
      setScanSummary(err.message || 'Failed to run admin scans');
    } finally {
      setScanRunning(false);
    }
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const extracted = text
        .split(/[\n,;]+/)
        .map((value) => value.trim())
        .filter(Boolean);

      const existing = scanInput
        .split(/[\n,]+/)
        .map((u) => u.trim())
        .filter(Boolean);
      const mergedMap = {} as Record<string, true>;
      [...existing, ...extracted].forEach((url) => {
        mergedMap[url] = true;
      });
      const merged = Object.keys(mergedMap);
      setScanInput(merged.join('\n'));
      setScanSummary(`Loaded ${extracted.length} URL/domain value(s) from CSV.`);
    } catch {
      setScanSummary('Failed to parse CSV file.');
    } finally {
      event.target.value = '';
    }
  };

  const downloadScanReportCsv = () => {
    if (!scanResults.length) return;

    const header = ['url', 'status', 'industry', 'company_name', 'contact_email', 'support_email', 'all_emails', 'scan_id', 'risk_score', 'total_violations', 'error'];
    const rows = scanResults.map((r) => [
      r.url || '',
      r.status || '',
      r.industry || '',
      r.companyName || '',
      r.contactEmail || '',
      r.supportEmail || '',
      Array.isArray(r.allEmails) ? r.allEmails.join('; ') : '',
      r.scanId || '',
      Number.isFinite(r.riskScore) ? String(r.riskScore) : '',
      Number.isFinite(r.totalViolations) ? String(r.totalViolations) : '',
      r.error || '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-scan-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Run Admin Scans (No Free Limit)</h2>
        <p className="text-xs text-slate-400">Paste one or more URLs/domains (comma, semicolon, or new line separated). Example: google.com or https://google.com. Admin scans are not subject to public free-scan limits.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors cursor-pointer">
            Upload CSV
            <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className="hidden" />
          </label>
          <button
            onClick={downloadScanReportCsv}
            disabled={!scanResults.length}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Download Last Run CSV
          </button>
        </div>
        <textarea
          value={scanInput}
          onChange={(e) => setScanInput(e.target.value)}
          rows={4}
          placeholder={'google.com\nhttps://another-site.com'}
          className="w-full rounded-lg bg-slate-900/70 border border-white/10 text-slate-200 placeholder:text-slate-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={runAdminScans}
            disabled={scanRunning}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-brand-300 hover:text-white bg-brand-600/10 hover:bg-brand-600/30 border border-brand-500/30 rounded-md transition-colors disabled:opacity-60"
          >
            {scanRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
            {scanRunning ? 'Scanning...' : 'Run Scans'}
          </button>
          {scanSummary && <span className="text-xs text-slate-300">{scanSummary}</span>}
        </div>

        {scanResults.length > 0 && (
          <div className="mt-2 overflow-x-auto border border-white/10 rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/5 text-slate-400">
                  <th className="px-3 py-2 text-left">URL</th>
                  <th className="px-3 py-2 text-left">Industry</th>
                  <th className="px-3 py-2 text-left">Emails Found</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {scanResults.slice(0, 15).map((r, idx) => (
                  <tr key={`${r.url}-${idx}`} className="border-t border-white/5 text-slate-300">
                    <td className="px-3 py-2 max-w-[280px] truncate" title={r.url}>{r.url}</td>
                    <td className="px-3 py-2">{r.industry || 'generic'}</td>
                    <td className="px-3 py-2">{Array.isArray(r.allEmails) && r.allEmails.length > 0 ? r.allEmails.join(', ') : '—'}</td>
                    <td className="px-3 py-2">{r.status === 'success' ? 'success' : (r.error || 'failed')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">All Scans</h1>
          <p className="text-sm text-slate-400 mt-1">
            {data ? `${data.total} total scans` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            {(['all', 'free', 'authenticated'] as const).map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  filter === f
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={fetchScans}
            className="p-2 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">URL</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Risk</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Violations</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Breakdown</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Duration</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Scanned</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading scans...
                  </td>
                </tr>
              ) : !data || data.scans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No scans found
                  </td>
                </tr>
              ) : (
                data.scans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <span className="text-slate-300 truncate" title={scan.url}>
                          {truncateUrl(scan.url)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          scan.user_id
                            ? 'bg-brand-500/10 text-brand-300'
                            : 'bg-slate-500/10 text-slate-400'
                        )}
                      >
                        {scan.user_id ? 'Auth' : 'Free'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge score={scan.risk_score} />
                    </td>
                    <td className="px-4 py-3 text-slate-300">{scan.total_violations}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-xs">
                        {scan.critical_count > 0 && (
                          <span className="text-red-400">{scan.critical_count}C</span>
                        )}
                        {scan.serious_count > 0 && (
                          <span className="text-orange-400">{scan.serious_count}S</span>
                        )}
                        {scan.moderate_count > 0 && (
                          <span className="text-yellow-400">{scan.moderate_count}M</span>
                        )}
                        {scan.minor_count > 0 && (
                          <span className="text-slate-400">{scan.minor_count}m</span>
                        )}
                        {scan.total_violations === 0 && (
                          <span className="text-green-400">Clean</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                      {scan.scan_duration_ms ? `${(scan.scan_duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {formatTimeAgo(scan.scanned_at)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/scans/${scan.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-brand-300 hover:text-white bg-brand-600/10 hover:bg-brand-600/30 border border-brand-500/30 rounded-md transition-colors"
                      >
                        View
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

function RiskBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'bg-red-500/10 text-red-400'
      : score >= 40
      ? 'bg-amber-500/10 text-amber-400'
      : 'bg-green-500/10 text-green-400';

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-bold', color)}>
      {score}
    </span>
  );
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return u.hostname + path;
  } catch {
    return url;
  }
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
