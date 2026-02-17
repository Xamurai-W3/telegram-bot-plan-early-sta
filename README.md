Gem Scout is a Telegram bot that helps you discover and evaluate early-stage crypto tokens with a risk-first approach. It can show trending tokens, produce a structured scorecard for a token, maintain a watchlist, and optionally send alerts.

This bot is informational only and not financial advice. Always do your own research.

How it works
1) Telegram bot built with grammY.
2) AI-assisted analysis via the CookMyBots AI Gateway.
3) Long-term memory and watchlists stored in MongoDB when MONGODB_URI is set (falls back to in-memory when not).
4) Optional alerts loop that polls watchlists and notifies users when ALERTS_ENABLED is true.

Requirements
1) Node.js 18+
2) A Telegram bot token (TELEGRAM_BOT_TOKEN)
3) Optional: MongoDB (MONGODB_URI) for long-term memory and persistence

Setup
1) Install dependencies
npm install

2) Configure environment variables
Copy .env.sample to .env and fill in values.

3) Run locally
npm run dev

4) Run in production
npm start

Environment variables
1) TELEGRAM_BOT_TOKEN (required): Telegram bot token.
2) COOKMYBOTS_AI_ENDPOINT (required for AI features): Base URL like https://api.cookmybots.com/api/ai
3) COOKMYBOTS_AI_KEY (required for AI features): CookMyBots AI gateway key.
4) MONGODB_URI (optional): MongoDB connection string for long-term memory and watchlists.
5) ALERTS_ENABLED (optional, default false): Enable alerts polling loop.
6) ALERTS_POLL_INTERVAL_MS (optional, default 300000): Alerts loop interval.
7) AI_TIMEOUT_MS (optional, default 600000): Timeout for AI gateway calls.
8) AI_MAX_RETRIES (optional, default 2): Retry count for AI gateway calls.
9) CONCURRENCY (optional, default 1): grammY runner concurrency (kept at 1 by default for safety).
10) GLOBAL_AI_INFLIGHT_MAX (optional, default 2): Cap for simultaneous AI jobs.

Commands
/start
Shows a welcome message, short disclaimer, and examples.

/help
Lists available commands.

/gem <query>
Fetches best-effort token data and returns a structured scorecard (risk, momentum, fundamentals).

/trending [chain]
Lists trending tokens. Use /gem to drill down.

/watch add <query>
Adds a token to your watchlist.

/watch remove <query>
Removes a token from your watchlist.

/watch list
Shows your watchlist.

/alert on | off
Enables or disables alerts for your account (requires ALERTS_ENABLED=true on the server).

/reset
Clears your long-term memory messages. Offers an option to also clear your watchlist.

Database
Collections used when MONGODB_URI is set:
1) memory_messages: per-user conversation turns (user/assistant) for AI context.
2) watchlists: per-user watchlist items.
3) alert_settings: per-user alert enabled flag.

Deployment notes (Render)
1) This bot uses long polling with @grammyjs/runner.
2) On boot it clears any webhook with drop_pending_updates to prevent update backlog.
3) It tolerates 409 conflicts from overlapping deploys and backs off/restarts polling.

Troubleshooting
1) Bot not responding
Check logs and confirm TELEGRAM_BOT_TOKEN is set.

2) AI replies not working
Confirm COOKMYBOTS_AI_ENDPOINT and COOKMYBOTS_AI_KEY are set. The endpoint must be the base URL (do not include /chat).

3) Memory/watchlists reset on deploy
Set MONGODB_URI so state is persisted.
