import { cfg } from "../lib/config.js";
import { resolveToken, fetchTokenSnapshot } from "../services/cryptoData.js";
import {
  addToWatchlist,
  removeFromWatchlist,
  listWatchlist
} from "../services/watchlist.js";

function usage() {
  return [
    "Usage:",
    "/watch add <query>",
    "/watch remove <query>",
    "/watch list"
  ].join("\n");
}

function fmtItem(x, i) {
  const sym = x.symbol || x.name || "(unknown)";
  const last = x.lastCheckedAt ? new Date(x.lastCheckedAt).toLocaleString() : "never";
  const liq = x.lastSnapshot?.liquidityUsd != null ? `$${Math.round(x.lastSnapshot.liquidityUsd).toLocaleString()}` : "?";
  const vol = x.lastSnapshot?.volume24hUsd != null ? `$${Math.round(x.lastSnapshot.volume24hUsd).toLocaleString()}` : "?";
  return `${i + 1}) ${sym} (${x.chain || "?"})\n   ${x.address}\n   liq ${liq} vol24 ${vol} last checked: ${last}`;
}

export default function register(bot) {
  bot.command("watch", async (ctx) => {
    const userId = String(ctx.from?.id || "");

    const text = ctx.message?.text || "";
    const rest = text.replace(/^\/watch\s*/i, "").trim();

    const [sub, ...parts] = rest.split(/\s+/).filter(Boolean);
    const arg = parts.join(" ").trim();

    if (!sub) return ctx.reply(usage());

    if (sub === "list") {
      const wl = await listWatchlist({ mongoUri: cfg.MONGODB_URI, platform: "telegram", userId });
      const items = wl?.ok ? wl.items : [];

      if (!items.length) {
        return ctx.reply("Your watchlist is empty. Try /watch add <query>.");
      }

      // Opportunistically refresh minimal stats for first few items (rate-limit friendly)
      const refreshed = [];
      for (const item of items.slice(0, 5)) {
        const snapRes = await fetchTokenSnapshot({ chain: item.chain, address: item.address });
        if (snapRes?.ok) {
          refreshed.push({
            ...item,
            lastCheckedAt: new Date(),
            lastSnapshot: snapRes.snapshot
          });
        } else {
          refreshed.push(item);
        }
      }

      const msg = [
        wl.persisted ? "Your watchlist:" : "Your watchlist (temporary, no DB):",
        "",
        ...refreshed.map(fmtItem),
        "",
        "Tip: /gem <query> for a full scorecard.",
        "Not financial advice."
      ].join("\n");

      return ctx.reply(msg);
    }

    if (sub !== "add" && sub !== "remove") return ctx.reply(usage());
    if (!arg) return ctx.reply(usage());

    const resolved = await resolveToken(arg);
    if (!resolved.ok) {
      if (resolved.error === "AMBIGUOUS") {
        return ctx.reply(
          "That query matches multiple tokens. Please be more specific (chain or contract address)."
        );
      }
      return ctx.reply("I couldn’t resolve that token. Try a contract address, or a more specific symbol/name.");
    }

    const token = resolved.token;

    if (sub === "add") {
      const r = await addToWatchlist({
        mongoUri: cfg.MONGODB_URI,
        platform: "telegram",
        userId,
        token
      });

      return ctx.reply(
        `${token.symbol || token.name || token.address} added to watchlist${r.persisted ? "" : " (temporary)"}.\n${"Not financial advice."}`
      );
    }

    const rr = await removeFromWatchlist({
      mongoUri: cfg.MONGODB_URI,
      platform: "telegram",
      userId,
      chain: token.chain,
      address: token.address
    });

    return ctx.reply(
      `${token.symbol || token.name || token.address} removed from watchlist${rr.persisted ? "" : " (temporary)"}.\n${"Not financial advice."}`
    );
  });
}
