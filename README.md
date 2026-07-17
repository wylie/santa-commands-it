# Santa Commands It!

`Santa Commands It!` is a theatrical holiday web application from Argon Collective LLC. Visitors ask Santa for something, the server makes the authoritative decision, completed rulings are stored in Neon Postgres, and approved or coal outcomes receive permanent public pages that can be shared directly. Version `0.1.6` is the stabilization release for the full `v0.1.x` milestone, focused on accessibility, responsive polish, deployment readiness, operational documentation, and test reliability.

## Release

- Current version: `v0.1.6`
- Current scope: server-rendered homepage, authoritative submission and reporting endpoints, Neon persistence, moderation-first ruling decisions, permanent public ruling pages, abuse safeguards, share actions, accessibility refinements, and launch-readiness validation

Completed rulings persist across refreshes and can be revisited at permanent public URLs. Blocked submissions are still rejected before any database write and never receive public pages, and public reports can now be submitted without exposing reporter details.

## Product concept

Santa is warm, theatrical, self-important, and certain that his declarations settle the matter. Visitors ask for something, and Santa may:

- approve it with `SANTA COMMANDS IT!`
- reject unacceptable content before any ruling is stored
- award coal to an otherwise acceptable request

Completed approvals and coal rulings are public on the homepage and on their own individual pages. No account is required, and successful submissions can be shared with a permanent public link.

## Technology stack

- Astro with server rendering
- TypeScript in strict mode
- Neon Postgres
- Drizzle ORM
- Drizzle Kit
- Plain CSS with reusable design tokens
- Vitest
- Playwright
- ESLint
- Prettier
- npm

## Local setup

1. Use Node.js `22.22.3` or another compatible Node 22 release.
2. Install dependencies with `npm install`.
3. Create or select a Neon project.
4. Copy the Neon pooled connection string recommended for serverless HTTP access.
5. Add it to a local `.env` file as `DATABASE_URL=...`.
6. Add `RATE_LIMIT_SECRET=...` to the same `.env` file.
7. Optionally add `SITE_URL=https://your-production-domain.example` for canonical URLs and production metadata.
8. Generate and apply the schema migration:
   - `npm run db:generate`
   - `npm run db:migrate`
9. Start the development server with `npm run dev`.
10. Submit a request, confirm it appears in Santa's Latest Commands, open its permanent ruling page, and test the report flow locally.

If `DATABASE_URL` is missing, the form remains usable but the server cannot persist rulings, recent public commands will be unavailable, and no permanent ruling pages can be created.

## Environment variables

- `DATABASE_URL`
  - Required for local submissions, persisted rulings, database reads, and database migrations
  - Must never use a `PUBLIC_` prefix
  - Must never be committed
- `RATE_LIMIT_SECRET`
  - Required in production for hashed rate-limiting and reporting client keys
  - Should be a long random secret
  - Uses a documented local-development fallback only when omitted outside production
- `SITE_URL`
  - Optional in local development because same-origin requests and local canonical URLs can fall back to the current request origin
  - Required in production for canonical URLs, Open Graph metadata, and share links
  - Should be the full origin only, such as `https://example.com`
  - Falls back to the current request origin for local development when omitted
- `SANTA_TEST_MODE`
  - Used only for isolated browser-test and local audit flows
  - Must not be enabled for ordinary production traffic

Use `.env.example` as the local template.

## Available npm scripts

- `npm run dev` starts the Astro development server.
- `npm run build` creates the server build for the Vercel adapter output.
- `npm run preview` runs a production-mode local server. The Vercel adapter used by this project does not support Astro's native `preview` command, so this script intentionally uses `astro dev --mode production` as the supported local approximation.
- `npm run lint` runs ESLint.
- `npm run format` formats the repository with Prettier.
- `npm run format:check` checks formatting without writing changes.
- `npm run typecheck` runs `astro check`.
- `npm run db:generate` generates a Drizzle migration from schema changes.
- `npm run db:migrate` applies generated migrations to the configured database.
- `npm run db:studio` opens Drizzle Studio against the configured database.
- `npm run db:check` runs Drizzle's schema check command.
- `npm run test` runs the Vitest suite.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run test:e2e` runs the Playwright browser suite.
- `npm run test:lighthouse` runs a local Lighthouse review against the homepage and a representative ruling page.
- `npm run check` runs the main validation flow.

## Project structure

```text
.
├── drizzle/
├── public/
│   ├── favicon.svg
│   └── images/
├── scripts/
├── src/
│   ├── components/
│   ├── config/
│   ├── layouts/
│   ├── pages/
│   ├── scripts/
│   ├── server/
│   ├── styles/
│   └── utils/
├── tests/
│   ├── e2e/
│   └── unit/
├── .env.example
├── CHANGELOG.md
├── astro.config.mjs
├── drizzle.config.ts
├── package.json
└── playwright.config.ts
```

## Santa artwork

The Santa artwork is a required committed asset.

- Canonical filesystem path: `public/images/santa.png`
- Canonical browser URL: `/images/santa.png`
- The homepage and individual ruling pages both render that exact PNG path directly.
- Do not rename it, change its capitalization, or introduce Santa-specific JPEG or JPG variants.

If the deployed site does not show Santa, verify that `/images/santa.png` returns `200` with `image/png` and confirm the deployment includes the tracked file.

## Server-side submission flow

In `v0.1.6`, the browser performs basic validation and then submits to `POST /api/rulings`.

The server then:

1. Enforces method, content-type, request-size, and same-origin expectations.
2. Derives a privacy-preserving client key by hashing trusted platform request metadata with `RATE_LIMIT_SECRET`.
3. Applies duplicate and idempotency checks before writing a new ruling.
4. Applies submission rate limits before moderation or coal decisions.
5. Trims and re-checks both the name and request.
6. Uses a honeypot field plus a lightweight form-timing signal to reject likely bot traffic.
7. Moderates both fields.
8. Rejects blocked content without saving it.
9. Runs the random-coal decision only for acceptable requests.
10. Selects and formats Santa's response on the server.
11. Persists approved or coal rulings in Neon through Drizzle, along with short-lived idempotency and submission-attempt records.
12. Returns safe ruling data to the browser, including the public identifier for permanent linking.

The browser updates the response panel, inserts the new ruling at the top of Santa's Latest Commands, and exposes a `VIEW & SHARE` action without a full page reload. Client-side requests now use a bounded timeout and preserve the in-flight idempotency key for safe retry behavior after ambiguous failures.

## Public-use safeguards

- Submission rate limiting starts at `5` attempts per `10` minutes and `20` attempts per `24` hours per hashed client key.
- Report rate limiting starts at `5` reports per hour per hashed client key and `1` report per ruling per client per `24` hours.
- Duplicate submissions are detected for the same normalized name and normalized request from the same client within `60` seconds.
- Each intentional form submission carries an opaque idempotency key so retries return the existing ruling instead of writing another row.
- A hidden honeypot field plus a configurable minimum form-open time help reject likely automated traffic before a ruling is created.
- Request bodies are size-limited and parsed through a strict JSON helper rather than trusting ad hoc `request.json()` calls.
- Security headers are applied globally through Astro middleware, including CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and cross-origin isolation headers where appropriate.
- Browser-side submission and reporting requests now time out cleanly instead of leaving controls disabled indefinitely.

These protections are intentionally lightweight. They reduce routine abuse and operational mistakes, but they are not a substitute for future platform-level firewalling, rate limiting, and server-side moderation review.

## What gets stored

The `rulings` table stores only final public rulings:

- internal primary key
- public identifier
- trimmed display name
- trimmed request text
- final decision
- rendered Santa response
- created timestamp

Only these final decision values are stored:

- `approved`
- `random-coal`

Blocked submissions are never stored and never receive a public identifier.

Additional operational tables now store:

- hashed submission-attempt records for rate limiting
- submission idempotency records with expiration timestamps
- public ruling reports with reason, optional note, hashed client key, status, and created timestamp

## What is never stored

- blocked submissions
- moderation-match details
- internal database IDs in browser responses
- email addresses
- account data
- raw IP addresses in the application database
- device fingerprints
- reporter names or contact details

Blocked content is rejected before any database write.

## Moderation and random coal

Moderation rules remain editable in `src/config/moderation.ts`, but they are now enforced authoritatively on the server.

Santa settings remain editable in `src/config/santa-settings.ts`, including:

- random coal enabled state
- random coal percentage
- considering delay range
- recent-ruling list limit
- configured display timezone for recent ruling timestamps
- client request timeout

The initial coal percentage remains `5%`.

## Latest commands behavior

- The homepage fetches the newest public rulings on the server during rendering.
- The latest-commands section shows a real semantic list when rulings exist.
- Each latest-command item links to its permanent public ruling page.
- The empty state still works for a brand-new database.
- If recent-ruling loading fails, the homepage stays usable and shows a quiet unavailable message.
- After a successful submission, the browser inserts the new ruling at the top of the visible list and keeps only the latest ten items.

## Permanent ruling pages and sharing

- Final approved and coal outcomes live at `/rulings/[publicId]`.
- The route uses the stored public identifier rather than the internal database key.
- Each ruling page shows the visitor name, request, decision, stored Santa response, timestamp, and share actions.
- Copy-link uses the canonical absolute ruling URL.
- Native sharing uses the Web Share API when the browser supports it.
- Unknown or invalid public identifiers return a friendly 404 experience.
- Blocked submissions never receive URLs, never become public pages, and never appear in metadata.

Completed approved and coal rulings are public and accessible to anyone with the URL.

## Public reporting

- Individual ruling pages now expose a secondary `REPORT THIS COMMAND` action.
- Reports accept one typed reason plus an optional short note up to `300` characters.
- Reports are stored privately with an initial `open` status for future review tooling.
- Reporter details are intentionally minimal: the application stores only a hashed client key when needed for rate limiting and duplicate-report protection.
- Reports do not automatically hide a ruling in `v0.1.6`.
- Blocked submissions still never receive public URLs and therefore cannot be reported.

## Astro rendering and deployment

- The project now uses Astro server rendering with the official Vercel adapter.
- Database access exists only in server-side modules under `src/server/`.
- `DATABASE_URL` is never exposed to client-side code.
- `RATE_LIMIT_SECRET` is read only on the server and should be configured distinctly in production.
- `SITE_URL` should be configured in production so ruling pages emit stable canonical metadata.
- Production builds output Vercel-compatible server artifacts rather than a static site.
- This release uses database-backed safeguards because a serverless deployment cannot rely on process memory as the sole production limiter.
- The Vercel adapter does not support Astro's native preview server, so the local `preview` script intentionally runs a production-mode server approximation instead.
- Same-origin request enforcement accepts the configured production origin and the current request origin, which keeps preview deployments safe without allowing arbitrary origins.

## Diagnosing submission errors safely

- Browser responses for failed submissions stay generic on purpose.
- For a local `POST /api/rulings` failure, inspect the terminal that is running `npm run dev`.
- For Vercel failures, inspect the function logs for the `/api/rulings` invocation.
- Safe diagnostics include the failing submission stage, sanitized error class, and database error code.
- Diagnostics must not include submitted names, submitted requests, raw request bodies, secrets, or raw IP addresses.

If the homepage can read recent rulings but valid submissions fail, run `npm run db:migrate` against the same database the app is using and then retry the submission. Reads only require the `rulings` table, while submissions also require the `submission_attempts` and `submission_idempotency` tables.

## Local and Vercel environment setup

Local development:

- Required: `DATABASE_URL`
- Optional: `SITE_URL`
- Optional with a documented development fallback: `RATE_LIMIT_SECRET`

Vercel production and preview:

- Required: `DATABASE_URL`
- Required: `SITE_URL`
- Required: `RATE_LIMIT_SECRET`

Do not place secrets in `vercel.json`. Configure them through the Vercel project environment settings instead.

## Migrations and deployment verification

- Apply local schema updates with `npm run db:migrate`.
- Apply the same migration command against the production or preview database before expecting new submission or reporting code paths to work.
- After deployment, verify the ruling flow and open `/images/santa.png` directly to confirm the deployed asset path is correct.
- Remember that `public/images/santa.png` is the repository filesystem path, while `/images/santa.png` is the browser URL.

## Production readiness

Required services:

- Vercel-compatible Astro server hosting
- Neon Postgres
- Google Fonts access for `Germania One`, with system-font fallbacks if the request fails

Recommended production setup:

- Set `DATABASE_URL`, `RATE_LIMIT_SECRET`, and `SITE_URL` explicitly in the deployment environment.
- Apply migrations before switching production traffic to a new release.
- Keep `RATE_LIMIT_SECRET` unique per environment.
- Review CSP behavior after every third-party asset change.
- Review moderation fixtures before launch so test-only blocked phrases are not shipped unintentionally.

Preview deployment considerations:

- Preview URLs work because the same-origin check allows the current request origin in addition to the configured `SITE_URL`.
- Do not weaken origin validation beyond configured and request-local origins.
- Use preview deployments to validate CSP, Google Fonts loading, and database connectivity before promoting a release.

## Migrations

Generate a migration after future schema changes:

- `npm run db:generate`

Apply migrations locally or to Neon:

- `npm run db:migrate`

Open Drizzle Studio for local inspection:

- `npm run db:studio`

The committed initial migration lives under `drizzle/`. Ordinary application startup does not mutate the schema automatically.

## Design and layout

- Desktop uses the sticky two-column Santa layout.
- The left rail holds the Santa artwork and the compact footer.
- The right column stacks the response panel, form, and public latest-commands list.
- Mobile and tablet collapse into normal document flow.
- The visual system keeps the light winter palette, Germania One display typography, and rounded low-border surfaces introduced in earlier releases.

## Accessibility goals

- Semantic landmarks and headings
- Keyboard-friendly submission and ask-again flow
- Accessible inline validation and blocked-state focus handling
- Safe public ruling markup with semantic `time` elements
- Status announcements that do not reread the entire feed
- Responsive layout down to narrow mobile widths
- Reduced-motion support
- Forced-colors and high-contrast resilience where practical
- Sufficient contrast at 200% zoom

## Testing

- `npm run test` covers validation, moderation normalization, coal decisions, repository-safe public-ruling mapping, canonical URL helpers, share payload utilities, environment validation, and safety-oriented edge cases without requiring a live database.
- `npm run test:e2e` uses a dedicated test-mode server strategy instead of a real Neon database, and now includes automated accessibility checks with Axe.
- `npm run test:lighthouse` provides a local production-style Lighthouse audit for the homepage and a representative ruling page.
- `npm run build` verifies the server-rendered production output and public ruling route.

Test precautions:

- Do not point ad hoc integration tests at a production Neon database.
- The standard test suite does not require destructive database access.
- If you add database integration tests later, use a dedicated test database and explicit cleanup.

## Current limitations

- No admin review dashboard, removal workflow, or reporting triage interface exists yet.
- No platform firewall, CAPTCHA, or third-party anti-bot service is configured in this repository.
- Client-side timing and honeypot checks are only lightweight abuse signals and can be bypassed.
- Database-backed rate limiting is intended for low public traffic and should be revisited before large-scale launch.
- Moderation rules still require code or configuration edits rather than an owner-facing editor.
- No automatic report-based removal or restore controls exist yet.
- No automated data-retention policy exists yet for public rulings or reports.
- `npm audit --omit=dev` currently reports a high-severity `drizzle-orm` advisory below `0.45.2`; resolving it requires a breaking dependency upgrade that should be handled deliberately after regression review.
- No dynamic social image generation, downloadable share cards, or QR codes exist yet.
- No authentication or user accounts exist yet.
- Completed public rulings remain stored until manually removed through database tools.
- Infrastructure providers still process ordinary request metadata outside the application database.
- Rule-based moderation cannot catch every harmful meaning or evasion pattern.

## Ownership and credits

- `Santa Commands It!` is a project from Argon Collective LLC.
- The compact left-rail footer carries the site attribution without turning ownership into part of the Santa joke.

## Google Fonts dependency

The site loads `Germania One` from Google Fonts with `display=swap` and keeps strong system-font fallbacks for all display text. This improves the theatrical visual direction, but it does mean visitors make a request to Google Fonts unless the font is cached or blocked. If the request fails, the site remains readable and functional with local fallbacks.

## Privacy and stored data

Completed public rulings store:

- display name
- request text
- final decision
- final Santa response
- public identifier
- created timestamp

Reports store:

- ruling reference
- report reason
- optional note
- report status
- created timestamp
- privacy-protected hashed client key only where needed for abuse prevention

Not intentionally stored:

- blocked submissions
- raw IP addresses in the application database
- user accounts
- contact information
- browser history
- client-side form timing values
- device fingerprints
- full request bodies in logs

## Pre-launch checklist

Use [PRELAUNCH.md](/Users/wylie/Repos/santa-commands-it/PRELAUNCH.md) for the concise release checklist covering moderation fixtures, environment setup, migrations, rate limits, CSP, privacy review, Lighthouse, and final mobile/desktop validation.

## Roadmap

- `v0.2.0`: Post-launch product planning after observing real moderation, reporting, and operational needs
