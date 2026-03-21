'use client';

import { useState, useRef } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Code,
  BarChart3,
  Mail,
  Eye,
  Zap,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { ScanForm } from '@/components/scan/scan-form';
import { ScanResults } from '@/components/scan/scan-results';

export default function HomePage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleResult = (data: any) => {
    setResult(data);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        {/* ── Hero Section ─────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 pt-28 pb-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              ADA Compliance Scanner
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
              Don&apos;t wait for the{' '}
              <span className="text-brand-400">lawsuit</span>.
              <br />
              Fix your site <span className="text-brand-400">today</span>.
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-2">
              Over 4,000 ADA website lawsuits were filed last year alone.
            </p>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Scan your website for WCAG violations, get a lawsuit risk score, and see the exact code to fix every issue.
            </p>
          </div>

          {/* Free Scan Form */}
          <ScanForm
            onResult={handleResult}
            onError={setError}
            onLoadingChange={setScanning}
          />

          {/* Error Message */}
          {error && (
            <div className="max-w-2xl mx-auto mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Social proof numbers */}
          {!result && !scanning && (
            <div className="flex justify-center gap-8 md:gap-16 mt-16">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">WCAG 2.1</div>
                <div className="text-sm text-slate-500 mt-1">AA Standard</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">50+</div>
                <div className="text-sm text-slate-500 mt-1">Accessibility Rules</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">&lt; 30s</div>
                <div className="text-sm text-slate-500 mt-1">Scan Time</div>
              </div>
            </div>
          )}
        </section>

        {/* ── Scan Results ─────────────────────────────────── */}
        {result && (
          <section ref={resultsRef} className="px-4 pb-20">
            <ScanResults result={result} />
          </section>
        )}

        {/* ── How It Works ─────────────────────────────────── */}
        {!result && (
          <>
            <section id="how-it-works" className="bg-slate-800/50 py-20">
              <div className="max-w-6xl mx-auto px-4">
                <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    How It Works
                  </h2>
                  <p className="text-slate-400 max-w-xl mx-auto">
                    Three simple steps to protect your business from ADA lawsuits.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <StepCard
                    number={1}
                    icon={<Eye className="h-8 w-8" />}
                    title="Enter Your URL"
                    description="Paste your website URL and we'll launch a real browser to scan every element on the page."
                  />
                  <StepCard
                    number={2}
                    icon={<BarChart3 className="h-8 w-8" />}
                    title="Get Your Risk Score"
                    description="Receive a 0-100 lawsuit risk score weighted by the exact violations plaintiff lawyers look for."
                  />
                  <StepCard
                    number={3}
                    icon={<Code className="h-8 w-8" />}
                    title="Fix With Exact Code"
                    description="See the broken HTML and the exact fix for each violation. Copy, paste, and be compliant."
                  />
                </div>
              </div>
            </section>

            {/* ── Features Grid ──────────────────────────────── */}
            <section className="py-20">
              <div className="max-w-6xl mx-auto px-4">
                <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    Everything You Need
                  </h2>
                  <p className="text-slate-400 max-w-xl mx-auto">
                    Built specifically for businesses that want to avoid ADA lawsuits.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FeatureCard
                    icon={<Shield className="h-6 w-6 text-brand-400" />}
                    title="Lawsuit Risk Score"
                    description="0-100 score based on violations ADA plaintiff lawyers target first. Know your real exposure."
                  />
                  <FeatureCard
                    icon={<Code className="h-6 w-6 text-green-400" />}
                    title="Exact Code Fixes"
                    description="See the broken HTML alongside the exact fix. Copy-paste your way to compliance."
                  />
                  <FeatureCard
                    icon={<Mail className="h-6 w-6 text-amber-400" />}
                    title="Weekly Monitoring"
                    description="We scan your site every week and alert you the moment new violations appear."
                  />
                  <FeatureCard
                    icon={<BarChart3 className="h-6 w-6 text-purple-400" />}
                    title="Trend Dashboard"
                    description="Track your risk score over time. See which violations keep reappearing."
                  />
                  <FeatureCard
                    icon={<Zap className="h-6 w-6 text-yellow-400" />}
                    title="WCAG 2.1 AA"
                    description="Scans against 50+ accessibility rules covering WCAG 2.1 Level AA criteria."
                  />
                  <FeatureCard
                    icon={<AlertTriangle className="h-6 w-6 text-red-400" />}
                    title="Priority Ranking"
                    description="Violations ranked by lawsuit risk. Fix the most dangerous issues first."
                  />
                </div>
              </div>
            </section>

            {/* ── Pricing Section ────────────────────────────── */}
            <section id="pricing" className="bg-slate-800/50 py-20">
              <div className="max-w-6xl mx-auto px-4">
                <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    Simple Pricing
                  </h2>
                  <p className="text-slate-400 max-w-xl mx-auto">
                    Start free. Upgrade when you&apos;re ready for full protection.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                  <PricingCard
                    name="Starter"
                    price="$29"
                    period="/month"
                    description="For small businesses with a single website."
                    features={[
                      '1 website',
                      '100 pages per scan',
                      'Weekly monitoring',
                      'Email alerts',
                      'Exact code fixes',
                    ]}
                    cta="Start Free Trial"
                    href="/signup"
                  />
                  <PricingCard
                    name="Business"
                    price="$79"
                    period="/month"
                    description="For growing businesses with multiple sites."
                    features={[
                      '5 websites',
                      '500 pages per scan',
                      'Weekly monitoring',
                      'Priority email alerts',
                      'Exact code fixes',
                      'Compliance reports',
                    ]}
                    cta="Start Free Trial"
                    href="/signup"
                    popular
                  />
                  <PricingCard
                    name="Agency"
                    price="$199"
                    period="/month"
                    description="For agencies managing client websites."
                    features={[
                      '20 websites',
                      'Unlimited pages',
                      'Daily monitoring',
                      'Instant alerts',
                      'White-label reports',
                      'API access',
                      'Priority support',
                    ]}
                    cta="Start Free Trial"
                    href="/signup"
                  />
                </div>
              </div>
            </section>

            {/* ── CTA Banner ─────────────────────────────────── */}
            <section className="py-20">
              <div className="max-w-3xl mx-auto px-4 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to protect your business?
                </h2>
                <p className="text-slate-400 mb-8 text-lg">
                  Start with a free scan — no credit card required.
                </p>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors text-lg"
                >
                  Scan Your Site Free
                  <ArrowRight className="h-5 w-5" />
                </a>
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function StepCard({
  number,
  icon,
  title,
  description,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="relative bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center">
        {number}
      </div>
      <div className="text-brand-400 flex justify-center mb-4 mt-2">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/[0.07] transition-colors">
      <div className="mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  href,
  popular,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  popular?: boolean;
}) {
  return (
    <div
      className={`relative bg-white/5 border rounded-2xl p-8 ${
        popular
          ? 'border-brand-500 ring-1 ring-brand-500/50'
          : 'border-white/10'
      }`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand-600 text-white text-xs font-semibold rounded-full">
          Most Popular
        </div>
      )}
      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <div className="mt-4 mb-2">
        <span className="text-4xl font-bold text-white">{price}</span>
        <span className="text-slate-400">{period}</span>
      </div>
      <p className="text-sm text-slate-400 mb-6">{description}</p>
      <ul className="space-y-3 mb-8">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
            <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      <a
        href={href}
        className={`block text-center py-3 rounded-lg font-semibold transition-colors ${
          popular
            ? 'bg-brand-600 hover:bg-brand-700 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        {cta}
      </a>
    </div>
  );
}
