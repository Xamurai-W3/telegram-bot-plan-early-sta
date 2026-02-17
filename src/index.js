import "dotenv/config";

import { run } from "@grammyjs/runner";
import { cfg } from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";

process.on("unhandledRejection", (r) => {
  console.error("[process] UnhandledRejection:", safeErr(r));
});
process.on("uncaughtException", (e) => {
  console.error("[process] UncaughtException:", safeErr(e));
  process.exit(1);
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let runner = null;
let restarting = false;

async function startPolling(bot) {
  let backoffMs = 2000;

  while (true) {
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: true });
    } catch (e) {
      console.warn("[boot] deleteWebhook failed:", safeErr(e));
    }

    try {
      runner = run(bot, { concurrency: 1 });
      console.log("[boot] polling started", { concurrency: 1 });
      return;
    } catch (e) {
      const msg = safeErr(e);
      console.warn("[boot] polling start failed", { err: msg });

      // If getUpdates conflict occurs, backoff and retry.
      if (String(msg).includes("409") || String(msg).toLowerCase().includes("conflict")) {
        await sleep(backoffMs);
        backoffMs = Math.min(20_000, Math.round(backoffMs * 2.5));
        continue;
      }

      throw e;
    }
  }
}

async function boot() {
  console.log("[boot] service starting", {
    nodeEnv: process.env.NODE_ENV || "",
    tokenSet: !!cfg.TELEGRAM_BOT_TOKEN,
    mongoSet: !!cfg.MONGODB_URI,
    aiEndpointSet: !!cfg.COOKMYBOTS_AI_ENDPOINT,
    aiKeySet: !!cfg.COOKMYBOTS_AI_KEY,
    alertsEnabled: !!cfg.ALERTS_ENABLED
  });

  if (!cfg.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is required. Set it in env and redeploy.");
    process.exit(1);
  }

  const { createBot } = await import("./bot.js");
  const { startAlertsLoop } = await import("./features/alerts.js");

  const bot = createBot(cfg.TELEGRAM_BOT_TOKEN);

  try {
    await bot.init();
  } catch (e) {
    console.warn("[boot] bot.init failed:", safeErr(e));
  }

  // Keep Telegram command menu in sync
  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Welcome and examples" },
      { command: "help", description: "How to use Gem Scout" },
      { command: "gem", description: "Analyze a token" },
      { command: "trending", description: "Trending tokens" },
      { command: "watch", description: "Manage your watchlist" },
      { command: "alert", description: "Toggle alerts" },
      { command: "reset", description: "Clear memory" }
    ]);
  } catch (e) {
    console.warn("[boot] setMyCommands failed:", safeErr(e));
  }

  // Alerts loop (optional)
  try {
    startAlertsLoop(bot);
  } catch (e) {
    console.warn("[alerts] failed to start:", safeErr(e));
  }

  await startPolling(bot);

  // Runner-level error handling (409 overlap, etc.)
  if (runner) {
    runner.task.catch(async (e) => {
      const msg = safeErr(e);
      console.warn("[runner] task error", { err: msg });

      if ((String(msg).includes("409") || String(msg).toLowerCase().includes("conflict")) && !restarting) {
        restarting = true;
        try {
          console.warn("[runner] conflict detected; restarting polling");
          try {
            runner.abort();
          } catch {}
          await sleep(2000);
          await startPolling(bot);
        } finally {
          restarting = false;
        }
      }
    });
  }

  // Lightweight memory log (once per minute)
  setInterval(() => {
    const m = process.memoryUsage();
    console.log("[mem]", {
      rssMB: Math.round(m.rss / 1e6),
      heapUsedMB: Math.round(m.heapUsed / 1e6)
    });
  }, 60_000).unref();
}

boot().catch((e) => {
  console.error("[boot] fatal", safeErr(e));
  process.exit(1);
});
