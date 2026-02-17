export default function register(bot) {
  bot.command("help", async (ctx) => {
    const t = [
      "Commands:",
      "/start - welcome and examples",
      "/help - this message",
      "/gem <query> - analyze a token (symbol/name/address)",
      "/trending [chain] - trending/new tokens",
      "/watch add <query> - add to watchlist",
      "/watch remove <query> - remove from watchlist",
      "/watch list - show your watchlist",
      "/alert on|off - toggle alerts",
      "/reset [all] - clear memory (and optionally watchlist)",
      "",
      "Examples:",
      "/trending solana",
      "/gem 0x...",
      "/watch add BONK",
      "/alert on"
    ].join("\n");

    await ctx.reply(t);
  });
}
