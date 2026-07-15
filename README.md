# Santa Commands It!

`Santa Commands It!` is a theatrical holiday web application from Argon Collective LLC. Visitors ask Santa for something, Santa reviews the request locally in the browser, and he responds with approval, coal, or a moderation warning.

## Release

- Current version: `v0.1.2`
- Current scope: homepage experience, local request interaction, moderation-first decision flow, configurable random coal, testing, and project tooling

Nothing is persisted in this release. Refreshing the page resets the interaction.

## Product concept

Santa is warm, theatrical, self-important, and convinced that his rulings settle the matter. Visitors ask for something, and Santa may:

- approve it with `SANTA COMMANDS IT!`
- reject unacceptable content before any final ruling
- award coal to an otherwise acceptable request

Blocked submissions are not final rulings. They are rejected before storage or publication, and they are not shown in the public recent-commands area.

## Technology stack

- Astro
- TypeScript in strict mode
- Plain CSS with reusable design tokens
- Vitest
- Playwright
- ESLint
- Prettier
- npm

## Local setup

1. Use Node.js `22.22.3` or another compatible Node 22 release.
2. Install dependencies with `npm install`.
3. Place the supplied Santa artwork at `public/images/santa.png`.
4. Start the development server with `npm run dev`.

If the Santa image is missing, the homepage renders a styled placeholder instead of a broken image.

## Available npm scripts

- `npm run dev` starts the Astro development server.
- `npm run build` creates the production build in `dist/`.
- `npm run preview` serves the production build locally.
- `npm run lint` runs ESLint.
- `npm run format` formats the repository with Prettier.
- `npm run format:check` checks formatting without writing changes.
- `npm run typecheck` runs `astro check`.
- `npm run test` runs the Vitest unit suite.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run test:e2e` runs the Playwright browser suite.
- `npm run check` runs the main pre-commit validation flow.

## Project structure

```text
.
├── public/
│   ├── favicon.svg
│   └── images/
├── src/
│   ├── components/
│   ├── config/
│   ├── layouts/
│   ├── pages/
│   ├── scripts/
│   ├── styles/
│   └── utils/
├── tests/
│   ├── e2e/
│   └── unit/
├── CHANGELOG.md
├── astro.config.mjs
├── eslint.config.mjs
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── vitest.config.ts
```

## Santa image placement

The supplied vintage-style Santa illustration is expected at:

`public/images/santa.png`

Do not replace it with generated or downloaded artwork in this repository.

## Design and layout

- The desktop homepage uses a sticky two-column layout.
- The left rail holds the Santa artwork and the compact site footer.
- The right column stacks the opening Santa panel, the form, and the latest-commands placeholder.
- Mobile and tablet collapse into a normal top-to-bottom flow.
- The visual system uses a light winter palette of snowy blue-white, soft ivory, cool blue-gray, muted evergreen, charcoal, and restrained cranberry accents.
- Germania One is loaded from Google Fonts and used only for display text such as Santa-facing headings and rulings.
- Body copy, helper text, labels, counters, and form controls continue to use the readable body and UI font stacks.

## Interactive request flow

In `v0.1.2`, the homepage form is fully interactive in the current page session:

1. The visitor enters a name and a request.
2. The form validates required fields and length limits.
3. Santa checks the trimmed values against local moderation rules.
4. Blocked content is rejected immediately with a warning to revise the submission.
5. Acceptable submissions enter a short considering state.
6. Santa then approves the request or awards random coal.
7. The visitor can ask again without reloading the page.

All valid and acceptable requests remain local to the browser session. Nothing is saved, published, or added to the recent-commands section yet.

## Validation rules

- Name: required, trimmed, maximum `40` characters
- Request: required, trimmed, maximum `500` characters
- Validation errors are shown inline and focus moves to the first invalid field.
- The request counter updates live and adds visible warning text near the 500-character limit.

## Moderation and decision configuration

Editable Santa behavior lives in `src/config/`.

- `src/config/santa-settings.ts`
  - random coal on or off
  - random coal percentage
  - considering delay range
  - name and request limits
- `src/config/moderation.ts`
  - blocked words
  - blocked phrases
  - allowed exceptions
- `src/config/responses.ts`
  - opening copy
  - considering copy
  - approved responses
  - coal responses
  - blocked warning copy

The initial random coal percentage is `5%`.

To change coal behavior:

- Set `randomCoalEnabled` to `false` to disable coal entirely.
- Set `randomCoalPercentage` anywhere from `0` to `100`.

To update moderation:

- Add standalone terms to `blockedWords`.
- Add multi-word checks to `blockedPhrases`.
- Add known false-positive phrases or terms to `allowedExceptions`.

The repository only includes small placeholder moderation entries for testing. They must be reviewed and replaced before launch.

## Client-side moderation limitations

Moderation in `v0.1.2` runs only in the browser. This is useful for local interaction and tests, but it is not production-safe protection.

- Client-side checks can be bypassed.
- Blocked content is not stored or published in this release.
- The same moderation rules will need to run server-side before any future database write.

Server-side enforcement is planned for `v0.1.3` when persistence is introduced.

## Accessibility goals

- Semantic landmarks and headings
- Keyboard-friendly submission and ask-again flow
- Accessible labels, hints, inline errors, and status messaging
- Character counter association for the request field
- Clear approved, coal, and blocked states without relying on color alone
- Responsive layout down to narrow mobile widths
- Reduced-motion support
- Sufficient contrast at 200% zoom

## Ownership and credits

- `Santa Commands It!` is a project from Argon Collective LLC.
- The compact left-rail footer carries the site attribution without making ownership part of the Santa joke.

## Testing

- `npm run test` runs the unit suite for validation, moderation normalization, coal decisions, and the Santa decision engine.
- `npm run test:e2e` runs the browser suite covering validation, approval, coal, blocked submissions, ask-again behavior, and layout safety.
- `npm run check` runs the main validation flow.
- `npm run build` verifies the production build.

## Current limitations

- No database persistence exists yet.
- The recent-commands section remains an empty placeholder.
- No public feed or shareable ruling pages exist yet.
- No authentication or admin tooling exists yet.
- Moderation is client-side only and must not be treated as sufficient enforcement for a persisted product.

## Roadmap

- `v0.1.3`: Database persistence and recent rulings
- `v0.1.4`: Individual shareable ruling pages
- `v0.1.5`: Abuse protection and hardening
- `v0.1.6`: Accessibility, performance, and stabilization
