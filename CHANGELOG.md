
## 2026-02-17 11:58:15. UTC
- Request: The bot is not responding, can you fix thar
- Summary: Fixed the immediate boot crash (“Unexpected end of input”) by making command registration properly awaited, then hardened polling reliability: webhook deletion on boot, runner concurrency pinned to 1, and a restart loop…
- Files: .env.sample, CHANGELOG.md, DOCS.md, README.md, package.json, src/bot.js, src/features/agent.js, src/features/alerts.js, src/index.js, src/lib/config.js, src/services/watchlist.js

## 2026-02-17 12:05:00. UTC
- Reliability: fixed startup crash, hardened long polling with webhook deletion and 409 conflict restart backoff.
- Diagnostics: added safer boot env logging (booleans only), AI call logs with latency, and heartbeat/memory logs.
- Agent: added strict backpressure (per-chat lock + global cap) and hard timeout so slow AI can’t stall responsiveness.
