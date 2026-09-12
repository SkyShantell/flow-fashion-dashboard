"use client";

import { useEffect, useRef } from "react";

const SHOE_MOTION = "Shoe Showcase — Editorial Cut";
const HOOK_STYLE_RE = /\s*·\s*Hook\s*([1-5])\s*$/i;

function stripHookStyle(style: string) {
  return String(style || "").replace(HOOK_STYLE_RE, "").trim();
}

function hookIndexFromStyle(style: string) {
  const match = String(style || "").match(HOOK_STYLE_RE);
  const parsed = match ? Number(match[1]) : 1;
  return Number.isFinite(parsed) ? Math.max(1, Math.min(5, parsed)) : 1;
}

function encodeHookStyle(style: string, index: number) {
  const base = stripHookStyle(style);
  if (!base || base === SHOE_MOTION) return base;
  return `${base} · Hook ${Math.max(1, Math.min(5, index))}`;
}

function normalizedProductName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[_|/]+/g, " ")
    .replace(/[^a-z0-9' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hookProfile(productName: string, focus: string): [string, string] {
  const raw = normalizedProductName(productName);
  const resolvedFocus = String(focus || "").toLowerCase();

  if (raw.includes("jean")) return ["pants", "the perfect jeans"];
  if (raw.includes("polo") && (raw.includes("knit") || raw.includes("sweater"))) return ["top", "polo knitwear >>>"];
  if (raw.includes("knit")) return ["top", `${raw.includes("sleeveless") ? "sleeveless " : ""}knitwear >>>`];
  if (raw.includes("sweater")) return ["top", "the perfect sweater"];
  if (raw.includes("hoodie") && ["set", "pant", "jogger", "sweat"].some(x => raw.includes(x))) return ["set", "the perfect cozy set"];
  if (raw.includes("set")) return ["set", "the perfect set for fall"];
  if (raw.includes("hoodie")) return ["top", "hoodie season >>>"];
  if (raw.includes("dress")) return ["dress", "the perfect everyday dress"];
  if (["pants", "trouser", "cargo"].some(x => raw.includes(x)) || resolvedFocus === "pants") return ["pants", "the perfect everyday pants"];
  if (["shirt", "tee", "top", "blouse"].some(x => raw.includes(x)) || ["shirt", "hoodie"].includes(resolvedFocus)) return ["top", "the perfect everyday top"];
  if (["shoe", "sneaker", "boot", "heel", "loafer"].some(x => raw.includes(x)) || resolvedFocus === "shoes") return ["shoes", "the perfect pair >>>"];
  if (["bag", "purse", "handbag"].some(x => raw.includes(x)) || resolvedFocus === "handbag") return ["bag", "the perfect everyday bag"];
  return ["outfit", "the perfect fit >>>"];
}

function hookOptions(productName: string, focus: string) {
  const [category, primary] = hookProfile(productName, focus);
  const map: Record<string, string[]> = {
    pants: [primary, "these fit way too good >>>", "found my new favorite pants", "the fit on these >>>", "need these in every color"],
    top: [primary, "this top is too good >>>", "found my new favorite top", "the fit on this >>>", "need this in every color"],
    set: [primary, "this set is too good >>>", "the easiest outfit ever", "found my new favorite set", "need this in every color"],
    dress: [primary, "this dress is too good >>>", "found my new favorite dress", "the fit on this >>>", "need this in every color"],
    shoes: [primary, "these look even better on >>>", "found my new favorite pair", "the shape on these >>>", "need these in every color"],
    bag: [primary, "this bag goes with everything", "found my new everyday bag", "the details on this >>>", "need this in every color"],
    outfit: [primary, "this fit is too good >>>", "found my new favorite outfit", "the fit on this >>>", "need this in every color"],
  };
  const out: string[] = [];
  for (const value of map[category] || map.outfit) {
    const cleaned = String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (cleaned && !out.includes(cleaned)) out.push(cleaned);
  }
  for (const value of ["this one is too good >>>", "adding this to the rotation", "the details on this >>>"]) {
    if (out.length >= 5) break;
    if (!out.includes(value)) out.push(value);
  }
  return out.slice(0, 5);
}

export default function HookPickerControl() {
  const hookIndexRef = useRef(1);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const patchedFetch: typeof window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      let nextInit = init;

      if (
        method === "POST" &&
        /\/api\/backend\/jobs\/[^/]+\/references(?:\?|$)/.test(url) &&
        typeof init?.body === "string"
      ) {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          if (typeof body.motion_style === "string" && body.motion_style !== SHOE_MOTION) {
            body.motion_style = encodeHookStyle(body.motion_style, hookIndexRef.current);
            nextInit = { ...init, body: JSON.stringify(body) };
          }
        } catch {
          // Leave the original request untouched if the body is not JSON.
        }
      }

      return originalFetch(input, nextInit);
    };

    window.fetch = patchedFetch;

    const cleanEncodedLabels = () => {
      document.querySelectorAll<HTMLElement>(".productionBadges span").forEach(span => {
        const current = span.textContent || "";
        if (HOOK_STYLE_RE.test(current)) span.textContent = stripHookStyle(current);
      });
      document.querySelectorAll<HTMLOptionElement>(".photoModal select option").forEach(option => {
        if (HOOK_STYLE_RE.test(option.textContent || "")) option.textContent = stripHookStyle(option.textContent || "");
      });
    };

    const renameRegenerateButtons = () => {
      document.querySelectorAll<HTMLElement>(".jobCard").forEach(card => {
        const completed = Array.from(card.querySelectorAll<HTMLElement>(".jobMeta span"))
          .some(span => (span.textContent || "").trim().toLowerCase() === "video: completed");
        const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>(".jobActions button"));
        const promptButton = buttons.find(button => ["video prompt", "regenerate video"].includes((button.textContent || "").trim().toLowerCase()));
        if (!promptButton) return;
        promptButton.textContent = completed ? "Regenerate video" : "Video prompt";
      });
    };

    const ensureHookPicker = () => {
      const modal = document.querySelector<HTMLElement>(".photoModal");
      if (!modal || modal.querySelector(".shoePreGen")) return;

      const preGen = modal.querySelector<HTMLElement>(".preGenSettings");
      if (!preGen) return;
      const selects = preGen.querySelectorAll<HTMLSelectElement>("select");
      const focusSelect = selects[0];
      const motionSelect = selects[2];
      if (!focusSelect || !motionSelect) return;

      const productName = modal.querySelector<HTMLElement>(".modalSub")?.textContent?.trim() || "Product";
      const key = `${productName}|${focusSelect.value}`;
      const existing = modal.querySelector<HTMLElement>("[data-onscreen-hook-picker]");
      if (existing?.dataset.key === key) return;
      existing?.remove();

      hookIndexRef.current = hookIndexFromStyle(motionSelect.value);

      const panel = document.createElement("div");
      panel.className = "preGenSettings";
      panel.dataset.onscreenHookPicker = "true";
      panel.dataset.key = key;

      const head = document.createElement("div");
      head.className = "preGenHead";
      const title = document.createElement("b");
      title.textContent = "On-screen hook";
      const help = document.createElement("span");
      help.textContent = "Pick 1 of 5. This is the text burned onto the finished video — it is separate from the video prompt.";
      head.append(title, help);

      const chips = document.createElement("div");
      chips.className = "choiceChips";

      const render = () => {
        chips.replaceChildren();
        const options = hookOptions(productName, focusSelect.value);
        options.forEach((hook, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = hookIndexRef.current === index + 1 ? "choiceChip selected" : "choiceChip";
          button.textContent = hook;
          button.addEventListener("click", () => {
            hookIndexRef.current = index + 1;
            Array.from(chips.querySelectorAll<HTMLButtonElement>("button")).forEach((item, buttonIndex) => {
              item.classList.toggle("selected", buttonIndex === index);
            });
          });
          chips.appendChild(button);
        });
      };

      focusSelect.addEventListener("change", () => {
        panel.dataset.key = `${productName}|${focusSelect.value}`;
        render();
      });

      panel.append(head, chips);
      preGen.insertAdjacentElement("afterend", panel);
      render();
    };

    const sync = () => {
      cleanEncodedLabels();
      renameRegenerateButtons();
      ensureHookPicker();
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    return () => {
      observer.disconnect();
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
