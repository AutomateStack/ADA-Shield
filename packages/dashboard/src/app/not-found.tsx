import Link from 'next/link';
import { Shield, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20">
            <Shield className="h-12 w-12 text-brand-400" />
          </div>
        </div>

        <h1 className="text-7xl font-bold text-white mb-2">404</h1>
        <h2 className="text-xl font-semibold text-slate-300 mb-4">
          Page not found
        </h2>
        <p className="text-slate-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-medium rounded-xl transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
