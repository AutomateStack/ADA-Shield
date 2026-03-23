'use client';

import { Download, Award } from 'lucide-react';

interface ComplianceBadgeProps {
  riskScore: number;
  siteUrl: string;
}

function buildSvg(siteUrl: string, year: number): string {
  const domain = (() => {
    try {
      return new URL(siteUrl).hostname.replace(/^www\./, '');
    } catch {
      return siteUrl;
    }
  })();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="68" viewBox="0 0 200 68" role="img" aria-label="ADA Shield Accessibility Verified Badge">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1b4b"/>
      <stop offset="100%" style="stop-color:#312e81"/>
    </linearGradient>
    <linearGradient id="shield" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="200" height="68" rx="10" fill="url(#bg)" stroke="#4338ca" stroke-width="1.5"/>
  <!-- Shield icon -->
  <path d="M18 12 L30 12 L30 22 C30 27 24 30 24 30 C24 30 18 27 18 22 Z" fill="url(#shield)"/>
  <!-- Checkmark -->
  <polyline points="20,22 23,25 28,19" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- ADA Shield text -->
  <text x="36" y="22" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="700" fill="white">ADA Shield</text>
  <!-- Verified label -->
  <text x="36" y="34" font-family="system-ui,-apple-system,sans-serif" font-size="9" fill="#a5b4fc">Accessibility Verified ${year}</text>
  <!-- Divider -->
  <line x1="14" y1="42" x2="186" y2="42" stroke="#4338ca" stroke-width="1"/>
  <!-- Domain -->
  <text x="100" y="57" font-family="system-ui,-apple-system,sans-serif" font-size="9" fill="#c7d2fe" text-anchor="middle">${domain}</text>
</svg>`;
}

export function ComplianceBadge({ riskScore, siteUrl }: ComplianceBadgeProps) {
  if (riskScore > 29) return null; // only show for low-risk sites

  const year = new Date().getFullYear();
  const svg = buildSvg(siteUrl, year);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const embedCode = `<a href="https://adashield.io" target="_blank" rel="noopener noreferrer" title="ADA Accessibility Verified">
  <img src="${dataUrl}" alt="ADA Shield Accessibility Verified" width="200" height="68" />
</a>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
  };

  return (
    <div className="bg-gradient-to-r from-green-500/10 to-brand-600/10 border border-green-500/30 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <Award className="h-8 w-8 text-green-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-green-300 mb-1">
            Low Risk — Compliance Badge Available
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Your site scored {riskScore}/100. Display this badge to show visitors you take accessibility seriously.
          </p>

          {/* Badge preview */}
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt="ADA Shield compliance badge preview"
              width={200}
              height={68}
              className="rounded-lg"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={dataUrl}
              download="ada-shield-badge.svg"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download Badge SVG
            </a>
            <button
              onClick={copyEmbed}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/10 rounded-lg transition-colors"
            >
              Copy Embed Code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
