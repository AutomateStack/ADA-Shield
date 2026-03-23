import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://adashield.com';

export const metadata: Metadata = {
  title: {
    default: 'ADA Shield — Website Accessibility Scanner & Lawsuit Risk Calculator',
    template: '%s | ADA Shield',
  },
  description:
    'Scan your website for ADA/WCAG accessibility violations. Get a lawsuit risk score, see exact code fixes, and monitor your site weekly.',
  keywords: [
    'ADA compliance',
    'WCAG',
    'accessibility scanner',
    'lawsuit risk',
    'website accessibility',
    'ADA lawsuit',
    'WCAG 2.1',
    'accessibility audit',
  ],
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'ADA Shield — Website Accessibility Scanner & Lawsuit Risk Calculator',
    description:
      'Scan your website for ADA/WCAG violations. Get a lawsuit risk score, exact code fixes, and weekly monitoring.',
    url: siteUrl,
    siteName: 'ADA Shield',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ADA Shield — Accessibility Scanner & Lawsuit Risk Calculator',
    description:
      'Scan your website for ADA/WCAG violations. Get a lawsuit risk score and exact code fixes.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'ADA Shield',
              applicationCategory: 'WebApplication',
              description:
                'Website accessibility scanner and ADA lawsuit risk calculator with exact code fixes and weekly monitoring.',
              operatingSystem: 'Web',
              offers: {
                '@type': 'AggregateOffer',
                lowPrice: '29',
                highPrice: '199',
                priceCurrency: 'USD',
              },
            }),
          }}
        />
      </body>
    </html>
  );
}
