
Troubleshooting: bot not responding
1) Webhook conflicts
This bot uses long polling. On boot it calls deleteWebhook({ drop_pending_updates: true }) to prevent webhook conflicts and stale backlogs.

2) 409 Conflict (overlapping deploys)
During deploys, two instances can overlap briefly. If Telegram returns a 409 Conflict (another getUpdates is running), the bot backs off and restarts polling with an exponential delay.

3) Required env vars
If TELEGRAM_BOT_TOKEN is missing, the bot will not start. If COOKMYBOTS_AI_ENDPOINT or COOKMYBOTS_AI_KEY are missing, /gem and the chat agent will fall back with a short error message.
