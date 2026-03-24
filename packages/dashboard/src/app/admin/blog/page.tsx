'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Loader2, AlertCircle, RefreshCw, Check,
} from 'lucide-react';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string | null;
  author: string;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
}

const EMPTY_FORM: Omit<BlogPost, 'id' | 'published_at' | 'created_at'> = {
  slug: '',
  title: '',
  excerpt: '',
  content: '',
  cover_image: '',
  author: 'ADA Shield Team',
  tags: [],
  published: false,
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [tagsInput, setTagsInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/admin/blog`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) throw new Error('Failed to load posts');
      setPosts(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, adminSecret]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setTagsInput('');
    setEditingId(null);
    setSaveError('');
    setSaved(false);
    setShowForm(true);
  }

  function openEdit(post: BlogPost) {
    setForm({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      cover_image: post.cover_image ?? '',
      author: post.author,
      tags: post.tags,
      published: post.published,
    });
    setTagsInput(post.tags.join(', '));
    setEditingId(post.id);
    setSaveError('');
    setSaved(false);
    setShowForm(true);
  }

  function handleTitleChange(title: string) {
    setForm((f) => ({
      ...f,
      title,
      // Auto-generate slug only for new posts
      ...(editingId == null ? { slug: slugify(title) } : {}),
    }));
  }

  async function handleSave() {
    setSaveError('');
    setSaved(false);
    if (!form.title.trim() || !form.slug.trim() || !form.content.trim()) {
      setSaveError('Title, slug, and content are required.');
      return;
    }
    setSaving(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const body = { ...form, tags };
      const url = editingId
        ? `${apiUrl}/api/admin/blog/${editingId}`
        : `${apiUrl}/api/admin/blog`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save post');
      }

      setSaved(true);
      await fetchPosts();
      setTimeout(() => {
        setShowForm(false);
        setSaved(false);
      }, 800);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(post: BlogPost) {
    try {
      await fetch(`${apiUrl}/api/admin/blog/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ ...post, published: !post.published }),
      });
      await fetchPosts();
    } catch {
      // silently ignore toggle errors — user can retry
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`${apiUrl}/api/admin/blog/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': adminSecret },
      });
      setDeleteConfirm(null);
      await fetchPosts();
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Blog</h1>
          <p className="text-slate-400 mt-1 text-sm">Manage blog posts visible on your public site.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/blog"
            target="_blank"
            className="text-sm text-slate-400 hover:text-white transition-colors underline"
          >
            View public blog
          </Link>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Post
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {posts.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <p className="mb-2">No blog posts yet.</p>
              <button onClick={openNew} className="text-brand-400 hover:text-brand-300 text-sm underline">
                Create your first post
              </button>
            </div>
          )}
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      post.published
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-600/40 text-slate-400'
                    }`}
                  >
                    {post.published ? 'Published' : 'Draft'}
                  </span>
                  <span className="text-xs text-slate-500">/blog/{post.slug}</span>
                </div>
                <p className="text-white font-medium truncate">{post.title}</p>
                <p className="text-slate-500 text-xs truncate">{post.excerpt}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => togglePublish(post)}
                  title={post.published ? 'Unpublish' : 'Publish'}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {post.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => openEdit(post)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(post.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-white font-semibold mb-2">Delete this post?</p>
            <p className="text-slate-400 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit form panel */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingId ? 'Edit Post' : 'New Post'}
            </h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Post title"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Slug *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="url-friendly-slug"
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Excerpt *</label>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Short summary shown in blog list"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Content * <span className="text-slate-500 font-normal">(HTML supported)</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={12}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="<p>Your content here...</p>"
                />
              </div>

              {/* Cover image */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Cover Image URL</label>
                <input
                  type="url"
                  value={form.cover_image ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, cover_image: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="https://..."
                />
              </div>

              {/* Author + Tags row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Author</label>
                  <input
                    type="text"
                    value={form.author}
                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="WCAG, ADA, Tips"
                  />
                </div>
              </div>

              {/* Published toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, published: !f.published }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.published ? 'bg-brand-600' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.published ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-300">
                  {form.published ? 'Published (visible on blog)' : 'Draft (hidden from public)'}
                </span>
              </div>

              {saveError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {saveError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-800 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {saved ? (
                  <>
                    <Check className="h-4 w-4" /> Saved!
                  </>
                ) : saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  editingId ? 'Update Post' : 'Create Post'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
