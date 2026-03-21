import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS classes with clsx for conditional class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fetcher for SWR — wraps fetch with JSON parsing and error handling.
 */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

/**
 * Returns the risk color class based on risk level.
 */
export function getRiskColorClass(color: string): string {
  switch (color) {
    case 'green':
      return 'text-risk-low';
    case 'amber':
      return 'text-risk-medium';
    case 'red':
      return 'text-risk-high';
    default:
      return 'text-slate-400';
  }
}

/**
 * Returns the risk badge classes based on risk level.
 */
export function getRiskBadgeClasses(color: string): string {
  switch (color) {
    case 'green':
      return 'bg-green-500/20 text-green-300';
    case 'amber':
      return 'bg-amber-500/20 text-amber-300';
    case 'red':
      return 'bg-red-500/20 text-red-300';
    default:
      return 'bg-slate-500/20 text-slate-300';
  }
}
