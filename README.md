# Santa Commands It!

`Santa Commands It!` is a theatrical holiday web application from Argon Collective LLC. Visitors ask Santa for something, the server makes the authoritative decision, completed rulings are stored in Neon Postgres, and approved or coal outcomes receive permanent public pages that can be shared directly. Version `0.2.4` continues the `v0.2.x` owner-administration milestone with dynamic social-preview images, private workshop preview tooling, and the existing owner dashboard, moderation, settings, and response-template controls.

## Release

- Current version: `v0.2.4`
- Current scope: the preserved public Santa experience plus a private `Santa's Workshop` owner area with secure single-owner authentication, server-side sessions, range-aware owner dashboard analytics, ruling visibility controls, a report-review queue, database-backed moderation rules, editable Santa settings, response-template management, dynamic ruling share images, and private audit activity

Completed rulings persist across refreshes and can be revisited at permanent public URLs when they remain public. Blocked submissions are still rejected before any database write and never receive public pages, public reports can be submitted without exposing reporter details, and hidden rulings now return the same public not-found experience as unknown identifiers.

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
7. Add `WORKSHOP_USERNAME=...` and `SESSION_SECRET=...`.
8. Generate a workshop password hash with `npm run workshop:hash`, then store it as `WORKSHOP_PASSWORD_HASH=...`.
9. Optionally add `SITE_URL=https://your-production-domain.example` for canonical URLs and production metadata.
10. Optionally add `SITE_TIMEZONE=America/New_York` or another valid IANA time zone for workshop dashboard grouping. When omitted, the dashboard groups in `UTC`.
11. Generate and apply the schema migration:

- `npm run db:generate`
- `npm run db:migrate`

12. Seed the initial database-backed moderation and Santa configuration once:

- `npm run db:seed:configuration`

13. Start the development server with `npm run dev`.
14. Submit a request, confirm it appears in Santa's Latest Commands, open its permanent ruling page, load `/rulings/[publicId]/og.png`, sign into `/workshop/login`, and test dashboard ranges, moderation rules, Santa settings, response templates, report review, share-preview pages, hide, restore, and delete behavior against local data.

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
- `WORKSHOP_USERNAME`
  - Required for `Santa's Workshop` owner login
  - Must remain server-only
  - Should be a dedicated owner username rather than a public identifier
- `WORKSHOP_PASSWORD_HASH`
  - Required for `Santa's Workshop` owner login
  - Must contain a server-only password hash, not a plaintext password
  - The committed `npm run workshop:hash` helper emits the expected `scrypt$...` format
- `SESSION_SECRET`
  - Required in production for workshop session-token hashing
  - Must be at least 32 characters in production
  - Should be unique per environment
- `SITE_URL`
  - Optional in local development because same-origin requests and local canonical URLs can fall back to the current request origin
  - Required in production for canonical URLs, Open Graph metadata, and share links
  - Should be the full origin only, such as `https://example.com`
  - Falls back to the current request origin for local development when omitted
- `SITE_TIMEZONE`
  - Optional and server-only
  - Must be a valid IANA time zone such as `UTC` or `America/New_York`
  - Controls workshop dashboard date bucketing and selected-range grouping
  - Falls back to `UTC` when omitted
- `SANTA_TEST_MODE`
  - Used only for isolated browser-test and local audit flows
  - Must not be enabled for ordinary production traffic

Use `.env.example` as the local template.

## Santa's Workshop owner area

Private owner routes now live under:

- `/workshop`
- `/workshop/login`
- `/workshop/moderation`
- `/workshop/moderation/new`
- `/workshop/moderation/[ruleId]`
- `/workshop/settings`
- `/workshop/settings/responses`
- `/workshop/rulings`
- `/workshop/rulings/[publicId]`
- `/workshop/rulings/[publicId]/share-preview`
- `/workshop/reports`
- `/workshop/reports/[reportId]`

The public homepage, public ruling pages, submission flow, reporting flow, Santa artwork, winter visual design, and latest-commands feed remain intact and operate independently of the owner area.

## Workshop dashboard

- The private dashboard remains at `/workshop`.
- Supported range query values are `7d`, `30d`, `90d`, and `all`; invalid values fall back to `30d`.
- Range selection is server-side and encoded in the URL, for example `/workshop?range=30d`.
- `7d`, `30d`, and `90d` compare selected-range ruling counts against the immediately preceding equal-length period. `all` shows no previous-period comparison.
- The dashboard groups by day for `7d`, `30d`, and `90d`, and by month for `all`.
- Missing days or months are zero-filled in the trend output instead of disappearing.
- Primary metrics distinguish selected-range ruling counts from current operational report counts so owners can tell historical activity apart from present queue state.
- Decision percentages are calculated from selected-range rulings only: approved divided by total rulings, and coal divided by total rulings.
- The coal summary compares the current configured coal percentage with the actual selected-range coal rate. If random coal is disabled, the dashboard says so explicitly. If settings were updated during the selected range, the dashboard notes that the current target may not match every historical ruling in view.
- Report metrics include current open reports, current reviewed reports, reports created in range, dismissed in range, actioned in range, rulings with multiple open reports, and oldest open-report age.
- Moderation and template summaries show counts only. The dashboard does not expose the full blocked-word list, allowed-exception list, report notes, or full private configuration notes.
- Recent rulings are bounded to `5`, recent owner activity is bounded to `10`, and the owner-activity summary strips private moderation notes and other sensitive free-text details.
- Dashboard health checks are lightweight and private. They cover runtime moderation/template loading, Santa settings availability, random coal percentage validity, database reachability, `SITE_URL`, `SITE_TIMEZONE`, required production environment presence, and the canonical `public/images/santa.png` asset.
- The trend view is decorative HTML/CSS only; the accessible source of truth is the semantic table rendered directly below it.
- Dashboard aggregates come from focused database summary queries and bounded recent-item queries. No client-side filtering over all-time data is used.
- Blocked submission attempts are not counted on the dashboard because this release does not persist privacy-safe aggregate counts for them.

## Workshop authentication and session behavior

- The release uses a secure single-owner username and password flow backed by server-only environment variables.
- Passwords are verified against a `scrypt` hash.
- Successful login creates a server-side workshop session and sets an HTTP-only cookie.
- Workshop cookies use `SameSite=Lax`, are marked `Secure` in production, and expire after `12` hours.
- Each authenticated session carries a private CSRF token that is required for workshop mutations, including logout.
- Login failures are generic by design and do not reveal whether the username or password was incorrect.
- Failed login attempts are rate-limited per hashed client identifier at `5` failures per `15` minutes.
- Workshop pages redirect unauthenticated visitors to `/workshop/login`.
- Workshop API mutations reject unauthorized or cross-origin requests safely.
- Configuration mutations also require supported form content types, bounded request bodies, and CSRF tokens before a rule, setting, or template can change.

## Workshop ruling management

- Workshop search is server-side and matches display name, request text, Santa response, and public identifier.
- Decision filters support all, approved, and coal rulings.
- Visibility filters support all, public, and hidden rulings.
- Sorting supports newest first and oldest first.
- Pagination is server-side with a page size of `25`.
- Private ruling views now include report totals, open-report counts, latest-report timestamps, and direct links into the report queue.
- Workshop pages are private, `noindex`, `nofollow`, and excluded from public navigation.

## Workshop report review

- Reports now receive opaque private identifiers under `/workshop/reports/[reportId]`; internal numeric database ids are never used in owner URLs.
- The report queue is server-side searchable, filterable by status, reason, and ruling visibility, sorted by review priority, and paginated at `25` items per page.
- Supported report states are `open`, `reviewed`, `dismissed`, and `actioned`.
- Owners can mark a report reviewed, dismiss it with an optional private resolution note, reopen it, or mark it actioned without changing the public ruling.
- Owners can also hide a public ruling directly from a report. That action hides the ruling publicly, marks the current report actioned, and also marks other `open` or `reviewed` reports for the same ruling as actioned. Already dismissed reports remain dismissed.
- The workshop dashboard now tracks open reports, reviewed reports, actioned reports from the last seven days, and rulings with multiple open reports.
- The workshop navigation now shows the current open-report count beside the private reports link.

## Visibility model, hide/restore, and deletion semantics

- Persisted rulings now have a separate `visibility` state: `public` or `hidden`.
- Existing rulings migrate safely to `public`.
- Hidden rulings remain stored in the database and continue to appear inside `Santa's Workshop`.
- Public queries now require `visibility = public`, including the homepage feed, public ruling pages, report lookup, and duplicate replay behavior that would otherwise reveal a hidden ruling.
- Hiding a ruling records `hidden_at` and an optional private `hidden_reason`.
- Restoring a ruling returns it to `public` visibility and clears `hidden_at`. The prior `hidden_reason` is intentionally retained as private historical context.
- Permanent deletion removes the ruling record itself.
- Related `ruling_reports` and `submission_idempotency` rows are removed automatically by database cascade rules.
- Owner activity entries are preserved because they reference the ruling's public identifier rather than a foreign key.

## Owner activity log

- Workshop activity is private and currently records `login-success`, `login-failure`, `logout`, `ruling-hidden`, `ruling-restored`, `ruling-deleted`, `report-reviewed`, `report-dismissed`, `report-reopened`, `report-actioned`, `ruling-hidden-from-report`, and `related-reports-actioned`.
- Activity entries store the action type, optional target public identifier, optional related public identifier, optional short private details, and timestamp.
- Passwords, session tokens, raw IP addresses, and duplicated full request bodies are not stored in the activity log.

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
- `npm run workshop:hash` generates a new `scrypt` password hash for `WORKSHOP_PASSWORD_HASH`.
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

The `rulings` table stores final approved and coal rulings, including private visibility metadata when a ruling is hidden:

- internal primary key
- public identifier
- trimmed display name
- trimmed request text
- final decision
- rendered Santa response
- visibility
- optional hidden timestamp
- optional private hidden reason
- created timestamp

Only these final decision values are stored:

- `approved`
- `random-coal`

Blocked submissions are never stored and never receive a public identifier.

Additional operational tables now store:

- hashed submission-attempt records for rate limiting
- submission idempotency records with expiration timestamps
- public ruling reports with an opaque private report identifier, reason, optional note, hashed client key, status, optional review and resolution timestamps, optional private resolution note, and created timestamp
- workshop login-attempt records for rate limiting
- workshop sessions with expiration and CSRF state
- private owner-activity records
- moderation rules, Santa settings, and response templates used only by authenticated workshop tooling and server-side submission decisions

## What is never stored

- blocked submissions
- moderation-match details
- internal database IDs in browser responses
- full blocked-word, blocked-phrase, or allowed-exception lists in public browser bundles
- full response-template collections in public browser bundles
- owner-only configuration notes, configuration history, or moderation test text
- email addresses
- account data
- raw IP addresses in the application database
- device fingerprints
- reporter names or contact details

Blocked content is rejected before any database write.

## Database-backed configuration

The production source of truth for moderation and editable Santa behavior is now the database, not a deployed source-file edit.

### Moderation rules

- Rules live in the `moderation_rules` table.
- Supported rule types are `blocked-word`, `blocked-phrase`, and `allowed-exception`.
- Supported private categories are `bullying`, `harassment`, `hate`, `violence`, `sexual-content`, `personal-information`, `dangerous-content`, `spam`, `profanity`, `general`, and `test-fixture`.
- Rule-management URLs use opaque workshop identifiers such as `rule_...`; internal numeric ids are never exposed in owner URLs or public responses.
- The moderation list is server-side searchable by rule value, category, private note, and opaque rule id, plus server-side filterable by rule type, status, and category.
- Rule pagination is server-side with a page size of `25`.
- Rules can be enabled, disabled, edited, and deleted from `Santa's Workshop`.
- Inactive rules remain searchable and editable but do not affect submissions or moderation tests.

### Moderation tester

- The private moderation tester lives on `/workshop/moderation`.
- Test content is evaluated against the current active rules on the server.
- Test input is never persisted, never logged intentionally, and never creates a ruling.
- The tester reveals private match metadata such as matching rule type, opaque rule id, category, and normalized input only to authenticated owners.

### Santa settings

- Editable Santa settings live in the `santa_settings` table.
- `v0.2.3` exposes `randomCoalEnabled` and `randomCoalPercentage` for editing and surfaces the current configured value in the private dashboard.
- The stored coal percentage is retained even when random coal is disabled.
- Settings updates use a version field for optimistic concurrency so stale tabs do not silently overwrite newer values.
- The default coal percentage remains `5%`.

### Response templates

- Templates live in the `response_templates` table.
- Template groups are `approved`, `coal`, and `blocked-warning`.
- Approved and coal templates may use `{name}` and `{request}` placeholders.
- Blocked warning templates allow no placeholders.
- Templates are stored and rendered as plain text only; they are never evaluated as code and never rendered through `innerHTML`.
- Equal random selection is used within each active template group.
- Persisted rulings keep the exact final rendered Santa response even after later template edits.

### Required template safeguards

- Approved responses must keep at least one active template.
- Coal responses must keep at least one active template while random coal is enabled.
- Blocked warning responses must keep at least one active template.
- The active blocked-warning set must retain the core warning text `THAT IS UNACCEPTABLE. ASK FOR SOMETHING ELSE OR RECEIVE COAL!`.

### Caching and fail-closed behavior

- Active moderation rules, current Santa settings, and active response templates are loaded through a focused server-side configuration service.
- The runtime cache TTL is `30` seconds.
- Owner mutations invalidate the current instance cache immediately after successful changes.
- Other serverless instances may continue serving older configuration until their local TTL expires, so cross-instance propagation can take up to `30` seconds.
- The cache is only an optimization; the database remains authoritative.
- If required runtime configuration cannot be loaded, public submissions fail closed with the existing generic workshop error rather than accepting unmoderated content.

### Source defaults and migration

- Source files now provide safe seed defaults and test recovery values rather than equal production authority.
- The committed seed source lives in `src/config/configuration-seed-defaults.json`.
- The one-time seed command is `npm run db:seed:configuration`.
- The seed is intentionally idempotent: it inserts missing rules, settings, and templates, skips existing rows, and does not overwrite later owner changes.
- Startup does not synchronize source defaults into the database automatically.

## Latest commands behavior

- The homepage fetches the newest public rulings on the server during rendering.
- Hidden rulings are excluded from homepage and public-page queries.
- The latest-commands section shows a real semantic list when rulings exist.
- Each latest-command item links to its permanent public ruling page.
- The empty state still works for a brand-new database.
- If recent-ruling loading fails, the homepage stays usable and shows a quiet unavailable message.
- After a successful submission, the browser inserts the new ruling at the top of the visible list and keeps only the latest ten items.

## Permanent ruling pages and sharing

- Final approved and coal outcomes live at `/rulings/[publicId]`.
- The route uses the stored public identifier rather than the internal database key.
- Each ruling page shows the visitor name, request, decision, stored Santa response, timestamp, and share actions.
- Public ruling pages now emit absolute Open Graph and Twitter image metadata for the current ruling when a canonical origin can be resolved from `SITE_URL` or the current request.
- Copy-link uses the canonical absolute ruling URL.
- Native sharing uses the Web Share API when the browser supports it.
- Unknown or invalid public identifiers return a friendly 404 experience.
- Blocked submissions never receive URLs, never become public pages, and never appear in metadata.

Completed approved and coal rulings are public and accessible to anyone with the URL.

## Dynamic social preview images

- Public ruling images render at `/rulings/[publicId]/og.png`.
- Public pages emit `og:image`, `og:image:width=1200`, `og:image:height=630`, `og:image:type=image/png`, ruling-specific alt text, `twitter:image`, and `twitter:card=summary_large_image`.
- Approved rulings use a clear `APPROVED BY SANTA` treatment and coal rulings use `SANTA CHOSE COAL`; the image never exposes report notes, hidden reasons, internal ids, or the configured random-coal percentage.
- Canonical Santa artwork stays fixed at filesystem path `public/images/santa.png` and browser URL `/images/santa.png`.
- The renderer uses the committed local Santa PNG and `@vercel/og` with its default server-side font behavior, so it does not fetch Google Fonts per image request.
- Text is normalized as plain text only, wraps deterministically, truncates with ellipses when necessary, and handles long unbroken strings without horizontal overflow.
- Successful public image responses use short shared caching with stale-while-revalidate, not immutable caching. Hidden, deleted, malformed, missing, and renderer-failure responses return `no-store`.
- Remote platforms may continue showing a previously cached social image until their own cache expires or is refreshed; hiding or deleting a ruling does not guarantee immediate third-party removal.

## Workshop share preview

- Owners can open `/workshop/rulings/[publicId]/share-preview` from a ruling detail page.
- The preview page is private, `noindex`, and `no-store`, and it shows the rendered image, metadata title, metadata description, image alt text, visibility status, canonical ruling URL, and the public image URL only when the ruling is still public.
- Hidden rulings render through the authenticated preview image route `/workshop/rulings/[publicId]/share-preview.png` and never expose the public `og.png` URL as an active share target.
- The preview flow intentionally omits editing controls and download controls.

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

If the homepage can read recent rulings but valid submissions fail, run `npm run db:migrate` and `npm run db:seed:configuration` against the same database the app is using and then retry the submission. Reads only require the `rulings` table, while submissions also require the moderation, settings, template, submission-attempt, and idempotency tables.

## Local and Vercel environment setup

Local development:

- Required: `DATABASE_URL`
- Required: `WORKSHOP_USERNAME`
- Required: `WORKSHOP_PASSWORD_HASH`
- Required: `SESSION_SECRET`
- Optional: `SITE_URL`
- Optional with a documented development fallback: `RATE_LIMIT_SECRET`

Vercel production and preview:

- Required: `DATABASE_URL`
- Required: `WORKSHOP_USERNAME`
- Required: `WORKSHOP_PASSWORD_HASH`
- Required: `SESSION_SECRET`
- Required: `SITE_URL`
- Required: `RATE_LIMIT_SECRET`

Do not place secrets in `vercel.json`. Configure them through the Vercel project environment settings instead.

## Migrations and deployment verification

- Apply local schema updates with `npm run db:migrate`.
- Seed initial configuration with `npm run db:seed:configuration`.
- Apply the same migration command against the production or preview database before expecting new submission or reporting code paths to work.
- Run the configuration seed once per environment after the new tables exist. Re-running it later is safe and will skip already-seeded rows.
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
- Apply the configuration seed after the migration the first time `v0.2.2` reaches an environment.
- Keep `RATE_LIMIT_SECRET` unique per environment.
- Review CSP behavior after every third-party asset change.
- Review seeded moderation fixtures before launch so any test-oriented rules are categorized appropriately for the environment.

Preview deployment considerations:

- Preview URLs work because the same-origin check allows the current request origin in addition to the configured `SITE_URL`.
- Do not weaken origin validation beyond configured and request-local origins.
- Use preview deployments to validate CSP, Google Fonts loading, and database connectivity before promoting a release.

## Migrations

Generate a migration after future schema changes:

- `npm run db:generate`

Apply migrations locally or to Neon:

- `npm run db:migrate`

Seed or re-check the initial database-backed configuration:

- `npm run db:seed:configuration`

Open Drizzle Studio for local inspection:

- `npm run db:studio`

The committed migrations live under `drizzle/`. Ordinary application startup does not mutate the schema or synchronize configuration defaults automatically.

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

- `npm run test` covers validation, moderation normalization, rule duplication behavior, runtime configuration caching, stale settings conflicts, response-template safeguards, repository-safe public-ruling mapping, canonical URL helpers, share payload utilities, environment validation, and safety-oriented edge cases without requiring a live database.
- `npm run test:e2e` uses a dedicated test-mode server strategy instead of a real Neon database, includes automated accessibility checks with Axe, and now exercises workshop dashboard ranges, moderation, settings, template, ruling, and report flows in the browser.
- `npm run test:lighthouse` provides a local production-style Lighthouse audit for the homepage and a representative ruling page.
- `npm run build` verifies the server-rendered production output and public ruling route.

Test precautions:

- Do not point ad hoc integration tests at a production Neon database.
- The standard test suite does not require destructive database access.
- If you add database integration tests later, use a dedicated test database and explicit cleanup.

## Current limitations

- Single-owner authentication only; there are no multiple staff accounts or role permissions yet.
- No configuration rollback UI exists yet.
- No scheduled rule activation or scheduled settings changes exist yet.
- No bulk moderation-rule import or export exists yet.
- No automatic rule suggestions or external moderation classifier exists yet.
- No multiple moderation profiles exist yet.
- No platform firewall, CAPTCHA, or third-party anti-bot service is configured in this repository.
- Client-side timing and honeypot checks are only lightweight abuse signals and can be bypassed.
- Database-backed rate limiting is intended for low public traffic and should be revisited before large-scale launch.
- Cache propagation across serverless instances may take up to the configured `30` second TTL.
- No automated data-retention policy exists yet for public rulings or reports.
- `npm audit --omit=dev` currently reports a high-severity `drizzle-orm` advisory below `0.45.2`; resolving it requires a breaking dependency upgrade that should be handled deliberately after regression review.
- No downloadable share cards or QR codes exist yet.
- No automatic owner alerts, email notifications, CSV export, or bulk actions exist yet.
- No dashboard CSV export, scheduled reports, external analytics, visitor tracking, or blocked-attempt analytics exist yet.
- Completed public rulings remain stored until removed through `Santa's Workshop` or direct database administration.
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

- `v0.2.5`: `v0.2.x` stabilization and launch polish
