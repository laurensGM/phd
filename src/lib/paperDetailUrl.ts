/** Build paper detail URL (hash id avoids PWA precache mismatch on ?query params). */
export function paperDetailUrl(paperId: string, base?: string): string {
  const b = (
    base ?? ((typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/')
  ).replace(/\/?$/, '/');
  const path = `${b}papers/detail/#id=${encodeURIComponent(paperId)}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${window.location.origin}${normalized}`;
  }
  return path;
}

/** Read paper id from ?id= or #id= (supports legacy query links). */
export function getPaperIdFromLocation(loc: Pick<Location, 'search' | 'hash'> = window.location): string | null {
  const fromQuery = new URLSearchParams(loc.search).get('id');
  if (fromQuery) return fromQuery;

  const hash = loc.hash.replace(/^#/, '').trim();
  if (!hash) return null;
  if (hash.startsWith('id=')) return decodeURIComponent(hash.slice(3));
  return decodeURIComponent(hash);
}
