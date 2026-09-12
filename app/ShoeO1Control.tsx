"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type JobLite = {
  id: string;
  product_name?: string | null;
  image_status: string;
  approved: boolean;
  video_status: string;
  upscale_status: string;
  stage: string;
  selected_refs?: string[];
  image_url?: string | null;
  video_url?: string | null;
};

type BatchLite = {
  id: string;
  name?: string | null;
  mode?: string | null;
  jobs: JobLite[];
};

type VideoPromptInfo = {
  default_prompt: string;
  prompt_used: string;
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

export default function ShoeO1Control() {
  const [batches, setBatches] = useState<BatchLite[]>([]);
  const [batchId, setBatchId] = useState("");
  const [activeBatch, setActiveBatch] = useState<BatchLite | null>(null);
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);
  const [busyJob, setBusyJob] = useState("");
  const [error, setError] = useState("");

  const isShoe = activeBatch?.mode === "shoe_showcase";

  const loadBatches = useCallback(async () => {
    try {
      const list = await backend<BatchLite[]>("/batches");
      setBatches(list);
      setBatchId(current => current && list.some(batch => batch.id === current)
        ? current
        : (list[0]?.id || ""));
    } catch {
      // Main dashboard handles connection errors.
    }
  }, []);

  const loadActive = useCallback(async (id: string) => {
    if (!id) { setActiveBatch(null); return; }
    try {
      setActiveBatch(await backend<BatchLite>(`/batches/${id}`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Shoe Showcase batch");
    }
  }, []);

  useEffect(() => {
    void loadBatches();
    const timer = window.setInterval(() => void loadBatches(), 5000);
    return () => window.clearInterval(timer);
  }, [loadBatches]);

  // Match the current dashboard sidebar selection without modifying the existing page.
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
    const timer = window.setInterval(() => void loadActive(batchId), 3000);
    return () => window.clearInterval(timer);
  }, [batchId, loadActive]);

  // Portals only: no MutationObserver and no manual DOM insertion/removal.
  useEffect(() => {
    if (!isShoe) {
      setTargets([]);
      setHeaderTarget(null);
      return;
    }
    const syncTargets = () => {
      const next = Array.from(document.querySelectorAll<HTMLElement>(".jobCard .jobActions"));
      setTargets(prev => sameTargets(prev, next) ? prev : next);
      const nextHeader = document.querySelector<HTMLElement>(".productionHead > div:first-child");
      setHeaderTarget(prev => prev === nextHeader ? prev : nextHeader);
    };
    syncTargets();
    const timer = window.setInterval(syncTargets, 500);
    return () => window.clearInterval(timer);
  }, [isShoe]);

  async function approveAndGenerate(job: JobLite) {
    setBusyJob(job.id); setError("");
    try {
      await backend<JobLite>(`/jobs/${job.id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approved: true, start_video: true }),
      });
      await loadActive(job.id ? batchId : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Kling O1 video");
    } finally {
      setBusyJob("");
    }
  }

  async function regenerateO1(job: JobLite) {
    if (!window.confirm(`Regenerate the Kling O1 video for “${job.product_name || "this shoe"}”?`)) return;
    setBusyJob(job.id); setError("");
    try {
      const info = await backend<VideoPromptInfo>(`/jobs/${job.id}/video-prompt`);
      const prompt = (info.prompt_used || info.default_prompt || "").trim();
      if (!prompt) throw new Error("No Kling O1 prompt is available for this shoe.");
      await backend<JobLite>(`/jobs/${job.id}/regenerate-video`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      await loadActive(batchId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not regenerate Kling O1 video");
    } finally {
      setBusyJob("");
    }
  }

  const portals = useMemo(() => {
    if (!isShoe || !activeBatch) return [];
    return targets.slice(0, activeBatch.jobs.length).map((target, index) => {
      const job = activeBatch.jobs[index];
      if (!job) return null;
      const refs = Math.min(6, job.selected_refs?.length || 0);
      const busy = busyJob === job.id;
      const finished = ["video_complete", "complete"].includes(String(job.stage || ""));
      const processing = job.approved && !finished && !["failed", "error"].includes(String(job.video_status || "").toLowerCase());

      return createPortal(
        <div key={`shoe-o1-${job.id}`} style={{ display: "contents" }}>
          {job.image_status === "completed" && !job.approved && (
            <button
              type="button"
              className="primary small"
              disabled={busy}
              onClick={() => void approveAndGenerate(job)}
              title={`Approved Flow opener becomes @image_1; ${refs} product reference${refs === 1 ? "" : "s"} follow as @image_2+`}
            >
              {busy ? "Queueing…" : "Approve + Kling O1"}
            </button>
          )}
          {processing && (
            <span style={{ alignSelf: "center", fontSize: 11, color: "#aaa", padding: "0 4px" }}>
              Kling O1 · {job.video_status || "processing"}
            </span>
          )}
          {finished && (
            <button type="button" className="ghost small" disabled={busy} onClick={() => void regenerateO1(job)}>
              {busy ? "Queueing…" : "Regenerate Kling O1"}
            </button>
          )}
        </div>,
        target,
      );
    });
  }, [activeBatch, batchId, busyJob, isShoe, targets]);

  if (!isShoe || !activeBatch) return null;

  return <>
    <style>{`
      .editorialPanel { display: none !important; }
      .bulkVideo { display: none !important; }
      .productionHead > div:first-child > p:not(.shoeO1HeaderCopy) { display: none !important; }
    `}</style>
    {headerTarget && createPortal(
      <p className="shoeO1HeaderCopy">
        Confirm shoe photos → Flow generates one opening image → approve it → Kling O1 creates the 10-second 9:16 video using that approved image as @image_1 plus the selected shoe references.
      </p>,
      headerTarget,
    )}
    {portals}
    {error && <div style={{ position: "fixed", left: 18, bottom: 18, zIndex: 10060, maxWidth: 420, border: "1px solid rgba(255,100,100,.35)", borderRadius: 12, background: "rgba(32,12,15,.96)", color: "#ffb5b5", padding: "10px 12px", fontSize: 12 }}>{error}</div>}
  </>;
}
