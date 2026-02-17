import { safeErr } from "./safeErr.js";

function trimSlash(u) {
  u = String(u || "");
  while (u.endsWith("/")) u = u.slice(0, -1);
  return u;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeReadJson(r) {
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { text, json };
}

function withTimeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { ctrl, clear: () => clearTimeout(t) };
}

function pickTimeout(cfg) {
  const v = Number(cfg?.AI_TIMEOUT_MS || 600000);
  return Number.isFinite(v) && v > 0 ? v : 600000;
}

function pickModel(cfg, override) {
  const m = String(override || cfg?.AI_MODEL || "").trim();
  return m || undefined;
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 504);
}

function logCfg(cfg) {
  return {
    aiEndpointSet: !!String(cfg?.COOKMYBOTS_AI_ENDPOINT || "").trim(),
    aiKeySet: !!String(cfg?.COOKMYBOTS_AI_KEY || "").trim()
  };
}

export async function aiChat(cfg, { messages, model, meta } = {}, opts = {}) {
  const base = trimSlash(cfg?.COOKMYBOTS_AI_ENDPOINT || "");
  const key = String(cfg?.COOKMYBOTS_AI_KEY || "");

  if (!base || !key) {
    return {
      ok: false,
      status: 412,
      json: null,
      error: "AI_NOT_CONFIGURED"
    };
  }

  const timeoutMs = Number(opts.timeoutMs || pickTimeout(cfg));
  const retries = Number.isFinite(opts.retries) ? Number(opts.retries) : Number(cfg?.AI_MAX_RETRIES || 2);
  const backoffMs = Number.isFinite(opts.backoffMs) ? Number(opts.backoffMs) : 900;

  const url = base + "/chat";
  const started = Date.now();

  console.log("[ai] chat start", { meta, ...logCfg(cfg) });

  let attempt = 0;
  while (true) {
    attempt++;
    const { ctrl, clear } = withTimeout(timeoutMs);

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: Array.isArray(messages) ? messages : [],
          model: pickModel(cfg, model),
          meta: meta || undefined
        }),
        signal: ctrl.signal
      });

      const { text, json } = await safeReadJson(r);

      if (!r.ok) {
        const msg = json?.error || json?.message || text || `HTTP_${r.status}`;
        console.warn("[ai] chat fail", {
          status: r.status,
          attempt,
          ms: Date.now() - started,
          err: String(msg).slice(0, 300)
        });

        if (attempt <= retries && isRetryableStatus(r.status)) {
          await sleep(backoffMs * attempt);
          continue;
        }

        return { ok: false, status: r.status, json, error: String(msg) };
      }

      const outText = json?.output?.content;
      console.log("[ai] chat ok", {
        attempt,
        ms: Date.now() - started,
        hasText: typeof outText === "string" && outText.trim().length > 0
      });

      return { ok: true, status: r.status, json, error: null };
    } catch (e) {
      const msg = e?.name === "AbortError" ? "AI_TIMEOUT" : safeErr(e);
      console.warn("[ai] chat exception", {
        attempt,
        ms: Date.now() - started,
        err: String(msg).slice(0, 300)
      });

      if (attempt <= retries) {
        await sleep(backoffMs * attempt);
        continue;
      }

      return { ok: false, status: e?.name === "AbortError" ? 408 : 0, json: null, error: String(msg) };
    } finally {
      clear();
    }
  }
}
