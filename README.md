# Santa Commands It!

`Santa Commands It!` is a theatrical holiday web application from Argon Collective LLC. Visitors ask Santa for something, the server makes the authoritative decision, completed rulings are stored in Neon Postgres, and the latest public commands render directly on the homepage.

## Release

- Current version: `v0.1.3`
- Current scope: server-rendered homepage, authoritative submission endpoint, Neon persistence, Drizzle schema and migrations, moderation-first ruling decisions, and automated test coverage

Completed rulings now persist across refreshes. Blocked submissions are still rejected before any database write.

## Product concept

Santa is warm, theatrical, self-important, and certain that his declarations settle the matter. Visitors ask for something, and Santa may:

- approve it with `SANTA COMMANDS IT!`
- reject unacceptable content before any ruling is stored
- award coal to an otherwise acceptable request

Completed approvals and coal rulings are public on the homepage. No account is required, but successful local submissions may appear in Santa's latest public commands.

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
6. Place the supplied Santa artwork at `public/images/santa.png`.
7. Generate and apply the schema migration:
   - `npm run db:generate`
   - `npm run db:migrate`
8. Start the development server with `npm run dev`.
9. Submit a request and confirm it appears in Santa's Latest Commands.

If `DATABASE_URL` is missing, the form remains usable but the server cannot persist rulings and the latest-commands section will show an unavailable message instead of crashing the page.

## Environment variables

- `DATABASE_URL`
  - Required for persisted rulings and database migrations
  - Must never use a `PUBLIC_` prefix
  - Must never be committed

Use `.env.example` as the local template.

## Available npm scripts

- `npm run dev` starts the Astro development server.
- `npm run build` creates the server build for the Vercel adapter output.
- `npm run preview` serves the production build locally.
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

## Santa image placement

The supplied vintage-style Santa illustration is expected at:

`public/images/santa.png`

Do not replace it with generated or downloaded artwork in this repository.

## Server-side submission flow

In `v0.1.3`, the browser performs basic validation and then submits to `POST /api/rulings`.

The server then:

1. Validates the incoming JSON payload again.
2. Trims and re-checks both the name and request.
3. Moderates both fields.
4. Rejects blocked content without saving it.
5. Runs the random-coal decision only for acceptable requests.
6. Selects and formats Santa's response on the server.
7. Persists approved or coal rulings in Neon through Drizzle.
8. Returns safe ruling data to the browser.

The browser updates the response panel and inserts the new ruling at the top of Santa's Latest Commands without a full page reload.

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

## What is never stored

- blocked submissions
- moderation-match details
- internal database IDs in browser responses
- email addresses
- account data
- application-level IP address storage
- device fingerprints

Blocked content is rejected before any database write.

## Moderation and random coal

Moderation rules remain editable in `src/config/moderation.ts`, but they are now enforced authoritatively on the server.

Santa settings remain editable in `src/config/santa-settings.ts`, including:

- random coal enabled state
- random coal percentage
- considering delay range
- recent-ruling list limit
- configured display timezone for recent ruling timestamps

The initial coal percentage remains `5%`.

## Latest commands behavior

- The homepage fetches the newest public rulings on the server during rendering.
- The latest-commands section shows a real semantic list when rulings exist.
- The empty state still works for a brand-new database.
- If recent-ruling loading fails, the homepage stays usable and shows a quiet unavailable message.
- After a successful submission, the browser inserts the new ruling at the top of the visible list and keeps only the latest ten items.

## Astro rendering and deployment

- The project now uses Astro server rendering with the official Vercel adapter.
- Database access exists only in server-side modules under `src/server/`.
- `DATABASE_URL` is never exposed to client-side code.
- Production builds output Vercel-compatible server artifacts rather than a static site.

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
- Sufficient contrast at 200% zoom

## Testing

- `npm run test` covers validation, moderation normalization, coal decisions, server submission flow, and public-ruling mapping without requiring a live database.
- `npm run test:e2e` uses a dedicated test-mode server strategy instead of a real Neon database.
- `npm run build` verifies the server-rendered production output.

Test precautions:

- Do not point ad hoc integration tests at a production Neon database.
- The standard test suite does not require destructive database access.
- If you add database integration tests later, use a dedicated test database and explicit cleanup.

## Current limitations

- No shareable individual ruling pages exist yet.
- No social metadata exists for individual rulings yet.
- No rate limiting exists yet.
- No reporting tools or admin deletion tools exist yet.
- No authentication or user accounts exist yet.
- Completed public rulings remain stored until manually removed through database tools.
- Client-side moderation is no longer authoritative, but server-side moderation still needs future launch hardening such as rate limiting and abuse controls.

## Ownership and credits

- `Santa Commands It!` is a project from Argon Collective LLC.
- The compact left-rail footer carries the site attribution without turning ownership into part of the Santa joke.

## Roadmap

- `v0.1.4`: Individual shareable ruling pages and social metadata
- `v0.1.5`: Abuse protection, rate limiting, reporting, and security hardening
- `v0.1.6`: Accessibility, performance, deployment, and stabilization
