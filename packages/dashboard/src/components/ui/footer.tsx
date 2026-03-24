import Link from 'next/link';
import { ShieldLogo } from '@/components/ui/shield-logo';

export function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <ShieldLogo className="h-7 w-7" />
              <span className="text-lg font-bold text-white">ADA Shield</span>
            </div>
            <p className="text-sm text-slate-400">
              Protect your business from ADA lawsuits with automated accessibility scanning and monitoring.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/#how-it-works" className="text-slate-400 hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="/#pricing" className="text-slate-400 hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <Link href="/login" className="text-slate-400 hover:text-white transition-colors">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://www.w3.org/WAI/WCAG21/quickref/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  WCAG 2.1 Guidelines
                </a>
              </li>
              <li>
                <a
                  href="https://www.ada.gov/resources/web-guidance/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ADA Compliance Guide
                </a>
              </li>
              <li>
                <Link href="/resources" className="text-slate-400 hover:text-white transition-colors">
                  Resources &amp; Guides
                </Link>
              </li>
            </ul>
          </div>

          {/* Data Consultant */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Data Consultant</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://dataflowpro.bolt.host/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-400 hover:text-brand-300 transition-colors"
                >
                  DataFlow Pro
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/10 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} ADA Shield. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
