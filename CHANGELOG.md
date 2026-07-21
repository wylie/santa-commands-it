# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.3.4] - 2026-07-21

### Changed

- Repaired production Latest Answers and Browse Requests loading when the deployment can reach the database but the `rulings` table is still missing the later Featured Requests columns
- Repaired public ruling creation so ordinary approved and coal submissions can persist safely against that older schema while defaulting new rulings to non-featured
- Distinguished recoverable featured-column schema drift from genuine public-rulings outages, while keeping empty results and dependency failures separate
- Reduced coupling between public reads and submission-only configuration by preserving existing public rulings when templates or related runtime configuration are unavailable
- Improved typed submission diagnostics, database URL validation, and private Workshop health checks for rulings schema and public query readiness
- Added outage, schema-compatibility, environment, and browser coverage for public ruling availability

## [0.3.3] - 2026-07-20

### Added

- A grouped public ruling-actions panel that keeps `Share`, `Copy Link`, `Back to Requests`, and `Report` distinct while preserving the existing ruling page flow
- Workshop share-preview diagnostics for canonical ruling URLs, native-share title and text, public readiness status, seasonal mode, and private preview verification

### Changed

- Public sharing now uses one canonical ruling URL helper plus a deterministic share payload that truncates safely, strips unsafe controls, and stays bounded for browser share sheets
- Copy-link and native-share actions now provide clearer status feedback, pending-state protection, and a manual fallback field when automatic sharing or clipboard access fails
- Browser and unit coverage now exercise canonical share URLs, deterministic payload text, manual fallback behavior, and hidden-ruling preview diagnostics
- Repaired production `503` handling for public request submission by classifying configuration outages, database outages, and schema mismatches into sanitized dependency failures
- Repaired Santa's Latest Answers and `/commands` degradation so database or migration failures render an unavailable state instead of a misleading empty result
- Added private Workshop health checks for the public rulings schema and Latest Answers query path, plus documentation for the required `v0.3.1` rulings migration sequence

## [0.3.2] - 2026-07-20

### Added

- Manual seasonal public presentation controls with predefined `standard`, `festive`, `christmas-eve`, and `post-christmas` modes
- A dedicated Workshop Seasonal Settings page with greeting, status, countdown, restore-defaults, and version-protected save flows
- A shared public seasonal notice that can render on the homepage, `/commands`, and public ruling pages
- Countdown utilities that use the configured site time zone and whole calendar-day math
- Seasonal dashboard summary, configuration-health checks, and owner activity coverage

### Changed

- The old homepage-only seasonal greeting moved out of Santa Settings into the dedicated seasonal presentation flow
- Public ruling share images now apply a restrained seasonal-mode treatment without embedding stale countdown numbers or full owner text
- Documentation now covers seasonal modes, manual activation, countdown behavior, cache propagation, and the additive schema migration

## [0.3.1] - 2026-07-19

### Added

- Featured Requests editorial controls for hand-picking public rulings in Santa's Workshop
- Homepage Featured Requests section that shows up to three newest featured public rulings above Santa's Latest Answers
- Featured-only public Commands filtering through server-rendered discovery URLs
- Workshop featured management actions, dashboard count, and recent featured activity summary
- Subtle Featured treatment in dynamic ruling Open Graph images
- Automated coverage for feature toggles, public badges, filtering, dashboard counts, activity logging, and share images

### Changed

- Public ruling cards and ruling detail pages now expose featured status with accessible text while preserving chronological browsing behavior
- Project documentation now covers Featured Requests, simplified public navigation, seasonal homepage messaging, cache behavior, and the related schema migration
- Unified the Requests page with the homepage two-column layout and centralized the shared public shell
- Moved public navigation below Santa and kept the footer anchored to the left rail on desktop
- Removed redundant Requests-page Ask Santa CTA panels for empty and unavailable states
- Improved mobile stacking order and guarded desktop sticky-rail behavior for short viewports

## [0.3.0] - 2026-07-19

### Added

- Public Commands browsing page at `/commands` for viewing published public rulings beyond the homepage feed
- Public display-name and request-text search with server-side normalization and shareable query URLs
- Approved and coal decision filtering, newest and oldest sorting, and fixed server-side pagination
- Shared public ruling-card component used by the homepage Santa's Latest Answers section and the `/commands` page
- Simplified public navigation with `ASK SANTA`, `BROWSE REQUESTS`, and a direct homepage form anchor
- Clearer Browse Requests terminology across public navigation, `/commands`, and related metadata
- Static sitemap entry for `/commands`
- Automated unit and Playwright coverage for discovery query parsing, public-safe repository behavior, empty/error states, accessibility, responsive behavior, sitemap behavior, and Workshop visibility integration

### Changed

- Public discovery queries now select only public-safe fields, apply visibility and decision filters in the database, and avoid exposing hidden rulings, reports, moderation data, or internal ids
- Parameterized Commands URLs now emit `noindex, follow` and canonicalize to `/commands`

## [0.2.6] - 2026-07-19

### Changed

- Workshop Reports now fails closed into a private accessible unavailable state instead of surfacing an unhandled page error when the report queue cannot load
- Reports-page launch coverage now verifies the private noindex fallback, preserved Workshop navigation, and successful loading for normal report review flows
- Production-readiness documentation now reflects the `v0.2.6` launch-polish scope, current PNG asset requirements, deployment checks, cache behavior, and Neon backup guidance

## [0.2.5] - 2026-07-18

### Changed

- Dynamic ruling Open Graph images now use the canonical `public/images/santa-solo.png` artwork and the existing `public/images/snow-black.png` pattern treatment without external asset fetches
- Share-image text preparation now strips unsafe control and bidirectional control characters while preserving ordinary Unicode and emoji content
- Documentation and tests now cover the PNG Santa asset path, `@vercel/og` server rendering, cache behavior, Workshop previews, and third-party social cache limits

## [0.2.4] - 2026-07-18

### Added

- Dynamic Open Graph preview images for public ruling pages at `/rulings/[publicId]/og.png` with shared rendering logic, the canonical `public/images/santa-solo.png` artwork, and distinct approved or coal treatments
- Ruling-specific `og:image`, `og:image:width`, `og:image:height`, `og:image:type`, `og:image:alt`, `twitter:image`, and `twitter:card=summary_large_image` metadata on public ruling pages
- A private workshop preview flow at `/workshop/rulings/[publicId]/share-preview` plus an authenticated preview image endpoint for hidden or public rulings
- Deterministic text normalization, wrapping, and truncation utilities for share-image rendering safety across long input, emoji, and hostile plain-text content

### Changed

- Public share images now use short-lived shared caching with stale-while-revalidate instead of immutable caching so hidden or deleted rulings can stop serving after cache expiry
- Hidden, deleted, malformed, and unknown ruling image requests now fail closed with indistinguishable public 404 behavior and `no-store` error responses
- Workshop ruling detail pages now include direct share-preview access alongside the existing public-link workflow
- Automated coverage now checks share-image metadata, cache policy, and private workshop preview behavior in both unit and Playwright suites

## [0.2.3] - 2026-07-18

### Added

- An expanded private workshop dashboard at `/workshop` with server-side `7d`, `30d`, `90d`, and `all` date ranges
- Range-scoped ruling metrics, previous-period comparisons, daily or monthly trend summaries, and accessible trend tables without a heavy chart dependency
- Current-state report operations, moderation-rule counts, response-template counts, configuration-health checks, and bounded recent-ruling and recent-owner-activity summaries
- Focused aggregate repository methods plus dashboard unit, Playwright, and accessibility coverage for the new workshop operational view

### Changed

- Workshop dashboard metrics now distinguish selected-range ruling activity from all-time operational report counts
- Random coal reporting now compares the current configured coal percentage with the actual coal rate in the selected ruling range and calls out when random coal is disabled or settings changed during that range
- Dashboard section loading now fails independently so one unavailable query surfaces a warning without taking down the rest of the private owner page
- Environment templates and README guidance now document `SITE_TIMEZONE` and the expanded workshop dashboard behavior

## [0.2.2] - 2026-07-18

### Added

- A private workshop configuration area with moderation-rule management at `/workshop/moderation`, `/workshop/moderation/new`, and `/workshop/moderation/[ruleId]`
- Database-backed Santa settings at `/workshop/settings` with optimistic-concurrency protection for random coal changes
- Database-backed response-template management at `/workshop/settings/responses` for approved, coal, and blocked warning messages
- A private moderation tester that evaluates active rules without storing test content or creating rulings
- Additive schema support for `moderation_rules`, `santa_settings`, and `response_templates`
- An explicit idempotent configuration seed command at `npm run db:seed:configuration`
- Automated coverage for configuration caching, duplicate rule normalization, stale settings conflicts, template safeguards, and fail-closed runtime configuration errors

### Changed

- Public ruling submissions now load active moderation rules, current Santa settings, and active response templates from the server-side configuration service instead of source-edited production config
- Workshop navigation now includes dedicated Moderation and Santa Settings entries without exposing any configuration tools publicly
- Owner activity now records moderation-rule, Santa-settings, and response-template changes alongside the existing workshop audit history
- Runtime configuration now uses short-lived server-side caching with mutation-side invalidation and fail-closed behavior when required configuration cannot be loaded

## [0.2.1] - 2026-07-17

### Added

- A private workshop report-review queue at `/workshop/reports` plus per-report detail pages at `/workshop/reports/[reportId]`
- Opaque report public identifiers, review and resolution timestamps, private resolution notes, and related-public-id owner activity links for moderation history
- Report moderation actions for reviewed, dismissed, reopened, actioned, and hide-ruling-from-report flows, including automatic actioning of related open or reviewed reports on the same ruling
- Dashboard and navigation coverage for open report counts, reviewed reports, recent actioned reports, and rulings with multiple open reports
- Unit and Playwright coverage for report queue filtering, moderation transitions, report-driven ruling hiding, and ruling-side report summaries

### Changed

- Workshop ruling detail and list views now expose report summaries, open-report counts, latest-report timing, and direct report-queue entry points
- Owner activity now records report-focused moderation events alongside the existing workshop auth and ruling-management audit trail
- Project documentation and package metadata now describe the `v0.2.1` moderation-queue release

## [0.2.0] - 2026-07-17

### Added

- A private `Santa's Workshop` owner area at `/workshop` with a secure single-owner login, server-side session cookie, logout flow, and private noindex pages
- Owner dashboard summaries for total rulings, approved rulings, coal rulings, hidden rulings, open reports, recent rulings, and recent owner activity
- Searchable, filterable, paginated ruling management with private detail pages and owner-only hide, restore, and permanent-delete actions
- A persisted ruling-visibility model plus a private owner-activity audit log for login, logout, hide, restore, and delete events
- CSRF protection for authenticated workshop mutations and automated coverage for workshop auth, visibility, and ruling-management behavior

### Changed

- Public ruling queries, feeds, pages, report lookups, and duplicate replay behavior now exclude hidden rulings consistently
- Project configuration, environment templates, and operational scripts now cover workshop credentials, session secrets, and password-hash generation
- Documentation now tracks the start of the `v0.2.x` owner-administration milestone while preserving the existing public `v0.1.x` experience

## [0.1.5] - 2026-07-16

### Added

- Server-side submission rate limiting, duplicate detection, idempotency tracking, and lightweight bot defenses for `POST /api/rulings`
- Public ruling reports with typed reasons, optional notes, per-client report limits, and a dedicated `POST /api/rulings/[publicId]/reports` endpoint
- Privacy-preserving client-key hashing with `RATE_LIMIT_SECRET`, request-body size limits, safer JSON parsing, and same-origin API enforcement
- Global security headers and CSP coverage through Astro middleware
- Expanded automated coverage for reporting, abuse controls, duplicate handling, and security behavior

### Changed

- Homepage submissions now return friendly rate-limit, duplicate, and bot-rejected states without creating extra rulings
- Public ruling pages now include an inline report flow while keeping reporter details private
- Project documentation and environment setup now cover `RATE_LIMIT_SECRET`, abuse safeguards, and operational limits

## [0.1.6] - 2026-07-16

### Added

- Automated accessibility coverage with Axe for representative homepage, ruling-page, report, and not-found states
- Local Lighthouse review tooling for the homepage and a representative ruling page
- A dedicated pre-launch checklist for environment setup, moderation review, privacy checks, and final validation

### Changed

- Accessibility, keyboard, and live-region behavior were audited and refined across submission, sharing, reporting, and error states
- Responsive, short-viewport, forced-colors, and focus styling behavior were tightened for launch readiness
- Client-side submission and reporting flows now time out cleanly and preserve retry safety more reliably
- Environment, deployment, preview, metadata, and production-readiness documentation were expanded for the full `v0.1.x` milestone
- Submission persistence now uses a Neon HTTP-compatible atomic write path instead of an unsupported transaction call
- The committed Santa PNG now renders directly from `/images/santa-solo.png` in every environment without a runtime placeholder fallback

## [0.1.4] - 2026-07-15

### Added

- Permanent public ruling pages at `/rulings/[publicId]` for approved and coal outcomes
- Public-ID lookup support in the rulings repository and server service layer
- Post-submission `VIEW & SHARE` actions plus recent-feed links to permanent ruling pages
- Copy-link behavior, native Web Share support, and ruling-specific canonical metadata
- Friendly ruling-page 404 handling and expanded automated coverage for links, metadata, and sharing

### Changed

- Homepage-created rulings now expose their stable public URLs without leaving the page automatically
- Recent public rulings now act as entry points to shareable standalone ruling pages
- Layout and metadata utilities now build canonical URLs from configured site settings or safe local fallbacks
- Project documentation now covers public ruling URLs, `SITE_URL`, and the public nature of completed rulings

## [0.1.3] - 2026-07-15

### Added

- Neon Postgres and Drizzle integration with an initial `rulings` schema and committed migration
- Server-authoritative `POST /api/rulings` endpoint for validated, moderated Santa submissions
- Persisted public rulings with generated public identifiers, stored Santa responses, and created timestamps
- Server-rendered latest-commands query plus live client-side insertion after successful submissions
- Mocked end-to-end test mode for persisted rulings, blocked submissions, recoverable failures, and feed limits

### Changed

- Validation, moderation, and random-coal decisions now run authoritatively on the server
- The homepage now renders recent public rulings from persistence instead of a permanent placeholder
- The browser flow now submits to the server and treats response payloads as untrusted typed data
- Database and migration setup is now documented for local development and future schema changes

## [0.1.2] - 2026-07-15

### Added

- Typed Santa decision engine with explicit approved, random-coal, and blocked outcomes
- Editable Santa settings, moderation rules, and response-template configuration under `src/config/`
- Local moderation checks for both display names and request text, including blocked words, blocked phrases, and allowed exceptions
- Configurable random-coal behavior with a default 5 percent chance for otherwise acceptable requests
- Expanded automated coverage for normalization, moderation, coal decisions, and end-to-end browser interaction states

### Changed

- The request flow now validates, moderates, considers, and resolves locally without a page reload
- The main Santa response panel now supports opening, considering, approved, coal, blocked, and recoverable error states
- The ask-again flow now preserves the visitor's name while clearing the prior request
- Accessibility behavior now covers inline validation, blocked-submission focus handling, and live status announcements for local rulings

## [0.1.1] - 2026-07-15

### Added

- Functional local request submission flow with inline validation and live character counting
- Simulated Santa considering state before final local approval
- Approved-result presentation and ask-again interaction without persistence
- Early accessibility and browser-test coverage for the interactive request shell

## [0.1.0] - 2026-07-14

### Added

- Initial Astro project configuration with strict TypeScript, ESLint, Prettier, Vitest, and Playwright
- Reusable design-token foundation for color, typography, spacing, layout, motion, and focus states
- Responsive homepage with Santa portrait placement, speech bubble, introductory copy, and recent-rulings placeholder
- Santa artwork integration using the canonical `public/images/santa-solo.png` asset path
- Accessible request-form shell with typed field limits, a live character counter, and a foundation-release status message
- README, changelog, favicon, and project documentation for local setup and future roadmap
