
Troubleshooting: bot not responding
1) This bot runs in long polling mode and clears any webhook on boot to avoid conflicts.
2) If you see Telegram 409 Conflict errors, it usually means two instances overlapped; the bot will back off and restart polling automatically.
3) Make sure TELEGRAM_BOT_TOKEN is set. AI responses require COOKMYBOTS_AI_ENDPOINT (base URL) and COOKMYBOTS_AI_KEY.
