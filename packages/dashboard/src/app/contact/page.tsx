'use client';

import { useState } from 'react';
import { Mail, MessageSquare, User, Send, CheckCircle2, AlertCircle, Clock, Shield } from 'lucide-react';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';

const TOPICS = [
  'General Question',
  'Technical Support',
  'Billing & Subscriptions',
  'Accessibility Compliance Help',
  'Partnership / Enterprise',
  'Report a Bug',
  'Other',
] as const;

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', topic: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');
      setStatus('success');
      setForm({ name: '', email: '', topic: '', message: '' });
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    }
  };

  const isValid = form.name.trim() && form.email.trim() && form.topic && form.message.trim();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 pt-28 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm font-medium mb-6">
            <MessageSquare className="h-4 w-4" />
            We&apos;re here to help
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Contact Us</h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            Have a question about ADA compliance, your account, or our service? We typically respond within one business day.
          </p>
        </section>

        {/* Main Grid */}
        <section className="max-w-5xl mx-auto px-4 pb-24 grid md:grid-cols-3 gap-8">
          {/* Info sidebar */}
          <div className="space-y-5">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Get in Touch</h2>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-brand-500/10 flex-shrink-0">
                  <Mail className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Email</p>
                  <a
                    href="mailto:audit@adashield.net"
                    className="text-sm text-slate-300 hover:text-white transition-colors"
                  >
                    audit@adashield.net
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-brand-500/10 flex-shrink-0">
                  <Clock className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Response Time</p>
                  <p className="text-sm text-slate-300">Within 1 business day</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-brand-500/10 flex-shrink-0">
                  <Shield className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">ADA Compliance Help</p>
                  <p className="text-sm text-slate-300">Our team specializes in WCAG 2.1 AA standards and ADA law.</p>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Quick Resources</h2>
              <ul className="space-y-2">
                {[
                  { label: 'Free Website Scan', href: '/' },
                  { label: 'ADA Compliance Guide', href: '/ada-compliance-guide' },
                  { label: 'Pricing Plans', href: '/#pricing' },
                  { label: 'Privacy Policy', href: '/privacy' },
                  { label: 'Terms of Service', href: '/terms' },
                ].map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-brand-300 transition-colors"
                    >
                      → {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-2">
            {status === 'success' ? (
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-10 flex flex-col items-center justify-center text-center min-h-[420px]">
                <div className="p-4 rounded-full bg-green-500/10 mb-5">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Message Sent!</h2>
                <p className="text-slate-400 max-w-sm">
                  Thanks for reaching out. We&apos;ll get back to you at <span className="text-slate-200">{form.email || 'your email'}</span> within one business day.
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="mt-6 px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5"
              >
                <h2 className="text-base font-semibold text-white">Send Us a Message</h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                      Your Name <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Jane Smith"
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="jane@example.com"
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Topic */}
                <div>
                  <label htmlFor="topic" className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                    Topic <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="topic"
                    name="topic"
                    required
                    value={form.topic}
                    onChange={handleChange}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                  >
                    <option value="" disabled>Select a topic…</option>
                    {TOPICS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                    Message <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={6}
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Describe your question or issue in detail…"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors resize-y"
                  />
                </div>

                {status === 'error' && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-lg text-sm text-red-300">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending' || !isValid}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'sending' ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </button>

                <p className="text-xs text-slate-600 text-center">
                  We respect your privacy. Your information is never sold or shared.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
