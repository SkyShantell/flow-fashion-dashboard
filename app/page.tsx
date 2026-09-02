"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  batch_id: string;
  product_name?: string | null;
  product_url?: string | null;
  product_id?: string | null;
  focus?: string | null;
  scene?: string | null;
  motion_style?: string | null;
  listing_images?: string[];
  review_images?: string[];
  selected_refs?: string[];
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
  scene_pool?: string[];
  creator_profile?: string | null;
  video_style?: string | null;
  motion_pool?: string[];
  auto_approve: boolean;
  status: string;
  counts: Record<string, number | Record<string, number>>;
  jobs: Job[];
};

type ScannerRow = Record<string, string | number> & { _row_num?: number };

type VideoPromptInfo = {
  job_id: string;
  default_prompt: string;
  prompt_used: string;
  source: "last_used" | "default" | string;
  can_regenerate: boolean;
};

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

const scenes = ["Modern apartment mirror", "Walk-in closet", "Luxury bathroom mirror", "Penthouse at night", "Casual bedroom mirror", "Modern hotel room mirror", "Warm living room mirror", "Apartment entryway mirror"];
const profiles = ["Male", "Female"];
const styles = ["Calm", "Casual UGC", "Fit Check", "Detail Focus", "Streetwear", "High-energy", "Flashy"];
const productTypes = [
  { value: "outfit", label: "Outfit / Set" },
  { value: "shirt", label: "Shirt / Top" },
  { value: "hoodie", label: "Hoodie / Jacket" },
  { value: "pants", label: "Pants / Bottoms" },
  { value: "shoes", label: "Shoes" },
  { value: "handbag", label: "Bag / Handbag" },
];

type JobSettings = { focus: string; scene: string; motion_style: string };

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
  const [scenePool, setScenePool] = useState<string[]>([scenes[0]]);
  const [profile, setProfile] = useState(profiles[0]);
  const [motionPool, setMotionPool] = useState<string[]>([styles[0]]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [avatarB64, setAvatarB64] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState("image/jpeg");
  const [links, setLinks] = useState("");
  const [regen, setRegen] = useState<Record<string, string>>({});
  const [photoJobId, setPhotoJobId] = useState<string | null>(null);
  const [refPick, setRefPick] = useState<Record<string, string[]>>({});
  const [jobSettings, setJobSettings] = useState<Record<string, JobSettings>>({});
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; jobId: string } | null>(null);
  const [videoPromptJobId, setVideoPromptJobId] = useState<string | null>(null);
  const [videoPromptInfo, setVideoPromptInfo] = useState<VideoPromptInfo | null>(null);
  const [videoPromptDraft, setVideoPromptDraft] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);

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
  useEffect(() => {
    if (!selected || photoJobId) return;
    const imported = selected.jobs.find(j => j.stage === "imported" && !j.image_url);
    if (imported) setPhotoJobId(imported.id);
  }, [selected, photoJobId]);
  useEffect(() => {
    if (!previewImage) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewImage(null); };
    document.addEventListener("keydown", onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = oldOverflow; };
  }, [previewImage]);

  const counts = selected?.counts || {};
  const metrics = useMemo(() => [
    ["Products", Number(counts.products || 0)],
    ["Images ready", Number(counts.images_ready || 0)],
    ["Approved", Number(counts.approved || 0)],
    ["Videos ready", Number(counts.videos_ready || 0)],
    ["Archived", Number(counts.archived || 0)],
    ["Failed", Number(counts.failed || 0)],
  ], [counts]);

  const photoJob = photoJobId ? selected?.jobs.find(j => j.id === photoJobId) || null : null;
  const previewJob = previewImage ? selected?.jobs.find(j => j.id === previewImage.jobId) || null : null;
  const videoPromptJob = videoPromptJobId ? selected?.jobs.find(j => j.id === videoPromptJobId) || null : null;

  function flash(msg: string) { setMessage(msg); setError(""); setTimeout(() => setMessage(""), 3500); }
  function productTypeLabel(value?: string | null) { return productTypes.find(x => x.value === value)?.label || "Outfit / Set"; }
  function togglePool(value: string, current: string[], setter: (next: string[]) => void) {
    if (current.includes(value)) {
      if (current.length === 1) return;
      setter(current.filter(x => x !== value));
    } else setter([...current, value]);
  }
  function settingsFor(job: Job): JobSettings {
    return jobSettings[job.id] || {
      focus: job.focus || "outfit",
      scene: job.scene || selected?.scene || scenes[0],
      motion_style: job.motion_style || selected?.video_style || styles[0],
    };
  }

  async function createBatch() {
    setLoading(true); setError("");
    try {
      const batch = await api<Batch>("/batches", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, scene: scenePool[0], scene_pool: scenePool, creator_profile: profile, video_style: motionPool[0], motion_pool: motionPool, auto_approve: autoApprove, avatar_b64: avatarB64, avatar_mime: avatarMime })
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
      await api<Batch>(`/batches/${selectedId}/products`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ links: list, start_generation: false }) });
      setLinks(""); await loadSelected(); flash(`${list.length} product link(s) imported — choose product photos next`);
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
    finally { setLoading(false); }
  }

  async function importScanner() {
    if (!selectedId) return;
    const rows = [...scannerPick];
    if (!rows.length) return;
    setLoading(true); setError("");
    try {
      await api<Batch>(`/batches/${selectedId}/scanner/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ row_nums: rows, start_generation: false }) });
      setScannerPick(new Set()); await Promise.all([loadSelected(), loadScanner()]); flash(`${rows.length} scanner product(s) imported — choose product photos next`);
    } catch (e) { setError(e instanceof Error ? e.message : "Scanner import failed"); }
    finally { setLoading(false); }
  }

  function refsFor(job: Job) {
    return refPick[job.id] ?? job.selected_refs ?? [];
  }

  function openPhotoPicker(job: Job) {
    setRefPick(prev => ({ ...prev, [job.id]: prev[job.id] ?? job.selected_refs ?? [] }));
    setJobSettings(prev => ({ ...prev, [job.id]: prev[job.id] || { focus: job.focus || "outfit", scene: job.scene || selected?.scene || scenes[0], motion_style: job.motion_style || selected?.video_style || styles[0] } }));
    setPhotoJobId(job.id);
  }

  function toggleRef(job: Job, url: string) {
    setRefPick(prev => {
      const current = prev[job.id] ?? job.selected_refs ?? [];
      if (current.includes(url)) return { ...prev, [job.id]: current.filter(x => x !== url) };
      if (current.length >= 5) {
        setError("You can select up to 5 product photos.");
        return prev;
      }
      setError("");
      return { ...prev, [job.id]: [...current, url] };
    });
  }

  async function startImageWithRefs(job: Job) {
    const refs = refsFor(job);
    if (!refs.length) { setError("Select at least one product photo."); return; }
    setLoading(true); setError("");
    try {
      const production = settingsFor(job);
      await api<Job>(`/jobs/${job.id}/references`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ refs, start_generation: true, focus: production.focus, scene: production.scene, motion_style: production.motion_style })
      });
      setPhotoJobId(null);
      await loadSelected();
      flash(`Using ${refs.length} selected product photo${refs.length === 1 ? "" : "s"} — image queued`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start image generation"); }
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

  async function openVideoPrompt(job: Job) {
    setVideoPromptJobId(job.id);
    setVideoPromptInfo(null);
    setVideoPromptDraft("");
    setPromptLoading(true);
    setError("");
    try {
      const info = await api<VideoPromptInfo>(`/jobs/${job.id}/video-prompt`);
      setVideoPromptInfo(info);
      setVideoPromptDraft(info.prompt_used || info.default_prompt || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load video prompt");
      setVideoPromptJobId(null);
    } finally { setPromptLoading(false); }
  }

  async function regenerateVideo(job: Job) {
    const prompt = videoPromptDraft.trim();
    if (!prompt) { setError("Video prompt cannot be empty."); return; }
    setLoading(true); setError("");
    try {
      await api<Job>(`/jobs/${job.id}/regenerate-video`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt })
      });
      setVideoPromptJobId(null);
      setVideoPromptInfo(null);
      await loadSelected();
      flash("Video regeneration queued with your changes");
    } catch (e) { setError(e instanceof Error ? e.message : "Video regeneration failed"); }
    finally { setLoading(false); }
  }

  async function syncSheet() {
    if (!selectedId) return;
    setLoading(true); setError("");
    try {
      await api<Batch>(`/batches/${selectedId}/sync-sheet`, { method: "POST" });
      await loadSelected();
      flash("Google Sheet sync queued for this batch");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sync Google Sheet"); }
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
          <div><span className={pillClass(Boolean(health?.google_sheet))}></span> Google Sheets</div>
          <div><span className={pillClass(Boolean(health?.drive_archive))}></span> Drive archive</div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><div className="eyebrow">AI FASHION PRODUCTION</div><h1>{selected?.name || "Production Dashboard"}</h1><p>{health ? `${health.image_model} → ${health.video_model} → ${health.video_final_resolution}` : "Connecting to backend…"}</p></div>
          <div className="topActions"><button className="ghost" onClick={() => { void loadBatches(); void loadSelected(); void loadScanner(); }}>Refresh</button><button className="ghost" disabled={!selectedId || loading || !health?.google_sheet} onClick={syncSheet}>Sync Sheet</button><button className="dangerGhost" disabled={!selectedId || loading} onClick={retryFailed}>Retry failed</button></div>
        </header>

        {(message || error) && <div className={error ? "toast error" : "toast"}>{error || message}</div>}

        {showCreate && <div className="modalBackdrop"><div className="modal batchSettingsModal"><div className="modalHead"><div><h2>Create production batch</h2><p className="modalSub">Pick one or several backgrounds and motion styles. If you select several, products rotate through them automatically.</p></div><button className="iconBtn" onClick={() => setShowCreate(false)}>×</button></div><div className="formGrid">
          <label>Batch name<input value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Creator<select value={profile} onChange={e => setProfile(e.target.value)}>{profiles.map(x => <option key={x}>{x}</option>)}</select></label>
          <div className="wide settingBlock"><div className="settingLabel"><b>Backgrounds</b><span>{scenePool.length > 1 ? `Rotate ${scenePool.length} settings across the batch` : "Same setting for every product"}</span></div><div className="choiceChips">{scenes.map(x => <button type="button" key={x} className={scenePool.includes(x) ? "choiceChip selected" : "choiceChip"} onClick={() => togglePool(x, scenePool, setScenePool)}>{x}</button>)}</div></div>
          <div className="wide settingBlock"><div className="settingLabel"><b>Motion styles</b><span>{motionPool.length > 1 ? `Rotate ${motionPool.length} motion styles across the batch` : "Same motion style for every product"}</span></div><div className="choiceChips">{styles.map(x => <button type="button" key={x} className={motionPool.includes(x) ? "choiceChip selected" : "choiceChip"} onClick={() => togglePool(x, motionPool, setMotionPool)}>{x}</button>)}</div></div>
          <label className="wide">Avatar / creator reference<input type="file" accept="image/*" onChange={onAvatar} /></label>
          <label className="check wide"><input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} /> Auto-approve images and continue to video</label>
        </div><div className="modalFoot"><button className="ghost" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={loading} onClick={createBatch}>{loading ? "Creating…" : "Create batch"}</button></div></div></div>}

        {photoJob && <div className="modalBackdrop"><div className="modal photoModal">
          <div className="modalHead"><div><h2>Select product photos</h2><p className="modalSub">{photoJob.product_name || "Imported product"}</p></div><button className="iconBtn" onClick={() => setPhotoJobId(null)}>×</button></div>
          <div className="photoPickerTop"><div><b>{refsFor(photoJob).length} selected</b><span>Choose 1–5 images that show the exact product most clearly. Listing and review photos can be mixed.</span></div><button className="ghost small" onClick={() => setRefPick(prev => ({ ...prev, [photoJob.id]: [] }))}>Clear</button></div>
          <div className="preGenSettings"><div className="preGenHead"><b>Generation settings</b><span>Set these before generating. Product type controls framing; background controls the image; motion controls the video.</span></div><div className="preGenGrid">
            <label>Product type <span className="detectedTag">Detected: {productTypeLabel(photoJob.focus)}</span><select value={settingsFor(photoJob).focus} onChange={e => setJobSettings(prev => ({ ...prev, [photoJob.id]: { ...settingsFor(photoJob), focus: e.target.value } }))}>{productTypes.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
            <label>Background<select value={settingsFor(photoJob).scene} onChange={e => setJobSettings(prev => ({ ...prev, [photoJob.id]: { ...settingsFor(photoJob), scene: e.target.value } }))}>{scenes.map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Motion style<select value={settingsFor(photoJob).motion_style} onChange={e => setJobSettings(prev => ({ ...prev, [photoJob.id]: { ...settingsFor(photoJob), motion_style: e.target.value } }))}>{styles.map(x => <option key={x}>{x}</option>)}</select></label>
          </div></div>
          <div className="photoSections">
            <div><div className="photoSectionTitle">Listing photos <span>{photoJob.listing_images?.length || 0}</span></div><div className="photoGrid">{(photoJob.listing_images || []).map((url, i) => { const picked = refsFor(photoJob).includes(url); const order = refsFor(photoJob).indexOf(url) + 1; return <button type="button" className={`photoThumb ${picked ? "picked" : ""}`} key={`listing-${i}-${url}`} onClick={() => toggleRef(photoJob, url)}><img src={url} alt={`Listing product ${i + 1}`} /><span>{picked ? order : "+"}</span></button>; })}{!(photoJob.listing_images || []).length && <div className="muted pad">No listing photos returned.</div>}</div></div>
            <div><div className="photoSectionTitle">Review photos <span>{photoJob.review_images?.length || 0}</span></div><div className="photoGrid">{(photoJob.review_images || []).map((url, i) => { const picked = refsFor(photoJob).includes(url); const order = refsFor(photoJob).indexOf(url) + 1; return <button type="button" className={`photoThumb ${picked ? "picked" : ""}`} key={`review-${i}-${url}`} onClick={() => toggleRef(photoJob, url)}><img src={url} alt={`Review product ${i + 1}`} /><span>{picked ? order : "+"}</span></button>; })}{!(photoJob.review_images || []).length && <div className="muted pad">No review photos returned.</div>}</div></div>
          </div>
          <div className="modalFoot photoFoot"><span className="muted">Nothing generates until you press Generate try-on.</span><div><button className="ghost" onClick={() => setPhotoJobId(null)}>Cancel</button><button className="primary" disabled={loading || !refsFor(photoJob).length} onClick={() => startImageWithRefs(photoJob)}>{loading ? "Queueing…" : `Generate try-on (${refsFor(photoJob).length})`}</button></div></div>
        </div></div>}

        {previewImage && <div className="imageLightboxBackdrop" onClick={() => setPreviewImage(null)}>
          <div className="imageLightbox" onClick={e => e.stopPropagation()}>
            <div className="imageLightboxHead"><div><b>Review generated image</b><span>{previewImage.title}</span></div><button className="iconBtn" onClick={() => setPreviewImage(null)}>×</button></div>
            <div className="imageLightboxCanvas"><img src={previewImage.url} alt={previewImage.title} /></div>
            <div className="imageLightboxFoot"><span>Full-size preview · press Esc or click outside to close.</span><div><a className="ghost linkBtn" href={previewImage.url} target="_blank" rel="noreferrer">Open original</a>{previewJob?.image_status === "completed" && !previewJob.approved && <button className="primary" disabled={loading} onClick={async () => { await approve(previewJob); setPreviewImage(null); }}>{loading ? "Queueing…" : "Approve + video"}</button>}</div></div>
          </div>
        </div>}

        {videoPromptJobId && <div className="modalBackdrop" onClick={() => setVideoPromptJobId(null)}><div className="modal videoPromptModal" onClick={e => e.stopPropagation()}>
          <div className="modalHead"><div><h2>Video prompt</h2><p className="modalSub">{videoPromptJob?.product_name || "Product video"}</p></div><button className="iconBtn" onClick={() => setVideoPromptJobId(null)}>×</button></div>
          {promptLoading ? <div className="promptLoading">Loading prompt…</div> : videoPromptInfo && <>
            <div className="promptMeta"><span>{videoPromptInfo.source === "last_used" ? "Prompt used for the current video" : "Default prompt for this product"}</span><button className="ghost small" onClick={() => setVideoPromptDraft(videoPromptInfo.default_prompt)}>Reset to default</button></div>
            <textarea className="videoPromptEditor" value={videoPromptDraft} onChange={e => setVideoPromptDraft(e.target.value)} spellCheck={false} />
            <div className="promptHelp">Edit anything you want — movement, pacing, turns, product focus, hand motion, etc. Regenerate uses this exact prompt while keeping the approved image as the start frame.</div>
            <div className="modalFoot videoPromptFoot"><div className="promptFootLeft"><button className="ghost" onClick={() => navigator.clipboard?.writeText(videoPromptDraft)}>Copy prompt</button></div><div><button className="ghost" onClick={() => setVideoPromptJobId(null)}>Close</button><button className="primary" disabled={loading || !videoPromptInfo.can_regenerate || !videoPromptDraft.trim()} onClick={() => videoPromptJob && regenerateVideo(videoPromptJob)}>{loading ? "Queueing…" : "Regenerate video with changes"}</button></div></div>
          </>}
        </div></div>}

        {!selected ? <div className="empty"><h2>Create your first batch</h2><p>Your Railway worker is ready. Create a batch and send products into the production queue.</p><button className="primary" onClick={() => setShowCreate(true)}>Create batch</button></div> : <>
          <section className="metrics">{metrics.map(([label, value]) => <div className="metric" key={String(label)}><span>{label}</span><b>{value}</b></div>)}</section>

          <section className="grid2">
            <div className="panel"><div className="panelHead"><div><h3>Creator Scanner Queue</h3><p>Pull products directly from the Scanner Queue sheet.</p></div><button className="ghost small" onClick={() => void loadScanner()}>Reload</button></div>
              <div className="scannerList">{scanner.slice(0, 12).map((row, idx) => { const n = Number(row._row_num || 0); const title = String(row["Product Name"] || row["Product"] || `Scanner product ${idx + 1}`); const selectedRow = scannerPick.has(n); return <label className={`scannerRow ${selectedRow ? "picked" : ""}`} key={`${n}-${idx}`}><input type="checkbox" checked={selectedRow} onChange={() => setScannerPick(prev => { const next = new Set(prev); selectedRow ? next.delete(n) : next.add(n); return next; })} /><div><b>{title}</b><span>{String(row["Creators"] || "")}</span></div></label>; })}{!scanner.length && <div className="muted pad">No pending scanner products.</div>}</div>
              <button className="primary full" disabled={!scannerPick.size || loading} onClick={importScanner}>Import selected ({scannerPick.size})</button>
            </div>
            <div className="panel"><div className="panelHead"><div><h3>Import product links</h3><p>Paste one TikTok Shop product URL per line.</p></div></div><textarea className="linkBox" value={links} onChange={e => setLinks(e.target.value)} placeholder="https://www.tiktok.com/view/product/..." /><button className="primary full" disabled={!links.trim() || loading} onClick={importLinks}>Import products</button><div className="miniInfo"><b>Current batch</b><span>{selected.creator_profile} · {(selected.scene_pool?.length || 1)} background{(selected.scene_pool?.length || 1) === 1 ? "" : "s"} · {(selected.motion_pool?.length || 1)} motion style{(selected.motion_pool?.length || 1) === 1 ? "" : "s"}</span></div></div>
          </section>

          <section className="panel production"><div className="panelHead"><div><h3>Production queue</h3><p>Auto-refreshes every 5 seconds. The Railway worker keeps processing even if this page is closed.</p></div><span className="liveDot">LIVE</span></div>
            <div className="jobGrid">{selected.jobs.map(job => <article className="jobCard" key={job.id}><div className="media">{job.image_url ? <button type="button" className="generatedImageButton" title="Click to review larger" onClick={() => setPreviewImage({ url: job.image_url!, title: job.product_name || "Generated try-on", jobId: job.id })}><img src={job.image_url} alt={job.product_name || "Generated try-on"} /><span className="zoomHint">⌕ View larger</span></button> : <div className="mediaPlaceholder"><span>{stageLabel(job.stage)}</span></div>}<div className="stageBadge">{stageLabel(job.stage)}</div></div><div className="jobBody"><h4>{job.product_name || "Importing product…"}</h4><div className="productionBadges"><span>{productTypeLabel(job.focus)}</span><span>{job.scene || selected.scene || "Background"}</span><span>{job.motion_style || selected.video_style || "Motion"}</span></div><div className="jobMeta"><span>Image: {job.image_status}</span><span>Video: {job.video_status}</span><span>1080p: {job.upscale_status}</span></div>{job.error && <div className="jobError">{job.error}</div>}
              <div className="jobActions">{job.stage === "imported" && <button className="primary small" disabled={loading} onClick={() => openPhotoPicker(job)}>Select product photos</button>}{job.image_status === "completed" && !job.approved && <button className="primary small" disabled={loading} onClick={() => approve(job)}>Approve + video</button>}{job.image_status === "completed" && <button className="ghost small" disabled={loading} onClick={() => openVideoPrompt(job)}>Video prompt</button>}{job.stage === "failed" && <button className="dangerGhost small" disabled={loading} onClick={() => retry(job)}>Retry</button>}{job.video_url && <a className="ghost small linkBtn" href={job.video_url} target="_blank" rel="noreferrer">Open video</a>}{job.drive_video_url && <a className="ghost small linkBtn" href={job.drive_video_url} target="_blank" rel="noreferrer">Drive</a>}</div>
              {job.image_status === "completed" && !job.approved && <div className="regenBox"><input placeholder="Regenerate instruction…" value={regen[job.id] || ""} onChange={e => setRegen({ ...regen, [job.id]: e.target.value })} /><button className="ghost small" disabled={loading} onClick={() => regenerate(job)}>Regenerate</button></div>}
            </div></article>)}{!selected.jobs.length && <div className="muted pad">No products in this batch yet.</div>}</div>
          </section>
        </>}
      </section>
    </main>
  );
}
