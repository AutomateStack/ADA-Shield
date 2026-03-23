# Copilot Custom Instructions for ADA Shield

## Project Overview

ADA Shield is a website accessibility scanner that detects WCAG 2.1 AA violations and calculates a 0–100 lawsuit risk score. It uses Puppeteer + axe-core for scanning, provides exact code fixes for each violation, and offers weekly automated monitoring with tiered subscription plans.

## Monorepo Structure

This is an npm workspaces monorepo under `packages/`:

- **packages/api** — Express.js REST API (CommonJS JavaScript)
- **packages/dashboard** — Next.js 14 customer-facing web app (TypeScript, strict mode)
- **packages/scanner** — Puppeteer + axe-core scanning engine (CommonJS JavaScript)
- **supabase/** — Database schema and migrations

Cross-package imports use the `@ada-shield/*` namespace (e.g., `require('@ada-shield/scanner')`).

## Tech Stack

| Package | Key Technologies |
|---------|-----------------|
| **API** | Express 4, Supabase, BullMQ, Stripe, Resend, Helmet, Zod, Winston |
| **Dashboard** | Next.js 14, TypeScript 5, Supabase SSR, Radix UI, Tailwind CSS 3, SWR, react-hook-form, Recharts, Zod |
| **Scanner** | Puppeteer 22, @axe-core/puppeteer 4, BullMQ, Supabase, Winston |

## Code Conventions

### General

- **Validation:** Use Zod schemas for all input validation (API request bodies, form data).
- **Logging:** Use Winston logger with structured context objects (`logger.info('message', { key: value })`). Never use `console.log`.
- **Error handling:** Use try/catch with `next(error)` in Express routes. The API has a global `errorHandler` middleware.
- **Auth:** Supabase JWT tokens via `Authorization: Bearer <token>` header. Two middleware variants: `authenticate` (required) and `optionalAuth` (optional).
- **Environment variables:** Validated at startup via `validateConfig()`. Use `config.js` — do not access `process.env` directly in business logic.

### API (`packages/api/`)

- CommonJS modules (`require` / `module.exports`).
- Express Router for modular routes under `src/routes/`.
- Zod `.safeParse()` for request validation — return 400 with error details on failure.
- Rate limiting via `express-rate-limit` (per-IP, window-based).
- Stripe webhooks mount **before** the JSON body parser (requires raw body).
- Async/await with try/catch + `next(error)` pattern in all route handlers.

### Dashboard (`packages/dashboard/`)

- TypeScript with strict mode. Path alias: `@/*` → `src/*`.
- Next.js App Router (not Pages Router). Use `'use client'` directive only for interactive components.
- Supabase SSR client for cookie-based auth sessions.
- Tailwind CSS with a custom brand color scale (50–950) and risk-level colors (`risk.low`, `risk.medium`, `risk.high`).
- Radix UI primitives for accessible, unstyled UI components.
- SWR for client-side data fetching; react-hook-form + Zod for form handling.
- SEO: Next.js `Metadata` API with title templates, OG tags, and JSON-LD structured data.
- Security headers configured in `next.config.js` (CSP, X-Frame-Options: DENY, permissions policy).

### Scanner (`packages/scanner/`)

- CommonJS modules.
- Puppeteer runs headless with sandboxing flags (`--no-sandbox`, `--disable-dev-shm-usage`).
- axe-core analyzes against WCAG 2.1 AA tags. Violations include impact level, WCAG tags, HTML nodes, and fix suggestions.
- BullMQ queue named `'accessibility-scans'` with 3 retries, exponential backoff, concurrency of 2, and 5 jobs/minute rate limit.

## Database (Supabase PostgreSQL)

- **Row Level Security (RLS)** is enabled on all tables — users can only access their own data.
- Key tables: `sites`, `scan_results`, `subscriptions`, `notification_preferences`.
- `scan_results.violations` is a JSONB column storing the full violation array.
- Risk score range: 0–100 (integer). Impact levels: critical, serious, moderate, minor.
- Subscription plans: `starter`, `business`, `agency` with `pages_limit` and `sites_limit`.

## Business Logic

- **Free scans:** Limited to 3 violations shown, 10 scans/hour per IP, processed synchronously.
- **Authenticated scans:** Full results, processed asynchronously via BullMQ queue.
- **Risk score:** Weighted by violation impact — high-lawsuit-risk rules score 20 pts, others score 10/7/4/2 based on severity.
- **Subscription tiers:** Starter ($29/mo), Business ($99/mo), Agency ($199/mo) with increasing page and site limits.

## Code Review Guidelines

- Ensure all database queries respect RLS — never bypass with service role key unless absolutely necessary.
- Validate all user input with Zod before processing.
- Check that new API routes include proper authentication middleware and rate limiting.
- Verify Tailwind classes use the project's custom color tokens (brand, risk levels) rather than raw color values.
- Ensure new scan-related code adheres to WCAG 2.1 AA standards terminology.
- Dashboard components should be accessible — use Radix UI primitives where applicable.
- Never expose secrets or service role keys to the client. Dashboard uses `NEXT_PUBLIC_*` env vars only.
