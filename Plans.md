# ABCD Publications — Static Site Plans.md

Created: 2026-08-11
Spec: [spec.md](spec.md) (product contract; precedence `spec.md` > `Plans.md`)

Goal: replace the Shiny app at <https://abcd-study.shinyapps.io/abcd-publications/> with a
static Next.js site on GitHub Pages at `https://pubs.nbdc-datahub.org/` (Phase 8; it first
shipped as a project page under `software.nbdc-datahub.org/abcd-publications/`).

---

## Phase 0: Repo scaffolding & tooling baseline

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 0.1 | Move `app_MAIN.R` + `portfolio_forApp_2026-07-06.rds` to `legacy/`; move `abcd-pubs_data-document.pdf` to `data/`. Update `.gitignore` for `web/public/data/`, `web/public/downloads/`, `web/out/`, `.next/`, `node_modules/` [tdd:skip:file-moves-only] | `legacy/app_MAIN.R` and `data/abcd-pubs_data-document.pdf` exist; `git status` clean after commit; no build output tracked | - | cc:done [4681977] |
| 0.2 | Export `legacy/portfolio_forApp_2026-07-06.rds` → `data/portfolio.csv` via a one-off R command; write `data/portfolio.meta.json` with `{"lastUpdated":"2026-07-06"}` [tdd:skip:one-off-data-export] | Parsing `data/portfolio.csv` yields 1,848 records × 46 columns whose names match spec §3.1 verbatim, and every column is identical to the RDS after NA→`""` normalization (records span physical lines — count by parsing, not by `wc -l`) | 0.1 | cc:done [4681977] |
| 0.3 | Root tooling: `package.json` (scripts `prep`/`test`/`lint`/`format`), `biome.json` and `vitest.config.ts` copied from `abcd-ror`, `tsconfig.base.json`, Node 20 | `npm run lint` and `npm test` both exit 0 on the empty baseline | 0.1 | cc:done [4681977] |
| 0.4 | Scaffold `web/` — Next.js 15 App Router + React 19 + TS strict + Tailwind v4; `next.config.ts` with `output:'export'`, `trailingSlash:true`, `images.unoptimized`, basePath from `NEXT_PUBLIC_BASE_PATH`; add `web/lib/base-path.ts`; add `web/public/.nojekyll` | `npm run build --prefix web` produces `web/out/index.html` and `web/out/.nojekyll` | 0.3 | cc:done [4681977] |

## Phase 1: Data pipeline (`scripts/prep.ts`)

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 1.1 | CSV reader + schema validator: parse RFC-4180 CSV, assert the 46 required columns in order, assert `ABCD.member ∈ {yes,no}`, `Pub.Year` 4-digit int, domain flags ∈ {0,1}, rowCount > 0, and `URL` unique; non-zero exit with a named-column error message on failure [tdd:required] | Vitest: valid fixture passes; 6 malformed fixtures (missing column, bad member value, non-int year, domain=2, zero rows, duplicate URL) each fail with a message naming the offending column | 0.3 | cc:done [07e14a7] |
| 1.2 | Columnar encoder → `web/public/data/index.json` per spec §3.2 (journal dictionary, 10-bit `domainMask`, `extra` map preserving original column names) [tdd:required] | Vitest round-trip: `decode(encode(rows))` equals the source rows field-for-field for all 1,848 rows including empty/quoted values | 1.1 | cc:done [07e14a7] |
| 1.3 | Abstract sharding → `web/public/data/abstracts/NN.json`, 32 shards, `shardSize = ceil(rowCount/32)`; shard lookup is `floor(rowIndex/shardSize)` [tdd:required] | Vitest: every row index maps to a shard containing its abstract; concatenating shards in order reproduces the Abstract column exactly | 1.2 | cc:done [07e14a7] |
| 1.4 | Prebuilt exports: full CSV → `web/public/downloads/abcd-pubs_unfiltered_<lastUpdated>.csv` generated with the **same writer the browser uses**, so all four downloads share one quoting style; copy `data/abcd-pubs_data-document.pdf` → `web/public/downloads/` [tdd:required] | Re-parsing the generated CSV yields records field-for-field identical to parsing `data/portfolio.csv` (byte-identity was the original DoD but would only have tested a file copy — R quotes every string field, the shared writer quotes only when required); PDF present and non-zero size | 1.1 | cc:done [07e14a7] |
| 1.5 | Size gate in `prep`: gzip `index.json` and each shard, fail if index > 350 KB or any shard > 60 KB; print a size table [tdd:required] | Vitest with an oversized fixture exits non-zero; real data run prints index ≤ 350 KB gz and exits 0 | 1.2, 1.3 | cc:done [07e14a7] |
| 1.6 | Shared types + pure filter/encode helpers in `web/lib/data.ts` imported by both `prep` and the browser (single source of truth for the format) | `npm run build --prefix web` and `npm run prep` both compile against the same exported types; no duplicated shape definitions | 1.2 | cc:done [07e14a7] |

## Phase 2: Design system & app shell

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 2.1 | Port `abcd-ror` tokens into `web/app/globals.css`: `:root`/`.dark` variables, `@theme inline`, `.glass-card`, `.gradient-text`, `.btn-primary`, `.focus-ring`, ambient `body::before`, `fadeUp`/`fadeIn`, `prefers-reduced-motion` disable block [tdd:skip:css-only] | Light and dark render with the abcd-ror palette; `prefers-reduced-motion: reduce` suppresses all keyframe animation (verified in DevTools emulation) | 0.4 | cc:done [88b981b] |
| 2.2 | `ThemeProvider` + `ThemeToggle` (next-themes, class strategy) and Geist via `next/font/local`; header with title, "Last updated", total count [tdd:skip:thin-ui-wrapper] | Toggle switches themes with no flash on reload; no network request to a font CDN in the Network panel | 2.1 | cc:done [88b981b] |
| 2.3 | Data loading: fetch `index.json` through the base-path helper, decode into typed row objects, expose via context; skeleton + error state if the fetch fails [tdd:required] | Vitest covers decode + error path; app renders "Showing 1,848 publications" on load and a visible error message when the fetch 404s | 1.6, 2.2 | cc:done [88b981b] |

## Phase 3: Filters & charts

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 3.1 | Pure filter engine in `web/lib/filter.ts`: domain ANY/ALL over `domainMask`, `ABCD.member`, year range; returns filtered index array [tdd:required] | Vitest: ANY/ALL cases against a hand-checked fixture, empty-selection = pass-through, boundary years inclusive, all-filters-combined case | 2.3 | cc:done [88b981b] |
| 3.2 | Filter rail UI: domain multi-select, ANY/ALL radio, member checkboxes, year range slider bounded by `yearMin`/`yearMax` from data, Clear domains / Reset year / Clear all filters [tdd:skip:ui-wiring-covered-by-3.1] | Every control is keyboard-operable; "Clear all filters" restores defaults and clears the table search; collapses to a disclosure panel below `md` | 3.1 | cc:done [88b981b] |
| 3.3 | Domain chart: horizontal Plotly bar, descending counts, selected vs unselected coloring from CSS tokens, end-of-bar count labels, "not mutually exclusive" subtitle; `next/dynamic` `ssr:false` [tdd:skip:chart-rendering] | Renders the same per-domain counts as the Shiny app on the unfiltered data; re-themes on toggle; empty filtered set shows the empty-state message | 3.1, 2.1 | cc:done [88b981b] |
| 3.4 | Year chart: vertical Plotly bar stacked by `ABCD.member`, per-segment counts, bold total above each bar, legend "ABCD Member?" [tdd:skip:chart-rendering] | Per-year totals match the Shiny app on unfiltered data; re-themes on toggle | 3.1, 2.1 | cc:done [88b981b] |
| 3.5 | Chart layout: side-by-side ≥1450 px, stacked below; screen-reader text summary per chart [tdd:skip:layout-only] | Breakpoint verified at 1449/1451 px; each chart has an associated text summary in the a11y tree | 3.3, 3.4 | cc:done [88b981b] |

## Phase 4: Table, abstracts & exports

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 4.1 | TanStack Table v8: columns per spec §4.3, global search + Clear Search, sorting, pagination (default 10), page-size selector, "Showing N publications" live count [tdd:skip:covered-by-4.2-and-3.1] | Search/sort/paginate work over 1,848 rows; Title links open the DOI in a new tab | 3.1, 2.3 | cc:done [88b981b] |
| 4.2 | Row selection keyed by `URL`: checkbox + row-click toggle (ignoring clicks on `a`/`button`/`input`), persists across pagination and search; "N rows selected" + "Clear selections" shown only when non-empty [tdd:required] | Vitest on the selection reducer; manual: select on page 1, search, paginate, return — selection intact; count matches | 4.1 | cc:done [88b981b] |
| 4.3 | Abstract modal: lazy-fetch the row's shard, cache it, loading and error states; Escape / backdrop / Close all dismiss; focus trapped and restored to the triggering button [tdd:required] | Vitest on shard-index + cache logic; Network panel shows exactly one shard request per distinct shard; keyboard-only open/close round-trip works | 4.1, 1.3 | cc:done [88b981b] |
| 4.4 | CSV writer in `web/lib/csv.ts`: RFC-4180 quoting/escaping, original 46 headers in original order [tdd:required] | Vitest: fields with comma, double-quote, CR, LF, and empty values round-trip through a CSV parser back to the input | 1.6 | cc:done [88b981b] |
| 4.5 | Four downloads wired: filtered, unfiltered (direct static link), search results, selected rows; hide "selected" when empty; "Preparing download…" state while shards load; Download Documentation link [tdd:required] | Vitest on row-set selection for each variant; each download produces a 46-column CSV with the spec §4.4 filename; unfiltered issues no shard fetches | 4.2, 4.3, 4.4 | cc:done [88b981b] |

## Phase 5: Deploy

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 5.1 | `.github/workflows/deploy_pages.yml` on `ubuntu-latest`: checkout → Node 20 → `npm ci` (root + web) → `npm run lint` → `npm test` → `npm run prep` → `npm run build --prefix web` with `NEXT_PUBLIC_BASE_PATH=/abcd-publications` → **publish `web/out` to the `gh-pages` branch** via `peaceiris/actions-gh-pages@v4` with `GITHUB_TOKEN`; `concurrency: pages-deploy, cancel-in-progress`; triggers `push: [main]` + `workflow_dispatch` [tdd:skip:ci-config] | Push to `main` produces a green run, the `gh-pages` branch contains the built site incl. `.nojekyll`, and the project-pages URL serves working assets, charts and downloads | Phase 4 | cc:done [06c9423] |
| 5.2 | One-time repo config: GitHub Pages source = `gh-pages` branch, `/` root; document the click-path in the README so it survives a repo re-create [tdd:skip:repo-settings] | Pages settings point at `gh-pages`; the live URL returns HTTP 200 | 5.1 | cc:done [06c9423] |
| 5.3 | Failure-path proof: a deliberately malformed `data/portfolio.csv` on a branch fails the workflow at the `prep` step [tdd:skip:ci-config] | Workflow run fails at `prep` with a message naming the bad column; no publish step executes | 5.1 | blocked |
| 5.4 | **README — local development section**: prerequisites (Node 20+), `npm ci` (root) + `npm ci --prefix web`, `npm run prep` to generate `web/public/data/`, `npm run dev --prefix web` → `http://localhost:3000`, plus `lint` / `test` / `build` / `format` commands and a note that `prep` must run before `dev` or the app 404s on `index.json` [tdd:skip:docs-only] | A developer with a clean clone reaches a working local site using only the README, in the documented order | 0.4, 1.5 | cc:done [06c9423] |
| 5.5 | **README — data refresh & deployment section (end of file)**: the §3.4 procedure (overwrite `data/portfolio.csv`, update `data/portfolio.meta.json`, commit, push to `main`), what CI does with it, how to read a failed run, where the site lands (`gh-pages` → project URL), and the two-line custom-domain switch [tdd:skip:docs-only] | A non-developer can publish a new CSV using only the README; the custom-domain note names both files to change | 5.1, 5.4 | cc:done [06c9423] |

## Phase 6: Polish (Recommended, not blocking)

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 6.1 | Shareable filter permalinks: sync filter + search state to query params, restore on load [tdd:required] | Vitest on serialize/parse round-trip; pasting a copied URL reproduces the exact filtered view | 4.1 | cc:done [88b981b] |
| 6.2 | About page: dataset description, domain taxonomy, refresh cadence, link to the documentation PDF [tdd:skip:content-only] | `/about/` exports and is linked from the header | 2.2 | cc:done [88b981b] |
| 6.3 | A11y + perf pass: keyboard-only walkthrough of every control, Lighthouse a11y ≥ 95, first-load transfer verified to contain no abstract bytes [tdd:skip:audit-task] | Lighthouse a11y ≥ 95; Network panel confirms 0 requests to `data/abstracts/` on first paint | Phase 5 | cc:done [06c9423] |
| 6.4 | Evaluate the Next 16 bump. Next 15.5.23 carries 3 high advisories via bundled `postcss` and optional `sharp`; both are build-time-only and unreachable in a static export with `images.unoptimized` (no image optimizer, no attacker-controlled CSS), so this is hygiene, not exposure. Bump only if the static-export config survives it [tdd:skip:dependency-bump] | Either `npm audit --prefix web` reports 0 high with a green `npm run build --prefix web`, or a one-line note in the README records the accepted risk and why | Phase 5 | cc:done [06c9423] |

---

## Phase 7: Post-launch UI fixes

Raised after the first deployment (2026-08-11), from viewing the live site.

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 7.1 | Restore the Plotly mode bar (PNG download, zoom, autoscale). It was removed in 6.3 because its buttons were focusable inside an `aria-hidden` subtree; `.modebar-container` turns out to be a **child** of `.svg-container`, so hide the sibling `svg.main-svg` graphics individually and leave the mode bar exposed and named [tdd:required] | Mode bar visible on both charts with a working PNG download; Lighthouse accessibility stays at 100 with `aria-hidden-focus` passing; every mode-bar button has an accessible name | - | cc:done [5c5006b] |
| 7.2 | Widen the page container from `92rem` to `108rem` so 1080p desktops use the available width [tdd:skip:layout-only] | At a 1920px viewport the content spans ~1728px with balanced gutters; the layout is unchanged at ≤1472px | - | cc:done [5c5006b] |
| 7.3 | Make the abstract modal opaque — the glass surface let the page behind it show through and made the abstract text hard to read [tdd:skip:css-only] | The dialog paints a fully opaque `--card` background in both themes; no page content is visible through it; backdrop darkened | - | cc:done [5c5006b] |
| 7.4 | Point `NEXT_PUBLIC_SITE_URL` and the docs at the canonical origin. The site serves from `software.nbdc-datahub.org/abcd-publications/`; the github.io URL redirects there, so `og:url` currently advertises a redirecting URL [tdd:skip:config-only] | `og:url` on the deployed page equals the canonical origin; README and spec name it | - | cc:done [5c5006b] |

## Outstanding

- **5.3** — the CI failure-path proof is still unexercised. The happy path is now proven (the
  first push deployed successfully), but no run has yet been made to fail. The local
  equivalent is verified: renaming a column in `data/portfolio.csv` makes `npm run prep` exit
  1 with `column 17 must be "Altmetric.Attention.Score", found "Altmetric.Score"`, and the
  workflow runs `prep` before `build`, so nothing would be published. Proving it end-to-end
  needs one throwaway branch with a deliberately broken CSV.

## Planning record

- `team_validation_mode`: `manual-pass` — sub-agents not used (session instruction: do not
  call the Agent tool unless requested). Product / Architecture / Security / QA / Skeptic
  were evaluated individually; findings are folded into the spec and the DoDs above.
- Wheel-reinvention check: `abcd-ror` at `/home/lz/Desktop/lz100/website/abcd-ror` already
  solves static export + basePath + Plotly-partial-bundle + gh-pages publish + Biome/Vitest
  baseline. Phases 0 and 5 reuse its config rather than re-deriving it.
- Lint/formatter baseline: none in this repo today → task 0.3 establishes Biome + Vitest
  before any implementation task.
- Security: no secrets, no auth, no user data. The only credential is the workflow's
  built-in `GITHUB_TOKEN`. All published data is already public. `.env` was not read.
- Skeptic notes carried into the spec: (a) the 4 MB payload problem is really a 3.2 MB
  *abstract* problem — measured, hence the shard split; (b) a future CSV with a renamed or
  dropped column is the most likely way this breaks — hence the hard validation gate at 1.1
  and the failure-path proof at 5.2; (c) `URL` is assumed unique and is the selection key —
  if a future export duplicates it, selection and "download selected" silently over-select,
  so 1.1 should also warn on duplicate URLs.

## Phase 8: Move to a dedicated domain

The site gets its own hostname, `pubs.nbdc-datahub.org`, instead of living as a project page
under `software.nbdc-datahub.org/abcd-publications/`.

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 8.1 | Serve from `https://pubs.nbdc-datahub.org/`: add `web/public/CNAME`, set `NEXT_PUBLIC_BASE_PATH=''` and `NEXT_PUBLIC_SITE_URL=https://pubs.nbdc-datahub.org` in the deploy workflow, and retarget README + spec at the new origin [tdd:skip:config-only] | `web/out/CNAME` contains the hostname; built HTML references `/_next/...` and `/data/...` with no `/abcd-publications` prefix; `og:url` is the new origin; README and spec name it | - | cc:done [ba79221] |
