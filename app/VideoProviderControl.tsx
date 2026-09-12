"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type BatchLite = {
  id: string;
  name?: string | null;
  mode?: string | null;
  status?: string | null;
};

type ProviderConfig = {
  batch_id: string;
  batch_name?: string | null;
  mode?: string | null;
  video_provider: "omni" | "kling" | string;
  video_provider_label: string;
  kling_account_email?: string | null;
  kling_model: string;
  kling_mode: string;
  kling_duration: number;
  kling_audio: boolean;
  kling_multi_shot: boolean;
  aspect_ratio: string;
  automatic_fallback: boolean;
  locked_for_shoes?: boolean;
};

async function backend<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/backend${path}`, { ...init, cache: "no-store" });
  const text = await res.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
  if (!res.ok) {
    const detail = typeof data === "object" && data && "detail" in data
      ? String((data as { detail: unknown }).detail)
      : `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return data as T;
}

export default function VideoProviderControl() {
  const [batches, setBatches] = useState<BatchLite[]>([]);
  const [batchId, setBatchId] = useState("");
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);

  const activeBatch = useMemo(
    () => batches.find(batch => batch.id === batchId) || null,
    [batches, batchId],
  );

  const loadBatches = useCallback(async () => {
    try {
      const list = await backend<BatchLite[]>("/batches");
      setBatches(list);
      setBatchId(current => current && list.some(batch => batch.id === current)
        ? current
        : (list[0]?.id || ""));
    } catch {
      // The main dashboard already reports backend connection errors. Keep this control quiet.
    }
  }, []);

  const loadConfig = useCallback(async (id: string) => {
    if (!id) { setConfig(null); return; }
    try {
      const next = await backend<ProviderConfig>(`/batches/${id}/video-provider`);
      setConfig(next);
      setError("");
    } catch (e) {
      setConfig(null);
      setError(e instanceof Error ? e.message : "Could not load video provider");
    }
  }, []);

  useEffect(() => {
    void loadBatches();
    const timer = window.setInterval(() => void loadBatches(), 10000);
    return () => window.clearInterval(timer);
  }, [loadBatches]);

  useEffect(() => { void loadConfig(batchId); }, [batchId, loadConfig]);

  // Keep this control synchronized with the batch selected in the existing sidebar without
  // changing the dashboard's established batch-selection code.
  useEffect(() => {
    if (!batches.length) return;
    const syncFromSidebar = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".batchBtn"));
      const activeIndex = buttons.findIndex(button => button.classList.contains("active"));
      const matching = activeIndex >= 0 ? batches[activeIndex] : undefined;
      if (matching) setBatchId(current => current === matching.id ? current : matching.id);
    };
    syncFromSidebar();
    const observer = new MutationObserver(syncFromSidebar);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [batches]);

  async function chooseProvider(provider: "omni" | "kling") {
    if (!batchId || loading || config?.video_provider === provider) return;
    setLoading(true);
    setError("");
    try {
      const next = await backend<ProviderConfig>(`/batches/${batchId}/video-provider`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          video_provider: provider,
          kling_account_email: config?.kling_account_email || null,
          kling_model: "kling-v3-0",
          kling_mode: "pro",
        }),
      });
      setConfig(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change video provider");
    } finally {
      setLoading(false);
    }
  }

  const isShoe = (activeBatch?.mode || config?.mode) === "shoe_showcase";
  const isKling = config?.video_provider === "kling";
  const batchName = activeBatch?.name || config?.batch_name || "Current batch";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open video provider selector"
        style={{
          position: "fixed", right: 18, bottom: 18, zIndex: 10050,
          border: "1px solid rgba(255,255,255,.16)", borderRadius: 999,
          background: "rgba(14,14,18,.94)", color: "#fff", padding: "10px 14px",
          fontWeight: 750, cursor: "pointer", boxShadow: "0 12px 36px rgba(0,0,0,.38)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        }}
      >
        Video · {isShoe ? "Kling O1" : isKling ? "Kling 3.0" : "Google Flow"}
      </button>
    );
  }

  return (
    <aside style={{
      position: "fixed", right: 18, bottom: 18, zIndex: 10050, width: 330,
      border: "1px solid rgba(255,255,255,.14)", borderRadius: 18,
      background: "rgba(13,13,18,.96)", color: "#fff", padding: 14,
      boxShadow: "0 20px 55px rgba(0,0,0,.46)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      fontFamily: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".11em", textTransform: "uppercase", opacity: .6 }}>Video Provider</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{isShoe ? "Shoe Showcase · Kling O1" : "Choose Flow or Kling"}</div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Minimize video provider selector" style={{ border: 0, background: "transparent", color: "#aaa", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>−</button>
      </div>

      {!!batches.length && <label style={{ display: "grid", gap: 5, marginTop: 12, fontSize: 11, color: "#aaa" }}>
        Batch
        <select
          value={batchId}
          onChange={e => setBatchId(e.target.value)}
          style={{ width: "100%", background: "#202027", color: "#fff", border: "1px solid #34343d", borderRadius: 10, padding: "9px 10px", font: "inherit" }}
        >
          {batches.map(batch => <option key={batch.id} value={batch.id}>{batch.name || "Untitled batch"}</option>)}
        </select>
      </label>}

      {isShoe ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ border: "1px solid #8a6cff", background: "rgba(123,92,255,.22)", color: "#fff", borderRadius: 11, padding: "11px 10px", fontWeight: 800, textAlign: "center" }}>
            Kling O1 · Locked for shoes
          </div>
          <div style={{ marginTop: 10, color: "#b8b8c2", fontSize: 11.5, lineHeight: 1.5 }}>
            Flow creates the one image you approve. Kling O1 then makes the 10-second 9:16 video with that approved image as @image_1 and up to 6 shoe reference images as @image_2–@image_7.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              disabled={loading || !batchId}
              onClick={() => void chooseProvider("omni")}
              style={{
                border: !isKling ? "1px solid #8a6cff" : "1px solid #3a3a43",
                background: !isKling ? "rgba(123,92,255,.22)" : "#202027",
                color: "#fff", borderRadius: 11, padding: "10px 8px", fontWeight: 800,
                cursor: loading ? "wait" : "pointer",
              }}
            >Google Flow</button>
            <button
              type="button"
              disabled={loading || !batchId}
              onClick={() => void chooseProvider("kling")}
              title="Use Kling 3.0 for approved-image fashion video generation"
              style={{
                border: isKling ? "1px solid #8a6cff" : "1px solid #3a3a43",
                background: isKling ? "rgba(123,92,255,.22)" : "#202027",
                color: "#fff", borderRadius: 11, padding: "10px 8px", fontWeight: 800,
                cursor: loading ? "wait" : "pointer",
              }}
            >Kling 3.0</button>
          </div>
          <div style={{ marginTop: 10, color: "#b8b8c2", fontSize: 11.5, lineHeight: 1.45 }}>
            {isKling
              ? "Kling 3.0 · 8 seconds · audio OFF · multi-shot OFF · 9:16 from the approved Google Flow start frame."
              : "Google Flow uses the existing Omni video pipeline for the approved start frame."}
          </div>
        </>
      )}

      <div style={{ marginTop: 7, color: "#858591", fontSize: 10.5 }}>
        {batchName} · {isShoe ? "Flow image → Kling O1 video" : "Manual selection only · no automatic fallback"}
      </div>
      {error && <div style={{ marginTop: 9, color: "#ff9999", fontSize: 11, lineHeight: 1.35 }}>{error}</div>}
    </aside>
  );
}
