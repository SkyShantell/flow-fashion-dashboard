"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type JobLite = {
  id: string;
  stage: string;
  video_status: string;
};

type BatchLite = {
  id: string;
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

function sleep(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export default function RedoFFmpegControl() {
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
      // Main dashboard reports backend availability errors.
    }
  }, []);

  const loadActive = useCallback(async (id: string) => {
    if (!id) { setActiveBatch(null); return; }
    try {
      setActiveBatch(await backend<BatchLite>(`/batches/${id}`));
    } catch {
      // Manual FFmpeg control already surfaces refresh failures.
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

  async function redo(job: JobLite, target: HTMLElement) {
    setBusyJob(job.id);
    setError("");
    try {
      await backend(`/jobs/${job.id}/redo-text-overlay`, { method: "POST" });
      await loadActive(batchId);

      // The existing Style + FFmpeg control owns the editor. As soon as its polling sees
      // video_complete again, open that same editor automatically for a one-click redo.
      for (let attempt = 0; attempt < 16; attempt += 1) {
        await sleep(300);
        const styleButton = Array.from(target.querySelectorAll<HTMLButtonElement>("button"))
          .find(button => (button.textContent || "").includes("Style + FFmpeg"));
        if (styleButton) {
          styleButton.click();
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reopen FFmpeg styling");
    } finally {
      setBusyJob("");
    }
  }

  const portals = useMemo(() => {
    if (!activeBatch) return [];
    return targets.slice(0, activeBatch.jobs.length).map((target, index) => {
      const job = activeBatch.jobs[index];
      if (!job) return null;
      const finished = String(job.stage || "") === "complete"
        && String(job.video_status || "").toLowerCase() === "completed";
      if (!finished) return null;
      const busy = busyJob === job.id;
      return createPortal(
        <button
          key={`redo-ffmpeg-${job.id}`}
          type="button"
          className="ghost small"
          disabled={busy}
          onClick={() => void redo(job, target)}
          title="Reopen the text editor and render a new FFmpeg version from the original video"
        >
          {busy ? "Opening…" : "Redo FFmpeg"}
        </button>,
        target,
      );
    });
  }, [activeBatch, busyJob, targets]);

  return <>
    {portals}
    {error && <div style={{ position: "fixed", left: 18, bottom: 18, zIndex: 10130, maxWidth: 420, border: "1px solid rgba(255,100,100,.35)", borderRadius: 12, background: "rgba(32,12,15,.96)", color: "#ffb5b5", padding: "10px 12px", fontSize: 12 }}>{error}</div>}
  </>;
}
