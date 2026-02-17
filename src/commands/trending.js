import { fetchTrending } from "../services/cryptoData.js";

function usage() {
  return "Usage: /trending [chain]";
}

function line(t, i) {
  const liq = t.liquidityUsd != null ? `$${Math.round(t.liquidityUsd).toLocaleString()}` : "?";
  const vol = t.volume24hUsd != null ? `$${Math.round(t.volume24hUsd).toLocaleString()}` : "?";
  const chg = Number.isFinite(Number(t.priceChange24hPct)) ? `${Math.round(Number(t.priceChange24hPct))}%` : "?";
  return `${i + 1}) ${t.symbol || ""} (${t.chain || "?"}) liq ${liq} vol24 ${vol} chg24 ${chg}\n   /gem ${t.address}`;
}

export default function register(bot) {
  bot.command("trending", async (ctx) => {
    const text = ctx.message?.text || "";
    const arg = text.replace(/^\/trending\s*/i, "").trim();

    if (arg && arg.length > 32) return ctx.reply(usage());

    const res = await fetchTrending(arg);
    if (!res?.ok) {
      return ctx.reply("Trending is best-effort and the data source is having trouble right now. Try again soon.");
    }

    const tokens = res.tokens || [];
    if (tokens.length === 0) {
      return ctx.reply("No trending tokens found right now (best-effort). Try /trending without a chain, or use /gem <query>.");
    }

    const msg = [
      `Trending tokens${arg ? " for " + arg : ""} (best-effort):`,
      res.sourceNote ? res.sourceNote : "",
      "",
      ...tokens.slice(0, 8).map(line),
      "",
      "Tip: use /gem <symbol|address> for a risk-first scorecard.",
      "Not financial advice."
    ].filter(Boolean).join("\n");

    return ctx.reply(msg);
  });
}
