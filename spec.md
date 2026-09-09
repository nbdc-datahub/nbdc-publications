# NBDC Publications — Product Spec

Status: draft (created 2026-08-11; multi-study since 2026-09-09)
Owner: nbdc-datahub
Repo: `nbdc-datahub/abcd-publications` (named before the site broadened to the NBDC portfolio)

This is the product contract: what is *correct*. `Plans.md` is the task ledger.
Precedence: `spec.md` > sub-spec > `Plans.md`.

---

## 1. Purpose

A **fully static** website that lets researchers browse, filter, visualize and export the
catalog of publications that use data from the NBDC studies.

It replaces the R Shiny app at <https://abcd-study.shinyapps.io/abcd-publications/>, which
covered ABCD alone.

No backend, no server-side compute, no database. Everything ships as static files served
from GitHub Pages; all filtering happens in the browser.

### 1.1 Studies

| id | Label | Study | State |
|----|-------|-------|-------|
| `abcd` | ABCD | Adolescent Brain Cognitive Development (ABCD) Study | 1,848 publications (2026-07-06 snapshot) |
| `hbcd` | HBCD | HEALthy Brain and Child Development (HBCD) Study | data collection in progress — 0 publications |

A study with zero publications is a **normal, supported state**, not a degenerate one. HBCD
ships today as a header-only CSV, and every part of the pipeline and UI MUST behave
correctly for it. Adding a third study MUST be a data drop plus one entry in `STUDIES` — not
a schema change.

### 1.2 Why static

The dataset is small and changes a few times a year. A Shiny server costs money, sleeps, and
adds a cold-start latency that a 1 MB JSON file does not.

---

## 2. Deployment

| Item | Value |
|------|-------|
| Host | GitHub Pages (project pages, custom domain) |
| URL | `https://pubs.nbdc-datahub.org/` |
| Base path | `NEXT_PUBLIC_BASE_PATH=''` (served from the domain root) |
| Runner | `ubuntu-latest` (GitHub-hosted) |
| Trigger | push to `main`, plus `workflow_dispatch` |
| Publish | `peaceiris/actions-gh-pages@v4` → `gh-pages` branch, `publish_dir: web/out` |

`web/public/.nojekyll` MUST exist (Next.js emits `_next/` — Jekyll would drop it).

`web/public/CNAME` MUST exist and MUST contain exactly `pubs.nbdc-datahub.org`. It is the only
record of the custom domain inside the repo; because the publish step replaces the `gh-pages`
tree wholesale, a deploy without it would clear the domain in Pages settings.

The site owns its hostname, so it is served from the root and the base path is empty.
`NEXT_PUBLIC_SITE_URL` (which feeds `og:url`) names that origin. It previously served as a
project page at `software.nbdc-datahub.org/abcd-publications/`; GitHub redirects the old path
to the new domain.

All internal links MUST go through the base-path helper, so changing hostname — or reverting to
a project page under another domain — stays a change to `web/public/CNAME` plus the two build
variables.

---

## 3. Data contract

### 3.1 Source of truth (what a human commits)

```
data/portfolio_abcd.csv          ← ABCD input. Overwrite this file to publish new ABCD data.
data/portfolio_hbcd.csv          ← HBCD input. Header-only placeholder today.
data/portfolio.meta.json         ← per-study snapshot dates
data/docs/abcd_data-document.pdf ← per-study documentation PDF offered for download
```

**One file per study, all sharing one identical column contract.** This is the rule the
multi-study design rests on:

> No column name is study-specific. `Study.member`, never `ABCD.member`.

That is what makes a new study a data drop rather than a code change, and it is why a
divergent taxonomy cannot slip through — a study file whose header differs in any way fails
the same header check as a corrupt one.

Each file is a plain UTF-8, comma-separated, RFC-4180-quoted export. Column **names and order
must be preserved verbatim**, including names containing spaces, `.`, `&`, and `#`.

**Records span physical lines.** In the 2026-07-06 ABCD snapshot, 57 abstracts contain
embedded newlines and 70 fields contain embedded double quotes — 1,848 records occupy 2,037
physical lines. Every consumer MUST use a real RFC-4180 parser; splitting on `\n` silently
shreds the data. Record count is only ever established by parsing, never by counting lines.

Required columns (46, in order, identical for every study):

```
Pub.Year, Pub.Date, Title, Authors, Abstract, Journal.Name, URL, DOI, PMID,
Journal.Citation.Rate, Article.Citation.Rate, RCR, RCR.Is.Provisional, Total.Citations,
Cited.By.Clinical.Article, Clinical.Impact, Altmetric.Attention.Score, News.mentions,
Blog.mentions, Policy.mentions, Patent.mentions, X.mentions, Peer.review.mentions,
Facebook.mentions, Wikipedia.mentions, Google..mentions, Reddit.mentions, F1000.mentions,
Q.A.mentions, Video.mentions, Clinical.guidelines.mentions, Bluesky.mentions,
Podcast.mentions, Study.member, Domains, COVID, "Friends, Family, & Community", Genetics,
"Linked External Data", "Mental Health", MRI, NeuroCognition, "Novel Technologies",
"Physical Health", "Substance Use", "# domains"
```

Semantics the app depends on:

- `Pub.Year` — integer year; drives the year range control.
- `Study.member` — exactly `"yes"` or `"no"`: is an author a member of **that row's own study**
  consortium? Drives a filter and a chart series. The R export names this column
  `ABCD.member`; renaming it is step 2 of the republish workflow in §3.4.
- The 10 domain columns (`COVID` … `Substance Use`) — `0`/`1` flags, **not mutually
  exclusive**. `Domains` is the `;`-joined human-readable mirror. The taxonomy is shared
  across studies.
- `URL` — the row's publication identity, unique **within** a study. See §3.5.
- `Abstract` — may be empty (30 ABCD rows are today).

There is deliberately **no `Study` column in the source**. A row's study is established by
the file it came from, so an operator cannot mislabel it.

`data/portfolio.meta.json` carries one snapshot date per study; `null` means the study has
not published data yet:

```json
{ "studies": { "abcd": { "lastUpdated": "2026-07-06" }, "hbcd": { "lastUpdated": null } } }
```

**Validation gate:** the build MUST fail (non-zero exit, no deploy) if, for any study file,
a required column is missing or out of order, `Study.member` holds a value outside
`{yes,no}`, `Pub.Year` is not a 4-digit integer, a domain column holds a value outside
`{0,1}`, or `URL` repeats within that study. It MUST also fail if **every** study is empty.
It MUST NOT fail merely because *one* study is empty. A dropped column silently producing a
half-empty site is the failure mode being prevented.

### 3.2 Published artifacts (what the build generates)

Generated by `npm run prep` into `web/public/`; **not committed** (regenerated every deploy).

```
web/public/data/index.json          ← all 45 non-Abstract columns, columnar + dictionary encoded
web/public/data/studies.json        ← per-study id, label, name, rowCount, lastUpdated
web/public/data/abstracts/NN.json   ← 32 shards, abstracts only, keyed by row index
web/public/downloads/nbdc-pubs_unfiltered_<lastUpdated>.csv   ← prebuilt full export
web/public/downloads/<study>_data-document.pdf                ← one per study that has one
```

`studies.json` exists so the study banner (§4.5) and the About page can be rendered at
**build time** from real row counts, with no client fetch and no flash.

Rows are concatenated in `STUDIES` declaration order (ABCD, then HBCD). That order is part of
the contract: row index determines shard assignment, so a non-deterministic merge would
reshuffle every abstract shard on each build and invalidate every browser cache.

`index.json` shape:

```jsonc
{
  "lastUpdated": "2026-07-06",                 // most recent across studies
  "rowCount": 1848,
  "yearMin": 2018, "yearMax": 2026,
  "columns": ["Pub.Year", "Pub.Date", ...],    // the 46 source names, source order
  "studies": ["abcd", "hbcd"],                 // ids, in declaration order
  "domains": ["COVID", "Friends, Family, & Community", ...],  // 10, sorted as displayed
  "journals": ["Developmental cognitive neuroscience", ...],  // dictionary, ~410 entries
  "shardSize": 58,                             // rows per abstract shard
  "cols": {
    "study":      [0, 0, 1, ...],              // index into studies[]
    "year":       [2018, 2018, ...],
    "title":      ["...", ...],
    "authors":    ["...", ...],
    "journal":    [0, 0, 12, ...],             // index into journals[]
    "url":        ["...", ...],
    "member":     [1, 0, ...],                 // 1 = yes
    "domainMask": [4, 2, 33, ...],             // bit i set ⇔ domains[i] == 1
    "extra":      { "DOI": [...], "PMID": [...], ... }  // remaining columns, original names
  }
}
```

Rationale for the abstract split (measured on the 2026-07-06 snapshot):

| Payload | Raw | gzip |
|---------|-----|------|
| Full CSV (46 cols) | 4.19 MB | 1.29 MB |
| Abstract column only | 3.22 MB | 0.96 MB |
| Everything else | 0.98 MB | 0.29 MB |

Abstracts are **75% of the bytes and are needed by ~0% of page views** (only when a user
opens one modal). They are therefore excluded from first load and fetched lazily per shard.

### 3.3 Performance budget (deploy gate)

- `index.json` ≤ **350 KB gzipped**. Fails the build above that.
- A single abstract shard ≤ **60 KB gzipped**.
- First load transfers no abstract data.
- Filter → chart + table repaint: ≤ 150 ms on 1,848 rows (all in-memory array work).

GitHub Pages compresses `.json` on the wire; the budget is measured on gzipped bytes.

### 3.4 Republishing (the operator workflow)

To publish new data for **one** study, without touching any other:

1. Drop the new export at `data/portfolio_<study>.csv` (same filename, overwrite).
2. **Rename the header `ABCD.member` to `Study.member`.** The R export still emits the old
   study-specific name; the contract requires the neutral one. The build fails by name if
   this is missed, so it cannot ship silently.
3. Set that study's date in `data/portfolio.meta.json` → `"abcd": {"lastUpdated": "2026-11-01"}`.
4. Commit and push to `main`.

CI parses every study file, validates it, regenerates every artifact in §3.2, runs the test
suite and the size gate, builds the static export, and publishes. No other file needs
editing. If any CSV is malformed the deploy fails loudly and the live site keeps its data.

To add a **new** study: add an entry to `STUDIES` in `web/lib/data.ts`, drop
`data/portfolio_<id>.csv` (46 columns, header-only is fine), add its key to
`data/portfolio.meta.json`, and optionally add `data/docs/<id>_data-document.pdf`. Nothing
else — the filter, the table column, the charts and the exports all read `STUDIES`.

### 3.5 Row identity

The selection and export key is **`<study>:<URL>`**, not `URL` alone.

`URL` is unique within a study, but a publication that uses both ABCD and HBCD data
legitimately appears in both files. Keyed on `URL` alone, such a paper would collapse two
rows into one selection entry and silently over- or under-export. The composite key keeps
both rows independently addressable.

A URL appearing in more than one study therefore emits a build **warning** naming both
studies — not a failure. It is valid data worth noticing, not a defect.

---

## 4. Features

Parity with the Shiny app unless noted. Layout may differ; capability may not.

### 4.1 Filters (sidebar / filter rail)

| Control | Behavior |
|---------|----------|
| **Study** | Multi-select over `STUDIES`; **all studies selected by default**. First control in the rail. |
| Research domain(s) | Multi-select over the 10 domains |
| Match type | `ANY` (default) / `ALL` of the selected domains |
| Clear domain selections | Resets domain multi-select only |
| Study member | Checkbox group `yes` / `no`, both checked by default |
| Publication year | Range slider, `yearMin`–`yearMax` from the data (never hardcoded) |
| Reset (year) | Restores the full year range |
| Clear all filters | Resets every control above **and** the table search |

Study filtering uses a bitmask over `STUDIES`, mirroring the domain bitmask rather than
introducing a second filtering idiom. Deselecting every study matches nothing, and says so —
the same hint the member checkboxes already use.

Domain filtering uses the domain bitmask: `ANY` ⇔ `mask & sel`, `ALL` ⇔ `(mask & sel) === sel`.

Filter state is shareable via the query string, including `?studies=abcd`. Parameters at
their default are omitted; unknown study ids in a pasted URL are ignored, never fatal.

### 4.2 Charts (Plotly, `plotly.js-basic-dist-min`)

Both recompute from the currently filtered rows, so both honour the study filter without
knowing it exists.

1. **Publications by Research Domain** — horizontal bar, counts per domain, descending.
   Selected domains use the accent color, unselected use a muted gray. Subtitle: "Categories
   are not mutually exclusive". Count labels at bar ends.
2. **Publications by Year** — vertical bar stacked by study membership, per-segment counts
   inside segments and a bold total above each bar.

Both render side-by-side on wide viewports and stack below ~1450 px. Empty filtered set → an
explicit "No matching records" state, not a blank canvas.

### 4.3 Table (TanStack Table v8, `@tanstack/react-table`)

Columns: select checkbox, **Study**, Year, Title (link to `URL`, new tab), Abstract (View
button), Authors (truncated, full text on hover/title), Journal.

Study is the first *data* column — the select checkbox precedes it because it is a control,
not data. It renders the study label (`ABCD`) and sorts.

- Global search box + "Clear Search", client-side over the visible columns.
- Sortable columns, page size selector, pagination (default 10/page).
- Row selection by checkbox **or** row click (excluding clicks on links/buttons).
  Selection persists across pagination and search, keyed by `<study>:<URL>` (§3.5).
- "N rows selected" + "Clear selections" appear only when selection is non-empty.
- Abstract "View" opens a modal with the full abstract text, fetching the row's shard on
  demand; shows a loading state and an error state if the fetch fails. Closable by
  Escape, backdrop click, and a Close button; focus is trapped and restored.

### 4.4 Downloads (CSV only — no XLSX)

| Button | Contents |
|--------|----------|
| Download Filtered Data | Rows passing the sidebar filters, all 47 columns |
| Download Unfiltered Data | Every row — direct link to the prebuilt static CSV |
| Download All Search Results | Rows passing filters **and** the table search, all 47 columns |
| Download Selected Rows | Checked rows only, all 47 columns; hidden when nothing is selected |
| Documentation | One static link per study that ships a PDF |

Exports carry **47 columns: a derived `Study` first, then the 46 source columns in source
order.** `Study` holds the study label (`ABCD`). It is derived rather than copied, so an
export always says which study each row came from even though no source file has that column.

Filenames: `nbdc-pubs_filtered_<today>.csv`, `nbdc-pubs_unfiltered_<lastUpdated>.csv`,
`nbdc-pubs_search_<today>.csv`, `nbdc-pubs_selected_<today>.csv`. (`abcd-pubs_*` before the
site broadened; the rename is deliberate and breaks scripts that hardcoded the old names.)

Any export other than the prebuilt unfiltered file includes `Abstract` and therefore
requires all 32 shards. The app fetches them in parallel on first such download, showing a
"Preparing download…" state; subsequent exports reuse the cached shards.

CSV writing MUST quote fields containing `,`, `"`, `\r`, or `\n`, and escape `"` as `""`.
Source column order and header names MUST match the study CSVs byte-for-byte after the
`Study` column.

### 4.5 Chrome

- Header: title "Publications Using NBDC Data", "Last updated <lastUpdated>", total
  publication count, light/dark theme toggle.
- **Study banner**, immediately below the navbar: a small, non-sticky, informational note
  naming any study whose data is still being collected — "HBCD data is still being
  collected; no HBCD publications are listed yet."
  It is rendered from `studies.json` at build time and keyed on `rowCount === 0`, so it
  **disappears on its own** when a study's first publications land. It is not an alert, and
  it does not print.
- Live count: "Showing N publications" / "No matching records found."
- An About page describing the studies, the dataset, the domain taxonomy, and the refresh
  cadence.

"ABCD" appears in the UI only where it names the ABCD Study itself.

### 4.6 Explicitly out of scope

- XLSX export (dropped by decision — CSV opens in Excel).
- Server-side search, user accounts, saved queries, an API.
- Per-study domain taxonomies — all studies share the 10 domains (§3.1).
- Splitting the charts by study — the study filter already scopes them.
- Renaming the GitHub repository.

---

## 5. Design

Reuses the `abcd-ror` design system (`/home/lz/Desktop/lz100/website/abcd-ror/web`) so the
two NBDC sites read as one family:

- Tailwind v4 with `@theme inline` tokens; the exact `:root` / `.dark` token block from
  `abcd-ror/web/app/globals.css` (indigo `#6366f1` → violet `#8b5cf6` accents, near-black
  `#08090c` dark surface, `--border`, `--muted`, `--shadow`).
- `.glass-card`, `.gradient-text`, `.btn-primary`, `.focus-ring` utilities; the fixed
  ambient radial-gradient `body::before` aura.
- Geist via `next/font/local` (the `geist` package) — no runtime CDN font.
- `next-themes` class-strategy dark mode with the same `ThemeToggle`.
- `fadeUp` / `fadeIn` entrance animations, all disabled under `prefers-reduced-motion`.
- Plotly traces MUST read their colors from the CSS tokens and re-render on theme change,
  so charts are legible in both themes.

Accessibility: keyboard-operable filters, table and modal; visible focus rings; the year
slider has a labeled numeric fallback; charts carry a text summary for screen readers;
color is never the sole carrier of the selected/unselected distinction in the domain chart.
Each study checkbox is labelled with the study's full name for screen readers.

Responsive: filter rail collapses to a disclosure panel below `md`; charts stack below
~1450 px; the table scrolls horizontally on narrow screens.

---

## 6. Tech stack

| Concern | Choice | Note |
|---------|--------|------|
| Framework | Next.js 16 App Router, `output: 'export'` | abcd-ror is on 15; same config |
| UI | React 19, TypeScript strict | |
| Styling | Tailwind CSS v4 | tokens copied from abcd-ror |
| Charts | `plotly.js-basic-dist-min` + `react-plotly.js/factory` | loaded via `next/dynamic`, `ssr: false` |
| Table | `@tanstack/react-table` v8 (`useReactTable`) | v9 is beta; stay on v8 |
| Theme | `next-themes` | |
| Lint/format | Biome | root `biome.json` copied from abcd-ror |
| Tests | Vitest | pure logic + prep pipeline |
| Data prep | `tsx scripts/prep.ts` | Node 20, no R at build time |

**No R in CI.** The `.rds` is converted to CSV once, by hand, and CSV is the contract from
then on. The `.rds` itself is **not committed** (`*.rds` is git-ignored) —
`data/portfolio_<study>.csv` is the committed source of truth; `legacy/app_MAIN.R` is kept
for provenance.

---

## 7. Repository layout

```
data/portfolio_<study>.csv   source CSV per study (committed)
data/portfolio.meta.json     per-study snapshot dates
data/docs/                   per-study documentation PDFs
scripts/prep.ts              CSVs → published artifacts
scripts/*.test.ts            prep + validation tests
web/                         Next.js app (app/, components/, lib/, public/)
legacy/                      app_MAIN.R + the original .rds (reference only)
.github/workflows/deploy_pages.yml
biome.json  vitest.config.ts  package.json (root tooling)
```

The Shiny app is retired to `legacy/` — kept for provenance, not run, not deployed.
`web/public/data/`, `web/public/downloads/`, `web/out/`, `.next/` are git-ignored.

---

## 8. Quality gates (all must pass before publish)

1. `npm run lint` — Biome, 0 errors.
2. `npm test` — Vitest, all green. Covers: CSV parse/validate, per-study validation including
   the empty-study case, columnar encoding round-trip (encode→decode reproduces the source
   rows exactly), study and domain bitmask filtering, composite row identity, CSV export
   escaping, shard index arithmetic.
3. `npm run prep` — schema validation on every real study CSV.
4. Size gate — `index.json` gzipped ≤ 350 KB.
5. `npm run build --prefix web` — type-check + static export succeed. Requires step 3 first:
   the study banner is rendered at build time from `studies.json`.

A failure at any step blocks the deploy; the previously published site stays up.
