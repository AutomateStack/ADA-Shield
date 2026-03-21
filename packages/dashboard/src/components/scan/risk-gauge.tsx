'use client';

interface RiskGaugeProps {
  score: number;
  color: string;
  level: string;
  size?: 'sm' | 'lg';
}

export function RiskGauge({ score, color, level, size = 'lg' }: RiskGaugeProps) {
  const radius = size === 'lg' ? 80 : 50;
  const strokeWidth = size === 'lg' ? 10 : 7;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const viewBoxSize = (radius + strokeWidth) * 2;
  const center = radius + strokeWidth;

  const strokeColor =
    color === 'green'
      ? '#22c55e'
      : color === 'amber'
      ? '#f59e0b'
      : '#ef4444';

  const textSize = size === 'lg' ? 'text-5xl' : 'text-3xl';
  const labelSize = size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg
        width={viewBoxSize}
        height={viewBoxSize}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textSize} font-bold`} style={{ color: strokeColor }}>
          {score}
        </span>
        <span className={`${labelSize} text-slate-400 mt-1`}>/ 100</span>
      </div>
      {/* Risk level badge */}
      <div
        className={`mt-3 px-3 py-1 rounded-full text-xs font-semibold ${
          color === 'green'
            ? 'bg-green-500/20 text-green-300'
            : color === 'amber'
            ? 'bg-amber-500/20 text-amber-300'
            : 'bg-red-500/20 text-red-300'
        }`}
      >
        {level} Risk
      </div>
    </div>
  );
}
