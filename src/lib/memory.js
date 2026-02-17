import { getDb } from "./db.js";
import { safeErr } from "./safeErr.js";

const COL = "memory_messages";

const inMem = {
  warned: false,
  byUser: new Map()
};

function memKey({ platform, userId, chatId }) {
  return `${platform}:${String(userId || "")}:${String(chatId || "")}`;
}

function getMemArr(key) {
  let arr = inMem.byUser.get(key);
  if (!arr) {
    arr = [];
    inMem.byUser.set(key, arr);
  }
  return arr;
}

export async function addTurn({ mongoUri, platform, userId, chatId, role, text }) {
  const doc = {
    platform,
    userId: String(userId || ""),
    chatId: chatId ? String(chatId) : "",
    role,
    text: String(text || "").slice(0, 4000),
    ts: new Date()
  };

  const db = await getDb(mongoUri);
  if (!db) {
    if (!inMem.warned) {
      inMem.warned = true;
      console.warn("[memory] using in-memory store (no MongoDB)");
    }
    const key = memKey(doc);
    const arr = getMemArr(key);
    arr.push({ role: doc.role, text: doc.text, ts: doc.ts });
    if (arr.length > 50) arr.splice(0, arr.length - 50);
    return;
  }

  try {
    await db.collection(COL).insertOne(doc);
  } catch (e) {
    console.error("[db] insertOne failed", { collection: COL, op: "insertOne", err: safeErr(e) });
  }
}

export async function getRecentTurns({ mongoUri, platform, userId, chatId, limit = 14 }) {
  const db = await getDb(mongoUri);
  if (!db) {
    const key = memKey({ platform, userId, chatId });
    const arr = inMem.byUser.get(key) || [];
    return arr.slice(-limit).map((r) => ({ role: r.role, text: r.text }));
  }

  const q = {
    platform,
    userId: String(userId || "")
  };
  if (chatId) q.chatId = String(chatId);

  try {
    const rows = await db
      .collection(COL)
      .find(q)
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();

    return rows.reverse().map((r) => ({ role: r.role, text: r.text }));
  } catch (e) {
    console.error("[db] find failed", { collection: COL, op: "find", err: safeErr(e) });
    return [];
  }
}

export async function clearUserMemory({ mongoUri, platform, userId, chatId }) {
  const db = await getDb(mongoUri);
  if (!db) {
    const key = memKey({ platform, userId, chatId });
    inMem.byUser.delete(key);
    return;
  }

  const q = { platform, userId: String(userId || "") };
  if (chatId) q.chatId = String(chatId);

  try {
    await db.collection(COL).deleteMany(q);
  } catch (e) {
    console.error("[db] deleteMany failed", { collection: COL, op: "deleteMany", err: safeErr(e) });
  }
}
