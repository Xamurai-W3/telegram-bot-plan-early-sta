import { fetchJson } from "./http.js";
import { safeErr } from "../lib/safeErr.js";

function isProbablyAddress(q) {
  const s = String(q || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(s) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

function normChain(chain) {
  const c = String(chain || "").trim().toLowerCase();
  if (!c) return "";
  if (c === "eth" || c === "ethereum") return "ethereum";
  if (c === "sol" || c === "solana") return "solana";
  if (c === "bsc" || c === "bnb" || c === "binance") return "bsc";
  if (c === "polygon" || c === "matic") return "polygon";
  if (c === "base") return "base";
  if (c === "arbitrum" || c === "arb") return "arbitrum";
  return c;
}

function mapDexChainToLabel(dexChainId) {
  const c = String(dexChainId || "").toLowerCase();
  return c;
}

function pickPair(p) {
  const liq = Number(p?.liquidity?.usd || 0);
  const vol24 = Number(p?.volume?.h24 || 0);
  return {
    chain: mapDexChainToLabel(p?.chainId),
    address: String(p?.baseToken?.address || ""),
    symbol: String(p?.baseToken?.symbol || ""),
    name: String(p?.baseToken?.name || ""),
    dexId: String(p?.dexId || ""),
    pairAddress: String(p?.pairAddress || ""),
    url: String(p?.url || ""),
    priceUsd: p?.priceUsd != null ? String(p.priceUsd) : "",
    liquidityUsd: Number.isFinite(liq) ? liq : null,
    volume24hUsd: Number.isFinite(vol24) ? vol24 : null,
    priceChange24hPct: Number(p?.priceChange?.h24 ?? NaN),
    fdv: Number(p?.fdv ?? NaN),
    marketCap: Number(p?.marketCap ?? NaN),
    createdAt: p?.pairCreatedAt ? new Date(Number(p.pairCreatedAt)) : null
  };
}

export async function resolveToken(query, chainHint = "") {
  const q = String(query || "").trim();
  const chain = normChain(chainHint);
  if (!q) return { ok: false, error: "EMPTY_QUERY", candidates: [] };

  const isAddr = isProbablyAddress(q);

  const url = isAddr
    ? `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(q)}`
    : `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(q)}`;

  try {
    const json = await fetchJson(url, { timeoutMs: 15_000, retries: 2 });
    const pairs = Array.isArray(json?.pairs) ? json.pairs : [];

    let mapped = pairs.map(pickPair);
    if (chain) mapped = mapped.filter((p) => String(p.chain || "").toLowerCase() === chain);

    // De-dupe by chain+address
    const seen = new Set();
    mapped = mapped.filter((p) => {
      const k = `${p.chain}:${p.address}`;
      if (!p.address) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (mapped.length === 0) {
      return { ok: false, error: "NO_MATCHES", candidates: [] };
    }

    if (mapped.length === 1) {
      return { ok: true, token: mapped[0], candidates: mapped };
    }

    // Prefer best liquidity then volume
    mapped.sort((a, b) => (Number(b.liquidityUsd || 0) - Number(a.liquidityUsd || 0)) || (Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0)));

    return { ok: false, error: "AMBIGUOUS", candidates: mapped.slice(0, 8) };
  } catch (e) {
    return { ok: false, error: "PROVIDER_ERROR", message: safeErr(e), candidates: [] };
  }
}

export async function fetchTokenSnapshot({ chain, address }) {
  if (!address) return { ok: false, error: "MISSING_ADDRESS" };

  const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`;

  try {
    const json = await fetchJson(url, { timeoutMs: 15_000, retries: 2 });
    const pairs = Array.isArray(json?.pairs) ? json.pairs : [];

    // Choose the best pair on the requested chain (or overall best)
    let mapped = pairs.map(pickPair);
    if (chain) {
      const c = String(chain).toLowerCase();
      const filtered = mapped.filter((p) => String(p.chain || "").toLowerCase() === c);
      if (filtered.length > 0) mapped = filtered;
    }

    mapped.sort((a, b) => (Number(b.liquidityUsd || 0) - Number(a.liquidityUsd || 0)) || (Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0)));

    const best = mapped[0];
    if (!best) return { ok: false, error: "NO_SNAPSHOT" };

    return {
      ok: true,
      snapshot: {
        ts: new Date(),
        ...best
      }
    };
  } catch (e) {
    return { ok: false, error: "PROVIDER_ERROR", message: safeErr(e) };
  }
}

export async function fetchTrending(chainHint = "") {
  // DexScreener has no official global trending API that is stable across time.
  // Best-effort approach: use a broad search that often surfaces active pairs.
  // If this degrades, the bot should clearly label it.

  const chain = normChain(chainHint);
  const url = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent("new")}`;

  try {
    const json = await fetchJson(url, { timeoutMs: 15_000, retries: 2 });
    const pairs = Array.isArray(json?.pairs) ? json.pairs : [];

    let mapped = pairs.map(pickPair);
    if (chain) mapped = mapped.filter((p) => String(p.chain || "").toLowerCase() === chain);

    mapped.sort((a, b) => (Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0)));

    return { ok: true, tokens: mapped.slice(0, 10), sourceNote: "Best-effort from public DexScreener search." };
  } catch (e) {
    return { ok: false, error: "PROVIDER_ERROR", message: safeErr(e) };
  }
}
