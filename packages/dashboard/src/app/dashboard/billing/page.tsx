'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, Shield, Zap, Building2, ArrowRight, ExternalLink } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

const plans = [
  {
    name: 'Starter',
    key: 'starter',
    price: '$29',
    period: '/month',
    description: 'For small businesses with one website.',
    icon: Zap,
    features: [
      '1 website',
      '10 pages per scan',
      'Weekly monitoring',
      'Email alerts',
      'WCAG 2.1 AA scanning',
      'Code fix suggestions',
    ],
    highlight: false,
  },
  {
    name: 'Business',
    key: 'business',
    price: '$99',
    period: '/month',
    description: 'For companies managing multiple sites.',
    icon: Shield,
    features: [
      'Up to 5 websites',
      '50 pages per scan',
      'Weekly monitoring',
      'Priority email support',
      'WCAG 2.1 AA + AAA scanning',
      'Code fix suggestions',
      'PDF compliance reports',
    ],
    highlight: true,
  },
  {
    name: 'Agency',
    key: 'agency',
    price: '$199',
    period: '/month',
    description: 'For agencies and enterprises at scale.',
    icon: Building2,
    features: [
      'Unlimited websites',
      'Unlimited pages per scan',
      'Daily monitoring',
      'Dedicated account manager',
      'White-label reports',
      'API access',
      'Custom integrations',
      'SLA guarantee',
    ],
    highlight: false,
  },
];

export default function BillingPage() {
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setUserEmail(session.user.email);
    });
  }, []);

  const gumroadUrl = `https://thirmal.gumroad.com/l/onvhab${userEmail ? `?email=${encodeURIComponent(userEmail)}` : ''}`;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Upgrade Your Plan</h1>
        <p className="text-slate-400 mt-1">
          Choose the plan that fits your needs. Cancel anytime.
        </p>
      </div>

      {/* Gumroad payment notice */}
      <div className="mb-8 p-4 bg-brand-500/10 border border-brand-500/30 rounded-xl flex items-start gap-3">
        <ExternalLink className="h-5 w-5 text-brand-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-300">
          Payments are processed securely via{' '}
          <span className="text-brand-300 font-semibold">Gumroad</span>.
          Select your plan below and you&apos;ll be redirected to complete checkout.
          Your account will be activated automatically after payment.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.key}
            className={`relative rounded-2xl border p-6 flex flex-col ${
              plan.highlight
                ? 'border-brand-500/50 bg-brand-600/5 shadow-lg shadow-brand-500/10'
                : 'border-white/10 bg-white/5'
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-brand-500 text-white text-xs font-bold rounded-full">
                Most Popular
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div
                className={`p-2 rounded-lg ${
                  plan.highlight ? 'bg-brand-500/20' : 'bg-white/10'
                }`}
              >
                <plan.icon
                  className={`h-5 w-5 ${
                    plan.highlight ? 'text-brand-400' : 'text-slate-300'
                  }`}
                />
              </div>
              <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
            </div>

            <div className="mb-4">
              <span className="text-3xl font-bold text-white">{plan.price}</span>
              <span className="text-slate-400 text-sm">{plan.period}</span>
            </div>

            <p className="text-sm text-slate-400 mb-6">{plan.description}</p>

            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  <span className="text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href={gumroadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                plan.highlight
                  ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/25'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-slate-600 mt-8">
        All plans include a 14-day money-back guarantee. Prices in USD.
      </p>
    </div>
  );
}
