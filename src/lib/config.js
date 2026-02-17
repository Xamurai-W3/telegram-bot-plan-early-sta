export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  MONGODB_URI: process.env.MONGODB_URI || "",

  COOKMYBOTS_AI_ENDPOINT:
    process.env.COOKMYBOTS_AI_ENDPOINT || "https://api.cookmybots.com/api/ai",
  COOKMYBOTS_AI_KEY: process.env.COOKMYBOTS_AI_KEY || "",

  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS || 600000),
  AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES || 2),
  AI_MODEL: process.env.AI_MODEL || "",
  AI_DEBUG: String(process.env.AI_DEBUG || "0") === "1",

  CONCURRENCY: Math.max(1, Number(process.env.CONCURRENCY || 1)),
  GLOBAL_AI_INFLIGHT_MAX: Math.max(1, Number(process.env.GLOBAL_AI_INFLIGHT_MAX || 2)),

  ALERTS_ENABLED: String(process.env.ALERTS_ENABLED || "false").toLowerCase() === "true",
  ALERTS_POLL_INTERVAL_MS: Math.max(
    60_000,
    Number(process.env.ALERTS_POLL_INTERVAL_MS || 300_000)
  )
};
