import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'ADA Shield Terms of Service — the rules and guidelines for using our platform.',
};

export default function TermsOfServicePage() {
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
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
        </div>

        <p className="text-sm text-slate-500 mb-8">Last updated: March 2026</p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using ADA Shield (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, do not use the Service.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              ADA Shield provides automated website accessibility scanning based on WCAG 2.1 AA standards.
              The Service generates accessibility reports, lawsuit risk scores, and suggested code fixes.
              The Service does not constitute legal advice.
            </p>
          </Section>

          <Section title="3. User Accounts">
            <p>You are responsible for:</p>
            <ul>
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use of your account</li>
            </ul>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to:</p>
            <ul>
              <li>Scan websites you do not own or have authorization to scan</li>
              <li>Attempt to circumvent rate limits or usage restrictions</li>
              <li>Use the Service for any unlawful purpose</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Interfere with or disrupt the Service infrastructure</li>
            </ul>
          </Section>

          <Section title="5. Subscription Plans and Billing">
            <p>
              Paid plans are billed monthly via Stripe. You can cancel your subscription at any time.
              Cancellation takes effect at the end of the current billing period. Refunds are not provided
              for partial months of service.
            </p>
            <p>
              We reserve the right to change pricing with 30 days notice. Existing subscribers will be
              notified before any price changes take effect.
            </p>
          </Section>

          <Section title="6. Free Scan Limitations">
            <p>
              Free scans are limited to 3 violations per scan and 10 scans per hour per IP address.
              Full scan results require a registered account and paid subscription.
            </p>
          </Section>

          <Section title="7. Disclaimer of Warranties">
            <p>
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind. ADA Shield does not guarantee
              that using the Service will make your website fully ADA compliant or protect you from legal claims.
              The scan results and risk scores are informational tools and should not be considered legal advice.
            </p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, ADA Shield shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your use of the Service.
            </p>
          </Section>

          <Section title="9. Modifications to Terms">
            <p>
              We may update these Terms from time to time. We will notify registered users of significant
              changes via email. Continued use of the Service after changes constitutes acceptance of the
              updated terms.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              For questions about these Terms, contact us at{' '}
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
