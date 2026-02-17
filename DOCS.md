Gem Scout helps you discover and evaluate early-stage crypto tokens with a risk-first scorecard. It can also keep a watchlist and (optionally) send alerts.

This is informational only and not financial advice. Always do your own research.

Commands
1) /start
What it does: Welcome, short disclaimer, and quick examples.
Usage: /start
Notes: Warns if MongoDB isn’t configured so memory and watchlists are temporary.

2) /help
What it does: Shows all commands and examples.
Usage: /help

3) /gem <query>
What it does: Finds a token by symbol, name, or contract address and returns a structured scorecard.
Usage: /gem PEPE
Usage: /gem 0x...
Notes: If multiple matches are found, the bot asks you to clarify.

4) /trending [chain]
What it does: Shows a short list of trending/new tokens (best-effort).
Usage: /trending
Usage: /trending solana

5) /watch add <query>
What it does: Adds a resolved token to your watchlist.
Usage: /watch add PEPE

6) /watch remove <query>
What it does: Removes a token from your watchlist.
Usage: /watch remove PEPE

7) /watch list
What it does: Displays your current watchlist.
Usage: /watch list

8) /alert on | off
What it does: Enables or disables alerts.
Usage: /alert on
Usage: /alert off
Notes: Alerts only run if the server has ALERTS_ENABLED=true.

9) /reset [all]
What it does: Clears your long-term chat memory. If you pass 'all', it also clears your watchlist.
Usage: /reset
Usage: /reset all

Environment variables
1) TELEGRAM_BOT_TOKEN (required)
2) COOKMYBOTS_AI_ENDPOINT (required for AI). Must be a base URL like https://api.cookmybots.com/api/ai
3) COOKMYBOTS_AI_KEY (required for AI)
4) MONGODB_URI (optional but recommended)
5) ALERTS_ENABLED (optional, default false)
6) AI_TIMEOUT_MS (optional, default 600000)
7) AI_MAX_GLOBAL_INFLIGHT (optional, default 1)
8) LOG_LEVEL (optional, default info)

Reliability notes
1) The bot uses long polling with @grammyjs/runner and clears any webhook on boot.
2) If Telegram returns 409 Conflict (usually deploy overlap), the bot backs off and restarts polling.
3) When a user action triggers an error, the bot replies with a short friendly message while logging diagnostics safely.
