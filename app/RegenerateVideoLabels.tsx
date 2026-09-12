"use client";

import { useEffect } from "react";

export default function RegenerateVideoLabels() {
  useEffect(() => {
    const sync = () => {
      document.querySelectorAll<HTMLElement>(".jobCard").forEach(card => {
        const completed = Array.from(card.querySelectorAll<HTMLElement>(".jobMeta span"))
          .some(span => (span.textContent || "").trim().toLowerCase() === "video: completed");
        const promptButton = Array.from(card.querySelectorAll<HTMLButtonElement>(".jobActions button"))
          .find(button => {
            const label = (button.textContent || "").trim().toLowerCase();
            return label === "video prompt" || label === "regenerate video";
          });
        if (promptButton) promptButton.textContent = completed ? "Regenerate video" : "Video prompt";
      });
    };

    sync();
    const timer = window.setInterval(sync, 1500);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
