"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  batch_id: string;
  product_name?: string | null;
  product_url?: string | null;
  product_id?: string | null;
  focus?: string | null;
  stage: string;
  approved: boolean;
  image_status: string;
  image_url?: string | null;
  video_status: string;
  upscale_status: string;
  video_url?: string | null;
  video_resolution?: string | null;
  drive_video_url?: string | null;
  error?: string | null;
};

type Batch = {
  id: string;
  name?: string | null;
  scene?: string | null;
  creator_profile?: string | null;
  video_style?: string | null;
  auto_approve: boolean;
  status: string;
  counts: Record<string, number | Record<string, number>>;
  jobs: Job[];
};

type ScannerRow = Record<string, string | number> & { _row_num?: number };

type Health = {
  ok: boolean;
  useapi: boolean;
  sociavault: boolean;
  google_sheet: boolean;
  drive_archive: boolean;
  image_model: string;
  video_model: string;
  video_native_resolution: string;
  video_final_resolution: string;
};

const scenes = ["Modern apartment mirror", "Walk-in closet", "Luxury bathroom mirror", "Penthouse at night"];
const profiles = ["Male", "Female"];
const styles = ["Calm", "High-energy", "Flashy"];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/backend${path}`, { ...init, cache: "no-store" });
  const text = await res.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
  if (!res.ok) {
    const detail = typeof data === "object" && data && "detail" in data ? String((data as { detail: unknown }).detail) : `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return data as T;
}

function pillClass(ok: boolean) { return ok ? "status good" : "status bad"; }

function stageLabel(stage: string) {
  return stage.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selected, setSelected] = useState<Batch | null>(null);
  const [scanner, setScanner] = useState<ScannerRow[]>([]);
  const [scannerPick, setScannerPick] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("Today's Fashion Batch");
  const [scene, setScene] = useState(scenes[0]);
  const [profile, setProfile] = useState(profiles[0]);
  const [videoStyle, setVideoStyle] = useState(styles[0]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [avatarB64, setAvatarB64] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState("image/jpeg");
  const [links, setLinks] = useState("");
  const [regen, setRegen] = useState<Record<string, string>>({});

  const loadHealth = useCallback(async () => {
    try { setHealth(await api<Health>("/health")); } catch (e) { setError(e instanceof Error ? e.message : "Health check failed"); }
  }, []);

  const loadBatches = useCallback(async () => {
    try {
      const data = await api<Batch[]>("/batches");
      setBatches(data);
      if (!selectedId && data.length) setSelectedId(data[0].id);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load batches"); }
  }, [selectedId]);

  const loadSelected = useCallback(async () => {
    if (!selectedId) { setSelected(null); return; }
    try { setSelected(await api<Batch>(`/batches/${selectedId}`)); } catch (e) { setError(e instanceof Error ? e.message : "Could not load batch"); }
  }, [selectedId]);

  const loadScanner = useCallback(async () => {
    try { setScanner(await api<ScannerRow[]>("/scanner/pending?max_items=50")); } catch (e) { setError(e instanceof Error ? e.message : "Could not load scanner queue"); }
  }, []);

  useEffect(() => { void loadHealth(); void loadBatches(); void loadScanner(); }, [loadHealth, loadBatches, loadScanner]);
  useEffect(() => { void loadSelected(); }, [loadSelected]);
  useEffect(() => {
    const id = setInterval(() => { void loadBatches(); void loadSelected(); }, 5000);
    return () => clearInterval(id);
  }, [loadBatches, loadSelected]);

  const counts = selected?.counts || {};
  const metrics = useMemo(() => [
    ["Products", Number(counts.products || 0)],
    ["Images ready", Number(counts.images_ready || 0)],
    ["Approved", Number(counts.approved || 0)],
    ["Videos ready", Number(counts.videos_ready || 0)],
    ["Archived", Number(counts.archived || 0)],
    ["Failed", Number(counts.failed || 0)],
  ], [counts]);

  function flash(msg: string) { setMessage(msg); setError(""); setTimeout(() => setMessage(""), 3500); }

  async function createBatch() {
    setLoading(true); setError("");
    try {
      const batch = await api<Batch>("/batches", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, scene, creator_profile: profile, video_style: videoStyle, auto_approve: autoApprove, avatar_b64: avatarB64, avatar_mime: avatarMime })
      });
      setSelectedId(batch.id); setSelected(batch); setShowCreate(false); await loadBatches(); flash("Batch created");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create batch"); }
    finally { setLoading(false); }
  }

  function onAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setAvatarMime(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = () => setAvatarB64(String(reader.result || "").split(",")[1] || null);
    reader.readAsDataURL(file);
  }

  async function importLinks() {
    if (!selectedId) return;
    const list = links.split(/\n|,/).map(x => x.trim()).filter(Boolean);
    if (!list.length) return;
    setLoading(true); setError("");
    try {
      await api<Batch>(`/batches/${selectedId}/products`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ links: list, start_generation: true }) });
      setLinks(""); await loadSelected(); flash(`${list.length} product link(s) queued`);
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
    finally { setLoading(false); }
  }

  async function importScanner() {
    if (!selectedId) return;
    const rows = [...scannerPick];
    if (!rows.length) return;
    setLoading(true); setError("");
    try {
      await api<Batch>(`/batches/${selectedId}/scanner/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ row_nums: rows, start_generation: true }) });
      setScannerPick(new Set()); await Promise.all([loadSelected(), loadScanner()]); flash(`${rows.length} scanner product(s) queued`);
    } catch (e) { setError(e instanceof Error ? e.message : "Scanner import failed"); }
    finally { setLoading(false); }
  }

  async function approve(job: Job) {
    setLoading(true); setError("");
    try { await api<Job>(`/jobs/${job.id}/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ approved: true, start_video: true }) }); await loadSelected(); flash("Approved — video queued"); }
    catch (e) { setError(e instanceof Error ? e.message : "Approval failed"); }
    finally { setLoading(false); }
  }

  async function retry(job: Job, step = "auto") {
    setLoading(true); setError("");
    try { await api<Job>(`/jobs/${job.id}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step }) }); await loadSelected(); flash(`Retry queued: ${step}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Retry failed"); }
    finally { setLoading(false); }
  }

  async function regenerate(job: Job) {
    const instruction = (regen[job.id] || "").trim();
    setLoading(true); setError("");
    try { await api<Job>(`/jobs/${job.id}/regenerate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ instruction }) }); await loadSelected(); flash("Image regeneration queued"); }
    catch (e) { setError(e instanceof Error ? e.message : "Regeneration failed"); }
    finally { setLoading(false); }
  }

  async function retryFailed() {
    if (!selectedId) return;
    setLoading(true); setError("");
    try { await api<Batch>(`/batches/${selectedId}/retry-failed`, { method: "POST" }); await loadSelected(); flash("Failed jobs re-queued"); }
    catch (e) { setError(e instanceof Error ? e.message : "Retry failed"); }
    finally { setLoading(false); }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">F</div><div><b>Flow Fashion</b><span>Production Factory</span></div></div>
        <button className="primary full" onClick={() => setShowCreate(true)}>+ New batch</button>
        <div className="sideLabel">Batches</div>
        <div className="batchList">
          {batches.map(b => <button key={b.id} className={`batchBtn ${selectedId === b.id ? "active" : ""}`} onClick={() => setSelectedId(b.id)}><b>{b.name || "Untitled batch"}</b><span>{Number(b.counts?.products || 0)} products · {b.status}</span></button>)}
          {!batches.length && <div className="muted">No batches yet.</div>}
        </div>
        <div className="providerBox">
          <div className="sideLabel">Backend</div>
          <div><span className={pillClass(Boolean(health?.ok))}></span> Railway API</div>
          <div><span className={pillClass(Boolean(health?.useapi))}></span> useapi</div>
          <div><span className={pillClass(Boolean(health?.sociavault))}></span> SociaVault</div>
          <div><span className={pillClass(Boolean(health?.drive_archive))}></span> Drive archive</div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><div className="eyebrow">AI FASHION PRODUCTION</div><h1>{selected?.name || "Production Dashboard"}</h1><p>{health ? `${health.image_model} → ${health.video_model} → ${health.video_final_resolution}` : "Connecting to backend…"}</p></div>
          <div className="topActions"><button className="ghost" onClick={() => { void loadBatches(); void loadSelected(); void loadScanner(); }}>Refresh</button><button className="dangerGhost" disabled={!selectedId || loading} onClick={retryFailed}>Retry failed</button></div>
        </header>

        {(message || error) && <div className={error ? "toast error" : "toast"}>{error || message}</div>}

        {showCreate && <div className="modalBackdrop"><div className="modal"><div className="modalHead"><h2>Create production batch</h2><button className="iconBtn" onClick={() => setShowCreate(false)}>×</button></div><div className="formGrid">
          <label>Batch name<input value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Scene<select value={scene} onChange={e => setScene(e.target.value)}>{scenes.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Creator<select value={profile} onChange={e => setProfile(e.target.value)}>{profiles.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Video style<select value={videoStyle} onChange={e => setVideoStyle(e.target.value)}>{styles.map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="wide">Avatar / creator reference<input type="file" accept="image/*" onChange={onAvatar} /></label>
          <label className="check wide"><input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} /> Auto-approve images and continue to video</label>
        </div><div className="modalFoot"><button className="ghost" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={loading} onClick={createBatch}>{loading ? "Creating…" : "Create batch"}</button></div></div></div>}

        {!selected ? <div className="empty"><h2>Create your first batch</h2><p>Your Railway worker is ready. Create a batch and send products into the production queue.</p><button className="primary" onClick={() => setShowCreate(true)}>Create batch</button></div> : <>
          <section className="metrics">{metrics.map(([label, value]) => <div className="metric" key={String(label)}><span>{label}</span><b>{value}</b></div>)}</section>

          <section className="grid2">
            <div className="panel"><div className="panelHead"><div><h3>Creator Scanner Queue</h3><p>Pull products directly from the Scanner Queue sheet.</p></div><button className="ghost small" onClick={() => void loadScanner()}>Reload</button></div>
              <div className="scannerList">{scanner.slice(0, 12).map((row, idx) => { const n = Number(row._row_num || 0); const title = String(row["Product Name"] || row["Product"] || `Scanner product ${idx + 1}`); const selectedRow = scannerPick.has(n); return <label className={`scannerRow ${selectedRow ? "picked" : ""}`} key={`${n}-${idx}`}><input type="checkbox" checked={selectedRow} onChange={() => setScannerPick(prev => { const next = new Set(prev); selectedRow ? next.delete(n) : next.add(n); return next; })} /><div><b>{title}</b><span>{String(row["Creators"] || "")}</span></div></label>; })}{!scanner.length && <div className="muted pad">No pending scanner products.</div>}</div>
              <button className="primary full" disabled={!scannerPick.size || loading} onClick={importScanner}>Import selected ({scannerPick.size})</button>
            </div>
            <div className="panel"><div className="panelHead"><div><h3>Import product links</h3><p>Paste one TikTok Shop product URL per line.</p></div></div><textarea className="linkBox" value={links} onChange={e => setLinks(e.target.value)} placeholder="https://www.tiktok.com/view/product/..." /><button className="primary full" disabled={!links.trim() || loading} onClick={importLinks}>Queue products</button><div className="miniInfo"><b>Current batch</b><span>{selected.scene} · {selected.creator_profile} · {selected.video_style}</span></div></div>
          </section>

          <section className="panel production"><div className="panelHead"><div><h3>Production queue</h3><p>Auto-refreshes every 5 seconds. The Railway worker keeps processing even if this page is closed.</p></div><span className="liveDot">LIVE</span></div>
            <div className="jobGrid">{selected.jobs.map(job => <article className="jobCard" key={job.id}><div className="media">{job.image_url ? <img src={job.image_url} alt={job.product_name || "Generated try-on"} /> : <div className="mediaPlaceholder"><span>{stageLabel(job.stage)}</span></div>}<div className="stageBadge">{stageLabel(job.stage)}</div></div><div className="jobBody"><h4>{job.product_name || "Importing product…"}</h4><div className="jobMeta"><span>Image: {job.image_status}</span><span>Video: {job.video_status}</span><span>1080p: {job.upscale_status}</span></div>{job.error && <div className="jobError">{job.error}</div>}
              <div className="jobActions">{job.image_status === "completed" && !job.approved && <button className="primary small" disabled={loading} onClick={() => approve(job)}>Approve + video</button>}{job.stage === "failed" && <button className="dangerGhost small" disabled={loading} onClick={() => retry(job)}>Retry</button>}{job.video_url && <a className="ghost small linkBtn" href={job.video_url} target="_blank" rel="noreferrer">Open video</a>}{job.drive_video_url && <a className="ghost small linkBtn" href={job.drive_video_url} target="_blank" rel="noreferrer">Drive</a>}</div>
              {job.image_status === "completed" && !job.approved && <div className="regenBox"><input placeholder="Regenerate instruction…" value={regen[job.id] || ""} onChange={e => setRegen({ ...regen, [job.id]: e.target.value })} /><button className="ghost small" disabled={loading} onClick={() => regenerate(job)}>Regenerate</button></div>}
            </div></article>)}{!selected.jobs.length && <div className="muted pad">No products in this batch yet.</div>}</div>
          </section>
        </>}
      </section>
    </main>
  );
}
