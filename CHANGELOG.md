# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, and this project adheres to Semantic Versioning.

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
- The committed Santa PNG now renders directly from `/images/santa.png` in every environment without a runtime placeholder fallback

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
- Santa artwork integration using the canonical `public/images/santa.png` asset path
- Accessible request-form shell with typed field limits, a live character counter, and a foundation-release status message
- README, changelog, favicon, and project documentation for local setup and future roadmap
