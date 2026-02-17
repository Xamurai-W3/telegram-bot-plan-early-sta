
## 2026-02-17 13:12:31. UTC
- Request: check for errors, bot doesnt work and it will show you the error first
- Summary: Fixed the production crash that was stopping the bot from polling by removing the invalid runner.task.catch usage (runner.task isn’t a Promise in @grammyjs/runner 2.0.3). Polling now starts safely once, always clears we…
- Files: .env.sample, DOCS.md, README.md, package.json, src/features/agent.js, src/index.js, src/lib/config.js, src/services/watchlist.js

## 2026-02-17 12:13:35. UTC
- Request: The bot is not responding to commands. Pls fix it
- Summary: Fixed command responsiveness by enforcing strict routing order (commands registered before the agent) and ensuring the agent always passes through slash commands via next(). Also fixed the production crash causing the b…
- Files: .env.sample, package.json, src/bot.js, src/features/agent.js, src/index.js, src/lib/config.js

## 2026-02-17 11:58:15. UTC
- Request: The bot is not responding, can you fix thar
- Summary: Fixed the immediate boot crash (“Unexpected end of input”) by making command registration properly awaited, then hardened polling reliability: webhook deletion on boot, runner concurrency pinned to 1, and a restart loop…
- Files: .env.sample, CHANGELOG.md, DOCS.md, README.md, package.json, src/bot.js, src/features/agent.js, src/features/alerts.js, src/index.js, src/lib/config.js, src/services/watchlist.js

## 2026-02-17 12:05:00. UTC
- Reliability: fixed startup crash, hardened long polling with webhook deletion and 409 conflict restart backoff.
- Diagnostics: added safer boot env logging (booleans only), AI call logs with latency, and heartbeat/memory logs.
- Agent: added strict backpressure (per-chat lock + global cap) and hard timeout so slow AI can’t stall responsiveness.
