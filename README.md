Gem Scout is a Telegram bot that helps you discover and evaluate early-stage crypto tokens with a risk-first approach. It can show trending tokens, produce a structured scorecard for a token, maintain a watchlist, and optionally send alerts.

This bot is informational only and not financial advice. Always do your own research.

How it works
1) Telegram bot built with grammY.
2) AI-assisted analysis via the CookMyBots AI Gateway (never calls OpenAI directly).
3) Long-term memory and watchlists stored in MongoDB when MONGODB_URI is set (falls back to in-memory when not).
4) Optional alerts loop that runs only when ALERTS_ENABLED=true.

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
2) COOKMYBOTS_AI_ENDPOINT (required for AI): Base URL like https://api.cookmybots.com/api/ai
3) COOKMYBOTS_AI_KEY (required for AI): CookMyBots AI gateway key.
4) MONGODB_URI (optional): Enables long-term memory and persistent watchlists.
5) ALERTS_ENABLED (optional, default false): Enables alerts loop.
6) AI_TIMEOUT_MS (optional, default 600000): AI gateway timeout.
7) AI_MAX_GLOBAL_INFLIGHT (optional, default 1): Caps simultaneous AI work.
8) LOG_LEVEL (optional, default info): Reserved for log verbosity controls.

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
Enables or disables alerts for your account. Alerts only run if ALERTS_ENABLED=true on the server.

/reset [all]
Clears your long-term memory. If you pass 'all', it also clears your watchlist.

Reliability (Render)
1) Runs in long polling mode via @grammyjs/runner.
2) On boot it calls deleteWebhook({ drop_pending_updates: true }) to prevent webhook conflicts.
3) If Telegram returns 409 Conflict (overlapping deploys), the bot backs off (2s, 5s, 10s, 20s) and restarts polling.
4) Process-level handlers log unhandledRejection and uncaughtException safely.

Troubleshooting
1) Bot not responding
Check logs for the boot line showing tokenSet: true. If TELEGRAM_BOT_TOKEN is missing, the service exits with a clear message.

2) AI replies not working
Confirm COOKMYBOTS_AI_ENDPOINT and COOKMYBOTS_AI_KEY are set. The endpoint must be the base URL (do not include /chat).

3) Memory/watchlists reset on deploy
Set MONGODB_URI so state is persistent. Without it, the bot uses an in-memory fallback.
