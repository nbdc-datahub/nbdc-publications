# NBDC Publications

A static website for browsing, filtering and exporting the catalog of publications that use
data from the NBDC studies.

**Live site:** <https://pubs.nbdc-datahub.org/>

| Study | State |
|---|---|
| [ABCD](https://abcdstudy.org/) — Adolescent Brain Cognitive Development | 1,848 publications (2026-07-06) |
| HBCD — HEALthy Brain and Child Development | data collection under way; no publications yet |

A study with no publications yet is a normal state, not a broken one: it still gets a filter
checkbox, and the site shows a small banner saying its data is still being collected. Both
disappear on their own once its first snapshot is published.

It replaces the R Shiny app formerly at `abcd-study.shinyapps.io/abcd-publications`, which
covered ABCD alone. There is no server: the whole dataset is published as static files and
filtered in the browser.

- **Product contract:** [spec.md](spec.md) — what is correct
- **Task ledger:** [Plans.md](Plans.md) — what is done and what is left

---

## How it fits together

```
data/portfolio_abcd.csv               ← one input per study (46 columns each, committed)
data/portfolio_hbcd.csv                 header-only until HBCD publishes
        │
        │  npm run prep   (parse → validate → merge → transform → size gate)
        ▼
web/public/data/index.json            ← 45 non-abstract columns, ~213 KB gzipped
web/public/data/studies.json          ← per-study row counts, read at build time
web/public/data/abstracts/00-31.json  ← 32 shards, fetched only when someone opens one
web/public/downloads/*.csv, *.pdf     ← prebuilt full export + per-study documentation
        │
        │  npm run build --prefix web  (Next.js static export)
        ▼
web/out/                              ← published to the gh-pages branch by CI
```

Abstracts are 75% of the dataset's bytes and are needed by almost no page view, so they never
ship with the page. Filtering, sorting, searching and pagination happen entirely in memory and
issue no network requests at all.

---

## Local development

**Prerequisites:** Node 20 or newer. (R is *not* needed — CSV is the contract.)

```bash
git clone git@github.com:nbdc-datahub/nbdc-publications.git
cd nbdc-publications

npm ci                  # root tooling: data pipeline, tests, lint
npm ci --prefix web     # the Next.js app

npm run prep            # REQUIRED FIRST — generates web/public/data/
npm run dev --prefix web
```

Then open <http://localhost:3000>.

> **Run `npm run prep` before `npm run dev`.** The generated data lives under
> `web/public/data/` and is git-ignored, so a fresh clone has none of it. Skip this step and
> the page loads but shows *"could not load index.json (HTTP 404)"*.

### Commands

| Command | What it does |
|---|---|
| `npm run prep` | Rebuilds the published data from every `data/portfolio_<study>.csv`. Fails loudly on a bad CSV. |
| `npm run dev --prefix web` | Dev server with hot reload on `localhost:3000`. |
| `npm run build --prefix web` | Production static export into `web/out/`. |
| `npm test` | Vitest — the data pipeline and every pure browser helper. |
| `npm run lint` | Biome lint + format check. |
| `npm run format` | Applies Biome formatting. |
| `npm run typecheck --prefix web` | TypeScript, no emit. |

To preview the real static export exactly as GitHub Pages serves it:

```bash
npm run build --prefix web
npx http-server web/out -p 8080 -c-1
```

Leave `NEXT_PUBLIC_BASE_PATH` unset, as production does — the site serves from the root of
its own domain (see [Deployment](#deployment)). Setting it to `/nbdc-publications` only
reproduces the *old* project-page layout.

### Layout

| Path | Contents |
|---|---|
| `data/` | The committed per-study source CSVs, their metadata, and `docs/` |
| `scripts/` | `prep.ts` (pipeline), `csv.ts` (RFC-4180 parser), `validate.ts` (schema gate) |
| `web/lib/` | Pure logic: data format, filtering, search, selection, exports, permalinks |
| `web/components/` | Dashboard, filter rail, charts, table, modal, downloads |
| `web/public/data/` | Generated — git-ignored, rebuilt on every deploy |
| `legacy/` | The retired Shiny app, kept for provenance. Not run, not deployed. |

---

## Publishing new data

This is the whole procedure. It needs no code changes and no developer. Each study is
published independently — refreshing ABCD never touches HBCD.

### 1. Replace that study's CSV

Save the new export over **`data/portfolio_<study>.csv`** — `data/portfolio_abcd.csv` or
`data/portfolio_hbcd.csv`. Same path, same filename, every time.

Every study uses the **same 46 columns**, with **exactly** these names in this order
(including the ones with spaces, `&` and `#`):

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

> **⚠ The one manual edit: rename `ABCD.member` to `Study.member`.**
> The R export still writes the old, study-specific name. No column name in this contract is
> study-specific — that is what lets a new study be a data drop instead of a code change — so
> the header must say `Study.member`. Miss it and the build fails by name; it cannot ship
> silently.

Also required: `Study.member` is only ever `yes` or `no`; `Pub.Year` is a 4-digit integer; the
ten domain columns are only `0` or `1`; and `URL` is unique **within** the file. A URL may
repeat across studies — a paper using two studies' data is listed once per study — and the
build only prints a notice for that.

There is deliberately **no `Study` column**: a row's study comes from the file it is in, so it
cannot be mislabelled. Exports add it back as the first of 47 columns.

Exporting from R reproduces this exactly:

```r
d <- readRDS("portfolio_forApp_<date>.rds")
names(d)[names(d) == "ABCD.member"] <- "Study.member"   # the rename above
write.csv(d, "data/portfolio_abcd.csv", row.names = FALSE, na = "", eol = "\n", fileEncoding = "UTF-8")
```

### 2. Update that study's snapshot date

`data/portfolio.meta.json` carries one date per study. `null` means the study has not
published yet:

```json
{
  "studies": {
    "abcd": { "lastUpdated": "2026-11-01" },
    "hbcd": { "lastUpdated": null }
  }
}
```

The most recent date across studies is shown on the site and names the full export
(`nbdc-pubs_unfiltered_2026-11-01.csv`).

### 2b. Documentation (optional)

Each study may ship its own PDF at `data/docs/<study>_data-document.pdf`. A study without one
simply gets no documentation link — nothing else changes.

### 3. Commit and push to `main`

```bash
git add data/
git commit -m "data: refresh to the 2026-11-01 snapshot"
git push origin main
```

That is the last manual step. CI installs dependencies, lints, tests, validates and rebuilds
the data, builds the static export, and publishes it to the `gh-pages` branch. The site
updates a couple of minutes later.

### If the run fails

The deploy is *designed* to fail rather than publish bad data, and **the live site keeps
serving the previous snapshot** whenever it does. Open the failed run under the repo's
**Actions** tab and read the failing step:

| Failing step | Meaning |
|---|---|
| `Prepare published data` | The CSV broke the contract. The message names the column and record, e.g. `column 17 must be "Altmetric.Attention.Score", found "Altmetric.Score"`. Fix the export and push again. |
| `Prepare published data`, size budget | The data outgrew the payload budget in [spec.md](spec.md) §3.3. Raise it deliberately, or move export-only columns into the lazy shards. |
| `Test` / `Lint` | A code problem, not a data problem. |

A CSV whose records span multiple physical lines is normal and fine — 57 abstracts contain
embedded newlines. Never count records with `wc -l`; parse the file.

---

## Adding a study

By design this is a data drop, not a code change — no column name is study-specific, and the
filter, the table column, the charts and the exports all read one list.

1. Add an entry to `STUDIES` in [`web/lib/data.ts`](web/lib/data.ts) — `id`, short `label`,
   full `name`. **Append it**; the declaration order fixes row indexes and therefore which
   abstract shard each row lands in, so reordering would invalidate every cached shard.
2. Add `data/portfolio_<id>.csv` with the same 46 columns. Header-only is fine — the study
   shows up in the filter and in the under-collection banner until it has rows.
3. Add its key to `data/portfolio.meta.json` with `"lastUpdated": null`.
4. Optionally add `data/docs/<id>_data-document.pdf`.

Then `npm run prep && npm test`. The banner, the Study filter, the Study column, the About
page and the exports all pick it up with no further edits.

---

## Deployment

| Item | Value |
|---|---|
| Host | GitHub Pages (project pages, custom domain) |
| URL | `https://pubs.nbdc-datahub.org/` |
| Branch | `gh-pages`, published by [`.github/workflows/deploy_pages.yml`](.github/workflows/deploy_pages.yml) |
| Trigger | Push to `main`, or **Actions → Build & Deploy → Run workflow** |
| Runner | `ubuntu-latest` |

### One-time repository setup

The workflow pushes to `gh-pages`, but Pages must be told to serve from it:

**Settings → Pages → Build and deployment → Source: *Deploy from a branch* → Branch:
`gh-pages` / `(root)` → Save.** Then tick **Enforce HTTPS**.

Without this the workflow goes green while the site 404s. It only needs doing once per
repository, so it is easy to miss after a fork or a re-create.

### The custom domain

The site serves from its own hostname, so it lives at the root and `NEXT_PUBLIC_BASE_PATH`
is empty. Two files carry that:

1. [`web/public/CNAME`](web/public/CNAME) — the hostname. Next copies `public/` verbatim into
   `web/out/`, so every deploy re-asserts the domain instead of letting the publish step clear it.
2. [`.github/workflows/deploy_pages.yml`](.github/workflows/deploy_pages.yml) —
   `NEXT_PUBLIC_BASE_PATH: ''` and `NEXT_PUBLIC_SITE_URL: https://pubs.nbdc-datahub.org`.

Outside the repo, a DNS `CNAME` record for `pubs` must point at `nbdc-datahub.github.io`, and
**Settings → Pages → Custom domain** must be set to the hostname with **Enforce HTTPS** ticked.

To move to a *different* hostname, change those two files plus DNS — every internal link goes
through a base-path helper, so nothing else needs touching. To go back to a project page under
another domain, delete `web/public/CNAME` and set `NEXT_PUBLIC_BASE_PATH: /nbdc-publications`.

---

## Notes

- **Dependencies.** `npm audit` is clean at both the root and in `web/`. Next 15 carried 3 high
  advisories through bundled `postcss` and optional `sharp`; the app runs on Next 16, which
  clears them.
- **Privacy.** No backend, no analytics, no cookies. Nothing is recorded about what visitors
  search for or download.
- **The `.rds` is not committed.** `data/portfolio_<study>.csv` is the source of truth;
  `legacy/app_MAIN.R` is kept only for provenance.
