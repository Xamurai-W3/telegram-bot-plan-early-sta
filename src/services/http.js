import { safeErr } from "../lib/safeErr.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchJson(url, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs || 15_000);
  const retries = Number.isFinite(opts.retries) ? Number(opts.retries) : 2;

  let attempt = 0;
  while (true) {
    attempt++;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const r = await fetch(url, {
        ...opts,
        signal: ctrl.signal,
        headers: {
          "User-Agent": "GemScoutBot/1.0",
          ...(opts.headers || {})
        }
      });

      const text = await r.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}

      if (!r.ok) {
        const msg = json?.error || json?.message || text || `HTTP_${r.status}`;
        const err = new Error(String(msg));
        err.status = r.status;
        err.bodySnippet = String(text || "").slice(0, 300);
        throw err;
      }

      return json;
    } catch (e) {
      const status = e?.status || 0;
      const retryable = status === 429 || status === 0 || (status >= 500 && status <= 504);

      if (attempt <= retries && retryable) {
        await sleep(350 * attempt * attempt);
        continue;
      }

      const msg = safeErr(e);
      const out = new Error(msg);
      out.cause = e;
      throw out;
    } finally {
      clearTimeout(t);
    }
  }
}
