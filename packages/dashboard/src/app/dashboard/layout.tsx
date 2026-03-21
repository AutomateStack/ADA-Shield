'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, LayoutDashboard, Globe, Settings, LogOut, CreditCard } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/sites', label: 'Sites', icon: Globe },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-white/10 bg-slate-950">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-brand-400" />
            <span className="text-lg font-bold text-white">ADA Shield</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-600/20 text-brand-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors w-full"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden border-b border-white/10 bg-slate-900/80 backdrop-blur px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-brand-400" />
            <span className="text-lg font-bold text-white">ADA Shield</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="text-slate-400 hover:text-white text-sm"
          >
            Sign Out
          </button>
        </header>

        {/* Mobile Nav */}
        <nav className="md:hidden flex border-b border-white/10 bg-slate-950 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-brand-500 text-brand-300'
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
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
