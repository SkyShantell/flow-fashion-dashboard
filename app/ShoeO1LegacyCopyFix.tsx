"use client";

import { useEffect } from "react";

const exactReplacements: Record<string, string> = {
  "Dark luxury car · 3 reviewed start frames · 3 Omni clips · FFmpeg editorial cut.": "Dark luxury car · 1 Flow opener · approve once · Seedance 2.0 5-second video.",
  "Locked to the reference-video style you supplied.": "One Flow opener only, then Seedance 2.0 uses it as @image_1.",
  "This item will use the dark-car shoe workflow from your reference videos and MD skill.": "Choose the shoe references. Flow generates one opener only; after approval, Seedance 2.0 creates the video.",
  "Shoe Showcase remains on its dedicated Google Flow / Omni 3-clip editorial pipeline.": "Shoe Showcase uses one Google Flow opener, then Seedance 2.0 creates the 5-second video.",
  "Confirm shoe photos → 3 editorial stills generate automatically → review → 3 start-frame Omni clips → FFmpeg hard-cut final.": "Confirm shoe photos → Flow generates one opener → approve it → Seedance 2.0 creates the 5-second video.",
};

function replaceExactText(root: ParentNode = document) {
  const nodes = root.querySelectorAll<HTMLElement>("span, p, b, small, div");
  nodes.forEach(node => {
    if (node.children.length) return;
    const current = (node.textContent || "").trim();
    const replacement = exactReplacements[current];
    if (replacement && current !== replacement) node.textContent = replacement;
  });
}

function replaceRuleGrid(selector: string, labels: string[]) {
  const grid = document.querySelector<HTMLElement>(selector);
  if (!grid) return;
  const spans = Array.from(grid.querySelectorAll<HTMLElement>(":scope > span"));
  spans.forEach((span, index) => {
    if (index < labels.length && span.textContent !== labels[index]) span.textContent = labels[index];
    if (index >= labels.length) span.style.display = "none";
  });
}

export default function ShoeO1LegacyCopyFix() {
  useEffect(() => {
    const sync = () => {
      replaceExactText();

      replaceRuleGrid(".batchSettingsModal .shoeLockedPanel .shoeRuleGrid", [
        "Dark luxury car",
        "1 Flow opener",
        "Approve one photo",
        "Seedance 2.0",
        "5-second video",
        "@image_1 = approved opener",
        "Up to 6 extra shoe refs",
        "No extra Flow frames",
        "Silent",
      ]);

      replaceRuleGrid(".photoModal .shoePreGen .shoeRuleGrid", [
        "Shoe only",
        "1 Flow opener",
        "Dark luxury car",
        "Approve one photo",
        "Seedance 2.0 · 5 sec",
        "@image_1 = approved opener",
        "Up to 6 extra shoe refs",
      ]);

      // The third badge on Shoe Showcase cards is legacy motion-style copy only.
      const activeBatch = Array.from(document.querySelectorAll<HTMLButtonElement>(".batchBtn"))
        .find(button => button.classList.contains("active"));
      const shoeActive = (activeBatch?.textContent || "").includes("Shoe Showcase");
      if (shoeActive) {
        document.querySelectorAll<HTMLElement>(".jobCard .productionBadges").forEach(row => {
          const badges = row.querySelectorAll<HTMLElement>(":scope > span");
          const last = badges[badges.length - 1];
          if (last && last.textContent !== "Seedance 2.0 · 5s") last.textContent = "Seedance 2.0 · 5s";
        });
      }
    };

    sync();
    const timer = window.setInterval(sync, 500);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
