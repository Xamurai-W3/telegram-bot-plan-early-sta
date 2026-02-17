import { getDb } from "../lib/db.js";
import { safeErr } from "../lib/safeErr.js";

const COL = "alert_settings";

const mem = {
  byUser: new Map()
};

function key(platform, userId) {
  return `${platform}:${String(userId || "")}`;
}

export async function setAlertsEnabled({ mongoUri, platform, userId, enabled }) {
  const en = !!enabled;
  const db = await getDb(mongoUri);

  if (!db) {
    mem.byUser.set(key(platform, userId), en);
    return { ok: true, enabled: en, persisted: false };
  }

  try {
    await db.collection(COL).updateOne(
      { platform, userId: String(userId || "") },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: { enabled: en, updatedAt: new Date() }
      },
      { upsert: true }
    );

    return { ok: true, enabled: en, persisted: true };
  } catch (e) {
    console.error("[db] updateOne failed", { collection: COL, op: "updateOne", err: safeErr(e) });
    return { ok: false, error: "DB_WRITE_FAILED" };
  }
}

export async function getAlertsEnabled({ mongoUri, platform, userId }) {
  const db = await getDb(mongoUri);

  if (!db) {
    const v = mem.byUser.get(key(platform, userId));
    return { ok: true, enabled: !!v, persisted: false };
  }

  try {
    const doc = await db.collection(COL).findOne({ platform, userId: String(userId || "") });
    return { ok: true, enabled: !!doc?.enabled, persisted: true };
  } catch (e) {
    console.error("[db] findOne failed", { collection: COL, op: "findOne", err: safeErr(e) });
    return { ok: false, error: "DB_READ_FAILED", enabled: false };
  }
}

export async function listAlertEnabledUsers({ mongoUri, platform, limit = 200 }) {
  const db = await getDb(mongoUri);
  if (!db) return { ok: true, users: [], persisted: false };

  try {
    const rows = await db
      .collection(COL)
      .find({ platform, enabled: true })
      .project({ userId: 1 })
      .limit(limit)
      .toArray();

    return { ok: true, users: rows.map((r) => String(r.userId || "")), persisted: true };
  } catch (e) {
    console.error("[db] find failed", { collection: COL, op: "find", err: safeErr(e) });
    return { ok: false, error: "DB_READ_FAILED", users: [], persisted: true };
  }
}
