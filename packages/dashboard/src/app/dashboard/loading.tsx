import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex-1 p-8">
      <div className="animate-pulse space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 bg-slate-200 rounded-lg w-48" />
          <div className="h-10 bg-slate-200 rounded-lg w-32" />
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
              <div className="h-8 bg-slate-200 rounded w-16" />
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 bg-slate-200 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
              <div className="h-6 bg-slate-200 rounded-full w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
