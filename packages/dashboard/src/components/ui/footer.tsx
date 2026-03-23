import Link from 'next/link';
import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-6 w-6 text-brand-400" />
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
                <span className="text-slate-500">WCAG 2.1 Guidelines</span>
              </li>
              <li>
                <span className="text-slate-500">ADA Compliance Guide</span>
              </li>
              <li>
                <span className="text-slate-500">Blog (Coming Soon)</span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-slate-500">Privacy Policy</span>
              </li>
              <li>
                <span className="text-slate-500">Terms of Service</span>
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
