import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-md">
      <nav
        className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-4 py-3"
        aria-label="Main"
      >
        <Link href="/" className="focus-ring flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="inline-block h-5 w-5 rounded-md bg-linear-to-br from-accent to-accent-2 shadow-sm"
          />
          ABCD<span className="gradient-text">·</span>Publications
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/about/" className="focus-ring text-sm text-muted hover:text-link">
            About
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
