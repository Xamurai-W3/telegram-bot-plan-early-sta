import { cfg } from "../lib/config.js";
import { safeErr } from "../lib/safeErr.js";
import { listAlertEnabledUsers } from "../services/alertsStore.js";
import { listWatchlist } from "../services/watchlist.js";
import { fetchTokenSnapshot } from "../services/cryptoData.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pct(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return ((a - b) / b) * 100;
}

export function startAlertsLoop(bot) {
  if (!cfg.ALERTS_ENABLED) {
    console.log("[alerts] disabled", { enabled: false });
    return;
  }

  console.log("[alerts] enabled", {
    enabled: true,
    intervalMs: cfg.ALERTS_POLL_INTERVAL_MS
  });

  let running = false;
  let cycle = 0;

  (async () => {
    while (true) {
      const started = Date.now();
      cycle++;

      if (running) {
        await sleep(cfg.ALERTS_POLL_INTERVAL_MS);
        continue;
      }

      running = true;
      try {
        console.log("[alerts] cycle start", { cycle });

        const usersRes = await listAlertEnabledUsers({
          mongoUri: cfg.MONGODB_URI,
          platform: "telegram",
          limit: 200
        });

        const users = usersRes?.ok ? usersRes.users : [];

        for (const userId of users.slice(0, 50)) {
          const wl = await listWatchlist({
            mongoUri: cfg.MONGODB_URI,
            platform: "telegram",
            userId
          });

          const items = wl?.ok ? wl.items : [];
          for (const item of items.slice(0, 10)) {
            const snapRes = await fetchTokenSnapshot({ chain: item.chain, address: item.address });
            if (!snapRes?.ok) continue;

            const snap = snapRes.snapshot;
            const prev = item.lastSnapshot;

            if (prev) {
              const prevVol = Number(prev.volume24hUsd || 0);
              const curVol = Number(snap.volume24hUsd || 0);
              const prevLiq = Number(prev.liquidityUsd || 0);
              const curLiq = Number(snap.liquidityUsd || 0);

              const volChg = pct(curVol, prevVol);
              const liqChg = pct(curLiq, prevLiq);

              const volSpike = volChg != null && volChg >= 150 && curVol >= 25_000;
              const liqDrop = liqChg != null && liqChg <= -40 && prevLiq >= 10_000;

              if (volSpike || liqDrop) {
                const why = volSpike
                  ? `Volume spike: +${Math.round(volChg)}% (24h)`
                  : `Liquidity drop: ${Math.round(liqChg)}%`;

                const text = [
                  "Watchlist alert (best-effort)",
                  `${item.symbol || item.name || item.address} on ${item.chain || "unknown chain"}`,
                  why,
                  "Use /gem to re-check details.",
                  "Not financial advice."
                ].join("\n");

                try {
                  await bot.api.sendMessage(userId, text);
                } catch (e) {
                  console.warn("[alerts] sendMessage failed", { err: safeErr(e) });
                }
              }
            }

            await sleep(250);
          }
        }

        const ms = Date.now() - started;
        console.log("[alerts] cycle ok", { cycle, ms });
      } catch (e) {
        console.warn("[alerts] cycle fail", { cycle, err: safeErr(e) });
      } finally {
        running = false;
        await sleep(cfg.ALERTS_POLL_INTERVAL_MS);
      }
    }
  })();
}
