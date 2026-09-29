# The Aura Lab Content OS — Phase 1

Multi-tenant agency OS for The Aura Lab. This is Phase 1 of 4 (see spec):
**Authentication, Organizations, Users, Clients, Brands, RBAC** — working
and running. The full Prisma schema for Phases 2-4 (content ops, approvals,
assets, tasks, reporting, ads, SEO, analytics, billing) is already modeled
so later phases are additive, not migrations that break existing data.

## What actually works right now

- Credentials login (Auth.js v5) with hashed passwords
- Multi-tenant data model: Organization → Client → Brand
- RBAC: 8 roles from the spec, enforced server-side on every action
  (`src/lib/rbac.ts`) — not just hidden in the UI
- Tenant isolation: a CLIENT-role user can only ever read/write their own
  Client row, checked in every server action (`assertTenantScope`)
- Real-time activity feed (Pusher Channels): creating a client or brand
  broadcasts an event, and any signed-in user sees it live on their
  dashboard, scoped to their org or client channel
- Dashboards that differ by role (agency view vs. client view)

## Stack decisions made for you

- **Storage: Cloudflare R2**, not UploadThing. Both were listed in the spec;
  R2 has no egress fees and a genuinely usable free tier (10GB). UploadThing
  is a paid wrapper on top of similar storage — redundant to list both.
  (Upload wiring for assets isn't built yet — that's Phase 2's Asset module.)
- **Real-time: Pusher Channels** (free tier: 200k messages/day, 100
  concurrent connections). Not in the original stack list but required for
  live comments/notifications, which the spec implies. Swap for Ably or a
  self-hosted Soketi later without touching call sites — everything goes
  through `triggerEvent()` in `src/lib/pusher-server.ts`.
- **DB hosting**: not prescribed. Free options that work with this schema:
  Neon or Supabase (Postgres free tier).

## Setup

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, AUTH_SECRET, Pusher keys
npx prisma db push        # or: npm run db:migrate
npm run db:seed           # creates org + super admin + one sample client
npm run dev
```

Set `SEED_ADMIN_PASSWORD` (12+ chars) in `.env` before seeding. Seeded logins: `admin@theauralab.com` and `client@neend.com`, both using that password.

Get a Pusher free account at pusher.com → Channels → create an app → copy
the 4 keys into `.env`. Real-time won't work without this step, but the app
runs fine without it otherwise (the feed just stays empty).

## Deliberately not built yet (Phase 2-4, per the spec's own phasing)

- Content calendar, versions, comments, approvals
- Asset library + R2 upload wiring
- Tasks/Kanban, notifications table wiring
- Reporting, Ads, SEO, Analytics modules (schema exists, no UI/logic yet)
- Stripe/Razorpay billing (Invoice/Contract models exist as manual records
  only — confirm if you want real payment processing before this is built)

## Known gaps worth deciding before Phase 2

1. Video/large-file upload handling (transcoding, thumbnails) isn't
   designed yet — Reels/Shorts will need it.
2. No background job queue yet (needed for scheduled publishing + monthly
   report generation). Recommend Inngest (free tier, works well on Vercel)
   when you get to Phase 3.
3. Permission table exists in the schema but Phase 1 uses a static
   role→permission matrix in code for speed. Move to DB-backed permissions
   once you need per-client permission overrides.


## Content planning pack, client logins & admin panel

**Content planning** (`/content/[id]`): every item now carries a structured script
(hook → scenes/slides/frames/sections → CTA), caption with platform character limit, SEO keywords
(first = primary, with a keyword checklist), hashtags (stored without `#`, deduped, platform
recommendations), design/shoot direction, and for blogs an SEO title, meta description, slug and body.
Every save writes a `ContentVersion` snapshot. The brand page has a new **Day plan** view: everything
planned for a day (reel, carousel, stories, post, blog) in posting order, with badges for what's still
missing.

**Client logins** (`/admin/users`, and "Client portal access" on each client page): create a login, get a
one-time temporary password, the person must set their own on first sign-in (`/change-password`). Reset,
deactivate and reactivate take effect immediately (sessions are re-checked against the database).

**Admin panel** (`/admin`): client health table (status, brands, awaiting approval, logins, last client login).
Super Admin manages team accounts and roles; Agency Manager manages client logins only.

After pulling these changes run `npx prisma db push` (adds columns only; existing data is untouched).

## Two-gate client approval, creative uploads, emails & password reset

**Workflow** (each item moves through this; clients see everything from "Plan with client" onward):

```
Draft → Internal review → Plan with client ──approve──► Plan approved
                              └─changes─► Plan changes requested (back to team)
Plan approved → In production (starts on first upload) → Creative with client ──approve──► Ready to publish → Scheduled → Published
                                                              └─changes─► Creative changes requested → re-upload → sent again (Version 2, 3…)
```

- **Gate 1 – plan**: script, caption, SEO keywords, hashtags. **Gate 2 – creative**: the finished reel / carousel / static.
- Content is **locked while the client is reviewing**, so they never approve something that then changes.
- Work in progress is **hidden from clients** until it's sent to them. Earlier versions stay visible as history.
- Text-only items can use **Skip creative** (manager) to go straight from Plan approved to Ready to publish.
- Managers can record a decision the client gave on a call; it's logged in the approval history as "recorded on the client's behalf".
- **/approvals**: clients get a "Needs your review" queue with *Approve selected* for a whole month; the team gets a follow-up and publishing queue.
- Marking **Published** takes an optional link to the live post.

**Creative uploads** go browser → Cloudflare R2 directly (large videos never touch the server) and are served only via
`/api/creatives/[id]` (sign-in + tenant check + short-lived signed URL). Or add a Drive/Frame.io link instead. Limits: video 1 GB, image 25 MB, PDF 50 MB.

R2 bucket CORS (required for browser uploads):

```json
[{ "AllowedOrigins": ["https://YOUR-APP-URL", "http://localhost:3000"],
   "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
```

**Emails (Resend)**: onboarding a client (Clients → *Onboard a new client*) creates the client, first brand and portal login and
emails the credentials immediately. Creating a login or resetting a password emails it too. If the email can't be sent, the temporary password is shown
on screen once so nobody is locked out. Clients also get an email when a plan or creative is sent for review.
You must verify a sending domain in Resend and set `EMAIL_FROM` — see `.env.example`.

**Forgot password**: `/forgot-password` → emailed single-use link (60 min, stored hashed, max 3/hour/account, same response whether or not the email exists).
With no `RESEND_API_KEY` in development, the reset link is printed to the server console.

**Upgrade steps**: `npm install`, then `npx prisma db push` (adds columns/tables/enum values only; existing data untouched), then redeploy.
Existing items in *Approved* now mean "plan approved" and will appear as waiting for creative.

**Tests**: `npm test` (workflow rules, upload validation, token/email helpers). `npm run typecheck`.

**Known limits**: password change/reset doesn't sign out already-open sessions (deactivating a user does, immediately);
"Published" is recorded by the team — there is no auto-posting to Instagram yet; no rate limit on the login form itself.

## Service toggles, idea bank & live chat

**Service toggles.** 28 top-level categories (Strategy, Branding, Social Media Marketing, SEO, Performance Marketing,
Website Development, Video Production, Email, WhatsApp, Influencer, LinkedIn/B2B, YouTube, ORM, CRO, Marketing Automation,
AI Marketing, App Development, Analytics, Digital PR, Personal Branding, Lead Generation, Growth Marketing, etc. — see
`src/lib/services.ts` for the full catalog and every line item under each). Checked at onboarding, editable anytime from
*Client → Manage services*. Each category has a free-text scope-items box for the specific line items that client bought
(documentation only — doesn't affect app behaviour). **A client with no services configured yet sees every content type**,
so nothing breaks for clients created before this feature existed; once you save their services once, the calendar's
"New content" type list and the server-side create check both narrow to what's enabled. Only category-level toggles drive
the product — full per-service modules (an Ads tracker, SEO tracker, Website project tracker) are a natural next build but
aren't included here; right now the toggle governs the content calendar only.

**Idea bank.** Collapsible panel on each brand's page (above the calendar). Add ideas anytime, independent of a date;
mark one "Planned"; **Use this idea** turns it into a real draft, pre-filled, and keeps the idea listed (struck through)
for reference — nothing is deleted.

**Live chat.** `/chat` — one thread per client. Clients see their own thread; your team sees every client in an inbox
with unread counts and picks one to reply in. Built on the `Discussion`/`Message` tables already in the schema, delivered
in real time over the same Pusher channels used for live content updates — no new infrastructure. Enter sends; Shift+Enter
makes a new line.

**Tests**: 34 passing (`npm test`) — workflow rules, upload validation, token/email helpers, and the service-category /
content-type gating logic (including the backward-compatibility rule for unconfigured clients).
