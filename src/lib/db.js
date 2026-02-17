import { MongoClient } from "mongodb";
import { safeErr } from "./safeErr.js";

let _client = null;
let _db = null;
let _warnedNoMongo = false;

export async function getDb(mongoUri) {
  if (!mongoUri) {
    if (!_warnedNoMongo) {
      _warnedNoMongo = true;
      console.warn("[db] MONGODB_URI not set. Falling back to in-memory storage.");
    }
    return null;
  }
  if (_db) return _db;

  try {
    _client = new MongoClient(mongoUri, {
      maxPoolSize: 5,
      ignoreUndefined: true
    });
    await _client.connect();
    _db = _client.db();

    try {
      await ensureIndexes(_db);
    } catch (e) {
      console.warn("[db] ensureIndexes failed:", safeErr(e));
    }

    console.log("[db] connected", { mongo: true });
    return _db;
  } catch (e) {
    console.error("[db] connect failed:", safeErr(e));
    return null;
  }
}

async function ensureIndexes(db) {
  await db.collection("memory_messages").createIndex({ platform: 1, userId: 1, ts: -1 });
  await db.collection("watchlists").createIndex({ platform: 1, userId: 1 });
  await db.collection("alert_settings").createIndex({ platform: 1, userId: 1 });
}
