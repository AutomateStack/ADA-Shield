'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface TrendPoint {
  date: string;
  score: number;
}

interface RiskTrendChartProps {
  scans: Array<{
    scanned_at: string;
    risk_score: number;
  }>;
}

function scoreColor(score: number) {
  if (score <= 29) return '#22c55e'; // green
  if (score <= 59) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  const color = scoreColor(payload.score);
  return (
    <circle cx={cx} cy={cy} r={4} fill={color} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value as number;
  const color = scoreColor(score);
  const level = score <= 29 ? 'Low' : score <= 59 ? 'Medium' : 'High';
  return (
    <div className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-semibold" style={{ color }}>
        Risk Score: {score} ({level})
      </p>
    </div>
  );
}

export function RiskTrendChart({ scans }: RiskTrendChartProps) {
  // Take up to 10 most recent, then reverse so oldest → newest (left → right)
  const data: TrendPoint[] = [...scans]
    .slice(0, 10)
    .reverse()
    .map((s) => ({
      date: new Date(s.scanned_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      score: s.risk_score,
    }));

  if (data.length < 2) return null; // needs at least 2 points to be useful

  // Determine the dominant color by average risk
  const avg = data.reduce((sum, p) => sum + p.score, 0) / data.length;
  const lineColor = scoreColor(avg);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Risk Score Trend</h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          {/* Low/High reference zones */}
          <ReferenceLine y={30} stroke="rgba(34,197,94,0.25)" strokeDasharray="4 4" />
          <ReferenceLine y={60} stroke="rgba(239,68,68,0.25)" strokeDasharray="4 4" />

          <XAxis
            dataKey="date"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            stroke={lineColor}
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 6, fill: lineColor }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-3 justify-end">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-block w-4 h-0.5 bg-green-500 rounded" />
          Low (&lt;30)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-block w-4 h-0.5 bg-amber-500 rounded" />
          Medium
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-block w-4 h-0.5 bg-red-500 rounded" />
          High (&gt;60)
        </span>
      </div>
    </div>
  );
}
