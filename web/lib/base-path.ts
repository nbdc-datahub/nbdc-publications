// Base path for GitHub Project Pages (e.g. "/abcd-publications"). Empty for a custom domain
// or local dev. Inlined at build from NEXT_PUBLIC_BASE_PATH; MUST equal `basePath` in
// next.config.ts.
//
// Next prefixes <Link>/<Image>/imported assets with basePath automatically, but NOT manual
// fetch() calls — so client fetches of data/index.json and data/abstracts/NN.json must go
// through withBasePath (spec §3.2).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBasePath(path: string): string {
  if (!BASE_PATH) return path;
  return `${BASE_PATH}${path.startsWith('/') ? '' : '/'}${path}`;
}
