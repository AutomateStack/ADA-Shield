'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Activity,
  Users,
  CreditCard,
  ArrowLeft,
  FileText,
  Globe,
  Mail,
} from 'lucide-react';
import { ShieldLogo } from '@/components/ui/shield-logo';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/scans', label: 'Scans', icon: Activity },
  { href: '/admin/sites', label: 'Sites', icon: Globe },
  { href: '/admin/outreach', label: 'Outreach', icon: Mail },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/blog', label: 'Blog', icon: FileText },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-white/10 bg-slate-950">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-2.5">
            <ShieldLogo className="h-7 w-7" />
            <span className="text-lg font-bold text-white">Admin Portal</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {adminNavItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-red-600/20 text-red-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Back to site */}
        <div className="px-4 py-4 border-t border-white/10">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors w-full"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Site
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden border-b border-white/10 bg-slate-900/80 backdrop-blur px-4 py-3 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <ShieldLogo className="h-7 w-7" />
            <span className="text-lg font-bold text-white">Admin</span>
          </Link>
        </header>

        {/* Mobile Nav */}
        <nav className="md:hidden flex overflow-x-auto border-b border-white/10 bg-slate-950 px-2">
          {adminNavItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  isActive
                    ? 'border-red-400 text-red-300'
                    : 'border-transparent text-slate-400 hover:text-white'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
