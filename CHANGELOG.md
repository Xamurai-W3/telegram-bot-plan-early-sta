
## 2026-02-17 12:05:00. UTC
- Reliability: fixed startup crash, hardened long polling with webhook deletion and 409 conflict restart backoff.
- Diagnostics: added safer boot env logging (booleans only), AI call logs with latency, and heartbeat/memory logs.
- Agent: added strict backpressure (per-chat lock + global cap) and hard timeout so slow AI can’t stall responsiveness.
