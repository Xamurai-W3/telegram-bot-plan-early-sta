import "dotenv/config";

import { run } from "@grammyjs/runner";
import { cfg } from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";

process.on("unhandledRejection", (r) => {
  console.error("[process] unhandledRejection", { err: safeErr(r) });
});

process.on("uncaughtException", (e) => {
  console.error("[process] uncaughtException", { err: safeErr(e) });
  // Keep process alive when feasible; most errors here are fatal, but Render will restart anyway.
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickLogLevel() {
  const raw = String(process.env.LOG_LEVEL || "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

function shouldLog(level) {
  const order = { debug: 10, info: 20, warn: 30, error: 40 };
  const cur = pickLogLevel();
  return (order[level] || 20) >= (order[cur] || 20);
}

let runner = null;
let restarting = false;

async function stopRunner() {
  if (!runner) return;
  try {
    runner.abort();
  } catch {}
  runner = null;
  await sleep(250);
}

async function startPolling(bot) {
  const concurrency = 1;

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    if (shouldLog("info")) console.log("[boot] webhook cleared", { dropPending: true });
  } catch (e) {
    console.warn("[boot] deleteWebhook failed", { err: safeErr(e) });
  }

  runner = run(bot, { concurrency });
  if (shouldLog("info")) console.log("[boot] polling started", { concurrency });

  // Runner task resolves on fatal polling failure.
  runner.task.catch(async (e) => {
    const msg = safeErr(e);
    console.warn("[runner] task error", { err: msg });

    const isConflict = String(msg).includes("409") || String(msg).toLowerCase().includes("conflict");
    if (!isConflict) return;

    if (restarting) return;
    restarting = true;

    try {
      const backoffs = [2000, 5000, 10000, 20000];
      for (const ms of backoffs) {
        console.warn("[runner] 409 conflict; restarting polling", { backoffMs: ms });
        await stopRunner();
        await sleep(ms);

        try {
          await bot.api.deleteWebhook({ drop_pending_updates: true });
        } catch {}

        try {
          runner = run(bot, { concurrency: 1 });
          console.log("[runner] polling restarted", { concurrency: 1 });
          return;
        } catch (startErr) {
          console.warn("[runner] restart failed", { err: safeErr(startErr) });
          continue;
        }
      }

      console.error("[runner] restart exhausted", { err: msg });
    } finally {
      restarting = false;
    }
  });
}

function startPollingCycleLogs() {
  // grammY runner doesn’t expose per-cycle hooks reliably; we log a heartbeat instead.
  // This is enough to diagnose “not responding” without spamming.
  setInterval(() => {
    if (shouldLog("debug")) console.log("[poll] heartbeat", { runnerActive: !!runner });
  }, 60_000).unref();
}

async function boot() {
  console.log("[boot] service starting", {
    nodeEnv: process.env.NODE_ENV || "",
    logLevel: pickLogLevel(),
    tokenSet: !!cfg.TELEGRAM_BOT_TOKEN,
    mongoSet: !!cfg.MONGODB_URI,
    aiEndpointSet: !!cfg.COOKMYBOTS_AI_ENDPOINT,
    aiKeySet: !!cfg.COOKMYBOTS_AI_KEY,
    alertsEnabled: !!cfg.ALERTS_ENABLED
  });

  if (!cfg.MONGODB_URI) {
    console.warn("[boot] MONGODB_URI not set; memory/watchlist will be temporary");
  }

  if (!cfg.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is required. Set it in env and redeploy.");
    process.exit(1);
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
      { command: "gem", description: "Analyze a token" },
      { command: "trending", description: "Trending tokens" },
      { command: "watch", description: "Manage your watchlist" },
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

  await startPolling(bot);
  startPollingCycleLogs();

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
