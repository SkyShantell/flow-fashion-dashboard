"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SHOE_MOTION = "Shoe Showcase — Editorial Cut";

export default function ShoeReferenceControl() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [extraRef, setExtraRef] = useState("");
  const extraRefState = useRef("");
  const modalKey = useRef("");

  useEffect(() => { extraRefState.current = extraRef; }, [extraRef]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      let nextInit = init;

      if (method === "POST" && /\/api\/backend\/jobs\/[^/]+\/references(?:\?|$)/.test(url) && typeof init?.body === "string") {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          const refs = Array.isArray(body.refs) ? body.refs.map(String).filter(Boolean) : [];
          const extra = extraRefState.current;
          if (body.motion_style === SHOE_MOTION && extra && !refs.includes(extra) && refs.length < 6) {
            body.refs = [...refs, extra];
            nextInit = { ...init, body: JSON.stringify(body) };
          }
        } catch {
          // Leave non-JSON requests unchanged.
        }
      }

      return originalFetch(input, nextInit);
    };

    const syncModal = () => {
      const modal = document.querySelector<HTMLElement>(".photoModal");
      const target = modal?.querySelector<HTMLElement>(".shoePreGen") || null;
      if (!modal || !target) {
        setPortalTarget(null);
        setSelectedCount(0);
        setCandidates([]);
        modalKey.current = "";
        extraRefState.current = "";
        setExtraRef("");
        return;
      }

      setPortalTarget(prev => prev === target ? prev : target);
      const key = modal.querySelector<HTMLElement>(".modalSub")?.textContent?.trim() || "shoe";
      if (modalKey.current !== key) {
        modalKey.current = key;
        extraRefState.current = "";
        setExtraRef("");
      }

      const thumbs = Array.from(modal.querySelectorAll<HTMLButtonElement>(".photoThumb"));
      const picked = new Set(
        thumbs.filter(button => button.classList.contains("picked"))
          .map(button => button.querySelector<HTMLImageElement>("img")?.src || "")
          .filter(Boolean),
      );
      const all = Array.from(new Set(
        thumbs.map(button => button.querySelector<HTMLImageElement>("img")?.src || "").filter(Boolean),
      ));
      setSelectedCount(picked.size);
      setCandidates(all.filter(url => !picked.has(url)).slice(0, 18));
      if (extraRefState.current && picked.has(extraRefState.current)) {
        extraRefState.current = "";
        setExtraRef("");
      }
    };

    syncModal();
    const timer = window.setInterval(syncModal, 300);
    return () => {
      window.clearInterval(timer);
      window.fetch = originalFetch;
    };
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(148,163,184,.18)" }}>
      <div className="preGenHead" style={{ marginBottom: 10 }}>
        <b>Kling O1 references</b>
        <span>Flow uses the 1–5 selected photos for the opener. Kling O1 also gets the approved Flow image plus an optional 6th product reference.</span>
      </div>
      {selectedCount < 5 ? (
        <div style={{ fontSize: 12, color: "#8f93a1" }}>Select up to 5 product photos above. After 5 are selected, you can optionally add reference #6 for Kling O1.</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#aeb2be", marginBottom: 8 }}>
            Optional reference #6 {extraRef ? "selected" : "— choose one if another angle helps product accuracy"}
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {candidates.map((url, index) => (
              <button
                type="button"
                key={`${url}-${index}`}
                onClick={() => setExtraRef(current => current === url ? "" : url)}
                title={extraRef === url ? "Remove extra Kling reference" : "Use as extra Kling O1 reference"}
                style={{
                  flex: "0 0 72px", width: 72, height: 82, padding: 3, borderRadius: 10, overflow: "hidden",
                  border: extraRef === url ? "2px solid #8a6cff" : "1px solid rgba(255,255,255,.16)",
                  background: extraRef === url ? "rgba(123,92,255,.18)" : "rgba(255,255,255,.03)", cursor: "pointer",
                }}
              >
                <img src={url} alt={`Optional Kling reference ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 7 }} />
              </button>
            ))}
            {!candidates.length && <span style={{ fontSize: 12, color: "#8f93a1" }}>No unused product photo is available.</span>}
          </div>
        </>
      )}
    </div>,
    portalTarget,
  );
}
