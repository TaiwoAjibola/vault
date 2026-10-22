# Keyhold

Keyhold is an encrypted credential vault with a Next.js web app and a
Chrome/Edge Manifest V3 extension. Secrets are encrypted in the browser with
Web Crypto before they reach Supabase. The database stores ciphertext, KDF
parameters, timestamps, and audit-event metadata — never a plaintext password,
username, URL, or note.

The interface uses a light “archival vault” design: warm paper, deep forest ink,
and a chartreuse accent.

## What is here

- **Web vault** — account sign-up, vault creation, master-password unlock,
  recovery-key reset, credential CRUD, search, reveal/copy, security settings,
  and an audit timeline.
- **Browser extension** — sign-in and vault unlock in the popup, strict
  per-origin autofill, manual save, a detected-login save prompt, and a compact
  in-page panel.
- **Database** — Supabase migration with row-level security, ownership guards,
  immutable audit events, retrieval timestamps, and full vault deletion.
- **Tests** — Web Crypto round trips, origin-matching rules, form detection, and
  RLS tests against a temporary local PostgreSQL instance.

## Architecture

```text
┌──────────────────────┐        ┌──────────────────────┐
│ Next.js web app      │        │ MV3 extension        │
│ React + Web Crypto   │        │ popup + content      │
└──────────┬───────────┘        └──────────┬───────────┘
           │                               │
           │  ciphertext + metadata        │  Supabase REST / Auth
           ▼                               ▼
        ┌──────────────────────────────────────┐
        │ Supabase Postgres + Auth + RLS        │
        │ vaults · credentials · vault_events  │
        └──────────────────────────────────────┘
```

Encryption happens before either client sends a request. Both clients share the
same vault format and crypto code under `src/lib/vault/`.

### Key hierarchy

1. A random 256-bit **data encryption key (DEK)** encrypts each credential with
   AES-256-GCM.
2. A **key encryption key (KEK)** is derived from the master password with
   PBKDF2-SHA-256 (600,000 iterations, 16-byte salt) and wraps the DEK.
3. A random **recovery key** (20 bytes, Crockford base32, shown as 8 groups of 4)
   derives a second KEK that wraps the same DEK.
4. Ciphertext is bound with AES-GCM additional authenticated data to the user
   and record id, so rows cannot be moved between accounts or credentials.
5. Account authentication (Supabase) and the vault master password are
   separate. The master password is never sent to Supabase.

The DEK lives only in memory: a React ref in the web app, and
`chrome.storage.session` (trusted extension contexts) for the extension. Locking
clears it.

See [docs/security.md](docs/security.md) for the threat model and limits.

## Quick start

### 1. Install

```bash
npm install
```

### 2. Start local Supabase

Docker is required for the Supabase CLI stack.

```bash
supabase start
supabase db reset
```

`db reset` applies
`supabase/migrations/20261021000100_keyhold_schema.sql` and the empty
`supabase/seed.sql`.

Copy the API URL and anon key printed by `supabase start` into `.env.local`:

```bash
cp .env.example .env.local
# edit NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Then:

```bash
npm run dev
```

Open <http://localhost:3000>, create an account, and create your vault. Save the
recovery key shown at setup — it is the only way back in if the master password
is lost.

### 3. Build and load the extension

```bash
cp extension/.env.example extension/.env
# set SUPABASE_URL, SUPABASE_ANON_KEY, KEYHOLD_APP_URL
npm run extension:build
```

In `chrome://extensions` (or `edge://extensions`):

1. Enable **Developer mode**.
2. Choose **Load unpacked**.
3. Select `extension/dist`.

Open a website tab, click the Keyhold toolbar button, and choose **Enable** to
grant that origin access. The extension never injects into all sites by default.

See [docs/extension.md](docs/extension.md) for the full flow.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Public anon key |
| `NEXT_PUBLIC_APP_URL` | `.env.local` | Public web app URL (links, redirects) |
| `SUPABASE_URL` | `extension/.env` | Supabase URL baked into the extension |
| `SUPABASE_ANON_KEY` | `extension/.env` | Public anon key baked in at build time |
| `KEYHOLD_APP_URL` | `extension/.env` | Web app URL for “Open vault” links |

The extension build fails if the Supabase values are missing or still placeholders.

## Cloud Supabase

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Set the two `NEXT_PUBLIC_*` variables in your hosting provider, then set
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `KEYHOLD_APP_URL` for the extension
build. Add your production URL under Authentication → URL Configuration
(`site_url` and `/auth/callback` redirect).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js development server |
| `npm run build` | Production web build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, including extension sources |
| `npm test` | Vitest: crypto, origins, detection, content bootstrap, RLS |
| `npm run test:rls` | RLS tests only |
| `npm run test:e2e` | Extension end-to-end run in Chromium against an in-memory Supabase |
| `npm run test:e2e:live` | Extension end-to-end run against a real Supabase project and account |
| `npm run test:e2e:live:web` | Web app end-to-end run against a real Supabase project |
| `npm run test:e2e:live:recovery` | Recovery-key reset run against a real Supabase project |
| `npm run extension:build` | Bundle and package the extension into `extension/dist` |
| `npm run extension:watch` | Rebuild extension sources on change |
| `npm run db:reset` | Reapply local migrations |
| `npm run db:push` | Push migrations to a linked Supabase project |

The RLS tests start a throwaway PostgreSQL cluster with `initdb`/`pg_ctl`, create
minimal Supabase-compatible roles and `auth.uid()`, apply the migration, and run
as the `authenticated` role. If those binaries are unavailable, the suite skips
the RLS file and the rest of the tests still run.

`npm run test:e2e` builds a throwaway extension bundle pointed at an in-memory
Supabase stand-in (`tests/e2e/mock-supabase.mjs`), starts a demo login page, and
drives Chromium through sign-in, vault unlock, site activation, the save prompt,
credential fill, audit logging, and locking. It needs a Chromium build; install
one with `npx playwright install chromium` if none is found.

The `extension/dist` folder in a fresh checkout is a placeholder build. Run
`npm run extension:build` with your own `extension/.env` values before loading
it in a browser.

### Live project tests

The `test:e2e:live*` scripts talk to a real Supabase project and write real
rows. Point them at a project and an account that already has a vault:

```bash
export KEYHOLD_LIVE_SUPABASE_URL="https://<project-ref>.supabase.co"
export KEYHOLD_LIVE_ANON_KEY="<publishable key>"
export KEYHOLD_LIVE_DB_ENV=/path/to/db.env   # optional, enables the psql checks
export QA_EMAIL="you@example.com"
export QA_PASSWORD="<account password>"
export QA_MASTER="<vault master password>"
export QA_NEW_MASTER="<new master password>" # recovery test only
npm run test:e2e:live
npm run test:e2e:live:web
npm run test:e2e:live:recovery
```

`test:e2e:live:web` expects the app to be running on `http://localhost:3000`
(`npm run build && npm start`). The recovery test needs a fresh account with no
vault yet: it creates one, captures the one-time recovery key, and resets the
master password with it.

## Project layout

```text
src/app/                 routes: marketing, auth, /app
src/components/          shell, vault screens, UI primitives
src/lib/vault/           shared crypto, origin, validation, formatting
src/lib/supabase/        browser/server clients and generated types
supabase/migrations/     schema, functions, triggers, RLS
extension/src/           background, content script, popup, unlock page
extension/scripts/       esbuild packaging and icon generation
tests/                   Vitest suites
docs/                    security model and extension guide
```

## Current limits

- No import/export, sharing, passkeys, TOTP, or breach monitoring yet.
- No automatic fill inside cross-origin iframes.
- Save prompts are heuristics. Review the site and username before saving.
- Audit events reveal metadata (which account changed something and when), not
  secret contents.
- Losing both the master password and the recovery key makes the vault
  unrecoverable. There is no server-side reset.

## License

Private MVP. Add a license before distributing.
