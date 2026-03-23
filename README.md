# ADA Shield

**Scan your website for ADA/WCAG accessibility violations. Get a lawsuit risk score, see exact code fixes, and monitor your site weekly.**

![Node.js](https://img.shields.io/badge/Node.js-22-green) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ecf8e) ![License](https://img.shields.io/badge/License-Private-red)

---

## What It Does

ADA Shield scans websites using a real headless browser (Puppeteer + axe-core) against **50+ WCAG 2.1 AA accessibility rules**, then calculates a **0–100 lawsuit risk score** weighted by the violations ADA plaintiff lawyers target first.

| Feature | Description |
|---|---|
| **Lawsuit Risk Score** | 0–100 score based on violations that trigger real ADA lawsuits |
| **Exact Code Fixes** | See the broken HTML and the exact fix for every violation |
| **Weekly Monitoring** | Automated scans with email alerts when new issues appear |
| **Trend Dashboard** | Track risk scores over time across all your sites |
| **Free Scan** | No login required — scan any site instantly |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Scanner** | Puppeteer + axe-core (WCAG 2.1 AA) |
| **API** | Express.js, Helmet, CORS, rate limiting |
| **Dashboard** | Next.js 14, Tailwind CSS, Radix UI |
| **Auth** | Supabase Auth (email/password, JWT) |
| **Database** | Supabase (PostgreSQL, RLS policies) |
| **Queue** | BullMQ + Redis (async scans) |
| **Payments** | Stripe (subscriptions) |
| **Email** | Resend (alerts) |

---

## Project Structure

```
ADA/
├── packages/
│   ├── scanner/          # Puppeteer + axe-core scanning engine
│   │   ├── src/
│   │   │   ├── scan.js           # Core scanner (headless browser)
│   │   │   ├── risk-score.js     # Lawsuit risk algorithm
│   │   │   ├── queue.js          # BullMQ job queue
│   │   │   └── worker.js         # Queue worker
│   │   └── package.json
│   │
│   ├── api/              # Express REST API
│   │   ├── src/
│   │   │   ├── index.js          # Server entry
│   │   │   ├── routes/           # scan, webhooks, internal
│   │   │   ├── db/               # Supabase CRUD operations
│   │   │   └── middleware/       # auth, rate-limiter, error-handler
│   │   └── package.json
│   │
│   └── dashboard/        # Next.js 14 frontend
│       ├── src/
│       │   ├── app/              # Pages (home, login, signup, dashboard)
│       │   ├── components/       # UI + scan components
│       │   ├── lib/              # Supabase clients, utilities
│       │   └── middleware.ts     # Route protection
│       └── package.json
│
├── supabase/
│   └── schema.sql        # Database tables + RLS policies
├── .github/workflows/    # CI/CD, weekly monitor, keep-alive
├── docker-compose.yml    # Redis for local dev
└── package.json          # npm workspaces root
```

---

## Getting Started

### Prerequisites

- **Node.js** 22+
- **npm** 10+
- **Supabase** project ([supabase.com](https://supabase.com))
- **Redis** (optional, for async queue — via Docker or cloud)

### 1. Clone & Install

```bash
git clone https://github.com/AutomateStack/ADA-Shield.git
cd ADA-Shield
git checkout dev
npm install
```

### 2. Configure Environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL (for frontend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as ANON_KEY (for frontend) |
| `NEXT_PUBLIC_API_URL` | API URL, default `http://localhost:4000` |

Also create `packages/dashboard/.env.local` with the `NEXT_PUBLIC_*` variables.

### 3. Set Up Database

Run `supabase/schema.sql` in your Supabase SQL Editor to create:
- `sites` — tracked websites
- `scan_results` — scan history with violations
- `subscriptions` — Stripe subscription data
- Row Level Security policies

### 4. Run Locally

```bash
# Terminal 1 — API
node packages/api/src/index.js

# Terminal 2 — Dashboard
cd packages/dashboard
NEXT_TELEMETRY_DISABLED=1 npx next dev -p 3000
```

On Windows (PowerShell):
```powershell
# Terminal 2 — Dashboard
cd packages\dashboard
$env:NEXT_TELEMETRY_DISABLED = "1"
node ..\..\node_modules\next\dist\bin\next dev -p 3000
```

### 5. Test a Scan

Open http://localhost:3000 and enter any URL, or use the API directly:

```bash
curl -X POST http://localhost:4000/api/scan/free \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/scan/free` | None | Free scan (3 violations shown, 10/hr rate limit) |
| `POST` | `/api/scan/run` | Bearer | Authenticated scan (runs synchronously) |
| `GET` | `/api/scan/results/:siteId` | Bearer | Get scan history for a site |
| `POST` | `/api/webhooks/stripe` | Stripe sig | Stripe webhook handler |
| `POST` | `/api/internal/trigger-weekly-scan` | API secret | Trigger weekly monitoring (internal/cron) |
| `GET` | `/health` | None | Health check |

---

## Risk Score Algorithm

The lawsuit risk score (0–100) uses weighted scoring:

**High-weight rules** (these trigger actual lawsuits):
- `color-contrast` — 20 pts/critical, 15 pts/serious
- `image-alt` — 20 pts/critical, 15 pts/serious
- `label` — 20 pts/critical, 15 pts/serious
- `link-name` — 15 pts/critical, 10 pts/serious
- `button-name` — 15 pts/critical, 10 pts/serious
- `html-has-lang` — 10 pts flat

**All other violations:** 10/7/4/2 pts per critical/serious/moderate/minor

| Score | Level | Color |
|---|---|---|
| 0–29 | Low | Green |
| 30–59 | Medium | Amber |
| 60–100 | High | Red |

---

## Pricing Tiers

| Plan | Price | Sites | Pages | Monitoring |
|---|---|---|---|---|
| **Free** | $0 | — | 3 violations shown | No |
| **Starter** | $29/mo | 1 | 10 | Weekly |
| **Business** | $79/mo | 5 | 50 | Weekly |
| **Agency** | $199/mo | 20 | Unlimited | Daily |

---

## Deployment

- **API** → Render (see `render.yaml`)
- **Dashboard** → Vercel
- **Database** → Supabase (hosted)
- **Redis** → Upstash or Railway

---

## License

Private — All rights reserved.