import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { ExternalLink, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ADA Accessibility Resources | ADA Shield',
  description:
    'Guides, statistics, and reference material for ADA website compliance and WCAG 2.1 accessibility.',
};

interface Article {
  title: string;
  description: string;
  tag: string;
  readTime: string;
  href: string;
  external?: boolean;
}

const ARTICLES: Article[] = [
  {
    title: 'What is WCAG 2.1 and Why Does It Matter?',
    description:
      'Web Content Accessibility Guidelines (WCAG) 2.1 is the international standard for accessible web content. Learn what Level AA compliance means for your business and why it matters legally.',
    tag: 'Standards',
    readTime: '5 min read',
    href: 'https://www.w3.org/WAI/WCAG21/Understanding/',
    external: true,
  },
  {
    title: 'ADA Website Lawsuit Statistics 2024',
    description:
      "Over 4,000 ADA Title III lawsuits were filed in federal court in 2023—a record high. E-commerce, healthcare, and hospitality are the top-targeted industries. Here's what the data says.",
    tag: 'Legal',
    readTime: '4 min read',
    href: 'https://www.adatitleiii.com/2024/01/plaintiffs-set-a-new-record-for-ada-title-iii-federal-lawsuit-filings-in-2023/',
    external: true,
  },
  {
    title: 'Top 5 ADA Violations That Trigger Lawsuits',
    description:
      'Missing alt text, unlabelled form fields, poor color contrast, inaccessible PDFs, and keyboard-trap modals account for the majority of ADA demand letters. Understand what to fix first.',
    tag: 'Violations',
    readTime: '6 min read',
    href: 'https://webaim.org/projects/million/',
    external: true,
  },
  {
    title: 'How to Fix Missing Image Alt Text (With Examples)',
    description:
      'Alt text is the single most common WCAG failure. This guide shows exactly how to write descriptive alt text for different image types: informational, decorative, functional, and complex.',
    tag: 'Fix Guides',
    readTime: '7 min read',
    href: 'https://www.w3.org/WAI/tutorials/images/decision-tree/',
    external: true,
  },
  {
    title: 'Color Contrast Requirements Explained',
    description:
      'WCAG 2.1 AA requires a 4.5:1 contrast ratio for normal text and 3:1 for large text. Learn how to test your palette, which tools to use, and how to fix failing combinations without redesigning.',
    tag: 'Design',
    readTime: '5 min read',
    href: 'https://webaim.org/resources/contrastchecker/',
    external: true,
  },
  {
    title: 'Screen Reader Compatibility: A Developer Checklist',
    description:
      'Screen readers interpret your HTML structure to give users a non-visual experience. This checklist covers ARIA roles, landmark regions, focus management, and live regions.',
    tag: 'Development',
    readTime: '8 min read',
    href: 'https://www.a11yproject.com/checklist/',
    external: true,
  },
];

const TAG_COLORS: Record<string, string> = {
  Standards: 'bg-brand-500/20 text-brand-300',
  Legal: 'bg-red-500/20 text-red-300',
  Violations: 'bg-orange-500/20 text-orange-300',
  'Fix Guides': 'bg-green-500/20 text-green-300',
  Design: 'bg-purple-500/20 text-purple-300',
  Development: 'bg-amber-500/20 text-amber-300',
};

export default function ResourcesPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <section className="max-w-4xl mx-auto px-4 pt-28 pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm font-medium mb-6">
            <BookOpen className="h-4 w-4" />
            Resources
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            ADA Compliance Resources
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            Practical guides and reference material to help you understand WCAG 2.1 requirements, fix common violations, and reduce your ADA lawsuit risk.
          </p>
        </section>

        {/* Articles grid */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ARTICLES.map((article) => (
              <ArticleCard key={article.title} article={article} />
            ))}
          </div>

          {/* Disclaimer */}
          <p className="mt-12 text-xs text-slate-600 text-center max-w-xl mx-auto">
            Articles link to authoritative external sources. ADA Shield is not a law firm and does not provide legal advice. For legal questions, consult an attorney.
          </p>
        </section>

        {/* CTA */}
        <section className="bg-slate-800/50 py-16">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to check your site?
            </h2>
            <p className="text-slate-400 mb-8">
              Know your exact violation list in under 60 seconds — no account required.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors"
            >
              Scan Your Site Free
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const tagClass = TAG_COLORS[article.tag] ?? 'bg-slate-500/20 text-slate-300';

  return (
    <a
      href={article.href}
      target={article.external ? '_blank' : undefined}
      rel={article.external ? 'noopener noreferrer' : undefined}
      className="group bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 hover:bg-white/[0.08] hover:border-brand-500/30 transition-all"
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tagClass}`}>
          {article.tag}
        </span>
        <span className="text-xs text-slate-500">{article.readTime}</span>
      </div>
      <h3 className="text-base font-semibold text-white group-hover:text-brand-300 transition-colors leading-snug">
        {article.title}
        {article.external && (
          <ExternalLink className="h-3.5 w-3.5 inline ml-1.5 opacity-50" />
        )}
      </h3>
      <p className="text-sm text-slate-400 leading-relaxed flex-1">{article.description}</p>
      <span className="text-xs font-medium text-brand-400 group-hover:text-brand-300 transition-colors mt-1">
        Read article →
      </span>
    </a>
  );
}
