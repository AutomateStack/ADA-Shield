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
  Star,
  ChevronRight,
  ChevronDown,
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
            <>
              <p className="text-center text-sm text-slate-500 mt-8">
                Trusted by businesses to stay ADA compliant
              </p>
              <div className="flex justify-center gap-8 md:gap-16 mt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">WCAG 2.1</div>
                  <div className="text-sm text-slate-500 mt-1">AA Standard</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">57%</div>
                  <div className="text-sm text-slate-500 mt-1">Violations Auto-detected</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">&lt; 60s</div>
                  <div className="text-sm text-slate-500 mt-1">Scan Time</div>
                </div>
              </div>
            </>
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

            {/* ── Testimonials ───────────────────────────────── */}
            <section className="bg-slate-800/50 py-20">
              <div className="max-w-6xl mx-auto px-4">
                <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    Trusted by businesses like yours
                  </h2>
                  <p className="text-slate-400 max-w-xl mx-auto">
                    See why hundreds of businesses rely on ADA Shield to stay protected.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <TestimonialCard
                    quote="Found 47 critical violations we didn't even know existed. Fixed them in a weekend. Haven't had a demand letter since."
                    name="Sarah K."
                    role="Owner, Coastal Boutique"
                    initials="SK"
                    color="bg-brand-600"
                  />
                  <TestimonialCard
                    quote="We use ADA Shield for every client handoff. The weekly monitoring and shareable reports save us hours of manual auditing."
                    name="Marcus R."
                    role="Head of Dev, Pixel Agency"
                    initials="MR"
                    color="bg-purple-600"
                  />
                  <TestimonialCard
                    quote="Our e-commerce site had image alt-text issues across 200 products. The exact code fixes made bulk-fixing trivial."
                    name="Jessica T."
                    role="CTO, ShopElite.com"
                    initials="JT"
                    color="bg-green-600"
                  />
                </div>
              </div>
            </section>

            {/* ── Risk Calculator ─────────────────────────────── */}
            <section className="py-20">
              <div className="max-w-3xl mx-auto px-4">
                <div className="text-center mb-10">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    What&apos;s your lawsuit risk?
                  </h2>
                  <p className="text-slate-400">
                    Answer 3 quick questions to estimate your ADA exposure before running a full scan.
                  </p>
                </div>
                <RiskCalculator />
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
                      '10 pages per scan',
                      'Weekly monitoring',
                      'Email alerts',
                      'Exact code fixes',
                    ]}
                    cta="Start Free Trial"
                    href="/signup"
                  />
                  <PricingCard
                    name="Business"
                    price="$99"
                    period="/month"
                    description="For growing businesses with multiple sites."
                    features={[
                      '5 websites',
                      '50 pages per scan',
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

            {/* ── FAQ Section ────────────────────────────────── */}
            <section id="faq" className="py-20">
              <div className="max-w-3xl mx-auto px-4">
                <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    Frequently Asked Questions
                  </h2>
                  <p className="text-slate-400">
                    Everything you need to know about ADA compliance and how ADA Shield works.
                  </p>
                </div>
                <FaqAccordion />
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

function TestimonialCard({
  quote,
  name,
  role,
  initials,
  color,
}: {
  quote: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 hover:bg-white/[0.07] transition-colors">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <p className="text-slate-300 text-sm leading-relaxed flex-1">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div
          className={`h-9 w-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
        >
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-slate-500">{role}</p>
        </div>
      </div>
    </div>
  );
}

const CALCULATOR_QUESTIONS = [
  {
    id: 'type',
    question: 'What type of business do you run?',
    options: [
      { label: 'Healthcare / Medical', risk: 35 },
      { label: 'E-commerce / Retail', risk: 28 },
      { label: 'Restaurant / Hospitality', risk: 22 },
      { label: 'Professional Services', risk: 18 },
      { label: 'Personal / Blog', risk: 10 },
    ],
  },
  {
    id: 'age',
    question: 'How old is your current website?',
    options: [
      { label: 'Built before 2018', risk: 30 },
      { label: '2018 – 2021', risk: 20 },
      { label: '2022 – 2023', risk: 12 },
      { label: 'Built in 2024 or later', risk: 5 },
    ],
  },
  {
    id: 'features',
    question: 'Which interactive features does your site have?',
    options: [
      { label: 'Contact forms + images + video', risk: 25 },
      { label: 'Contact forms + images', risk: 15 },
      { label: 'Mostly text and images', risk: 8 },
      { label: "Simple page — not sure", risk: 12 },
    ],
  },
];

function RiskCalculator() {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const total = scores.reduce((a, b) => a + b, 0);
  const riskLabel = total >= 70 ? 'High' : total >= 40 ? 'Medium' : 'Low';
  const riskColor =
    total >= 70 ? 'text-red-400' : total >= 40 ? 'text-amber-400' : 'text-green-400';

  const handleOption = (risk: number) => {
    const next = [...scores, risk];
    setScores(next);
    if (step + 1 < CALCULATOR_QUESTIONS.length) {
      setStep(step + 1);
    } else {
      setDone(true);
    }
  };

  const reset = () => {
    setStep(0);
    setScores([]);
    setDone(false);
  };

  const q = CALCULATOR_QUESTIONS[step];

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
      {!done ? (
        <>
          <div className="flex items-center gap-2 mb-6">
            {CALCULATOR_QUESTIONS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-brand-500' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Question {step + 1} of {CALCULATOR_QUESTIONS.length}
          </p>
          <h3 className="text-lg font-semibold text-white mb-5">{q.question}</h3>
          <div className="space-y-2">
            {q.options.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleOption(opt.risk)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-brand-600/20 border border-white/10 hover:border-brand-500/40 text-left text-sm text-slate-300 hover:text-white transition-colors group"
              >
                {opt.label}
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-brand-400 transition-colors" />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-2">Estimated lawsuit risk score</p>
          <div className={`text-6xl font-bold mb-2 ${riskColor}`}>{Math.min(total, 99)}</div>
          <div
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-6 ${
              riskLabel === 'High'
                ? 'bg-red-500/20 text-red-300'
                : riskLabel === 'Medium'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-green-500/20 text-green-300'
            }`}
          >
            {riskLabel} Risk
          </div>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            {riskLabel === 'High'
              ? 'Your site profile matches the top targets for ADA demand letters. Get an exact scan now.'
              : riskLabel === 'Medium'
              ? 'You have meaningful exposure. A free scan will show exactly which violations to fix.'
              : "You're in decent shape, but any violation could trigger a complaint. Verify with a free scan."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors"
            >
              Get Your Exact Score Free
              <ArrowRight className="h-4 w-4" />
            </a>
            <button
              onClick={reset}
              className="px-6 py-3 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Retake quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const FAQ_ITEMS = [
  {
    question: 'What is ADA website compliance?',
    answer:
      'The Americans with Disabilities Act (ADA) requires that businesses provide equal access to people with disabilities. Courts have increasingly ruled that websites are "places of public accommodation" under Title III of the ADA, which means your website must be accessible to users who rely on screen readers, keyboard navigation, and other assistive technologies.',
  },
  {
    question: 'What is WCAG 2.1 AA and why does it matter?',
    answer:
      'WCAG 2.1 AA (Web Content Accessibility Guidelines) is the internationally recognised technical standard for web accessibility. Meeting WCAG 2.1 AA is the most widely accepted way to demonstrate ADA compliance for websites. ADA Shield scans against all 50+ WCAG 2.1 AA criteria and shows you exactly which ones you are failing.',
  },
  {
    question: 'How does the lawsuit risk score work?',
    answer:
      'Our 0–100 risk score is weighted by the violations that plaintiff attorneys target most often in ADA demand letters and lawsuits — such as missing image alt text, unlabelled form fields, and insufficient colour contrast. A score above 70 indicates serious exposure. The score is recalculated every time you scan so you can track your progress over time.',
  },
  {
    question: 'Will fixing these issues break my website?',
    answer:
      'No. The fixes ADA Shield recommends are additive HTML/CSS changes — adding alt attributes, ARIA labels, and focus styles — that are invisible to sighted users and do not affect your site\'s design or functionality. We show you the exact HTML before and after so your developer can apply changes with confidence.',
  },
  {
    question: 'How often should I scan my website?',
    answer:
      'You should scan every time you publish new content, add new pages, or update templates. Our paid plans include automatic weekly monitoring so that new violations are caught before a plaintiff attorney finds them first. You\'ll receive an email alert the moment your risk score changes.',
  },
  {
    question: 'Is a free scan enough to protect my business?',
    answer:
      'The free scan gives you a snapshot of violations on a single page and shows up to 3 issues in detail. For full protection you need to scan all pages, monitor continuously, and track your risk score over time — that\'s what our Starter, Business, and Agency plans are designed for.',
  },
  {
    question: 'What types of businesses get sued most often?',
    answer:
      'Healthcare providers, e-commerce retailers, restaurants, hotels, and financial services firms are the most common targets because they interact with the public and handle transactions online. However, any business with a public-facing website can receive a demand letter — we\'ve seen lawsuits filed against companies of every size.',
  },
  {
    question: 'How is ADA Shield different from a one-time audit?',
    answer:
      'A one-time audit tells you what\'s wrong today. ADA Shield monitors continuously, so when your developer pushes a new feature that breaks accessibility, you know within a week — not after you receive a demand letter. We also provide the exact code fix for every violation, so remediation is fast and unambiguous.',
  },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      {/* FAQ JSON-LD schema for Google rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ_ITEMS.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
              },
            })),
          }),
        }}
      />
      <div className="space-y-3">
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors"
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
              aria-expanded={open === i}
            >
              <span className="text-sm font-semibold text-white">{item.question}</span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                  open === i ? 'rotate-180' : ''
                }`}
              />
            </button>
            {open === i && (
              <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-4">
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

