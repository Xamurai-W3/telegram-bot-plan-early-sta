import { cfg } from "../lib/config.js";
import { clearUserMemory } from "../lib/memory.js";
import { clearWatchlist } from "../services/watchlist.js";

export default function register(bot) {
  bot.command("reset", async (ctx) => {
    const userId = String(ctx.from?.id || "");
    const chatId = String(ctx.chat?.id || "");

    const text = ctx.message?.text || "";
    const arg = text.replace(/^\/reset\s*/i, "").trim().toLowerCase();

    await clearUserMemory({
      mongoUri: cfg.MONGODB_URI,
      platform: "telegram",
      userId,
      chatId
    });

    if (arg === "all") {
      await clearWatchlist({
        mongoUri: cfg.MONGODB_URI,
        platform: "telegram",
        userId
      });

      return ctx.reply("Memory and watchlist cleared.");
    }

    return ctx.reply(
      "Memory cleared. If you also want to clear your watchlist, run: /reset all"
    );
  });
}
