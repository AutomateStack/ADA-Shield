'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Upload, CheckCircle, AlertCircle, Clock, FileSpreadsheet, Play, Save } from 'lucide-react';

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleString() : '—';

interface Batch {
  id: string;
  created_at: string;
  file_name: string | null;
  row_count: number;
  imported_count: number;
  skipped_count: number;
  status: 'pending' | 'processing' | 'done' | 'failed';
  error_details: Array<{ url?: string; raw?: string; reason: string }> | null;
}

interface ImportResult {
  batchId: string;
  rowCount: number;
  imported: number;
  skipped: number;
  errors: Array<{ url?: string; raw?: string; reason: string }>;
  message: string;
}

interface QueueStatus {
  pendingSites: number;
  activeJobs: number;
  waitingJobs: number;
  dailyLimit: number;
  queueAvailable: boolean;
}

interface RunNowResult {
  enqueued: number;
  requestedLimit: number;
  message: string;
}

function StatusBadge({ status }: { status: Batch['status'] }) {
  const map: Record<Batch['status'], { cls: string; label: string }> = {
    pending: { cls: 'bg-slate-500/10 text-slate-400', label: 'Pending' },
    processing: { cls: 'bg-amber-500/10 text-amber-300', label: 'Processing' },
    done: { cls: 'bg-green-500/10 text-green-400', label: 'Done' },
    failed: { cls: 'bg-red-500/10 text-red-400', label: 'Failed' },
  };
  const { cls, label } = map[status] || map.pending;
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
  );
}

export default function AdminBulkImportPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [runNowResult, setRunNowResult] = useState<RunNowResult | null>(null);
  const [error, setError] = useState('');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [dailyLimitInput, setDailyLimitInput] = useState('2');
  const [savingSettings, setSavingSettings] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [batchRes, queueRes] = await Promise.all([
        fetch(`${apiUrl}/api/admin/bulk-import/batches?limit=20`, {
          headers: { 'x-admin-secret': adminSecret },
        }),
        fetch(`${apiUrl}/api/admin/bulk-import/queue-status`, {
          headers: { 'x-admin-secret': adminSecret },
        }),
      ]);
      if (batchRes.ok) {
        const data = await batchRes.json();
        setBatches(data.batches || []);
      }
      if (queueRes.ok) {
        const queuePayload = await queueRes.json();
        setQueueStatus(queuePayload);
        setDailyLimitInput(String(queuePayload.dailyLimit || 2));
      }
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setResult(null);
    setRunNowResult(null);
    setError('');

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch(`${apiUrl}/api/admin/bulk-import`, {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
        body: form,
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Upload failed');
      } else {
        setResult(payload);
        await fetchData();
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      // Reset file input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveDailyLimit = async () => {
    setSavingSettings(true);
    setError('');
    setRunNowResult(null);

    try {
      const res = await fetch(`${apiUrl}/api/admin/bulk-import/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ dailyLimit: Number(dailyLimitInput) }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Failed to save daily limit');
        return;
      }
      setDailyLimitInput(String(payload.dailyLimit));
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save daily limit');
    } finally {
      setSavingSettings(false);
    }
  };

  const runNow = async () => {
    setRunningNow(true);
    setError('');
    setRunNowResult(null);

    try {
      const res = await fetch(`${apiUrl}/api/admin/bulk-import/run-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ dailyLimit: Number(dailyLimitInput) }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Failed to run bulk process');
        return;
      }
      setRunNowResult(payload);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to run bulk process');
    } finally {
      setRunningNow(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bulk Import</h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload an Excel sheet to auto-scan and email sites. 2 sites are processed per day.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Queue status cards */}
      {queueStatus && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">Pending Sites</div>
            <div className="mt-2 text-2xl font-bold text-white">{queueStatus.pendingSites}</div>
            <div className="mt-1 text-xs text-slate-400">awaiting scan + email</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">Daily Limit</div>
            <div className="mt-2 text-2xl font-bold text-white">{queueStatus.dailyLimit}</div>
            <div className="mt-1 text-xs text-slate-400">sites per day</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">Active Jobs</div>
            <div className="mt-2 text-2xl font-bold text-white">{queueStatus.activeJobs}</div>
            <div className="mt-1 text-xs text-slate-400">running now</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">Queue</div>
            <div className={`mt-2 text-sm font-semibold ${queueStatus.queueAvailable ? 'text-green-400' : 'text-amber-400'}`}>
              {queueStatus.queueAvailable ? 'Active' : 'No Redis'}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {queueStatus.queueAvailable ? 'Processing enabled' : 'Set REDIS_URL to enable'}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Daily Processing Controls</h2>
            <p className="mt-1 text-xs text-slate-400">
              Choose how many pending imported sites to scan and email per day, or run that amount immediately.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                Sites Per Day
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(e.target.value)}
                className="w-32 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              onClick={saveDailyLimit}
              disabled={savingSettings}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-60"
            >
              {savingSettings ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Limit
            </button>
            <button
              onClick={runNow}
              disabled={runningNow || !queueStatus?.queueAvailable}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {runningNow ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Now
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Daily schedule runs at 09:00 UTC and uses the saved limit. Run Now queues the same number immediately.
        </div>
      </div>

      {/* Upload area */}
      <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-8">
        <div className="text-center space-y-4">
          <FileSpreadsheet className="h-10 w-10 text-slate-500 mx-auto" />
          <div>
            <div className="text-sm font-medium text-slate-200">Upload Excel file (.xlsx or .xls)</div>
            <div className="text-xs text-slate-500 mt-1">
              Required columns: <span className="text-slate-300">Site URL</span>,{' '}
              <span className="text-slate-300">Email</span> — Optional:{' '}
              <span className="text-slate-300">Name</span>,{' '}
              <span className="text-slate-300">Site Name</span>,{' '}
              <span className="text-slate-300">Facebook URL</span>,{' '}
              <span className="text-slate-300">Instagram URL</span>,{' '}
              <span className="text-slate-300">Phone</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="bulk-file-input"
          />
          <label
            htmlFor="bulk-file-input"
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
              uploading
                ? 'bg-brand-700 text-white cursor-not-allowed opacity-60'
                : 'bg-brand-600 hover:bg-brand-700 text-white'
            }`}
          >
            {uploading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Choose File
              </>
            )}
          </label>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
            <CheckCircle className="h-4 w-4" />
            Import complete
          </div>
          <p className="text-sm text-slate-300">{result.message}</p>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <span>Rows in file: <strong className="text-slate-200">{result.rowCount}</strong></span>
            <span>Imported: <strong className="text-green-400">{result.imported}</strong></span>
            <span>Skipped: <strong className="text-amber-400">{result.skipped}</strong></span>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
              {result.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span className="break-all">
                    <span className="text-slate-400">{e.url || e.raw || '?'}</span> — {e.reason}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {runNowResult && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-5 space-y-2">
          <div className="flex items-center gap-2 text-brand-300 font-semibold text-sm">
            <CheckCircle className="h-4 w-4" />
            Run started
          </div>
          <p className="text-sm text-slate-300">{runNowResult.message}</p>
          <div className="text-xs text-slate-400">
            Requested: <strong className="text-slate-200">{runNowResult.requestedLimit}</strong> site(s), queued now:{' '}
            <strong className="text-slate-200">{runNowResult.enqueued}</strong>
          </div>
        </div>
      )}

      {/* Batch history */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-white">Import History</h2>
        </div>

        {batches.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-500 text-sm">
            No imports yet. Upload an Excel file above to get started.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {batches.map((batch) => (
              <div key={batch.id}>
                <button
                  onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                  className="w-full text-left px-5 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-200 truncate">
                          {batch.file_name || 'Unnamed file'}
                        </span>
                        <StatusBadge status={batch.status} />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{formatDate(batch.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-shrink-0">
                      <span>{batch.row_count} rows</span>
                      <span className="text-green-400">{batch.imported_count} imported</span>
                      <span className="text-amber-400">{batch.skipped_count} skipped</span>
                    </div>
                  </div>
                </button>

                {expandedBatch === batch.id && batch.error_details && batch.error_details.length > 0 && (
                  <div className="px-5 pb-5 bg-black/10">
                    <div className="pt-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Skipped rows
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {batch.error_details.map((e, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          <span className="break-all">
                            <span className="text-slate-400">{e.url || e.raw || '?'}</span> — {e.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
