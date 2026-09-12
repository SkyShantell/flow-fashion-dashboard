"use client";

import { useEffect } from "react";

const PACK_VERSION = "flow-apple-emoji-pack-v1";
const APPLE_EMOJIS = [
  "🤎","🖤","🤍","❤️","🩷","🧡","💛","💚","💙","💜","🩶",
  "💕","💖","💗","💓","💘","💝","💞","💟","❣️","♥️",
  "✨","⭐️","🌟","💫","⚡️","🔥","☀️","🌙","❄️","☁️","🌈",
  "🍂","🍁","🌿","☘️","🌸","🌷","🌹","🌺","🌼","🌻","🪻",
  "🐆","🐻","🧸","🐰","🐱","🐶","🦋","🐝","🕊️",
  "🎀","💎","🪩","🎉","🎊","🎁","💌","💐","🕯️","🧿",
  "🛍️","🛒","👟","👠","👢","🥿","🩴","👜","👛","🎒","💍","🕶️","🧢","👒",
  "☕️","🥂","🍓","🍒","🍋","🍑","🍎","🍪","🍰","🍫",
  "😍","🥰","🤩","😘","😊","😭","😂","🤣","😮","😱","😩","🥹","😌","😎",
  "🫶","🙌","👏","🤝","🙏","💅","👀","👉","👈","☝️","✌️","🤞","👌","👍","💯"
];

function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const text = `${navigator.platform || ""} ${navigator.userAgent || ""}`;
  return /Mac|iPhone|iPad|iPod/i.test(text);
}

function renderAppleEmoji(token: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, 220, 220);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 154;
  while (size > 84) {
    ctx.font = `${size}px "Apple Color Emoji", sans-serif`;
    if (ctx.measureText(token).width <= 198) break;
    size -= 8;
  }
  ctx.font = `${size}px "Apple Color Emoji", sans-serif`;
  ctx.fillText(token, 110, 114);
  return canvas.toDataURL("image/png");
}

async function seedPack() {
  const chunkSize = 12;
  for (let start = 0; start < APPLE_EMOJIS.length; start += chunkSize) {
    const tokens = APPLE_EMOJIS.slice(start, start + chunkSize);
    const pngs = tokens.map(renderAppleEmoji);
    const response = await fetch("/api/backend/api/apple-emoji-assets", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokens, pngs, source: "apple_browser" }),
    });
    if (!response.ok) throw new Error(`Apple emoji seed failed (${response.status})`);
  }
}

export default function AppleEmojiSeeder() {
  useEffect(() => {
    if (!isAppleDevice()) return;
    try {
      if (window.localStorage.getItem(PACK_VERSION) === "done") return;
    } catch {
      // Continue without localStorage; the backend upserts safely.
    }

    let cancelled = false;
    void seedPack()
      .then(() => {
        if (cancelled) return;
        try { window.localStorage.setItem(PACK_VERSION, "done"); } catch {}
      })
      .catch(() => {
        // Silent on purpose. A later page load retries; normal dashboard use is unaffected.
      });
    return () => { cancelled = true; };
  }, []);

  return null;
}
