import { getDb } from "../lib/db.js";
import { safeErr } from "../lib/safeErr.js";

const COL = "watchlists";

const mem = {
  warned: false,
  byUser: new Map()
};

function key(platform, userId) {
  return `${platform}:${String(userId || "")}`;
}

function clampItem(item) {
  const out = {
    chain: String(item?.chain || ""),
    address: String(item?.address || ""),
    symbol: String(item?.symbol || ""),
    name: String(item?.name || ""),
    addedAt: item?.addedAt instanceof Date ? item.addedAt : new Date(),
    lastCheckedAt: item?.lastCheckedAt instanceof Date ? item.lastCheckedAt : null,
    lastSnapshot: item?.lastSnapshot && typeof item.lastSnapshot === "object" ? item.lastSnapshot : null
  };

  if (out.lastSnapshot) {
    const s = out.lastSnapshot;
    out.lastSnapshot = {
      priceUsd: s.priceUsd || "",
      liquidityUsd: Number.isFinite(Number(s.liquidityUsd)) ? Number(s.liquidityUsd) : null,
      volume24hUsd: Number.isFinite(Number(s.volume24hUsd)) ? Number(s.volume24hUsd) : null,
      priceChange24hPct: Number.isFinite(Number(s.priceChange24hPct)) ? Number(s.priceChange24hPct) : null,
      ts: s.ts instanceof Date ? s.ts : new Date()
    };
  }

  return out;
}

export async function addToWatchlist({ mongoUri, platform, userId, token }) {
  const item = clampItem({
    chain: token.chain,
    address: token.address,
    symbol: token.symbol,
    name: token.name,
    addedAt: new Date()
  });

  const db = await getDb(mongoUri);
  if (!db) {
    if (!mem.warned) {
      mem.warned = true;
      console.warn("[watchlist] using in-memory store (no MongoDB)");
    }

    const k = key(platform, userId);
    const arr = mem.byUser.get(k) || [];
    const exists = arr.some((x) => x.address && x.chain && x.address === item.address && x.chain === item.chain);
    if (!exists) arr.push(item);
    mem.byUser.set(k, arr);
    return { ok: true, item, persisted: false };
  }

  try {
    await db.collection(COL).updateOne(
      { platform, userId: String(userId || "") },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: { updatedAt: new Date() },
        $addToSet: { items: item }
      },
      { upsert: true }
    );

    return { ok: true, item, persisted: true };
  } catch (e) {
    console.error("[db] updateOne failed", { collection: COL, op: "updateOne", err: safeErr(e) });
    return { ok: false, error: "DB_WRITE_FAILED" };
  }
}

export async function removeFromWatchlist({ mongoUri, platform, userId, chain, address }) {
  const c = String(chain || "");
  const a = String(address || "");

  const db = await getDb(mongoUri);
  if (!db) {
    const k = key(platform, userId);
    const arr = mem.byUser.get(k) || [];
    const next = arr.filter((x) => !(x.chain === c && x.address === a));
    mem.byUser.set(k, next);
    return { ok: true, persisted: false };
  }

  try {
    await db.collection(COL).updateOne(
      { platform, userId: String(userId || "") },
      {
        $set: { updatedAt: new Date() },
        $pull: { items: { chain: c, address: a } }
      },
      { upsert: true }
    );

    return { ok: true, persisted: true };
  } catch (e) {
    console.error("[db] updateOne failed", { collection: COL, op: "updateOne", err: safeErr(e) });
    return { ok: false, error: "DB_WRITE_FAILED" };
  }
}

export async function listWatchlist({ mongoUri, platform, userId }) {
  const db = await getDb(mongoUri);
  if (!db) {
    const k = key(platform, userId);
    const arr = mem.byUser.get(k) || [];
    return { ok: true, items: arr, persisted: false };
  }

  try {
    const doc = await db.collection(COL).findOne({ platform, userId: String(userId || "") });
    const items = Array.isArray(doc?.items) ? doc.items : [];
    return { ok: true, items, persisted: true };
  } catch (e) {
    console.error("[db] findOne failed", { collection: COL, op: "findOne", err: safeErr(e) });
    return { ok: false, error: "DB_READ_FAILED", items: [] };
  }
}

export async function clearWatchlist({ mongoUri, platform, userId }) {
  const db = await getDb(mongoUri);
  if (!db) {
    mem.byUser.delete(key(platform, userId));
    return { ok: true, persisted: false };
  }

  try {
    await db.collection(COL).updateOne(
      { platform, userId: String(userId || "") },
      {
        $setOnInsert: { },
        $set: { items: [], updatedAt: new Date() }
      },
      { upsert: true }
    );

    return { ok: true, persisted: true };
  } catch (e) {
    console.error("[db] updateOne failed", { collection: COL, op: "updateOne", err: safeErr(e) });
    return { ok: false, error: "DB_WRITE_FAILED" };
  }
}
