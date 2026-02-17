import { Bot } from "grammy";
import { registerCommands } from "./commands/loader.js";
import { registerAgent } from "./features/agent.js";
import { safeErr } from "./lib/safeErr.js";

export function createBot(token) {
  const bot = new Bot(token);

  bot.catch((err) => {
    console.error("[bot] handler error", {
      err: safeErr(err?.error || err),
      ctx: {
        chatId: String(err?.ctx?.chat?.id || ""),
        userId: String(err?.ctx?.from?.id || "")
      }
    });
  });

  // 1) Commands first
  bot.use(async (ctx, next) => {
    // ensure bot info is available for group mention rules
    if (!ctx.me && bot.botInfo) ctx.me = bot.botInfo;
    return next();
  });

  bot.use(async (ctx, next) => {
    // Commands are registered imperatively on the bot instance.
    // This middleware stays lightweight.
    return next();
  });

  // Register command modules
  // (Loader will call bot.command(...))
  // Note: loader must run before agent registration.
  registerCommands(bot);

  // 2) AI agent catch-all last
  registerAgent(bot);

  return bot;
}
