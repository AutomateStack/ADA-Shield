import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowRight, CheckCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://adashield.com';

export const metadata: Metadata = {
  title: 'ADA Website Compliance Guide 2026 — WCAG 2.1 Checklist & Lawsuit Prevention',
  description:
    'The complete guide to ADA website compliance. Learn what WCAG 2.1 AA requires, which violations trigger lawsuits, and exactly how to fix them — with a free automated scanner.',
  keywords: [
    'ADA website compliance',
    'WCAG 2.1 checklist',
    'ADA compliance guide',
    'website accessibility requirements',
    'ADA Website lawsuit prevention',
    'WCAG 2.1 AA requirements',
    'accessibility audit checklist',
    'ADA Title III website',
  ],
  openGraph: {
    title: 'ADA Website Compliance Guide 2026 — WCAG 2.1 Checklist',
    description:
      'The complete guide to ADA website compliance. Learn WCAG 2.1 AA requirements, which violations trigger lawsuits, and how to fix them.',
    url: `${siteUrl}/ada-compliance-guide`,
    type: 'article',
    siteName: 'ADA Shield',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ADA Website Compliance Guide 2026',
    description:
      'Complete WCAG 2.1 checklist, lawsuit stats, and exact code fixes for every common ADA violation.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      headline: 'ADA Website Compliance Guide 2026 — WCAG 2.1 Checklist & Lawsuit Prevention',
      description:
        'The complete guide to ADA website compliance. Covers WCAG 2.1 AA requirements, lawsuit statistics, violation types, code fixes, and monitoring best practices.',
      url: `${siteUrl}/ada-compliance-guide`,
      datePublished: '2026-01-01',
      dateModified: '2026-03-24',
      author: { '@type': 'Organization', name: 'ADA Shield' },
      publisher: {
        '@type': 'Organization',
        name: 'ADA Shield',
        url: siteUrl,
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'ADA Compliance Guide',
          item: `${siteUrl}/ada-compliance-guide`,
        },
      ],
    },
  ],
};

const WCAG_PRINCIPLES = [
  {
    letter: 'P',
    name: 'Perceivable',
    color: 'text-brand-400',
    bg: 'bg-brand-500/10 border-brand-500/20',
    description:
      'All information and UI components must be presentable to users in ways they can perceive — including via screen readers and other assistive tech.',
    items: [
      'Alt text on every meaningful image',
      'Captions on all pre-recorded video',
      'Colour is never the only way to convey information',
      'Text has at least 4.5:1 contrast ratio against its background',
    ],
  },
  {
    letter: 'O',
    name: 'Operable',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    description:
      'All UI components and navigation must be operable — users who cannot use a mouse must be able to complete every action using only a keyboard.',
    items: [
      'All functionality available via keyboard alone',
      'No keyboard traps — users can always navigate away',
      'Visible focus indicator on every focusable element',
      'No flashing content faster than 3 flashes per second',
    ],
  },
  {
    letter: 'U',
    name: 'Understandable',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    description:
      'Information and the operation of the UI must be understandable — users must be able to comprehend content and know how to interact with forms.',
    items: [
      'Page language declared in HTML lang attribute',
      'Form inputs have descriptive, associated labels',
      'Error messages identify the field and suggest a fix',
      'Consistent navigation across pages',
    ],
  },
  {
    letter: 'R',
    name: 'Robust',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    description:
      'Content must be robust enough to be interpreted by current and future assistive technologies, including screen readers and voice control software.',
    items: [
      'Valid, well-formed HTML markup',
      'ARIA attributes used correctly',
      'Status messages conveyed without requiring focus',
      'Name, role, and value for all UI components',
    ],
  },
];

const TOP_VIOLATIONS = [
  {
    rank: 1,
    name: 'Missing image alt text',
    wcag: '1.1.1',
    impact: 'Critical',
    impactColor: 'text-red-400 bg-red-400/10',
    description:
      'Screen readers announce images by their alt attribute. Without it, blind users receive no information about the image content.',
    fix: `<!-- Before -->
<img src="product-photo.jpg">

<!-- After -->
<img src="product-photo.jpg" alt="Blue running shoes, size 10, side view">`,
  },
  {
    rank: 2,
    name: 'Insufficient colour contrast',
    wcag: '1.4.3',
    impact: 'Serious',
    impactColor: 'text-amber-400 bg-amber-400/10',
    description:
      'Text must achieve a 4.5:1 contrast ratio against its background (3:1 for large text). Low contrast makes text illegible for users with low vision.',
    fix: `/* Before — fails 4.5:1 ratio */
color: #999999; /* on white = 2.85:1 ❌ */

/* After — passes */
color: #767676; /* on white = 4.54:1 ✅ */`,
  },
  {
    rank: 3,
    name: 'Form inputs without labels',
    wcag: '1.3.1 / 4.1.2',
    impact: 'Critical',
    impactColor: 'text-red-400 bg-red-400/10',
    description:
      'Screen readers read out the label when a user focuses on an input. Inputs identified only by placeholder text are invisible to assistive technology.',
    fix: `<!-- Before -->
<input type="email" placeholder="Enter email">

<!-- After -->
<label for="email">Email address</label>
<input type="email" id="email" placeholder="you@example.com">`,
  },
  {
    rank: 4,
    name: 'Missing document language',
    wcag: '3.1.1',
    impact: 'Serious',
    impactColor: 'text-amber-400 bg-amber-400/10',
    description:
      'The HTML lang attribute tells screen readers which language rules to use. Without it, text-to-speech software may mispronounce every word.',
    fix: `<!-- Before -->
<html>

<!-- After -->
<html lang="en">`,
  },
  {
    rank: 5,
    name: 'No keyboard focus indicator',
    wcag: '2.4.7',
    impact: 'Serious',
    impactColor: 'text-amber-400 bg-amber-400/10',
    description:
      'Keyboard-only users (including people with motor disabilities) rely on a visible focus ring to know which element is active. Many sites remove it with outline: none.',
    fix: `/* Before — removes focus ring */
button:focus { outline: none; }

/* After — visible focus style */
button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}`,
  },
  {
    rank: 6,
    name: 'Empty or non-descriptive link text',
    wcag: '2.4.4',
    impact: 'Serious',
    impactColor: 'text-amber-400 bg-amber-400/10',
    description:
      'Screen reader users often navigate by scanning a list of all links on the page. "Click here" or "Read more" provides no context about the destination.',
    fix: `<!-- Before -->
<a href="/report.pdf">Click here</a>

<!-- After -->
<a href="/report.pdf">Download our 2026 Accessibility Report (PDF)</a>`,
  },
];

export default function AdaComplianceGuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 pt-28 pb-16">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-slate-500">
              <li>
                <Link href="/" className="hover:text-slate-300 transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-slate-300">ADA Compliance Guide</li>
            </ol>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm font-medium mb-6">
            <Shield className="h-4 w-4" />
            Updated March 2026
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
            ADA Website Compliance Guide 2026
          </h1>
          <p className="text-xl text-slate-400 leading-relaxed mb-8 max-w-3xl">
            Everything you need to know about ADA website compliance — what the law requires, which
            violations trigger lawsuits, the WCAG 2.1 AA checklist, and exact code fixes for the
            most common issues.
          </p>

          {/* Quick CTA */}
          <div className="p-5 bg-brand-600/10 border border-brand-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-white font-semibold mb-1">Check your site right now — free</p>
              <p className="text-slate-400 text-sm">
                Get a lawsuit risk score and see every WCAG violation in under 60&nbsp;seconds.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors text-sm whitespace-nowrap"
            >
              Scan My Site Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── Table of Contents ─────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 pb-12">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              In this guide
            </p>
            <ol className="space-y-2">
              {[
                ['#what-is-ada', 'What is ADA website compliance?'],
                ['#lawsuit-stats', 'ADA lawsuit statistics 2026'],
                ['#wcag-principles', 'The 4 WCAG 2.1 principles (POUR)'],
                ['#top-violations', 'Top 6 violations that trigger lawsuits'],
                ['#checklist', 'Quick WCAG 2.1 AA checklist'],
                ['#how-to-fix', 'How to remediate violations'],
                ['#monitor', 'Ongoing monitoring'],
              ].map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="text-brand-400 hover:text-brand-300 text-sm transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 pb-24 space-y-20">
          {/* ── What is ADA compliance ────────────────────────── */}
          <section id="what-is-ada">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
              What is ADA website compliance?
            </h2>
            <div className="prose-custom space-y-4 text-slate-400 leading-relaxed">
              <p>
                The <strong className="text-white">Americans with Disabilities Act (ADA)</strong>,
                enacted in 1990, prohibits discrimination against people with disabilities in all
                areas of public life. Title III specifically covers &ldquo;places of public
                accommodation&rdquo; — and since 2010, federal courts have consistently ruled that
                commercial websites qualify.
              </p>
              <p>
                This means any business that operates a public-facing website must ensure it is
                accessible to people who are blind, deaf, have motor disabilities, or have cognitive
                impairments. The technical standard courts use to assess compliance is{' '}
                <strong className="text-white">WCAG 2.1 Level AA</strong> — the Web Content
                Accessibility Guidelines published by the W3C.
              </p>
              <p>
                Unlike building codes, there is no single federal rule specifying exactly which
                technical standard websites must meet. However, the Department of Justice{' '}
                <strong className="text-white">issued a final rule in April 2024</strong> formally
                adopting WCAG 2.1 AA as the compliance standard for state and local government
                websites, and private-sector courts have endorsed the same benchmark in the vast
                majority of ADA web-accessibility cases.
              </p>
            </div>
          </section>

          {/* ── Lawsuit Stats ─────────────────────────────────── */}
          <section id="lawsuit-stats">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
              ADA lawsuit statistics 2026
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { stat: '4,000+', label: 'ADA web lawsuits filed in 2024', color: 'text-red-400' },
                { stat: '$25K–$75K', label: 'Typical settlement cost', color: 'text-amber-400' },
                { stat: '82%', label: 'Of suits filed in NY, CA, and FL', color: 'text-brand-400' },
              ].map(({ stat, label, color }) => (
                <div
                  key={stat}
                  className="bg-white/5 border border-white/10 rounded-xl p-5 text-center"
                >
                  <div className={`text-3xl font-bold mb-2 ${color}`}>{stat}</div>
                  <div className="text-sm text-slate-400">{label}</div>
                </div>
              ))}
            </div>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                ADA web accessibility lawsuits have grown every year since 2017. Serial plaintiffs
                and plaintiff law firms use automated scanners to identify non-compliant sites at
                scale, then send demand letters — often requesting $5,000–$20,000 to settle before a
                formal complaint is filed.
              </p>
              <p>
                Even if a lawsuit is ultimately dismissed, legal fees for defending an ADA case
                average <strong className="text-white">$8,000–$15,000</strong>. Proactive compliance
                is almost always cheaper than reactive defence.
              </p>
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200">
                  <strong>Key risk factor:</strong> Having received a demand letter once does{' '}
                  <em>not</em> protect you from future suits. Plaintiffs can sue again if violations
                  reappear after a redesign or CMS update.
                </p>
              </div>
            </div>
          </section>

          {/* ── WCAG POUR Principles ──────────────────────────── */}
          <section id="wcag-principles">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              The 4 WCAG 2.1 principles (POUR)
            </h2>
            <p className="text-slate-400 mb-8">
              WCAG 2.1 organises its 50+ success criteria under four core principles, often
              abbreviated as <strong className="text-white">POUR</strong>.
            </p>
            <div className="space-y-4">
              {WCAG_PRINCIPLES.map((p) => (
                <div
                  key={p.name}
                  className={`border rounded-2xl p-6 ${p.bg}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-2xl font-bold ${p.color}`}>{p.letter}</span>
                    <h3 className="text-lg font-semibold text-white">{p.name}</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">{p.description}</p>
                  <ul className="space-y-1.5">
                    {p.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                        <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ── Top Violations ────────────────────────────────── */}
          <section id="top-violations">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Top 6 violations that trigger ADA lawsuits
            </h2>
            <p className="text-slate-400 mb-8">
              These issues appear in the majority of ADA web complaints. Fixing them eliminates most
              of your legal exposure.
            </p>
            <div className="space-y-6">
              {TOP_VIOLATIONS.map((v) => (
                <div
                  key={v.rank}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <span className="text-3xl font-bold text-white/20 leading-none">
                      {String(v.rank).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-white">{v.name}</h3>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${v.impactColor}`}
                        >
                          {v.impact}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">WCAG {v.wcag}</span>
                      </div>
                      <p className="text-sm text-slate-400">{v.description}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Exact fix
                    </p>
                    <pre className="bg-slate-900 border border-white/10 rounded-lg p-4 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
                      {v.fix}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Quick Checklist ───────────────────────────────── */}
          <section id="checklist">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Quick WCAG 2.1 AA checklist
            </h2>
            <p className="text-slate-400 mb-8">
              Use this checklist for a manual review. Then run ADA Shield for automated detection of
              all 50+ criteria.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'All images have descriptive alt text',
                'All videos have captions and transcripts',
                'Text contrast ≥ 4.5:1 (large text ≥ 3:1)',
                'No information conveyed by colour alone',
                'All functionality usable via keyboard',
                'No keyboard traps on the page',
                'Visible focus indicator on all interactive elements',
                'No auto-playing audio/video without controls',
                'HTML lang attribute set correctly',
                'All form inputs have associated <label> elements',
                'Error messages identify the field and suggest a fix',
                'Page title is unique and descriptive',
                'Headings used in logical order (h1 → h2 → h3)',
                'Links have descriptive, unique text',
                'Tables have <th> headers with scope attributes',
                'ARIA landmark roles used appropriately',
                'Dynamic content updates announced to screen readers',
                'No sessions that expire without warning',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2.5 p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300"
                >
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          {/* ── How to Fix ────────────────────────────────────── */}
          <section id="how-to-fix">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
              How to remediate violations
            </h2>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                Most automated tools identify violations but leave you to figure out the fix. ADA
                Shield shows the broken HTML snippet alongside the corrected version so your developer
                can apply changes without interpretation.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
                {[
                  {
                    step: '1',
                    title: 'Scan your URL',
                    body: 'Paste your website URL. ADA Shield launches a real browser and runs axe-core against all WCAG 2.1 AA rules.',
                  },
                  {
                    step: '2',
                    title: 'Review violations by risk',
                    body: 'Violations are ranked by lawsuit risk — tackle critical issues (missing alt text, unlabelled inputs) first.',
                  },
                  {
                    step: '3',
                    title: 'Apply the exact fix',
                    body: 'Each violation includes the broken HTML and the corrected snippet. Copy, paste, and push to production.',
                  },
                ].map(({ step, title, body }) => (
                  <div
                    key={step}
                    className="relative bg-white/5 border border-white/10 rounded-xl p-5"
                  >
                    <div className="absolute -top-3.5 left-5 w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                      {step}
                    </div>
                    <h3 className="text-sm font-semibold text-white mt-2 mb-2">{title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
              <p>
                For larger sites, prioritise pages that are most exposed to user traffic (homepage,
                product pages, checkout, contact) — these are the pages plaintiff attorneys scan
                first.
              </p>
            </div>
          </section>

          {/* ── Monitoring ────────────────────────────────────── */}
          <section id="monitor">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
              Ongoing monitoring — why one scan isn&apos;t enough
            </h2>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                Every CMS update, theme change, plugin install, or new page publish can introduce new
                accessibility violations. A site that was compliant in January can have critical
                violations by March after a routine redesign.
              </p>
              <p>
                ADA Shield&apos;s weekly monitoring scans your registered sites automatically,
                recalculates your risk score, and sends an email alert the moment your score
                worsens — giving you time to fix issues before a plaintiff attorney finds them.
              </p>
              <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                <p className="text-sm font-semibold text-white mb-3">
                  What weekly monitoring catches that a one-time audit misses:
                </p>
                <ul className="space-y-2">
                  {[
                    'New images uploaded without alt text',
                    'Third-party widgets (chat, popups) that inject inaccessible HTML',
                    'A/B test variants that fail contrast or keyboard requirements',
                    'New product pages auto-generated from a CMS template',
                    'Font or colour changes in a theme update that break contrast ratios',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle className="h-4 w-4 text-brand-400 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ── Final CTA ─────────────────────────────────────── */}
          <section className="text-center py-8">
            <div className="bg-brand-600/10 border border-brand-500/30 rounded-2xl p-10">
              <Shield className="h-12 w-12 text-brand-400 mx-auto mb-4" />
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Ready to check your site?
              </h2>
              <p className="text-slate-400 mb-6 max-w-lg mx-auto">
                Run a free scan in 60 seconds and get your lawsuit risk score with actionable,
                copy-paste fixes for every violation found.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Scan My Site Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
                >
                  View Pricing Plans
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
