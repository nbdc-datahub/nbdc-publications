import type { Metadata } from 'next';
import Link from 'next/link';
import { documentationPath } from '../../lib/export';
import { readStudySummaries } from '../../lib/studies-build';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Which NBDC studies the catalog covers, how the research domains work, and how often it is refreshed.',
};

const DOMAINS = [
  'COVID',
  'Friends, Family, & Community',
  'Genetics',
  'Linked External Data',
  'Mental Health',
  'MRI',
  'NeuroCognition',
  'Novel Technologies',
  'Physical Health',
  'Substance Use',
];

export default function About() {
  const studies = readStudySummaries();

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">About this catalog</h1>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What this is</h2>
        <p className="text-sm leading-relaxed">
          A catalog of peer-reviewed publications that use data from the NBDC studies. Each entry
          carries bibliometrics (citation counts, relative citation ratio), Altmetric attention
          data, whether a member of that study is among the authors, and the research domains the
          work touches.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">The studies</h2>
        <ul className="space-y-3 text-sm leading-relaxed">
          {studies.map((study) => (
            <li key={study.id}>
              <strong>{study.name}</strong>
              <br />
              {study.rowCount === 0 ? (
                <span className="text-muted">
                  Data collection is still under way, so no {study.label} publications are listed
                  yet. They will appear here — and in the Study filter — as soon as the first
                  snapshot is published.
                </span>
              ) : (
                <span className="text-muted">
                  {study.rowCount.toLocaleString()} publications, as of {study.lastUpdated}.
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed">
          Use the <em>Study</em> filter to narrow the catalog to one study. All studies share the
          same research-domain taxonomy, so a domain filter means the same thing across them. A
          paper that uses more than one study&rsquo;s data is listed once per study.
        </p>
        <p className="text-sm leading-relaxed">
          The whole dataset is served as static files and filtered entirely in your browser — there
          is no server, no query log, and nothing is recorded about what you search for.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Research domains</h2>
        <p className="text-sm leading-relaxed">
          Publications are tagged with one or more of the ten domains below.{' '}
          <strong>The categories are not mutually exclusive</strong> — a paper on adolescent sleep
          and brain imaging counts under both, so the domain chart&rsquo;s bars sum to more than the
          number of publications.
        </p>
        <ul className="grid list-disc gap-1 pl-5 text-sm sm:grid-cols-2">
          {DOMAINS.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed">
          Use <em>Match ANY</em> to find work touching at least one selected domain, and{' '}
          <em>Match ALL</em> to find work at the intersection of every selected domain.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Refresh cadence</h2>
        <p className="text-sm leading-relaxed">
          The catalog is refreshed periodically as new publications are identified and bibliometrics
          are recomputed. The date shown on the main page is the snapshot date of the data currently
          published, not the date you are viewing it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Column documentation</h2>
        <p className="text-sm leading-relaxed">
          Exports contain a <code>Study</code> column naming the study each row came from, followed
          by all 46 source columns. Documentation defines each one, including how the citation and
          Altmetric measures are derived:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {studies
            .filter((study) => study.hasDocumentation)
            .map((study) => (
              <li key={study.id}>
                <a
                  href={documentationPath(study.id)}
                  download
                  className="focus-ring text-link underline underline-offset-2"
                >
                  {study.label} data documentation (PDF)
                </a>
              </li>
            ))}
        </ul>
      </section>

      <Link
        href="/"
        className="focus-ring inline-block text-sm text-link underline underline-offset-2"
      >
        ← Back to the catalog
      </Link>
    </article>
  );
}
