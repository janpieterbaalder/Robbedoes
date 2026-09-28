// Small in-memory cache for provider JSON. It complements the Next.js data cache: a warm
// server instance answers from memory, concurrent searches share one request, and when a
// provider is briefly down, data up to a day old is served instead of an error.
type Entry = { value: unknown; freshUntil: number; staleUntil: number };
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 300;
const STALE_MS = 24 * 3600 * 1000;

export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

export type FetchJson = (
  url: string,
  options: { ttlSeconds: number; headers?: Record<string, string> },
) => Promise<unknown>;

export const cachedFetchJson: FetchJson = (url, { ttlSeconds, headers }) => {
  const now = Date.now(),
    cached = entries.get(url);
  if (cached && cached.freshUntil > now) return Promise.resolve(cached.value);
  const running = pending.get(url);
  if (running) return running;
  const request = (async () => {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", ...headers },
        signal: AbortSignal.timeout(12000),
        next: { revalidate: ttlSeconds },
      });
      if (!res.ok) throw new HttpError(res.status);
      const value: unknown = await res.json();
      if (entries.size >= MAX_ENTRIES)
        entries.delete(entries.keys().next().value!);
      entries.set(url, {
        value,
        freshUntil: Date.now() + ttlSeconds * 1000,
        staleUntil: Date.now() + STALE_MS,
      });
      return value;
    } catch (error) {
      if (cached && cached.staleUntil > Date.now()) return cached.value;
      throw error;
    } finally {
      pending.delete(url);
    }
  })();
  pending.set(url, request);
  return request;
};
