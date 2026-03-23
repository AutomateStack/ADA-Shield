'use client';

import { RiskGauge } from './risk-gauge';
import { ViolationCard } from './violation-card';
import { AlertTriangle, CheckCircle, Clock, Filter } from 'lucide-react';
import { useState } from 'react';

interface ScanResultsProps {
  result: any;
}

type ImpactFilter = 'all' | 'critical' | 'serious' | 'moderate' | 'minor';

export function ScanResults({ result }: ScanResultsProps) {
  const [filter, setFilter] = useState<ImpactFilter>('all');

  const filteredViolations =
    filter === 'all'
      ? result.violations
      : result.violations.filter((v: any) => v.impact === filter);

  // Prefer a backend-provided total violating rules count when available (avoids
  // undercounting on free scans where the violations array is intentionally truncated).
  // Fall back to violations.length + hiddenViolations so free-scan totals are accurate.
  const violatingRulesCount =
    result.totalViolatingRules ??
    (result.violations.length + (result.hiddenViolations ?? 0));

  const totalRules =
    result.passedRules + violatingRulesCount + (result.incompleteRules ?? 0);

  const filters: { value: ImpactFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: violatingRulesCount },
    { value: 'critical', label: 'Critical', count: result.criticalCount },
    { value: 'serious', label: 'Serious', count: result.seriousCount },
    { value: 'moderate', label: 'Moderate', count: result.moderateCount },
    { value: 'minor', label: 'Minor', count: result.minorCount },
  ];

  return (
    <div className="max-w-5xl mx-auto mt-12 space-y-8">
      {/* Summary Header */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Scan Results</h2>
            <p className="text-slate-400 text-sm mt-1 break-all">{result.url}</p>
          </div>
          <span className="text-sm text-slate-500">
            {new Date(result.scannedAt).toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Risk Gauge */}
          <div className="flex justify-center md:col-span-1">
            <RiskGauge
              score={result.riskScore}
              color={result.riskColor}
              level={result.riskLevel}
            />
          </div>

          {/* Stats */}
          <div className="md:col-span-3 grid grid-cols-3 gap-4">
            <StatCard
              label="Total Violations"
              value={result.totalViolations}
              icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
              sublabel={
                <span className="text-xs">
                  <span className="text-red-400">{result.criticalCount} critical</span>
                  {' · '}
                  <span className="text-orange-400">{result.seriousCount} serious</span>
                </span>
              }
            />
            <StatCard
              label="Rules Passed"
              value={result.passedRules}
              icon={<CheckCircle className="h-5 w-5 text-green-400" />}
              sublabel={
                <span className="text-xs text-slate-500">
                  of {totalRules} total rules
                </span>
              }
            />
            <StatCard
              label="Scan Time"
              value={`${(result.scanDurationMs / 1000).toFixed(1)}s`}
              icon={<Clock className="h-5 w-5 text-brand-400" />}
              sublabel={
                <span className="text-xs text-slate-500">
                  {result.isFreeScan ? 'Free scan' : 'Full scan'}
                </span>
              }
            />
          </div>
        </div>
      </div>

      {/* Violations Section */}
      <div>
        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-400" />
            Violations
          </h3>
          <div className="flex gap-1.5">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {f.label} {f.count !== undefined && f.count > 0 ? `(${f.count})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Violation Cards */}
        <div className="space-y-3">
          {filteredViolations.length > 0 ? (
            filteredViolations.map((violation: any, i: number) => (
              <ViolationCard key={i} violation={violation} index={i} />
            ))
          ) : (
            <div className="text-center py-8 text-slate-500">
              No {filter} violations found.
            </div>
          )}
        </div>
      </div>

      {/* Upsell Banner */}
      {result.hiddenViolations > 0 && (
        <div className="p-6 bg-gradient-to-r from-brand-600/10 to-purple-600/10 border border-brand-500/30 rounded-xl text-center">
          <AlertTriangle className="h-8 w-8 text-brand-400 mx-auto mb-3" />
          <p className="text-lg font-semibold text-white mb-2">
            {result.hiddenViolations} more violations found
          </p>
          <p className="text-slate-300 mb-4 max-w-md mx-auto">
            Sign up to see all violations with exact code fixes, get a detailed compliance report, and monitor your site weekly.
          </p>
          <a
            href="/signup"
            className="inline-block px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors"
          >
            Sign Up — It&apos;s Free
          </a>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  sublabel,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sublabel: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-xl bg-white/5 flex flex-col items-center text-center">
      {icon}
      <div className="text-3xl font-bold text-white mt-2">{value}</div>
      <div className="text-slate-400 text-sm mt-1">{label}</div>
      <div className="mt-2">{sublabel}</div>
    </div>
  );
}
