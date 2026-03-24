import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { Calendar, Tag, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | ADA Shield',
  description: 'Practical guides and insights on ADA website compliance, WCAG accessibility, and lawsuit prevention.',
};

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image: string | null;
  author: string;
  tags: string[];
  published_at: string;
}

export default async function BlogPage() {
  const supabase = createSupabaseServer();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, cover_image, author, tags, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false });

  const allPosts: BlogPost[] = posts ?? [];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-900">
        {/* Hero */}
        <section className="bg-gradient-to-b from-slate-950 to-slate-900 py-16 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <span className="inline-block px-3 py-1 bg-brand-500/20 text-brand-300 text-xs font-semibold rounded-full uppercase tracking-wide mb-4">
              Blog
            </span>
            <h1 className="text-4xl font-bold text-white mb-4">
              ADA Compliance Insights
            </h1>
            <p className="text-slate-400 text-lg">
              Practical guides on web accessibility, WCAG standards, and protecting your business from ADA lawsuits.
            </p>
          </div>
        </section>

        {/* Posts grid */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          {allPosts.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-xl mb-2">No posts yet</p>
              <p className="text-sm">Check back soon for accessibility guides and tips.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {allPosts.map((post) => (
                <article
                  key={post.id}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-brand-500/40 transition-all group"
                >
                  {post.cover_image && (
                    <div className="h-48 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.cover_image}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {post.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-500/15 text-brand-300 text-xs rounded-full"
                          >
                            <Tag className="h-2.5 w-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <h2 className="text-lg font-bold text-white mb-2 leading-snug group-hover:text-brand-300 transition-colors">
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h2>
                    <p className="text-slate-400 text-sm line-clamp-3 mb-4">{post.excerpt}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.published_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span>{post.author}</span>
                    </div>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1 mt-4 text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
                    >
                      Read more <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
