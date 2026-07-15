# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, and this project adheres to Semantic Versioning.

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
- Graceful Santa artwork integration that uses `public/images/santa.png` when supplied and a styled fallback when it is absent
- Accessible request-form shell with typed field limits, a live character counter, and a foundation-release status message
- README, changelog, favicon, and project documentation for local setup and future roadmap
