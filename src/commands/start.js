import { cfg } from "../lib/config.js";

function disclaimer() {
  return "Not financial advice. High risk. Do your own research.";
}

export default function register(bot) {
  bot.command("start", async (ctx) => {
    const hasDb = !!cfg.MONGODB_URI;

    const lines = [
      "Gem Scout helps you discover and evaluate early-stage crypto tokens with a risk-first scorecard.",
      "",
      "Try:",
      "/trending",
      "/gem PEPE",
      "/watch add PEPE",
      "/watch list",
      "",
      disclaimer(),
      "",
      hasDb
        ? "Memory and watchlists are persistent."
        : "Note: MONGODB_URI is not set, so memory and watchlists are temporary and may reset on deploy."
    ];

    await ctx.reply(lines.join("\n"));
  });
}
