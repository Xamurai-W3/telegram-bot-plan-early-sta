import { Bot } from "grammy";
import { registerCommands } from "./commands/loader.js";
import { registerAgent } from "./features/agent.js";
import { safeErr } from "./lib/safeErr.js";

export async function createBot(token) {
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

  bot.use(async (ctx, next) => {
    if (!ctx.me && bot.botInfo) ctx.me = bot.botInfo;
    return next();
  });

  // Commands must be registered before the agent catch-all.
  await registerCommands(bot);

  // AI agent catch-all must be last.
  registerAgent(bot);

  return bot;
}
