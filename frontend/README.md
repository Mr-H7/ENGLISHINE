# Englishine React migration

React 19 + Vite + TypeScript + Tailwind CSS v4 implementation of the Englishine platform. The approved legacy HTML remains the visual and functional baseline while routes are migrated incrementally.

## Local commands

- `npm ci`
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run format:check`
- `npm test`
- `node scripts/verify-public.mjs` (requires the legacy server on 4173, React on 5187, and Edge CDP on 9335)

## Current migration status

Public-facing routes are React-owned, lazy-loaded route chunks. The auth experience now uses dedicated React screens for login, signup, password recovery/reset, and activation. The student application adds a responsive command-center route plus coherent course, homework, assignment, exam, certificate, progress, notification, profile, and support destinations. `/index.html` redirects to `/`.

The approved page documents remain immutable source specifications and are bundled into React during this parity-first migration. `LegacyDocumentPage` centralizes parsing, asset resolution, metadata transfer, lifecycle-safe behavior initialization, and route-scoped platform styling. Original assets are imported once through Vite's asset graph; no duplicate image copies are stored in this frontend.

Student lesson/device, payment infrastructure, and admin routes remain explicit migration boundaries. Their four shell layouts and reusable UI system remain available, with their Tailwind foundation injected only inside lazy shell routes so Tailwind reset styles cannot alter approved public pages.

## Quality boundaries

No backend, auth provider, entitlement, payment, upload, device enforcement, analytics, or notification integration is invented. Existing preview and empty states remain unchanged. Root HTML, styles, scripts, assets, build output, and deployment configuration are untouched.
