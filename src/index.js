import "dotenv/config";

import { run } from "@grammyjs/runner";
import { cfg } from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";

process.on("unhandledRejection", (r) => {
  console.error("[process] unhandledRejection", { err: safeErr(r) });
});

process.on("uncaughtException", (e) => {
  console.error("[process] uncaughtException", { err: safeErr(e) });
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let runner = null;
let restartLock = false;

async function stopRunner() {
  if (!runner) return;
  try {
    runner.abort();
  } catch (e) {
    console.warn("[runner] abort failed", { err: safeErr(e) });
  }
  runner = null;
  await sleep(250);
}

function is409(e) {
  const msg = String(safeErr(e) || "");
  return msg.includes("409") || msg.toLowerCase().includes("conflict");
}

async function startRunner(bot) {
  await bot.api.deleteWebhook({ drop_pending_updates: true }).catch((e) => {
    console.warn("[boot] deleteWebhook failed", { err: safeErr(e) });
  });

  const concurrency = 1;
  runner = run(bot, { concurrency });
  console.log("[boot] polling started", { concurrency });

  runner.task.catch(async (e) => {
    console.warn("[runner] task error", { err: safeErr(e) });
    if (!is409(e)) return;
    await restartPolling(bot, e);
  });
}

async function restartPolling(bot, reason) {
  if (restartLock) return;
  restartLock = true;

  try {
    const backoffs = [2000, 5000, 10000, 20000];

    for (const backoffMs of backoffs) {
      console.warn("[runner] restarting polling", {
        reason: safeErr(reason),
        backoffMs
      });

      await stopRunner();
      await sleep(backoffMs);

      try {
        await startRunner(bot);
        console.log("[runner] polling restarted");
        return;
      } catch (e) {
        console.warn("[runner] restart attempt failed", { err: safeErr(e) });
        continue;
      }
    }

    console.error("[runner] restart exhausted", { err: safeErr(reason) });
  } finally {
    restartLock = false;
  }
}

async function boot() {
  console.log("[boot] service starting", {
    platform: "telegram",
    runnerMode: "long-polling",
    tokenSet: !!cfg.TELEGRAM_BOT_TOKEN,
    mongoSet: !!cfg.MONGODB_URI,
    aiConfigured: !!(cfg.COOKMYBOTS_AI_ENDPOINT && cfg.COOKMYBOTS_AI_KEY),
    alertsEnabled: !!cfg.ALERTS_ENABLED,
    concurrency: 1
  });

  if (!cfg.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is required. Set it in env and redeploy.");
    process.exit(1);
  }

  if (!cfg.MONGODB_URI) {
    console.warn("[boot] MONGODB_URI not set; memory/watchlist will be temporary");
  }

  const { createBot } = await import("./bot.js");
  const { startAlertsLoop } = await import("./features/alerts.js");

  const bot = await createBot(cfg.TELEGRAM_BOT_TOKEN);

  try {
    await bot.init();
  } catch (e) {
    console.warn("[boot] bot.init failed", { err: safeErr(e) });
  }

  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Welcome and examples" },
      { command: "help", description: "How to use Gem Scout" },
      { command: "watch", description: "Manage your watchlist" },
      { command: "gem", description: "Analyze a token" },
      { command: "trending", description: "Trending tokens" },
      { command: "alert", description: "Toggle alerts" },
      { command: "reset", description: "Clear memory" }
    ]);
  } catch (e) {
    console.warn("[boot] setMyCommands failed", { err: safeErr(e) });
  }

  try {
    startAlertsLoop(bot);
  } catch (e) {
    console.warn("[alerts] failed to start", { err: safeErr(e) });
  }

  await startRunner(bot);

  setInterval(() => {
    const m = process.memoryUsage();
    console.log("[mem]", {
      rssMB: Math.round(m.rss / 1e6),
      heapUsedMB: Math.round(m.heapUsed / 1e6)
    });
  }, 60_000).unref();
}

boot().catch((e) => {
  console.error("[boot] fatal", { err: safeErr(e) });
  process.exit(1);
});
