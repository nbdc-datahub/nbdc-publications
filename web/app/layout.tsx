import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import { Header } from '../components/Header';
import { StudyBanner } from '../components/StudyBanner';
import { ThemeProvider } from '../components/ThemeProvider';
import './globals.css';

const SITE = 'Publications Using NBDC Data';
const DESC =
  'Browse, filter and export the catalog of publications that use data from the NBDC studies.';

// Absolute base for OG URLs — set NEXT_PUBLIC_SITE_URL at build; omitted (relative URLs)
// otherwise so a wrong domain never gets baked in.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: { default: SITE, template: '%s — NBDC Publications' },
  description: DESC,
  applicationName: 'NBDC Publications',
  openGraph: { title: SITE, description: DESC, type: 'website', url: '/' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#08090c' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <Header />
          <StudyBanner />
          <main className="mx-auto max-w-[108rem] px-4 py-6 sm:py-10">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
