"use client";

import { useEffect, useRef } from "react";

const SHOE_MOTION = "Shoe Showcase — Editorial Cut";
const HOOK_STYLE_RE = /\s*·\s*Hook\s*([1-5])\s*$/i;

function stripHookStyle(style: string) {
  return String(style || "").replace(HOOK_STYLE_RE, "").trim();
}

function hookIndexFromStyle(style: string) {
  const match = String(style || "").match(HOOK_STYLE_RE);
  const value = match ? Number(match[1]) : 1;
  return Number.isFinite(value) ? Math.max(1, Math.min(5, value)) : 1;
}

function encodeHookStyle(style: string, index: number) {
  const base = stripHookStyle(style);
  if (!base || base === SHOE_MOTION) return base;
  return `${base} · Hook ${Math.max(1, Math.min(5, index))}`;
}

function normalizedProductName(value: string) {
  return String(value || "").toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/[_|/]+/g, " ").replace(/[^a-z0-9' -]+/g, " ").replace(/\s+/g, " ").trim();
}

function hookOptions(productName: string, focus: string) {
  const raw = normalizedProductName(productName);
  const f = String(focus || "").toLowerCase();
  let category = "outfit";
  let primary = "the perfect fit >>>";
  if (raw.includes("jean")) { category = "pants"; primary = "the perfect jeans"; }
  else if (raw.includes("polo") && (raw.includes("knit") || raw.includes("sweater"))) { category = "top"; primary = "polo knitwear >>>"; }
  else if (raw.includes("knit")) { category = "top"; primary = `${raw.includes("sleeveless") ? "sleeveless " : ""}knitwear >>>`; }
  else if (raw.includes("sweater")) { category = "top"; primary = "the perfect sweater"; }
  else if (raw.includes("hoodie") && ["set", "pant", "jogger", "sweat"].some(x => raw.includes(x))) { category = "set"; primary = "the perfect cozy set"; }
  else if (raw.includes("set")) { category = "set"; primary = "the perfect set for fall"; }
  else if (raw.includes("hoodie")) { category = "top"; primary = "hoodie season >>>"; }
  else if (raw.includes("dress")) { category = "dress"; primary = "the perfect everyday dress"; }
  else if (["pants", "trouser", "cargo"].some(x => raw.includes(x)) || f === "pants") { category = "pants"; primary = "the perfect everyday pants"; }
  else if (["shirt", "tee", "top", "blouse"].some(x => raw.includes(x)) || ["shirt", "hoodie"].includes(f)) { category = "top"; primary = "the perfect everyday top"; }
  else if (["shoe", "sneaker", "boot", "heel", "loafer"].some(x => raw.includes(x)) || f === "shoes") { category = "shoes"; primary = "the perfect pair >>>"; }
  else if (["bag", "purse", "handbag"].some(x => raw.includes(x)) || f === "handbag") { category = "bag"; primary = "the perfect everyday bag"; }

  const map: Record<string, string[]> = {
    pants: [primary, "these fit way too good >>>", "found my new favorite pants", "the fit on these >>>", "need these in every color"],
    top: [primary, "this top is too good >>>", "found my new favorite top", "the fit on this >>>", "need this in every color"],
    set: [primary, "this set is too good >>>", "the easiest outfit ever", "found my new favorite set", "need this in every color"],
    dress: [primary, "this dress is too good >>>", "found my new favorite dress", "the fit on this >>>", "need this in every color"],
    shoes: [primary, "these look even better on >>>", "found my new favorite pair", "the shape on these >>>", "need these in every color"],
    bag: [primary, "this bag goes with everything", "found my new everyday bag", "the details on this >>>", "need this in every color"],
    outfit: [primary, "this fit is too good >>>", "found my new favorite outfit", "the fit on this >>>", "need this in every color"],
  };
  return (map[category] || map.outfit).slice(0, 5);
}

export default function HookPickerControl() {
  const hookIndexRef = useRef(1);
  const currentKeyRef = useRef("");

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      let nextInit = init;
      if (method === "POST" && /\/api\/backend\/jobs\/[^/]+\/references(?:\?|$)/.test(url) && typeof init?.body === "string") {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          if (typeof body.motion_style === "string" && body.motion_style !== SHOE_MOTION) {
            body.motion_style = encodeHookStyle(body.motion_style, hookIndexRef.current);
            nextInit = { ...init, body: JSON.stringify(body) };
          }
        } catch {}
      }
      return originalFetch(input, nextInit);
    };

    const mountPicker = () => {
      const modal = document.querySelector<HTMLElement>(".photoModal");
      if (!modal || modal.querySelector(".shoePreGen")) { currentKeyRef.current = ""; return; }
      const preGen = modal.querySelector<HTMLElement>(".preGenSettings");
      if (!preGen) return;
      const selects = preGen.querySelectorAll<HTMLSelectElement>("select");
      const focusSelect = selects[0];
      const motionSelect = selects[2];
      if (!focusSelect || !motionSelect) return;

      const productName = modal.querySelector<HTMLElement>(".modalSub")?.textContent?.trim() || "Product";
      const key = `${productName}|${focusSelect.value}`;
      let panel = modal.querySelector<HTMLElement>("[data-onscreen-hook-picker]");
      if (!panel || currentKeyRef.current !== key) {
        panel?.remove();
        hookIndexRef.current = hookIndexFromStyle(motionSelect.value);
        currentKeyRef.current = key;
        panel = document.createElement("div");
        panel.className = "preGenSettings";
        panel.dataset.onscreenHookPicker = "true";

        const head = document.createElement("div");
        head.className = "preGenHead";
        const title = document.createElement("b");
        title.textContent = "On-screen hook";
        const help = document.createElement("span");
        help.textContent = "Choose 1 of 5 for the finished video.";
        head.append(title, help);

        const chips = document.createElement("div");
        chips.className = "choiceChips";
        hookOptions(productName, focusSelect.value).forEach((hook, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = hookIndexRef.current === index + 1 ? "choiceChip selected" : "choiceChip";
          button.textContent = hook;
          button.onclick = () => {
            hookIndexRef.current = index + 1;
            chips.querySelectorAll("button").forEach((item, i) => item.classList.toggle("selected", i === index));
          };
          chips.appendChild(button);
        });
        panel.append(head, chips);
        preGen.insertAdjacentElement("afterend", panel);
      }
    };

    const timer = window.setInterval(mountPicker, 400);
    mountPicker();
    return () => {
      window.clearInterval(timer);
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
