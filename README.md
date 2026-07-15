# Santa Commands It!

`Santa Commands It!` is a theatrical holiday web application in which Santa Claus will eventually judge incoming requests with outsized authority, arbitrary coal, and public rulings. This repository contains the first foundation release only.

## Release

- Current version: `v0.1.0`
- Current scope: visual system, homepage shell, accessible non-submitting request form, testing, and project tooling

Submissions, moderation, random coal logic, persistence, and public rulings are intentionally not implemented yet.

## Product concept

Visitors will eventually ask Santa for something. Santa may approve it by bellowing “SANTA COMMANDS IT!”, deny an otherwise acceptable request with coal, or reject inappropriate requests before they are stored or shown publicly.

Otherwise acceptable requests are planned to have a configurable chance of receiving coal, initially targeted at roughly `5%`.

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

If the Santa image is missing, the homepage will render a styled placeholder instead of a broken image.

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
- `npm run test:e2e` runs the Playwright smoke test.
- `npm run check` runs the primary pre-commit validation flow.

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

Do not replace it with generated or downloaded artwork in this repository. Add the provided file locally before final visual review.

## Design and typography

- The homepage uses `Germania One` from Google Fonts as the display typeface.
- The shared document head loads it from `https://fonts.googleapis.com/css2?family=Germania+One&display=swap`.
- The display-font token is `--font-display: "Germania One", system-ui, sans-serif;`.
- Germania One is used for high-impact display text only, including the site title, major headings, and Santa's speech-bubble proclamation.
- Body copy, form labels, helper text, inputs, textareas, counters, metadata, and disclaimers continue to use the readable body and UI font stacks.
- The visual system uses a lighter winter palette built around snowy blue-white, soft ivory, cool blue-gray, muted evergreen, charcoal, and restrained cranberry accents.
- Most grouping relies on spacing, soft surface shifts, and low-contrast shadows instead of obvious section outlines.

## Ownership and credits

- `Santa Commands It!` is a project from Argon Collective LLC.
- The site footer includes restrained Argon Collective LLC attribution without making ownership part of the Santa joke.

## Accessibility goals

- Semantic landmarks and headings
- Strong keyboard focus visibility
- Accessible labels, hints, and status messaging
- Character counter association for the request field
- Responsive layout down to narrow mobile widths
- Reduced-motion support
- Sufficient contrast without relying on color alone

## Testing

- Run `npm run test` for unit tests.
- Run `npm run test:e2e` for the browser smoke test.
- Run `npm run check` for the main validation suite.
- Run `npm run build` before release work is considered complete.

## Current limitations

- The form does not submit or persist data in `v0.1.0`.
- No moderation or Santa decision engine exists yet.
- No database or public ruling feed exists yet.
- No individual ruling pages exist yet.
- The site uses placeholder canonical site metadata until production hosting is known.

Blocked or inappropriate requests will eventually be rejected before storage and will not appear publicly.

## Roadmap

- `v0.1.1`: Complete submission interaction
- `v0.1.2`: Moderation and Santa decision engine
- `v0.1.3`: Database persistence and recent rulings
- `v0.1.4`: Individual shareable ruling pages
- `v0.1.5`: Abuse protection and hardening
- `v0.1.6`: Accessibility, performance, and stabilization
