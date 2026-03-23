'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: '/', label: 'Home' },
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/#pricing', label: 'Pricing' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-white/10">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Shield className="h-7 w-7 text-brand-400 group-hover:text-brand-300 transition-colors" />
          <span className="text-xl font-bold text-white">ADA Shield</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/"
            className="text-sm font-semibold px-4 py-2 bg-brand-500/10 border border-brand-500/30 text-brand-300 hover:bg-brand-500/20 rounded-lg transition-colors"
          >
            Free Scan
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
          >
            Start Free
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-slate-400 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-slate-900 border-b border-white/10 px-4 pb-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-2 text-slate-300 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="flex gap-3 mt-4">
            <Link
              href="/"
              className="flex-1 text-center py-2 text-sm text-brand-300 border border-brand-500/30 rounded-lg hover:bg-brand-500/10"
              onClick={() => setMobileOpen(false)}
            >
              Free Scan
            </Link>
            <Link
              href="/login"
              className="flex-1 text-center py-2 text-sm text-slate-300 border border-white/20 rounded-lg hover:bg-white/5"
              onClick={() => setMobileOpen(false)}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="flex-1 text-center py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              onClick={() => setMobileOpen(false)}
            >
              Start Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
