import type { Metadata } from 'next';
import Link from 'next/link';
import { DOCUMENTATION_PATH } from '../../lib/export';

export const metadata: Metadata = {
  title: 'About',
  description:
    'What the ABCD publications catalog contains, how the research domains work, and how often it is refreshed.',
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
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">About this catalog</h1>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What this is</h2>
        <p className="text-sm leading-relaxed">
          A catalog of peer-reviewed publications that use data from the{' '}
          <a
            href="https://abcdstudy.org/"
            target="_blank"
            rel="noreferrer"
            className="focus-ring text-accent underline underline-offset-2"
          >
            Adolescent Brain Cognitive Development (ABCD) Study
          </a>
          . Each entry carries bibliometrics (citation counts, relative citation ratio), Altmetric
          attention data, whether an ABCD member is among the authors, and the research domains the
          work touches.
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
          Exports contain all 46 source columns. The{' '}
          <a
            href={DOCUMENTATION_PATH}
            download
            className="focus-ring text-accent underline underline-offset-2"
          >
            data documentation PDF
          </a>{' '}
          defines each one, including how the citation and Altmetric measures are derived.
        </p>
      </section>

      <Link
        href="/"
        className="focus-ring inline-block text-sm text-accent underline underline-offset-2"
      >
        ← Back to the catalog
      </Link>
    </article>
  );
}
