'use client';

import { useState } from 'react';
import { Search, ArrowRight, Loader2 } from 'lucide-react';

interface ScanFormProps {
  onResult: (data: any) => void;
  onError: (message: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

const SCAN_STEPS = [
  'Launching browser...',
  'Loading page...',
  'Analyzing accessibility...',
  'Calculating risk score...',
];

export function ScanForm({ onResult, onError, onLoadingChange }: ScanFormProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStep(0);
    onLoadingChange(true);
    onError('');

    // Simulate progress steps
    const stepInterval = setInterval(() => {
      setStep((prev) => Math.min(prev + 1, SCAN_STEPS.length - 1));
    }, 3000);

    try {
      let scanUrl = url.trim();
      if (!scanUrl.startsWith('http://') && !scanUrl.startsWith('https://')) {
        scanUrl = `https://${scanUrl}`;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/scan/free`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: scanUrl }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Scan failed');
      }

      const data = await res.json();
      onResult(data);
    } catch (err: any) {
      onError(err.message || 'Something went wrong. Please try again.');
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
      onLoadingChange(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter your website URL (e.g., example.com)"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-lg"
            required
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-lg flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              Scan Free
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </form>
      <p className="text-sm text-slate-500 mt-3 text-center">
        Free scan &mdash; no login required. See your risk score in seconds.
      </p>

      {/* Progress Steps */}
      {loading && (
        <div className="mt-6 flex justify-center">
          <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-4 inline-flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
            <span className="text-sm text-slate-300">{SCAN_STEPS[step]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
