# Santa Commands It!

`Santa Commands It!` is a theatrical holiday web application from Argon Collective LLC. Visitors ask Santa for something, the server makes the authoritative decision, completed rulings are stored in Neon Postgres, and approved or coal outcomes receive permanent public pages that can be shared directly. Version `0.3.1` adds owner-curated Featured Commands and a short seasonal homepage greeting.

## Release

- Current version: `v0.3.1`
- Current scope: the preserved public Santa experience, public request browsing at `/commands`, curated Featured Commands, optional seasonal homepage messaging, shareable discovery URLs, and a private `Santa's Workshop` owner area with secure single-owner authentication, server-side sessions, range-aware owner dashboard analytics, ruling visibility controls, a report-review queue, database-backed moderation rules, editable Santa settings, response-template management, dynamic ruling share images, and private audit activity

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
9. For local production-like checks you may omit `SITE_URL`, but production should use `SITE_URL=https://santa-commands-it.vercel.app` for canonical URLs, Workshop origin validation, and public metadata.
10. Optionally add `SITE_TIMEZONE=America/New_York` or another valid IANA time zone for workshop dashboard grouping. When omitted, the dashboard groups in `UTC`.
11. Generate and apply the schema migration:

- `npm run db:generate`
- `npm run db:migrate`

12. Seed the initial database-backed moderation and Santa configuration once:

- `npm run db:seed:configuration`

13. Start the development server with `npm run dev`.
14. Submit a request, confirm it appears in Santa's Latest Answers and `/commands`, use the public `BROWSE REQUESTS` page, open its permanent ruling page, load `/rulings/[publicId]/og.png`, sign into `/workshop/login`, and test dashboard ranges, Featured Commands, seasonal greeting editing, moderation rules, Santa settings, response templates, report review, share-preview pages, hide, restore, and delete behavior against local data.

If `DATABASE_URL` is missing, the form remains usable but the server cannot persist rulings, recent public requests will be unavailable, and no permanent ruling pages can be created.

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

Use `.env.example` as the local template. Active local values belong in `.env`; real secrets must never be committed.

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

## Workshop login flow

- Owners should visit `/workshop/login`, not `/api/workshop/login`.
- The HTML form submits with `method="POST"` to `/api/workshop/login`.
- Successful logins follow a conventional POST/Redirect/GET flow:
  - `POST /api/workshop/login`
  - create the Workshop session
  - return `303 See Other`
  - redirect to `/workshop` or a validated internal Workshop return path
- Failed logins do not create a session and return `303 See Other` back to `/workshop/login?error=credentials`.
- Login error handling is allow-listed. Supported values are currently `credentials`, `rate-limited`, `expired`, and `unavailable`.
- `GET /api/workshop/login` is only a recovery path for accidental navigation and immediately redirects back to `/workshop/login`.
- External or malformed return URLs are rejected. Allowed return paths stay under `/workshop`.
- Workshop logout remains a protected `POST /api/workshop/logout` flow and redirects back to `/workshop/login?status=logged-out`.

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
- Featured Commands count shows current public rulings marked Featured.
- Recent Featured activity highlights the latest feature and unfeature owner actions separately from the broader activity feed.
- Moderation and template summaries show counts only. The dashboard does not expose the full blocked-word list, allowed-exception list, report notes, or full private configuration notes.
- Recent rulings are bounded to `5`, recent owner activity is bounded to `10`, and the owner-activity summary strips private moderation notes and other sensitive free-text details.
- Dashboard health checks are lightweight and private. They cover runtime moderation/template loading, Santa settings availability, random coal percentage validity, database reachability, `SITE_URL`, `SITE_TIMEZONE`, required production environment presence, and the canonical `public/images/santa-solo.png` asset.
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
- Failed login attempts are rate-limited per hashed client identifier at `5` failures per `15` minutes` in production.
- Local development skips the Workshop login rate limiter so owners can recover from bad credentials without waiting out the production lockout window.
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
- Public rulings can be marked as Featured from their Workshop detail page. Featured status is editorial only, creates private owner activity, and adds a subtle public badge without explaining why the ruling was chosen.
- Hidden rulings cannot be featured. Hiding a ruling from the ruling detail page or from a report clears Featured status, and deleting a ruling removes it from every featured surface with the deleted record.
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
- Featured status is cleared when a ruling is hidden and naturally disappears when a ruling is deleted.

## Owner activity log

- Workshop activity is private and currently records `login-success`, `login-failure`, `logout`, `ruling-hidden`, `ruling-restored`, `ruling-deleted`, `ruling-featured`, `ruling-unfeatured`, `report-reviewed`, `report-dismissed`, `report-reopened`, `report-actioned`, `ruling-hidden-from-report`, and `related-reports-actioned`.
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
- `npm run workshop:verify` checks a plaintext username and password against the current local `.env` Workshop credentials without exposing the stored hash.
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

- Canonical filesystem path: `public/images/santa-solo.png`
- Canonical browser URL: `/images/santa-solo.png`
- The homepage, public ruling pages, and dynamic share-image renderer all use that exact PNG path directly.
- Previous non-canonical Santa assets and non-PNG Santa derivatives should not be reintroduced as second canonical Santa files.

If the deployed site does not show Santa, verify that `/images/santa-solo.png` returns `200` with `image/png` and confirm the deployment includes the tracked file.

## Snow background

The repeating snow pattern is also a required committed asset.

- Background filesystem path: `public/images/snow-black.png`
- Background browser URL: `/images/snow-black.png`
- The site uses `background-repeat: repeat` with `--background-pattern-size: 400px`.
- A translucent icy overlay sits above the pattern through layered CSS backgrounds so the snow remains decorative and text stays readable.
- Dynamic ruling share images use the Santa artwork directly and apply restrained decorative snow-pattern regions from this existing asset.
- The pattern is decorative only. It is not exposed to assistive technology and does not carry any meaning on its own.

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

The browser updates the response panel, inserts the new ruling at the top of Santa's Latest Answers, and exposes a `READ SANTA'S ANSWER` action without a full page reload. Client-side requests now use a bounded timeout and preserve the in-flight idempotency key for safe retry behavior after ambiguous failures.

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
- `v0.3.1` adds an optional short plain-text seasonal homepage greeting that is managed separately from announcements, is not scheduled, and appears only on the homepage when present.
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
- Featured Commands are read from the rulings table and share the existing public page, public discovery, and share-image cache behavior. Feature toggles record owner activity immediately; public pages and social previews may reflect the previous response until their normal shared cache window expires.
- If required runtime configuration cannot be loaded, public submissions fail closed with the existing generic workshop error rather than accepting unmoderated content.

### Source defaults and migration

- Source files now provide safe seed defaults and test recovery values rather than equal production authority.
- The committed seed source lives in `src/config/configuration-seed-defaults.json`.
- The one-time seed command is `npm run db:seed:configuration`.
- The seed is intentionally idempotent: it inserts missing rules, settings, and templates, skips existing rows, and does not overwrite later owner changes.
- Startup does not synchronize source defaults into the database automatically.
- The `v0.3.1` migration adds `rulings.is_featured`, `rulings.featured_at`, related owner-activity enum values, and `santa_settings.seasonal_greeting`.

## Latest commands behavior

- The homepage fetches the newest public rulings on the server during rendering.
- Hidden rulings are excluded from homepage and public-page queries.
- The homepage also shows a Featured Commands section above Santa's Latest Answers when at least one public ruling is featured.
- Featured Commands shows up to three rulings, newest featured first, using the same public ruling-card component as the latest feed.
- If no featured rulings exist, the Featured Commands section is omitted entirely.
- The optional seasonal greeting appears only on the homepage and only when the Workshop setting contains text.
- The latest-commands section shows a real semantic list when rulings exist.
- Each latest-command item links to its permanent public ruling page.
- The homepage uses the shared public ruling-card component in a compact variant.
- The public navigation uses `ASK SANTA` and `BROWSE REQUESTS`.
- `ASK SANTA` links to `/#ask-santa` on the homepage and from other public pages.
- `BROWSE ALL REQUESTS` and `BROWSE REQUESTS` both lead to `/commands`.
- Internal technical names may still refer to "commands" for route, repository, and query compatibility.
- The empty state still works for a brand-new database.
- If recent-ruling loading fails, the homepage stays usable and shows a quiet unavailable message.
- After a successful submission, the browser inserts the new ruling at the top of the visible list and keeps only the latest ten items.

## Public Commands discovery

The public Commands route lives at `/commands` and is accessible without authentication. It is server rendered, uses real GET URLs, and does not expose Workshop controls.

- Search parameter: `q`
- Searchable fields: public display name and public request text
- Search normalization: trim leading/trailing whitespace, collapse repeated whitespace, strip unsafe control characters, and bound the query to `80` characters
- Search matching: case-insensitive partial matches through parameterized database queries
- Decision parameter: `decision=all`, `decision=approved`, `decision=coal`, or `decision=featured`
- Sort parameter: `sort=newest` or `sort=oldest`
- Pagination parameter: `page`
- Page size: fixed at `12` rulings
- Maximum accepted page: `1000`

Generated discovery links preserve only supported parameters in stable order: `q`, `decision`, `sort`, then `page`. Empty `q`, `decision=all`, `sort=newest`, and `page=1` are omitted from generated canonical-style paths, so `/commands?q=book&decision=approved&sort=newest&page=1` becomes `/commands?q=book&decision=approved`.

The Commands repository function selects only public-safe ruling fields: public id, display name, request text, decision, Santa response, created timestamp, and Featured status. It applies `visibility = public`, allowed decision values, the Featured-only filter when `decision=featured`, search filters, deterministic ordering, fixed limit, and bounded offset in the database. It does not return internal ids, report data, hidden reasons, moderation data, owner activity, IP-derived data, session data, or settings metadata.

Hidden rulings disappear from `/commands`, restored rulings return, deleted rulings are absent, and blocked submissions never appear because they are never stored as public rulings. Public search does not reveal whether hidden or deleted rulings would have matched.

Featured rulings remain searchable, pageable, shareable, and part of normal chronological browsing. They do not change default ordering unless the visitor explicitly uses the Featured-only filter.

The base `/commands` page may be indexed. URLs with `q`, `decision`, `sort`, or `page` emit `noindex, follow` and canonicalize to `/commands` so arbitrary search-result URLs do not become index targets. Search state lives only in the URL and current request; the app does not add search analytics, saved searches, cookies, profiles, popularity sorting, reactions, comments, personalized recommendations, trending algorithms, public tagging, or infinite scrolling.

The discovery page currently uses simple `ILIKE` search over display name and request text. Existing visibility-plus-created-at indexing supports the default browsing path, and no full-text or trigram migration is added in this release. This is designed for the current expected dataset size; a future larger dataset should revisit text-search indexes or cursor pagination before expanding public volume.

## Permanent ruling pages and sharing

- Final approved and coal outcomes live at `/rulings/[publicId]`.
- The route uses the stored public identifier rather than the internal database key.
- Each ruling page shows the visitor name, request, decision, stored Santa response, timestamp, and share actions.
- Public ruling pages now emit absolute Open Graph and Twitter image metadata for the current ruling when a canonical origin can be resolved from `SITE_URL`, local development, or a Vercel preview deployment host.
- Copy-link uses the canonical absolute ruling URL.
- Native sharing uses the Web Share API when the browser supports it.
- Unknown or invalid public identifiers return a friendly 404 experience.
- Blocked submissions never receive URLs, never become public pages, and never appear in metadata.

Completed approved and coal rulings are public and accessible to anyone with the URL.

## Crawling and indexing

- `public/robots.txt` allows the homepage, `/commands`, and public ruling routes.
- Workshop routes and API routes are disallowed from ordinary crawling.
- Workshop pages also emit `noindex, nofollow` metadata and `X-Robots-Tag` headers.
- Public dynamic share images under `/rulings/[publicId]/og.png` remain accessible for social preview consumers.
- `/sitemap.xml` includes `/` and `/commands`.
- The sitemap does not include search-result URLs, filter URLs, sort URLs, paginated Commands URLs, Workshop routes, API routes, private preview routes, or unbounded public ruling URLs.
- Parameterized Commands pages use page-level `noindex, follow` metadata rather than broad robots query-parameter rules.

## Dynamic social preview images

- Public ruling images render at `/rulings/[publicId]/og.png`.
- Public pages emit `og:image`, `og:image:width=1200`, `og:image:height=630`, `og:image:type=image/png`, ruling-specific alt text, `twitter:image`, and `twitter:card=summary_large_image`.
- Approved rulings use a clear `APPROVED BY SANTA` treatment and coal rulings use `SANTA CHOSE COAL`; the image never exposes report notes, hidden reasons, internal ids, or the configured random-coal percentage.
- Featured rulings keep the same dynamic image route and receive a subtle `FEATURED` treatment inside the generated image. The route still returns PNG.
- Canonical Santa artwork stays fixed at filesystem path `public/images/santa-solo.png` and browser URL `/images/santa-solo.png`.
- The renderer uses `@vercel/og`, which is built on Satori and Resvg for server-side 1200 x 630 PNG responses in the Astro server routes deployed through the Vercel adapter. It loads the committed Santa PNG and snow PNG from the local filesystem, converts them to in-memory data URLs, and caches those reads at module scope for warm server instances.
- The generated image uses `@vercel/og` default server-side font behavior rather than downloading Google Fonts per image request. This keeps rendering compatible with the current Astro and Vercel architecture, with the limitation that it visually approximates the public Germania One display font instead of depending on a runtime Google Fonts fetch.
- Text is normalized as plain text only, wraps deterministically, truncates with ellipses when necessary, and handles long unbroken strings without horizontal overflow.
- Successful public image responses use short shared caching with stale-while-revalidate, not immutable caching. Hidden, deleted, malformed, missing, and renderer-failure responses return `no-store`.
- Remote platforms may continue showing a previously cached social image until their own cache expires or is refreshed; hiding or deleting a ruling does not guarantee immediate third-party removal.

## Workshop share preview

- Owners can open `/workshop/rulings/[publicId]/share-preview` from a ruling detail page.
- The preview page is private, `noindex`, and `no-store`, and it shows the rendered image, metadata title, metadata description, image alt text, visibility status, canonical ruling URL, and the public image URL only when the ruling is still public.
- Hidden rulings render through the authenticated preview image route `/workshop/rulings/[publicId]/share-preview.png` and never expose the public `og.png` URL as an active share target.
- The preview flow intentionally omits editing controls and download controls.

## Local social-preview testing

1. Start the development server with `npm run dev`.
2. Create or use a valid public ruling.
3. Open `/rulings/[publicId]` and inspect the page source for `og:image`, dimensions, type, alt text, `twitter:image`, and `twitter:card`.
4. Open `/rulings/[publicId]/og.png` directly and confirm it returns PNG bytes with `Content-Type: image/png`.
5. Sign in to Santa's Workshop and open `/workshop/rulings/[publicId]/share-preview`.
6. Confirm the private preview image, metadata title, description, image alt text, visibility, and public image URL behavior.
7. Run `npm run build` and preview the production build.
8. Optionally verify the same ruling URL through a Vercel preview deployment and remember social platforms may cache previews independently.

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
- `SITE_URL` should be configured in production as `https://santa-commands-it.vercel.app` so ruling pages emit stable canonical metadata and Workshop login origin checks accept the canonical production origin.
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

Workshop-specific production variables:

- `WORKSHOP_USERNAME`
- `WORKSHOP_PASSWORD_HASH`
- `SESSION_SECRET`
- `RATE_LIMIT_SECRET`
- `SITE_URL=https://santa-commands-it.vercel.app`

Generate a replacement Workshop password hash with:

- `npm run workshop:hash`

Generate a strong session secret with a local tool such as:

- `openssl rand -base64 48`

## Migrations and deployment verification

- Apply local schema updates with `npm run db:migrate`.
- Seed initial configuration with `npm run db:seed:configuration`.
- Apply the same migration command against the production or preview database before expecting new submission or reporting code paths to work.
- Run the configuration seed once per environment after the new tables exist. Re-running it later is safe and will skip already-seeded rows.
- After deployment, verify the ruling flow and open `/images/santa-solo.png` and `/images/snow-black.png` directly to confirm both deployed asset paths are correct.
- Remember that `public/images/santa-solo.png` and `public/images/snow-black.png` are repository filesystem paths, while `/images/santa-solo.png` and `/images/snow-black.png` are the browser URLs.
- Any Vercel environment-variable change requires a new deployment before the new login or session configuration is live.

## Neon backup and migration safety

- Application data stored in Neon includes completed rulings, submission idempotency records, report records, Workshop sessions, owner activity, moderation rules, Santa settings, site settings, request availability, public copy, and response templates.
- Environment variables such as `DATABASE_URL`, `WORKSHOP_USERNAME`, `WORKSHOP_PASSWORD_HASH`, `SESSION_SECRET`, `RATE_LIMIT_SECRET`, `SITE_URL`, and `SITE_TIMEZONE` remain outside Neon and must be backed up through the deployment provider or password manager workflow.
- Visual assets such as `public/images/santa-solo.png` and `public/images/snow-black.png` remain in Git.
- Before applying migrations to production, create a Neon branch from the production branch using the Neon console or CLI.
- Point a local or preview deployment at the safety branch, run `npm run db:migrate`, then run `npm run db:seed:configuration`.
- Verify public submissions, `/workshop/reports`, settings pages, and dynamic share images against the branch before applying the same migration to production.
- If a migration fails, stop using the affected branch and restore through Neon-supported branch restore or point the application back to the previous known-good branch. This project does not implement a custom backup system.

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
- After changing `WORKSHOP_USERNAME`, `WORKSHOP_PASSWORD_HASH`, `SESSION_SECRET`, `RATE_LIMIT_SECRET`, or `SITE_URL`, trigger a fresh Vercel deployment and retest `/workshop/login`.

Preview deployment considerations:

- Preview URLs work because the same-origin check allows the current request origin in addition to the configured `SITE_URL`.
- Do not weaken origin validation beyond configured and request-local origins.
- Use preview deployments to validate CSP, Google Fonts loading, and database connectivity before promoting a release.

## Workshop login troubleshooting

- Open `/workshop/login`, not `/api/workshop/login`.
- After a valid login, the browser should finish on `/workshop`.
- After an invalid login, the browser should finish on `/workshop/login?error=credentials`.
- If the browser visibly ends on `/api/workshop/login`, inspect the deployment logs for that function invocation and verify the Workshop environment variables are set for the environment you are testing.
- If Workshop authentication works locally but not on Vercel, verify `WORKSHOP_USERNAME`, `WORKSHOP_PASSWORD_HASH`, `SESSION_SECRET`, `RATE_LIMIT_SECRET`, `DATABASE_URL`, and `SITE_URL` are configured for the correct Vercel environment and redeploy after any change.
- If `WORKSHOP_PASSWORD_HASH` needs to be regenerated, run `npm run workshop:hash` and update only the hash value in Vercel or your local `.env`.
- If `/workshop/reports` shows the private unavailable state, confirm migrations have run, the `ruling_reports` table includes the `public_id`, `reviewed_at`, `resolved_at`, and `resolution_note` columns, and the deployment is using the intended `DATABASE_URL`.
- If dynamic share images fail, verify `/images/santa-solo.png` and `/images/snow-black.png` return `200`, both files are PNG image data, and the server route `/rulings/[publicId]/og.png` returns `Content-Type: image/png` for a public ruling.

Safe Vercel log inspection:

- Review only the `/api/workshop/login` function logs for the affected deployment.
- Keep diagnostics at the level of error class, status, or failing stage.
- Do not print submitted usernames, passwords, password hashes, session tokens, or secrets into logs or screenshots.

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
- The Commands page uses the same public visual system with a server-rendered responsive card grid and simple wrapped pagination.
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

- `npm run test` covers validation, moderation normalization, rule duplication behavior, runtime configuration caching, stale settings conflicts, response-template safeguards, repository-safe public-ruling mapping, public Commands query parsing, discovery URL normalization, discovery repository behavior, canonical URL helpers, share payload utilities, environment validation, and safety-oriented edge cases without requiring a live database.
- `npm run test:e2e` uses a dedicated test-mode server strategy instead of a real Neon database, includes automated accessibility checks with Axe, and now exercises public Commands browsing, search, filters, sorting, pagination, metadata, sitemap behavior, responsive overflow checks, workshop dashboard ranges, moderation, settings, template, ruling, and report flows in the browser.
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
- Public Commands search covers display name and request text only.
- Public Commands does not support advanced search syntax, fuzzy matching, saved searches, popularity sorting, personalized recommendations, public analytics, comments, reactions, user profiles, user accounts, or infinite scrolling.
- Public Commands pagination uses a fixed page size of `12`.
- Offset pagination and simple `ILIKE` search are designed for the current expected dataset size, not an unbounded public archive.
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

- `v0.3.1`: Featured Commands, seasonal homepage messaging, and Workshop editorial controls
- `v0.3.2`: additional public sharing polish
- `v0.3.3`: lightweight Workshop operational insights
- `v0.3.4`: public experience refinement
- `v0.3.5`: `v0.3.x` stabilization
- `v0.2.6`: `v0.2.x` stabilization and launch polish
