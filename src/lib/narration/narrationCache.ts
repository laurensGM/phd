const CACHE_NAME = 'phd-paper-narrations-v1';

export async function cacheNarrationAudio(url: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(url);
    if (existing) return;
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (res.ok) await cache.put(url, res.clone());
  } catch {
    // Offline or CORS — ignore
  }
}

export async function getCachedNarrationUrl(url: string): Promise<string | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (!hit) return null;
    const blob = await hit.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function isNarrationCached(url: string): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    return !!(await cache.match(url));
  } catch {
    return false;
  }
}
