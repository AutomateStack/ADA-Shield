interface ShieldLogoProps {
  /** Tailwind size class applied to width/height, e.g. "h-7 w-7" */
  className?: string;
}

/**
 * Custom ADA Shield logo — a gradient shield with a glowing inner checkmark.
 * Drop-in replacement for the plain Lucide <Shield> icon used in logo lockups.
 */
export function ShieldLogo({ className = 'h-8 w-8' }: ShieldLogoProps) {
  return (
    <svg
      viewBox="0 0 40 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Main gradient — indigo → violet */}
        <linearGradient id="shield-grad" x1="20" y1="0" x2="20" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>

        {/* Subtle inner highlight */}
        <linearGradient id="shield-shine" x1="10" y1="2" x2="30" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Glow filter */}
        <filter id="shield-glow" x="-30%" y="-20%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer shield shape — drop shadow */}
      <path
        d="M20 2L3 9v12c0 10.5 7.3 20.3 17 23 9.7-2.7 17-12.5 17-23V9L20 2Z"
        fill="#4f46e5"
        opacity="0.35"
        transform="translate(0, 2)"
      />

      {/* Main shield body */}
      <path
        d="M20 2L3 9v12c0 10.5 7.3 20.3 17 23 9.7-2.7 17-12.5 17-23V9L20 2Z"
        fill="url(#shield-grad)"
        filter="url(#shield-glow)"
      />

      {/* Gloss overlay */}
      <path
        d="M20 2L3 9v12c0 10.5 7.3 20.3 17 23 9.7-2.7 17-12.5 17-23V9L20 2Z"
        fill="url(#shield-shine)"
      />

      {/* Thin border */}
      <path
        d="M20 2L3 9v12c0 10.5 7.3 20.3 17 23 9.7-2.7 17-12.5 17-23V9L20 2Z"
        stroke="#a5b4fc"
        strokeWidth="0.8"
        strokeOpacity="0.5"
        fill="none"
      />

      {/* Checkmark */}
      <path
        d="M12 22.5l5.5 5.5 10.5-11"
        stroke="#ffffff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
    </svg>
  );
}
