import { cfg } from "../lib/config.js";
import { resolveToken, fetchTokenSnapshot } from "../services/cryptoData.js";
import { aiChat } from "../lib/ai.js";
import { buildBotProfile } from "../lib/botProfile.js";

function disclaimer() {
  return "Not financial advice. High risk. Do your own research.";
}

function usage() {
  return "Usage: /gem <symbol|name|address>";
}

function formatCandidate(c, i) {
  const liq = c.liquidityUsd != null ? `$${Math.round(c.liquidityUsd).toLocaleString()}` : "unknown";
  const vol = c.volume24hUsd != null ? `$${Math.round(c.volume24hUsd).toLocaleString()}` : "unknown";
  return `${i + 1}) ${c.symbol || ""} ${c.name || ""} (${c.chain || "?"})\n   ${c.address}\n   liq ${liq}, vol24 ${vol}`;
}

export default function register(bot) {
  bot.command("gem", async (ctx) => {
    const text = ctx.message?.text || "";
    const q = text.replace(/^\/gem\s*/i, "").trim();

    if (!q) return ctx.reply(usage());

    const hint = "";
    const resolved = await resolveToken(q, hint);

    if (resolved.ok) {
      const token = resolved.token;
      const snapRes = await fetchTokenSnapshot({ chain: token.chain, address: token.address });
      const snap = snapRes?.ok ? snapRes.snapshot : null;

      const botProfile = buildBotProfile();
      const prompt = [
        "Create a structured token scorecard with these sections:",
        "Overview",
        "Risk tier and top risk flags",
        "Momentum snapshot",
        "Fundamentals checklist",
        "What would I watch next",
        "",
        "Be explicit about missing fields. Avoid hype. Keep it concise.",
        "End with a short disclaimer line.",
        "",
        "Token data (best-effort):",
        JSON.stringify(
          {
            chain: token.chain,
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            dexId: token.dexId,
            liquidityUsd: snap?.liquidityUsd ?? token.liquidityUsd ?? null,
            volume24hUsd: snap?.volume24hUsd ?? token.volume24hUsd ?? null,
            priceUsd: snap?.priceUsd ?? token.priceUsd ?? "",
            priceChange24hPct: Number.isFinite(Number(snap?.priceChange24hPct))
              ? Number(snap.priceChange24hPct)
              : (Number.isFinite(Number(token.priceChange24hPct)) ? Number(token.priceChange24hPct) : null),
            fdv: Number.isFinite(Number(snap?.fdv)) ? Number(snap.fdv) : (Number.isFinite(Number(token.fdv)) ? Number(token.fdv) : null),
            marketCap: Number.isFinite(Number(snap?.marketCap)) ? Number(snap.marketCap) : (Number.isFinite(Number(token.marketCap)) ? Number(token.marketCap) : null),
            pairCreatedAt: (snap?.createdAt || token.createdAt) ? String(snap?.createdAt || token.createdAt) : null,
            url: token.url
          },
          null,
          2
        )
      ].join("\n");

      const res = await aiChat(
        cfg,
        {
          messages: [
            { role: "system", content: botProfile },
            { role: "user", content: prompt }
          ],
          meta: { platform: "telegram", feature: "gem", userId: String(ctx.from?.id || ""), chatId: String(ctx.chat?.id || "") }
        },
        { timeoutMs: cfg.AI_TIMEOUT_MS, retries: cfg.AI_MAX_RETRIES }
      );

      const out = String(res?.json?.output?.content || "").trim();
      if (!res?.ok || !out) {
        const fallback = [
          "Token found, but I couldn’t generate the AI scorecard right now.",
          `${token.symbol || token.name || token.address} (${token.chain || ""})`,
          token.address,
          token.url ? token.url : "",
          "",
          disclaimer()
        ].filter(Boolean).join("\n");
        return ctx.reply(fallback);
      }

      return ctx.reply(out.includes("Not financial advice") ? out : `${out}\n\n${disclaimer()}`);
    }

    if (resolved.error === "AMBIGUOUS") {
      const msg = [
        "I found multiple matches. Reply with the number, or re-run /gem with a chain hint.",
        "Example: /gem solana BONK",
        "",
        ...resolved.candidates.map(formatCandidate)
      ].join("\n");
      return ctx.reply(msg);
    }

    if (resolved.error === "NO_MATCHES") {
      return ctx.reply("No matches found. Try a contract address, or a more specific name/symbol.");
    }

    return ctx.reply("Data provider error while searching. Try again in a bit.");
  });
}
