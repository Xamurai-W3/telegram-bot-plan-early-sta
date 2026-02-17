import { cfg } from "../lib/config.js";
import { setAlertsEnabled, getAlertsEnabled } from "../services/alertsStore.js";

function usage() {
  return "Usage: /alert on | /alert off";
}

export default function register(bot) {
  bot.command("alert", async (ctx) => {
    const userId = String(ctx.from?.id || "");
    const text = ctx.message?.text || "";
    const arg = text.replace(/^\/alert\s*/i, "").trim().toLowerCase();

    if (!arg) {
      const cur = await getAlertsEnabled({ mongoUri: cfg.MONGODB_URI, platform: "telegram", userId });
      return ctx.reply(
        `Alerts are ${cur?.enabled ? "ON" : "OFF"}.\n${usage()}`
      );
    }

    if (!cfg.ALERTS_ENABLED) {
      return ctx.reply(
        "Alerts aren’t available yet on this bot instance (server has ALERTS_ENABLED=false). Your watchlist still works."
      );
    }

    if (arg !== "on" && arg !== "off") return ctx.reply(usage());

    const enabled = arg === "on";
    const res = await setAlertsEnabled({
      mongoUri: cfg.MONGODB_URI,
      platform: "telegram",
      userId,
      enabled
    });

    if (!res?.ok) return ctx.reply("Couldn’t update alert settings right now. Try again.");

    return ctx.reply(`Alerts are now ${enabled ? "ON" : "OFF"}.`);
  });
}
