import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ADA Shield — Website Accessibility Scanner & Lawsuit Risk Calculator',
  description:
    'Scan your website for ADA/WCAG accessibility violations. Get a lawsuit risk score, see exact code fixes, and monitor your site weekly.',
  keywords: ['ADA compliance', 'WCAG', 'accessibility scanner', 'lawsuit risk', 'website accessibility'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
