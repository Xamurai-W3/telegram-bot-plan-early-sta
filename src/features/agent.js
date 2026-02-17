import { cfg } from "../lib/config.js";
import { safeErr } from "../lib/safeErr.js";
import { addTurn, getRecentTurns } from "../lib/memory.js";
import { aiChat } from "../lib/ai.js";
import { buildBotProfile } from "../lib/botProfile.js";

const perChatLock = new Set();
let globalInflight = 0;

function disclaimerLine() {
  return "Not financial advice. High risk. Do your own research.";
}

function clampText(s, max = 2500) {
  const t = String(s || "");
  return t.length > max ? t.slice(0, max) : t;
}

function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error("AI_TIMEOUT")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

export function registerAgent(bot) {
  bot.on("message:text", async (ctx, next) => {
    const raw = ctx.message?.text || "";
    if (raw.startsWith("/")) return next();

    const chatType = ctx.chat?.type || "private";
    const isPrivate = chatType === "private";

    const botUsername = (ctx.me && ctx.me.username) || (ctx.botInfo && ctx.botInfo.username) || "";
    const replyTo = ctx.message?.reply_to_message;

    const isReplyToBot =
      !!(replyTo?.from?.is_bot) &&
      !!botUsername &&
      String(replyTo?.from?.username || "").toLowerCase() === String(botUsername).toLowerCase();

    const ents = Array.isArray(ctx.message?.entities) ? ctx.message.entities : [];
    const isMentioned =
      !!botUsername &&
      ents.some((e) => {
        if (!e || e.type !== "mention") return false;
        const s = raw.slice(e.offset, e.offset + e.length);
        return s.toLowerCase() === ("@" + String(botUsername).toLowerCase());
      });

    if (!isPrivate && !isMentioned && !isReplyToBot) return next();

    let userText = raw;
    if (botUsername) {
      const re = new RegExp("@" + String(botUsername) + "\\b", "ig");
      userText = userText.replace(re, " ").trim();
    }

    if (!userText) {
      return ctx.reply("What should I help you with? Try /trending or /gem <query>.");
    }

    const userId = String(ctx.from?.id || "");
    const chatId = String(ctx.chat?.id || "");
    const lockKey = `${userId}:${chatId}`;

    if (perChatLock.has(lockKey)) {
      return ctx.reply("I’m working on your last request—please wait.");
    }

    if (globalInflight >= (cfg.GLOBAL_AI_INFLIGHT_MAX || 1)) {
      return ctx.reply("Busy right now, try again in a moment.");
    }

    perChatLock.add(lockKey);
    globalInflight++;

    const started = Date.now();
    const timeoutMs = Number(cfg.AI_TIMEOUT_MS || 45_000);

    try {
      await addTurn({
        mongoUri: cfg.MONGODB_URI,
        platform: "telegram",
        userId,
        chatId,
        role: "user",
        text: userText
      });

      const history = await getRecentTurns({
        mongoUri: cfg.MONGODB_URI,
        platform: "telegram",
        userId,
        chatId,
        limit: 16
      });

      const botProfile = buildBotProfile();
      const messages = [
        { role: "system", content: botProfile },
        ...history.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: clampText(m.text, 2000)
        })),
        {
          role: "system",
          content:
            "Response style: concise, risk-first, best-effort. Avoid hype. If data is uncertain or missing, say so plainly. End with a short disclaimer line."
        }
      ];

      const meta = {
        platform: "telegram",
        feature: "agent",
        userId,
        chatId,
        textLen: userText.length
      };

      console.log("[ai] agent call start", meta);

      const res = await withTimeout(
        aiChat(cfg, { messages, meta }, { timeoutMs: timeoutMs, retries: cfg.AI_MAX_RETRIES }),
        timeoutMs + 1500
      );

      const reply = String(res?.json?.output?.content || "").trim();

      console.log("[ai] agent call ok", {
        userId,
        chatId,
        ms: Date.now() - started,
        hasText: !!reply
      });

      if (!res?.ok || !reply) {
        const msg = res?.status === 412
          ? "AI isn’t configured yet on the server. Try /help, /trending, or /gem <query>."
          : "Something went wrong. Please try again.";

        await addTurn({
          mongoUri: cfg.MONGODB_URI,
          platform: "telegram",
          userId,
          chatId,
          role: "assistant",
          text: msg
        });

        return ctx.reply(msg);
      }

      const finalText = reply.includes("Not financial advice")
        ? reply
        : `${reply}\n\n${disclaimerLine()}`;

      await addTurn({
        mongoUri: cfg.MONGODB_URI,
        platform: "telegram",
        userId,
        chatId,
        role: "assistant",
        text: finalText
      });

      await ctx.reply(clampText(finalText, 3500));
    } catch (e) {
      console.warn("[ai] agent call fail", {
        userId,
        chatId,
        ms: Date.now() - started,
        err: String(safeErr(e)).slice(0, 300)
      });
      return ctx.reply("Something went wrong. Please try again.");
    } finally {
      globalInflight = Math.max(0, globalInflight - 1);
      perChatLock.delete(lockKey);
    }
  });
}
