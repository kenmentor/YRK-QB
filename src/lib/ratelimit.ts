// Tiny in-memory per-IP rate limiter. Good enough for a single-instance
// v1; replace with Redis/upstash when horizontally scaled.
const hits = new Map<string, number[]>();
setInterval(() => {
  const now = Date.now();
  hits.forEach((ts: number[], k: string) => {
    const fresh = ts.filter((t: number) => now - t < 10 * 60 * 1000);
    if (fresh.length) hits.set(k, fresh);
    else hits.delete(k);
  });
}, 60 * 1000).unref?.();

export function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export function rateLimited(req: Request, scope: string, max: number, windowMs: number): boolean {
  const key = `${scope}:${getIp(req)}`;
  const now = Date.now();
  const ts = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (ts.length >= max) return true;
  ts.push(now);
  hits.set(key, ts);
  return false;
}
