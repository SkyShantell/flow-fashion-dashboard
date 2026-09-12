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

export default function ManualFFmpegControl() {
  const [batches, setBatches] = useState<BatchLite[]>([]);
  const [batchId, setBatchId] = useState("");
  const [activeBatch, setActiveBatch] = useState<BatchLite | null>(null);
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [busyJob, setBusyJob] = useState("");
  const [error, setError] = useState("");

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

  async function sendToFFmpeg(job: JobLite) {
    setBusyJob(job.id);
    setError("");
    try {
      await backend(`/jobs/${job.id}/apply-text-overlay`, { method: "POST" });
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
              onClick={() => void sendToFFmpeg(job)}
              title="Add the selected on-screen hook with FFmpeg after reviewing the returned video"
            >
              {busy ? "Sending…" : "Send to FFmpeg"}
            </button>
          )}
          {processing && (
            <span style={{ alignSelf: "center", fontSize: 11, color: "#aaa", padding: "0 4px" }}>
              FFmpeg adding text…
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

  return <>
    {portals}
    {error && <div style={{ position: "fixed", left: 18, bottom: 18, zIndex: 10070, maxWidth: 420, border: "1px solid rgba(255,100,100,.35)", borderRadius: 12, background: "rgba(32,12,15,.96)", color: "#ffb5b5", padding: "10px 12px", fontSize: 12 }}>{error}</div>}
  </>;
}
