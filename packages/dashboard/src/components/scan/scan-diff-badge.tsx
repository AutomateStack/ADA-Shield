import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScanDiffBadgeProps {
  current: {
    total_violations: number;
    critical_count: number;
    serious_count: number;
    risk_score: number;
  };
  previous: {
    total_violations: number;
    critical_count: number;
    serious_count: number;
    risk_score: number;
  };
}

export function ScanDiffBadge({ current, previous }: ScanDiffBadgeProps) {
  const violationDiff = current.total_violations - previous.total_violations;
  const criticalDiff = current.critical_count - previous.critical_count;
  const scoreDiff = current.risk_score - previous.risk_score;

  if (violationDiff === 0 && scoreDiff === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 border border-white/10 text-sm text-slate-400">
        <Minus className="h-4 w-4" />
        No change since last scan
      </div>
    );
  }

  const improved = violationDiff < 0;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-lg border text-sm font-medium ${
        improved
          ? 'bg-green-500/10 border-green-500/30 text-green-300'
          : 'bg-red-500/10 border-red-500/30 text-red-300'
      }`}
    >
      {improved ? (
        <TrendingDown className="h-4 w-4 flex-shrink-0" />
      ) : (
        <TrendingUp className="h-4 w-4 flex-shrink-0" />
      )}

      <span>
        {improved ? '↓' : '↑'}{' '}
        {Math.abs(violationDiff)} violation{Math.abs(violationDiff) !== 1 ? 's' : ''}{' '}
        {improved ? 'fixed' : 'new'} since last scan
      </span>

      {criticalDiff !== 0 && (
        <span
          className={`px-2 py-0.5 rounded-full text-xs ${
            criticalDiff > 0
              ? 'bg-red-500/20 text-red-300'
              : 'bg-green-500/20 text-green-300'
          }`}
        >
          {criticalDiff > 0 ? '+' : ''}{criticalDiff} critical
        </span>
      )}

      {scoreDiff !== 0 && (
        <span className="text-xs opacity-75">
          risk score {scoreDiff > 0 ? '+' : ''}{scoreDiff}
        </span>
      )}
    </div>
  );
}
