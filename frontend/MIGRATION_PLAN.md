# Migration plan and functional inventory

## Decision

The current HTML remains the functional and visual specification. React now owns the 18 public-facing routes through lazy route modules, while root files, route directories, assets, scripts, output and deploy settings remain untouched. Authentication screens and the student command-center shell are now migrated without a live identity provider or fabricated account data. Student lesson/device, payment infrastructure, and admin content remain migration boundaries; no backend or server authorization change is included.

## Route inventory (30 source pages)

The machine-readable source mapping is `src/router/manifest.ts`; `npm test` verifies it against the actual HTML tree.

| Source                         | Existing route        | Future shell                      |
| ------------------------------ | --------------------- | --------------------------------- |
| index.html                     | / (also /index.html)  | Marketing                         |
| courses.html                   | /courses.html         | Marketing                         |
| videos.html                    | /videos.html          | Marketing                         |
| pricing.html                   | /pricing.html         | Marketing                         |
| about.html                     | /about.html           | Marketing                         |
| certifications.html            | /certifications.html  | Marketing                         |
| contact.html                   | /contact.html         | Marketing                         |
| testimonials.html              | /testimonials.html    | Marketing                         |
| scholarships.html              | /scholarships.html    | Marketing                         |
| login/index.html               | /login/               | Auth                              |
| signup/index.html              | /signup/              | Auth                              |
| payment/index.html             | /payment/             | Student/platform                  |
| checkout/index.html            | /checkout/            | Student/platform                  |
| activation/index.html          | /activation/          | Student/platform (alias retained) |
| account/activation/index.html  | /account/activation/  | Student/platform                  |
| account/devices/index.html     | /account/devices/     | Student/platform                  |
| private-booking/index.html     | /private-booking/     | Student/platform                  |
| level-test/index.html          | /level-test/          | Student/platform                  |
| live/index.html                | /live/                | Student/platform                  |
| lesson/index.html              | /lesson/              | Student/platform                  |
| admin/index.html               | /admin/               | Admin                             |
| admin/courses/index.html       | /admin/courses/       | Admin                             |
| admin/videos/index.html        | /admin/videos/        | Admin                             |
| admin/homework/index.html      | /admin/homework/      | Admin                             |
| admin/students/index.html      | /admin/students/      | Admin                             |
| admin/analytics/index.html     | /admin/analytics/     | Admin                             |
| admin/codes/index.html         | /admin/codes/         | Admin                             |
| admin/notifications/index.html | /admin/notifications/ | Admin                             |
| admin/comments/index.html      | /admin/comments/      | Admin                             |
| admin/leaderboard/index.html   | /admin/leaderboard/   | Admin                             |

Trailing-slashless platform URLs must resolve too. There is no current /dashboard or standalone student homework/exams route. StudentLayout provides an optional sidebar slot; new student navigation requires a later approved feature, not invented URLs.

## Rendering, styling and duplication

- Public pages: repeated HTML navbar/footer/brand, CTA links, buttons, badges, cards, empty states, filter controls.
- `styles.css`: public shared tokens, component styles, responsive overrides and page-scoped styles.
- `home-editorial.css`: current homepage presentation extensions; keep specificity and editorial ordering as visual specification.
- `platform.css`: imports shared styles and extends platform forms, lesson controls, admin sidebar, RTL and responsive shells.
- `script.js`: shared navigation, mobile menu, scroll/cursor/glow/reveal/counters, public form interactions, public course and video filters.
- `home-editorial.js`: Arabic word reveal, reduced-motion-aware entrances/parallax, configurable trust counters.
- `platform.js`: injects common header/footer and route-specific markup using body data-route, then initializes courseUI/lessonUI/formUI/testUI. Admin replaces the footer with its sidebar shell.
- `platform-data.js`: curriculum, grades, terms, bundles, components and explicit demo/empty data.
- `models/platform-models.js`: backend-ready documentation, not a working API.
- `platform.js` also contains legacy public renderers duplicated by the public HTML. Migrate the actual served public HTML, not those unused alternative renderers.
- Root `scripts/build.mjs` copies legacy sources/assets to dist/client. `scripts/validate.mjs` checks a subset of routes and basic syntax/markup, not full browser parity. `scripts/qa-local.mjs` is a separate browser QA helper.
- The new app has its own build/lockfile; do not merge build pipelines prematurely.
- Public pages still contain some English placeholder content. Record it as existing behavior; do not perform global copy cleanup in the foundation sprint.

## Navigation and shared layouts

Homepage navigation uses section anchors including hero, programmes, video-library, subscriptions, about-mr-ahmed and certifications. Footer links include courses category anchors. Preserve those IDs when the homepage and courses migrate; verify hash navigation even after filtering.
Platform nav uses existing public routes, level test, booking, activation and login, with additional live/devices mobile entries. Admin has ten existing sections. The scaffold exposes reusable Navbar/Sidebar/Footer inputs; these are foundations, not a claim that all page-specific nav variants have already been ported.
Marketing/Auth/Student/Admin layouts use shared primitives and RTL. Final shell parity must be visually approved before replacing HTML.

## Feature and form inventory

| Area                      | Existing behavior to preserve                                                                    | Integration boundary                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Public contact            | Placement request preparation, validation and local guidance                                     | No backend submission claim                          |
| Login/signup              | Preview forms, required fields, unconfigured-service notice                                      | No session provider or real auth                     |
| Curriculum                | Stage > grade > term > unit; unit/monthly/term/annual bundle selection                           | Current static data, nullable prices                 |
| Courses                   | Main/subcategory filters, school year/skill filters, hash targets                                | Preserve reset and empty states                      |
| Videos                    | Mode AND stage/term/unit, separate reel filters, reset, contextual empty states                  | Curated placeholders, no auto-sync                   |
| Lessons                   | Speed options, quality UI, timed sections, seek confirmation                                     | Actual streams/transcodes/DRM absent                 |
| Homework                  | Not opened/in progress/submitted; solution gate in local preview                                 | Server submission/ownership required                 |
| Comments/likes            | Local demonstration interactions                                                                 | API/moderation later                                 |
| Activation                | Code form and invalid/used/expired/success preview states                                        | Never grant real entitlements client-side            |
| Devices                   | Placeholder browser device/revoke and limit messaging                                            | Server device registry/session enforcement           |
| Payment/checkout          | Plans, promo fields, price placeholders                                                          | No checkout provider, fake discounts or live payment |
| Private booking           | Student/parent/grade/schedule/goal/notes form preview                                            | Request delivery not integrated                      |
| Level test                | Start/results placeholders, blur/visibility/fullscreen warning logs                              | No final questions/grading                           |
| Live                      | Upcoming/locked/empty session presentation                                                       | No conferencing integration                          |
| Admin                     | Courses/videos/homework/students/analytics/codes/notifications/comments/leaderboard placeholders | No protected operational admin                       |
| Notifications             | Composer title/message/group preview                                                             | No send provider                                     |
| Scholarships/testimonials | Respectful support and approval-required placeholders                                            | No donation process, fabricated quotes or results    |

Lesson 1.2 and Lesson 5.6 stay combined. Lesson 4 Story stays Coming Soon/locked. Preserve the `englishineSkipConfirm` local preference semantics when migrating; other in-memory demo state must not be presented as durable server state.

## Brand and component foundation

Existing palette: Midnight #071B46, Cobalt #04326D, Accent #0E4C92, Mist #B2BED6, Soft #F7FAFC and onyx surface variants. Existing Inter/Manrope/Playfair font stacks retained, with system Arabic fallback. Existing radii 4/8/14/22/36 and 72px navbar baseline mapped into the new styles. Official logo/favicon copied byte-for-byte.
Reusable primitives: Button/ButtonLink, Card, Input, Dialog/Modal, Badge, Avatar, Table, PageHeader, Section, Loading, EmptyState, ErrorState, StatsCard, ProgressCard, Navbar, Sidebar and Footer. Missing statistics use unavailable states, not invented zeroes. RTL logical properties, 44px controls, native modal focus handling, generated label IDs, reduced-motion and keyboard focus are baseline.
Do not replace page-specific visual compositions with generic cards during later migration.

## Migration order

1. Completed: migrate and parity-check all 18 public-facing routes at 1440/1280/1024/768/430/390/360, including public filters and mobile navigation.
2. Next: migrate Lesson and account-device routes while preserving local-demo boundaries and keyboard/motion behavior.
3. Then: migrate existing admin sections; integrate real auth/data only when separately authorized.
4. Final cutover: run full direct-route/link/assets/console/RTL/overflow verification, then replace legacy entry points only after approval. Do not remove source until replacements exist.

## Acceptance gates

- Foundation: install, lint, strict typecheck, format, route inventory tests and production build.
- Each migrated route: screenshot comparisons, keyboard/mobile nav, forms, filter/reset/empty state, assets, direct URL, deep-link/hash and console checks.
- Backend phase: server auth and RBAC, validated API contracts, entitlement/homework storage, device registry; later real streams/payment/notification providers.
- Never claim browser recording prevention, secure client-only gating, live payments, fabricated analytics, or authenticated admin without infrastructure.
