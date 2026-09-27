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
  video_provider: "omni" | "kling" | "enhancor" | "shoe_pov" | string;
  video_provider_label: string;
  shoe_pov_format?: "held" | "worn" | string;
  shoe_pov_skin_tone?: string;
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
      const list = await backend<BatchLite[]>("/batches-lite");
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

  async function chooseProvider(provider: "omni" | "kling" | "enhancor" | "shoe_pov", shoeSettings?: { format?: "held" | "worn"; skinTone?: string }) {
    if (!batchId || loading || config?.video_provider === provider) return;
    setLoading(true);
    setError("");
    try {
      const next = await backend<ProviderConfig>(`/batches/${batchId}/video-provider`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          video_provider: provider,
          shoe_pov_format: shoeSettings?.format || config?.shoe_pov_format || "held",
          shoe_pov_skin_tone: shoeSettings?.skinTone || config?.shoe_pov_skin_tone || "medium brown",
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

  async function saveShoeSettings(format: "held" | "worn", skinTone = config?.shoe_pov_skin_tone || "medium brown") {
    if (!batchId || loading) return;
    setLoading(true);
    setError("");
    try {
      const next = await backend<ProviderConfig>(`/batches/${batchId}/video-provider`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          video_provider: config?.video_provider === "shoe_pov" ? "shoe_pov" : "enhancor",
          shoe_pov_format: format,
          shoe_pov_skin_tone: skinTone.trim() || "medium brown",
        }),
      });
      setConfig(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save Shoes POV settings");
    } finally {
      setLoading(false);
    }
  }

  const isShoe = (activeBatch?.mode || config?.mode) === "shoe_showcase";
  const isKling = config?.video_provider === "kling";
  const isPov = config?.video_provider === "shoe_pov";
  const povFormat = config?.shoe_pov_format === "worn" ? "worn" : "held";
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
        Video · {isShoe ? (isPov ? "Flow Shoes POV" : "Seedance 2.0") : isKling ? "Kling 3.0" : "Google Flow"}
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
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{isShoe ? `Shoe Showcase · ${isPov ? "Flow Shoes POV" : "Seedance 2.0"}` : "Choose Flow or Kling"}</div>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button type="button" disabled={loading || !batchId} onClick={() => void chooseProvider("enhancor")} style={{ border: !isPov ? "1px solid #8a6cff" : "1px solid #3a3a43", background: !isPov ? "rgba(123,92,255,.22)" : "#202027", color: "#fff", borderRadius: 11, padding: "10px 8px", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>Seedance 2.0</button>
            <button type="button" disabled={loading || !batchId} onClick={() => void chooseProvider("shoe_pov")} style={{ border: isPov ? "1px solid #8a6cff" : "1px solid #3a3a43", background: isPov ? "rgba(123,92,255,.22)" : "#202027", color: "#fff", borderRadius: 11, padding: "10px 8px", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>Flow Shoes POV</button>
          </div>
          <div style={{ marginTop: 10, color: "#b8b8c2", fontSize: 11.5, lineHeight: 1.5 }}>
            {isPov
              ? "Nano Banana Pro creates the starting frame you approve. Flow Omni Flash makes an 8-second 720p 9:16 video, then the worker upscales it to 1080p and removes audio in the final FFmpeg pass."
              : "Flow creates the opener you approve. Seedance 2.0 uses it with your shoe photos and the two-second black reference video to make an 8-second 720p 9:16 video; the final FFmpeg pass is 1080p and silent."}
          </div>
          {isPov && <div style={{ display: "grid", gap: 9, marginTop: 12, paddingTop: 11, borderTop: "1px solid #30303a" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" disabled={loading} onClick={() => void saveShoeSettings("held")} style={{ border: povFormat === "held" ? "1px solid #8a6cff" : "1px solid #3a3a43", background: povFormat === "held" ? "rgba(123,92,255,.18)" : "#202027", color: "#fff", borderRadius: 9, padding: "8px", fontWeight: 750 }}>Handheld</button>
              <button type="button" disabled={loading} onClick={() => void saveShoeSettings("worn")} style={{ border: povFormat === "worn" ? "1px solid #8a6cff" : "1px solid #3a3a43", background: povFormat === "worn" ? "rgba(123,92,255,.18)" : "#202027", color: "#fff", borderRadius: 9, padding: "8px", fontWeight: 750 }}>Worn POV</button>
            </div>
            <label style={{ display: "grid", gap: 5, color: "#aaa", fontSize: 11 }}>Visible skin tone
              <input defaultValue={config?.shoe_pov_skin_tone || "medium brown"} onBlur={e => void saveShoeSettings(povFormat, e.target.value)} style={{ width: "100%", boxSizing: "border-box", background: "#202027", color: "#fff", border: "1px solid #34343d", borderRadius: 9, padding: "8px 9px", font: "inherit" }} />
            </label>
          </div>}
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
        {batchName} · {isShoe ? (isPov ? `${povFormat === "worn" ? "Worn" : "Handheld"} · no automatic fallback` : "Flow image → Seedance 2.0 video") : "Manual selection only · no automatic fallback"}
      </div>
      {error && <div style={{ marginTop: 9, color: "#ff9999", fontSize: 11, lineHeight: 1.35 }}>{error}</div>}
    </aside>
  );
}
