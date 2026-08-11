# ABCD Publications

A static website for browsing, filtering and exporting the catalog of publications that use
data from the [ABCD Study](https://abcdstudy.org/).

**Live site:** <https://nbdc-datahub.github.io/abcd-publications/>

It replaces the R Shiny app formerly at `abcd-study.shinyapps.io/abcd-publications`. There is
no server: the whole dataset is published as static files and filtered in the browser.

- **Product contract:** [spec.md](spec.md) — what is correct
- **Task ledger:** [Plans.md](Plans.md) — what is done and what is left

---

## How it fits together

```
data/portfolio.csv                    ← the input you replace (46 columns, committed)
        │
        │  npm run prep   (parse → validate → transform → size gate)
        ▼
web/public/data/index.json            ← 45 non-abstract columns, ~213 KB gzipped
web/public/data/abstracts/00-31.json  ← 32 shards, fetched only when someone opens one
web/public/downloads/*.csv, *.pdf     ← prebuilt full export + documentation
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
git clone git@github.com:nbdc-datahub/abcd-publications.git
cd abcd-publications

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
| `npm run prep` | Rebuilds the published data from `data/portfolio.csv`. Fails loudly on a bad CSV. |
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

Set `NEXT_PUBLIC_BASE_PATH=/abcd-publications` before `build` to reproduce the deployed URL
structure; leave it unset for local previews served from the root.

### Layout

| Path | Contents |
|---|---|
| `data/` | The committed source CSV, its metadata, and the documentation PDF |
| `scripts/` | `prep.ts` (pipeline), `csv.ts` (RFC-4180 parser), `validate.ts` (schema gate) |
| `web/lib/` | Pure logic: data format, filtering, search, selection, exports, permalinks |
| `web/components/` | Dashboard, filter rail, charts, table, modal, downloads |
| `web/public/data/` | Generated — git-ignored, rebuilt on every deploy |
| `legacy/` | The retired Shiny app, kept for provenance. Not run, not deployed. |

---

## Publishing new data

This is the whole procedure. It needs no code changes and no developer.

### 1. Replace the CSV

Save the new export over **`data/portfolio.csv`** — same path, same filename, every time.

It must have all 46 columns, with **exactly** these names in this order (including the ones
with spaces, `&` and `#`):

```
Pub.Year, Pub.Date, Title, Authors, Abstract, Journal.Name, URL, DOI, PMID,
Journal.Citation.Rate, Article.Citation.Rate, RCR, RCR.Is.Provisional, Total.Citations,
Cited.By.Clinical.Article, Clinical.Impact, Altmetric.Attention.Score, News.mentions,
Blog.mentions, Policy.mentions, Patent.mentions, X.mentions, Peer.review.mentions,
Facebook.mentions, Wikipedia.mentions, Google..mentions, Reddit.mentions, F1000.mentions,
Q.A.mentions, Video.mentions, Clinical.guidelines.mentions, Bluesky.mentions,
Podcast.mentions, ABCD.member, Domains, COVID, "Friends, Family, & Community", Genetics,
"Linked External Data", "Mental Health", MRI, NeuroCognition, "Novel Technologies",
"Physical Health", "Substance Use", "# domains"
```

Also required: `ABCD.member` is only ever `yes` or `no`; `Pub.Year` is a 4-digit integer; the
ten domain columns are only `0` or `1`; and `URL` is unique across rows (it is the identity
used for row selection and exports).

Exporting from R reproduces this exactly:

```r
d <- readRDS("portfolio_forApp_<date>.rds")
write.csv(d, "data/portfolio.csv", row.names = FALSE, na = "", eol = "\n", fileEncoding = "UTF-8")
```

### 2. Update the snapshot date

`data/portfolio.meta.json`:

```json
{ "lastUpdated": "2026-11-01" }
```

This date is shown on the site and used to name the full export
(`abcd-pubs_unfiltered_2026-11-01.csv`).

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

## Deployment

| Item | Value |
|---|---|
| Host | GitHub Pages (project pages) |
| URL | `https://nbdc-datahub.github.io/abcd-publications/` |
| Branch | `gh-pages`, published by [`.github/workflows/deploy_pages.yml`](.github/workflows/deploy_pages.yml) |
| Trigger | Push to `main`, or **Actions → Build & Deploy → Run workflow** |
| Runner | `ubuntu-latest` |

### One-time repository setup

The workflow pushes to `gh-pages`, but Pages must be told to serve from it:

**Settings → Pages → Build and deployment → Source: *Deploy from a branch* → Branch:
`gh-pages` / `(root)` → Save.** Then tick **Enforce HTTPS**.

Without this the workflow goes green while the site 404s. It only needs doing once per
repository, so it is easy to miss after a fork or a re-create.

### Moving to a custom domain

Two changes, no code:

1. Add `web/public/CNAME` containing the hostname (e.g. `publications.abcdstudy.org`).
2. In [`.github/workflows/deploy_pages.yml`](.github/workflows/deploy_pages.yml), set
   `NEXT_PUBLIC_BASE_PATH` to `''` and `NEXT_PUBLIC_SITE_URL` to the new origin.

Then point a DNS `CNAME` record at `nbdc-datahub.github.io` and set the domain in Pages
settings. Every internal link goes through a base-path helper, so nothing else needs touching.

---

## Notes

- **Dependencies.** `npm audit` is clean at both the root and in `web/`. Next 15 carried 3 high
  advisories through bundled `postcss` and optional `sharp`; the app runs on Next 16, which
  clears them.
- **Privacy.** No backend, no analytics, no cookies. Nothing is recorded about what visitors
  search for or download.
- **The `.rds` is not committed.** `data/portfolio.csv` is the source of truth;
  `legacy/app_MAIN.R` is kept only for provenance.
