import { createSupabaseServer } from '@/lib/supabase/server';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, Tag, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createSupabaseServer();
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt')
    .eq('slug', params.slug)
    .eq('published', true)
    .single();

  if (!post) return { title: 'Post Not Found | ADA Shield' };

  return {
    title: `${post.title} | ADA Shield Blog`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const supabase = createSupabaseServer();
  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', params.slug)
    .eq('published', true)
    .single();

  if (!post) notFound();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-900">
        <article className="max-w-3xl mx-auto px-4 py-16">
          {/* Back */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>

          {/* Cover image */}
          {post.cover_image && (
            <div className="rounded-2xl overflow-hidden mb-10 h-64 sm:h-80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Tags */}
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-500/15 text-brand-300 text-xs font-medium rounded-full"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-slate-500 mb-10 pb-8 border-b border-white/10">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(post.published_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span>By {post.author}</span>
          </div>

          {/* Content — stored as HTML */}
          <div
            className="prose prose-invert prose-slate max-w-none prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline prose-headings:text-white prose-strong:text-white prose-code:text-brand-300 prose-code:bg-white/5 prose-code:rounded prose-code:px-1"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* CTA */}
          <div className="mt-16 p-6 bg-brand-600/10 border border-brand-500/30 rounded-2xl text-center">
            <h3 className="text-lg font-bold text-white mb-2">
              Is Your Website ADA Compliant?
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Run a free scan and get your lawsuit risk score in seconds.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-colors"
            >
              Scan Your Website Free
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
