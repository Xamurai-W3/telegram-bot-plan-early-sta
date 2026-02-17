import "dotenv/config";

import { run } from "@grammyjs/runner";
import { cfg } from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandledRejection", { err: safeErr(reason) });
  // Keep the service alive; handler-level errors should be managed via bot.catch.
});

process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException", { err: safeErr(err) });
  // Uncaught exceptions can leave the process in a bad state. Exit so Render restarts it.
  process.exit(1);
});

let runner = null;
let pollingStarted = false;
let restartLock = false;

function is409(e) {
  const msg = String(safeErr(e) || "");
  return msg.includes("409") || msg.toLowerCase().includes("conflict");
}

async function stopRunner() {
  if (!runner) return;
  try {
    runner.abort();
  } catch (e) {
    console.warn("[runner] abort failed", { err: safeErr(e) });
  }
  runner = null;
  pollingStarted = false;
  await sleep(250);
}

async function startRunnerOnce(bot) {
  if (pollingStarted) {
    console.warn("[boot] polling already started; skipping");
    return;
  }

  // Always clear webhook first to avoid conflicts/backlog.
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
  } catch (e) {
    console.warn("[boot] deleteWebhook failed", { err: safeErr(e) });
  }

  const concurrency = 1;
  runner = run(bot, { concurrency });
  pollingStarted = true;
  console.log("[boot] polling started", { concurrency });

  // IMPORTANT: runner.task is not a Promise in runner 2.0.3.
  // Use bot.catch for update/Telegram API errors.
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
        await startRunnerOnce(bot);
        console.log("[runner] polling restarted");
        return;
      } catch (e) {
        console.warn("[runner] restart attempt failed", { err: safeErr(e) });
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
    aiEndpointSet: !!cfg.COOKMYBOTS_AI_ENDPOINT,
    aiKeySet: !!cfg.COOKMYBOTS_AI_KEY,
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

  // Telegram API + handler error boundary.
  bot.catch(async (err) => {
    const msg = safeErr(err?.error || err);
    const status = err?.error?.response?.error_code;

    console.error("[bot] update error", {
      err: msg,
      status,
      ctx: {
        chatId: String(err?.ctx?.chat?.id || ""),
        userId: String(err?.ctx?.from?.id || "")
      }
    });

    // 409s can happen during deploy overlap; keep the service alive and restart polling.
    if (status === 409 || is409(msg)) {
      await restartPolling(bot, msg);
      return;
    }

    // User-facing error for user-triggered updates.
    try {
      const chatId = err?.ctx?.chat?.id;
      if (chatId) {
        await err.ctx.reply("Something went wrong. Please try again in a moment.");
      }
    } catch (e) {
      console.warn("[bot] failed to send user-facing error", { err: safeErr(e) });
    }
  });

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

  await startRunnerOnce(bot);

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
