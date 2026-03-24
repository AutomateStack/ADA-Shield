import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'ADA Shield Privacy Policy — how we collect, use, and protect your data.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-brand-400" />
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        </div>

        <p className="text-sm text-slate-500 mb-8">Last updated: March 2026</p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          <Section title="1. Information We Collect">
            <p>We collect information you provide directly to us, including:</p>
            <ul>
              <li>Account information (email address, password)</li>
              <li>Website URLs you submit for scanning</li>
              <li>Payment information (processed securely by Stripe — we never store card details)</li>
              <li>Usage data such as scan history and accessibility reports</li>
            </ul>
            <p>We also automatically collect certain information when you use our service, including IP address, browser type, and pages visited.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our accessibility scanning services</li>
              <li>Process transactions and send related information</li>
              <li>Send you scan results, alerts, and monitoring reports</li>
              <li>Respond to your requests and provide customer support</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </Section>

          <Section title="3. Information Sharing">
            <p>We do not sell, trade, or rent your personal information to third parties. We may share information with:</p>
            <ul>
              <li><strong>Service providers</strong> — such as Stripe for payment processing and Supabase for data storage</li>
              <li><strong>Legal compliance</strong> — when required by law or to protect our rights</li>
            </ul>
          </Section>

          <Section title="4. Data Security">
            <p>
              We implement industry-standard security measures to protect your data. All data is transmitted over HTTPS.
              Authentication tokens are handled securely, and we follow the principle of least privilege for data access.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your account data for as long as your account is active. Scan results are retained in accordance with
              your subscription plan. You can request deletion of your data at any time by contacting us.
            </p>
          </Section>

          <Section title="6. Your Rights">
            <p>You have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </Section>

          <Section title="7. Cookies">
            <p>
              We use essential cookies for authentication and session management. We do not use third-party tracking cookies.
            </p>
          </Section>

          <Section title="8. Contact Us">
            <p>
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:tthirmal@gmail.com" className="text-brand-400 hover:text-brand-300">
                tthirmal@gmail.com
              </a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
      <div className="text-slate-400 text-sm leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-slate-400">
        {children}
      </div>
    </section>
  );
}
