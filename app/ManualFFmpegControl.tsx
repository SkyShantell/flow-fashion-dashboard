"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type JobLite = {
  id: string;
  product_name?: string | null;
  stage: string;
  video_status: string;
  video_url?: string | null;
};

type BatchLite = {
  id: string;
  name?: string | null;
  mode?: string | null;
  jobs: JobLite[];
};

type OverlayPreset = { id: string; label: string; description: string };
type OverlayColor = { id: string; hex: string };
type OverlayPlacement = { id: string; label: string };
type OverlayConfig = {
  headline: string;
  subheadline: string;
  preset: string;
  emoji_prefix: string;
  emoji_suffix: string;
  headline_color: string;
  subheadline_color: string;
  placement: string;
  emoji_mode?: string;
  presets: OverlayPreset[];
  colors: OverlayColor[];
  placements: OverlayPlacement[];
};

type OverlayDraft = Pick<
  OverlayConfig,
  "headline" | "subheadline" | "preset" | "emoji_prefix" | "emoji_suffix" | "headline_color" | "subheadline_color" | "placement"
>;

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

function sameTargets(a: HTMLElement[], b: HTMLElement[]) {
  return a.length === b.length && a.every((node, index) => node === b[index]);
}

function previewFont(preset: string, line: "headline" | "subheadline") {
  if (preset === "luxury_serif") return line === "headline"
    ? { fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 400, fontSize: 33 }
    : { fontFamily: "Georgia, serif", fontStyle: "normal", fontWeight: 400, fontSize: 22, textTransform: "uppercase" as const };
  if (preset === "big_editorial") return line === "headline"
    ? { fontFamily: "Georgia, serif", fontStyle: "normal", fontWeight: 400, fontSize: 42 }
    : { fontFamily: "Georgia, serif", fontStyle: "normal", fontWeight: 400, fontSize: 22 };
  if (preset === "serif_pop") return line === "headline"
    ? { fontFamily: "Georgia, serif", fontStyle: "normal", fontWeight: 400, fontSize: 36 }
    : { fontFamily: "Arial Rounded MT Bold, Arial, sans-serif", fontStyle: "normal", fontWeight: 800, fontSize: 22 };
  return line === "headline"
    ? { fontFamily: "Arial, sans-serif", fontStyle: "normal", fontWeight: 800, fontSize: 28 }
    : { fontFamily: "Arial, sans-serif", fontStyle: "normal", fontWeight: 500, fontSize: 20 };
}

function emojiTokens(value: string): string[] {
  return String(value || "").trim().split(/\s+/).filter(Boolean).slice(0, 8);
}

function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const text = `${navigator.platform || ""} ${navigator.userAgent || ""}`;
  return /Mac|iPhone|iPad|iPod/i.test(text);
}

function renderSystemEmojiPng(token: string): string {
  if (typeof document === "undefined" || !token) return "";
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = 172;
  const fontFamily = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  while (fontSize > 80) {
    ctx.font = `${fontSize}px ${fontFamily}`;
    if (ctx.measureText(token).width <= 226) break;
    fontSize -= 10;
  }
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillText(token, 128, 132);

  try {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (image.data[(y * canvas.width + x) * 4 + 3] > 3) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return "";
    const pad = 8;
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(canvas.width - sx, maxX - minX + 1 + pad * 2);
    const sh = Math.min(canvas.height - sy, maxY - minY + 1 + pad * 2);
    const out = document.createElement("canvas");
    out.width = Math.max(1, sw);
    out.height = Math.max(1, sh);
    const outCtx = out.getContext("2d");
    if (!outCtx) return "";
    outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL("image/png");
  } catch {
    return "";
  }
}

function renderEmojiPngs(value: string): string[] {
  return emojiTokens(value).map(token => renderSystemEmojiPng(token));
}

export default function ManualFFmpegControl() {
  const [batches, setBatches] = useState<BatchLite[]>([]);
  const [batchId, setBatchId] = useState("");
  const [activeBatch, setActiveBatch] = useState<BatchLite | null>(null);
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [busyJob, setBusyJob] = useState("");
  const [error, setError] = useState("");
  const [editorJob, setEditorJob] = useState<JobLite | null>(null);
  const [editorConfig, setEditorConfig] = useState<OverlayConfig | null>(null);
  const [draft, setDraft] = useState<OverlayDraft | null>(null);
  const [loadingEditor, setLoadingEditor] = useState(false);

  const loadBatches = useCallback(async () => {
    try {
      const list = await backend<BatchLite[]>("/batches");
      setBatches(list);
      setBatchId(current => current && list.some(batch => batch.id === current)
        ? current
        : (list[0]?.id || ""));
    } catch {
      // Main dashboard already reports backend errors.
    }
  }, []);

  const loadActive = useCallback(async (id: string) => {
    if (!id) { setActiveBatch(null); return; }
    try {
      setActiveBatch(await backend<BatchLite>(`/batches/${id}`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh FFmpeg status");
    }
  }, []);

  useEffect(() => {
    void loadBatches();
    const timer = window.setInterval(() => void loadBatches(), 5000);
    return () => window.clearInterval(timer);
  }, [loadBatches]);

  useEffect(() => {
    if (!batches.length) return;
    const sync = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".batchBtn"));
      const activeIndex = buttons.findIndex(button => button.classList.contains("active"));
      const matching = activeIndex >= 0 ? batches[activeIndex] : undefined;
      if (matching) setBatchId(current => current === matching.id ? current : matching.id);
    };
    sync();
    const timer = window.setInterval(sync, 500);
    return () => window.clearInterval(timer);
  }, [batches]);

  useEffect(() => {
    void loadActive(batchId);
    if (!batchId) return;
    const timer = window.setInterval(() => void loadActive(batchId), 2500);
    return () => window.clearInterval(timer);
  }, [batchId, loadActive]);

  useEffect(() => {
    const syncTargets = () => {
      const next = Array.from(document.querySelectorAll<HTMLElement>(".jobCard .jobActions"));
      setTargets(prev => sameTargets(prev, next) ? prev : next);
    };
    syncTargets();
    const timer = window.setInterval(syncTargets, 500);
    return () => window.clearInterval(timer);
  }, [batchId]);

  async function openEditor(job: JobLite) {
    setEditorJob(job);
    setEditorConfig(null);
    setDraft(null);
    setLoadingEditor(true);
    setError("");
    try {
      const config = await backend<OverlayConfig>(`/jobs/${job.id}/text-overlay-config`);
      setEditorConfig(config);
      setDraft({
        headline: config.headline || "",
        subheadline: config.subheadline || "",
        preset: config.preset || "luxury_serif",
        emoji_prefix: config.emoji_prefix || "",
        emoji_suffix: config.emoji_suffix || "",
        headline_color: config.headline_color || "white",
        subheadline_color: config.subheadline_color || "white",
        placement: config.placement || "middle",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open text styling");
      setEditorJob(null);
    } finally {
      setLoadingEditor(false);
    }
  }

  async function sendToFFmpeg() {
    if (!editorJob || !draft) return;
    setBusyJob(editorJob.id);
    setError("");
    try {
      const emoji_prefix_pngs = renderEmojiPngs(draft.emoji_prefix);
      const emoji_suffix_pngs = renderEmojiPngs(draft.emoji_suffix);
      await backend(`/jobs/${editorJob.id}/apply-text-overlay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, emoji_prefix_pngs, emoji_suffix_pngs }),
      });
      setEditorJob(null);
      setEditorConfig(null);
      setDraft(null);
      await loadActive(batchId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send video to FFmpeg");
    } finally {
      setBusyJob("");
    }
  }

  const portals = useMemo(() => {
    if (!activeBatch) return [];
    return targets.slice(0, activeBatch.jobs.length).map((target, index) => {
      const job = activeBatch.jobs[index];
      if (!job) return null;
      const stage = String(job.stage || "");
      const rawReady = stage === "video_complete" && String(job.video_status || "").toLowerCase() === "completed";
      const processing = stage === "finalizing_text";
      const finished = stage === "complete" && String(job.video_status || "").toLowerCase() === "completed";
      const busy = busyJob === job.id;

      if (!rawReady && !processing && !finished) return null;
      return createPortal(
        <div key={`manual-ffmpeg-${job.id}`} style={{ display: "contents" }}>
          {rawReady && (
            <button
              type="button"
              className="primary small"
              disabled={busy}
              onClick={() => void openEditor(job)}
              title="Choose text style, colors and Apple emoji, then render with FFmpeg"
            >
              {busy ? "Sending…" : "Style + FFmpeg"}
            </button>
          )}
          {processing && (
            <span style={{ alignSelf: "center", fontSize: 11, color: "#aaa", padding: "0 4px" }}>
              FFmpeg adding styled text…
            </span>
          )}
          {finished && (
            <span style={{ alignSelf: "center", fontSize: 11, color: "#8fd7a7", padding: "0 4px" }}>
              Text added ✓
            </span>
          )}
        </div>,
        target,
      );
    });
  }, [activeBatch, busyJob, targets]);

  const headlineHex = editorConfig?.colors.find(color => color.id === draft?.headline_color)?.hex || "#fff";
  const subheadlineHex = editorConfig?.colors.find(color => color.id === draft?.subheadline_color)?.hex || "#fff";
  const placementAlign = draft?.placement === "upper" ? "flex-start" : draft?.placement === "lower" ? "flex-end" : "center";
  const appleDevice = isAppleDevice();

  return <>
    {portals}

    {editorJob && (
      <div
        onMouseDown={e => { if (e.target === e.currentTarget && !busyJob) setEditorJob(null); }}
        style={{ position: "fixed", inset: 0, zIndex: 10100, background: "rgba(0,0,0,.72)", display: "grid", placeItems: "center", padding: 20 }}
      >
        <div style={{ width: "min(880px, 96vw)", maxHeight: "92vh", overflow: "auto", border: "1px solid rgba(255,255,255,.14)", borderRadius: 20, background: "#111116", color: "#fff", boxShadow: "0 30px 90px rgba(0,0,0,.55)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
            <div><div style={{ fontSize: 11, letterSpacing: ".11em", opacity: .55, textTransform: "uppercase" }}>Text + Apple Emoji</div><div style={{ fontSize: 18, fontWeight: 850, marginTop: 3 }}>{editorJob.product_name || "Video overlay"}</div></div>
            <button type="button" onClick={() => !busyJob && setEditorJob(null)} style={{ border: 0, background: "transparent", color: "#aaa", fontSize: 26, cursor: "pointer" }}>×</button>
          </div>

          {loadingEditor || !draft || !editorConfig ? (
            <div style={{ padding: 30, color: "#aaa" }}>Loading styles…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(280px,.95fr)", gap: 18, padding: 20 }}>
              <div style={{ display: "grid", gap: 14 }}>
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#bbb" }}>Headline
                  <input value={draft.headline} maxLength={120} onChange={e => setDraft({ ...draft, headline: e.target.value })} style={{ background: "#1d1d24", color: "#fff", border: "1px solid #34343d", borderRadius: 10, padding: "10px 11px", font: "inherit" }} />
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#bbb" }}>Second line <span style={{ opacity: .55 }}>optional</span>
                  <input value={draft.subheadline} maxLength={120} onChange={e => setDraft({ ...draft, subheadline: e.target.value })} style={{ background: "#1d1d24", color: "#fff", border: "1px solid #34343d", borderRadius: 10, padding: "10px 11px", font: "inherit" }} />
                </label>

                <div style={{ display: "grid", gap: 7 }}>
                  <div style={{ fontSize: 12, color: "#bbb" }}>Style preset</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {editorConfig.presets.map(preset => (
                      <button key={preset.id} type="button" onClick={() => setDraft({ ...draft, preset: preset.id })} style={{ textAlign: "left", border: draft.preset === preset.id ? "1px solid #8a6cff" : "1px solid #34343d", background: draft.preset === preset.id ? "rgba(123,92,255,.16)" : "#1d1d24", color: "#fff", borderRadius: 10, padding: 10, cursor: "pointer" }}>
                        <b style={{ display: "block", fontSize: 12 }}>{preset.label}</b><span style={{ display: "block", color: "#8e8e99", fontSize: 10.5, lineHeight: 1.35, marginTop: 3 }}>{preset.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#bbb" }}>Emoji before headline
                    <input value={draft.emoji_prefix} onChange={e => setDraft({ ...draft, emoji_prefix: e.target.value })} placeholder="🤎 🍂" style={{ background: "#1d1d24", color: "#fff", border: "1px solid #34343d", borderRadius: 10, padding: "10px 11px", fontFamily: '"Apple Color Emoji", system-ui, sans-serif' }} />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#bbb" }}>Emoji after headline
                    <input value={draft.emoji_suffix} onChange={e => setDraft({ ...draft, emoji_suffix: e.target.value })} placeholder="🤎" style={{ background: "#1d1d24", color: "#fff", border: "1px solid #34343d", borderRadius: 10, padding: "10px 11px", fontFamily: '"Apple Color Emoji", system-ui, sans-serif' }} />
                  </label>
                </div>
                <div style={{ border: appleDevice ? "1px solid rgba(110,210,145,.22)" : "1px solid rgba(255,190,90,.22)", borderRadius: 10, padding: "9px 10px", background: appleDevice ? "rgba(60,145,90,.09)" : "rgba(170,115,35,.09)", color: appleDevice ? "#9ee4b8" : "#efc27d", fontSize: 10.5, lineHeight: 1.45 }}>
                  {appleDevice
                    ? "Apple emoji mode ✓ Emojis are rendered locally by this Apple device into transparent PNGs, then sent with the overlay. Railway does not need the Apple emoji font."
                    : "For exact Apple emoji, open this editor on a Mac, iPhone, or iPad. On another device the local system emoji style will be used instead."}
                </div>
                <div style={{ fontSize: 10.5, color: "#777", marginTop: -7 }}>Separate multiple emoji with spaces. Complex Apple emoji sequences stay intact as one token.</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#bbb" }}>Headline color
                    <select value={draft.headline_color} onChange={e => setDraft({ ...draft, headline_color: e.target.value })} style={{ background: "#1d1d24", color: "#fff", border: "1px solid #34343d", borderRadius: 10, padding: "9px" }}>{editorConfig.colors.map(color => <option key={color.id} value={color.id}>{color.id.replaceAll("_", " ")}</option>)}</select>
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#bbb" }}>Second-line color
                    <select value={draft.subheadline_color} onChange={e => setDraft({ ...draft, subheadline_color: e.target.value })} style={{ background: "#1d1d24", color: "#fff", border: "1px solid #34343d", borderRadius: 10, padding: "9px" }}>{editorConfig.colors.map(color => <option key={color.id} value={color.id}>{color.id.replaceAll("_", " ")}</option>)}</select>
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#bbb" }}>Placement
                    <select value={draft.placement} onChange={e => setDraft({ ...draft, placement: e.target.value })} style={{ background: "#1d1d24", color: "#fff", border: "1px solid #34343d", borderRadius: 10, padding: "9px" }}>{editorConfig.placements.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                  </label>
                </div>
              </div>

              <div style={{ display: "grid", alignContent: "start", gap: 9 }}>
                <div style={{ fontSize: 12, color: "#bbb" }}>Layout preview</div>
                <div style={{ aspectRatio: "9 / 16", maxHeight: 560, width: "100%", borderRadius: 16, border: "1px solid #34343d", background: "linear-gradient(155deg,#3c3a3e 0%,#17171b 48%,#302822 100%)", display: "flex", flexDirection: "column", justifyContent: placementAlign, alignItems: "center", padding: "14% 8%", overflow: "hidden", boxShadow: "inset 0 0 90px rgba(0,0,0,.3)" }}>
                  <div style={{ width: "100%", textAlign: "center", textShadow: "0 2px 8px rgba(0,0,0,.65)" }}>
                    <div style={{ ...previewFont(draft.preset, "headline"), color: headlineHex, lineHeight: 1.05, overflowWrap: "anywhere" }}>
                      {draft.emoji_prefix && <span style={{ fontFamily: '"Apple Color Emoji", system-ui, sans-serif', fontSize: ".72em", marginRight: ".12em" }}>{draft.emoji_prefix}</span>}
                      {draft.headline || "Headline"}
                      {draft.emoji_suffix && <span style={{ fontFamily: '"Apple Color Emoji", system-ui, sans-serif', fontSize: ".72em", marginLeft: ".12em" }}>{draft.emoji_suffix}</span>}
                    </div>
                    {draft.subheadline && <div style={{ ...previewFont(draft.preset, "subheadline"), color: subheadlineHex, lineHeight: 1.08, marginTop: 6, overflowWrap: "anywhere" }}>{draft.subheadline}</div>}
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: "#777", lineHeight: 1.4 }}>On your Mac, the preview and the final exported emoji both use Apple Color Emoji. Text is rendered server-side, then FFmpeg composites the finished transparent layer over the real video.</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, padding: "14px 20px 18px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
            <button type="button" className="ghost" disabled={!!busyJob} onClick={() => setEditorJob(null)}>Cancel</button>
            <button type="button" className="primary" disabled={!!busyJob || loadingEditor || !draft || (!draft.headline.trim() && !draft.subheadline.trim())} onClick={() => void sendToFFmpeg()}>{busyJob ? "Rendering Apple emoji…" : "Send to FFmpeg"}</button>
          </div>
        </div>
      </div>
    )}

    {error && <div style={{ position: "fixed", left: 18, bottom: 18, zIndex: 10120, maxWidth: 420, border: "1px solid rgba(255,100,100,.35)", borderRadius: 12, background: "rgba(32,12,15,.96)", color: "#ffb5b5", padding: "10px 12px", fontSize: 12 }}>{error}</div>}
  </>;
}
