from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, 1))


page = Path("app/page.tsx")
text = page.read_text()

text = text.replace(
'''type SavedAvatar = {
  id: string;
  name: string;
  image_b64: string;
  image_mime: string;
};''',
'''type SavedAvatar = {
  id: string;
  name: string;
  image_b64?: string;
  image_mime: string;
  image_url?: string | null;
};''',
1)

anchor = '''function stageLabel(stage: string) {
  return stage.replaceAll("_", " ").replace(/\\b\\w/g, (c) => c.toUpperCase());
}
'''
insert = '''function stageLabel(stage: string) {
  return stage.replaceAll("_", " ").replace(/\\b\\w/g, (c) => c.toUpperCase());
}

function savedAvatarSrc(avatar: SavedAvatar) {
  if (avatar.image_url) return `/api/backend${avatar.image_url}`;
  if (avatar.image_b64) return `data:${avatar.image_mime || "image/jpeg"};base64,${avatar.image_b64}`;
  return "";
}
'''
if anchor not in text:
    raise SystemExit("stageLabel anchor not found")
text = text.replace(anchor, insert, 1)

# Derived saved-avatar preview lets the UI stop carrying saved image bytes in React state.
old_state = '''  const [savedAvatars, setSavedAvatars] = useState<SavedAvatar[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [avatarName, setAvatarName] = useState("My Avatar");
'''
new_state = '''  const [savedAvatars, setSavedAvatars] = useState<SavedAvatar[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [avatarName, setAvatarName] = useState("My Avatar");
  const selectedSavedAvatar = useMemo(
    () => savedAvatars.find(avatar => avatar.id === selectedAvatarId) || null,
    [savedAvatars, selectedAvatarId],
  );
'''
if old_state not in text:
    raise SystemExit("avatar state block not found")
text = text.replace(old_state, new_state, 1)

old_create = '''  async function createBatch() {
    const shoeMode = batchMode === "shoe_showcase";
    if (!shoeMode && !avatarB64) { setError("Choose or upload an avatar before creating the Fashion Try-On batch."); return; }
    setLoading(true); setError("");
    try {
      if (!shoeMode && avatarB64 && !selectedAvatarId) {
        const saved = await api<SavedAvatar>("/avatars", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: avatarName.trim() || "My Avatar", image_b64: avatarB64, image_mime: avatarMime })
        });
        setSelectedAvatarId(saved.id);
        setSavedAvatars(prev => [saved, ...prev.filter(x => x.id !== saved.id)]);
      }
      const batch = await api<Batch>("/batches", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, mode: batchMode,
          scene: shoeMode ? SHOE_SCENE : scenePool[0],
          scene_pool: shoeMode ? [SHOE_SCENE] : scenePool,
          creator_profile: profile,
          video_style: shoeMode ? SHOE_MOTION : motionPool[0],
          motion_pool: shoeMode ? [SHOE_MOTION] : motionPool,
          auto_approve: shoeMode ? false : autoApprove,
          avatar_b64: shoeMode ? null : avatarB64,
          avatar_mime: avatarMime,
          avatar_name: shoeMode ? null : (avatarName.trim() || "My Avatar"),
          flow_account_email: newFlowAccountEmail || null
        })
      });
'''
new_create = '''  async function createBatch() {
    const shoeMode = batchMode === "shoe_showcase";
    if (!shoeMode && !avatarB64 && !selectedAvatarId) { setError("Choose or upload an avatar before creating the Fashion Try-On batch."); return; }
    setLoading(true); setError("");
    try {
      let avatarIdForBatch = selectedAvatarId;
      if (!shoeMode && avatarB64 && !avatarIdForBatch) {
        const saved = await api<SavedAvatar>("/avatars", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: avatarName.trim() || "My Avatar", image_b64: avatarB64, image_mime: avatarMime })
        });
        avatarIdForBatch = saved.id;
        setSelectedAvatarId(saved.id);
        setSavedAvatars(prev => [saved, ...prev.filter(x => x.id !== saved.id)]);
      }
      const batch = await api<Batch>("/batches", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, mode: batchMode,
          scene: shoeMode ? SHOE_SCENE : scenePool[0],
          scene_pool: shoeMode ? [SHOE_SCENE] : scenePool,
          creator_profile: profile,
          video_style: shoeMode ? SHOE_MOTION : motionPool[0],
          motion_pool: shoeMode ? [SHOE_MOTION] : motionPool,
          auto_approve: shoeMode ? false : autoApprove,
          avatar_id: shoeMode ? null : (avatarIdForBatch || null),
          avatar_b64: shoeMode || avatarIdForBatch ? null : avatarB64,
          avatar_mime: avatarMime,
          avatar_name: shoeMode ? null : (avatarName.trim() || "My Avatar"),
          flow_account_email: newFlowAccountEmail || null
        })
      });
'''
if old_create not in text:
    raise SystemExit("createBatch block not found")
text = text.replace(old_create, new_create, 1)

old_choose = '''  function chooseSavedAvatar(avatar: SavedAvatar) {
    setSelectedAvatarId(avatar.id);
    setAvatarB64(avatar.image_b64);
    setAvatarMime(avatar.image_mime || "image/jpeg");
    setAvatarName(avatar.name);
  }
'''
new_choose = '''  function chooseSavedAvatar(avatar: SavedAvatar) {
    setSelectedAvatarId(avatar.id);
    setAvatarB64(null);
    setAvatarMime(avatar.image_mime || "image/jpeg");
    setAvatarName(avatar.name);
  }
'''
if old_choose not in text:
    raise SystemExit("chooseSavedAvatar block not found")
text = text.replace(old_choose, new_choose, 1)

old_sniper = '''            auto_approve: false,
            avatar_b64: avatar.image_b64,
            avatar_mime: avatar.image_mime || "image/jpeg",
            avatar_name: avatar.name,
'''
new_sniper = '''            auto_approve: false,
            avatar_id: avatar.id,
            avatar_b64: null,
            avatar_mime: avatar.image_mime || "image/jpeg",
            avatar_name: avatar.name,
'''
if old_sniper not in text:
    raise SystemExit("Sniper avatar block not found")
text = text.replace(old_sniper, new_sniper, 1)

old_grid = '''{!!savedAvatars.length && <div className="avatarGrid">{savedAvatars.map(avatar => <div className={`avatarCard ${selectedAvatarId === avatar.id ? "selected" : ""}`} key={avatar.id}><button type="button" className="avatarPick" onClick={() => chooseSavedAvatar(avatar)}><img src={`data:${avatar.image_mime};base64,${avatar.image_b64}`} alt={avatar.name} /><span>{avatar.name}</span></button><button type="button" className="avatarDelete" title="Delete saved avatar" onClick={() => void deleteAvatar(avatar)}>×</button></div>)}</div>}'''
new_grid = '''{!!savedAvatars.length && <div className="avatarGrid">{savedAvatars.map(avatar => <div className={`avatarCard ${selectedAvatarId === avatar.id ? "selected" : ""}`} key={avatar.id}><button type="button" className="avatarPick" onClick={() => chooseSavedAvatar(avatar)}><img src={savedAvatarSrc(avatar)} alt={avatar.name} /><span>{avatar.name}</span></button><button type="button" className="avatarDelete" title="Delete saved avatar" onClick={() => void deleteAvatar(avatar)}>×</button></div>)}</div>}'''
if old_grid not in text:
    raise SystemExit("avatar grid block not found")
text = text.replace(old_grid, new_grid, 1)

old_preview = '''{avatarB64 && <div className="avatarSelected"><img src={`data:${avatarMime};base64,${avatarB64}`} alt="Selected avatar" /><div><b>{avatarName || "Selected avatar"}</b><span>{selectedAvatarId ? "Saved avatar selected" : "Uploaded — save it to reuse later"}</span></div></div>}'''
new_preview = '''{(avatarB64 || selectedSavedAvatar) && <div className="avatarSelected"><img src={selectedSavedAvatar ? savedAvatarSrc(selectedSavedAvatar) : `data:${avatarMime};base64,${avatarB64}`} alt="Selected avatar" /><div><b>{avatarName || "Selected avatar"}</b><span>{selectedAvatarId ? "Saved avatar selected · stored externally" : "Uploaded — save it to reuse later"}</span></div></div>}'''
if old_preview not in text:
    raise SystemExit("avatar preview block not found")
text = text.replace(old_preview, new_preview, 1)

page.write_text(text)

# FFmpeg editor: normalize edge emoji and use the shared Apple cache on Windows.
ff = Path("app/ManualFFmpegControl.tsx")
text = ff.read_text()
anchor = '''function renderEmojiPngs(value: string): string[] {
  return emojiTokens(value).map(token => renderSystemEmojiPng(token));
}
'''
insert = '''function renderEmojiPngs(value: string): string[] {
  return emojiTokens(value).map(token => renderSystemEmojiPng(token));
}

function looksLikeEmojiToken(token: string): boolean {
  for (const char of String(token || "")) {
    const code = char.codePointAt(0) || 0;
    if ((code >= 0x1f000 && code <= 0x1faff) || (code >= 0x2600 && code <= 0x27bf)) return true;
  }
  return false;
}

function normalizeEdgeEmoji(draft: OverlayDraft): OverlayDraft {
  const parts = String(draft.headline || "").trim().split(/\\s+/).filter(Boolean);
  let prefix = String(draft.emoji_prefix || "").trim();
  let suffix = String(draft.emoji_suffix || "").trim();
  if (parts.length > 1 && !prefix && looksLikeEmojiToken(parts[0])) prefix = parts.shift() || "";
  if (parts.length > 1 && !suffix && looksLikeEmojiToken(parts[parts.length - 1])) suffix = parts.pop() || "";
  return { ...draft, headline: parts.join(" "), emoji_prefix: prefix, emoji_suffix: suffix };
}
'''
if anchor not in text:
    raise SystemExit("FFmpeg emoji helper anchor not found")
text = text.replace(anchor, insert, 1)

old_send = '''    try {
      const emoji_prefix_pngs = renderEmojiPngs(draft.emoji_prefix);
      const emoji_suffix_pngs = renderEmojiPngs(draft.emoji_suffix);
      await backend(`/jobs/${editorJob.id}/apply-text-overlay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, emoji_prefix_pngs, emoji_suffix_pngs }),
      });
'''
new_send = '''    try {
      const normalizedDraft = normalizeEdgeEmoji(draft);
      const appleDevice = isAppleDevice();
      const emoji_prefix_pngs = appleDevice ? renderEmojiPngs(normalizedDraft.emoji_prefix) : [];
      const emoji_suffix_pngs = appleDevice ? renderEmojiPngs(normalizedDraft.emoji_suffix) : [];
      await backend(`/jobs/${editorJob.id}/apply-text-overlay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...normalizedDraft,
          emoji_prefix_pngs,
          emoji_suffix_pngs,
          emoji_source: appleDevice ? "apple_browser" : "server_cache",
        }),
      });
'''
if old_send not in text:
    raise SystemExit("FFmpeg send block not found")
text = text.replace(old_send, new_send, 1)

old_warning = '''                  {appleDevice
                    ? "Apple emoji mode ✓ Emojis are rendered locally by this Apple device into transparent PNGs, then sent with the overlay. Railway does not need the Apple emoji font."
                    : "For exact Apple emoji, open this editor on a Mac, iPhone, or iPad. On another device the local system emoji style will be used instead."}
'''
new_warning = '''                  {appleDevice
                    ? "Apple emoji pack ✓ This Apple device syncs emoji artwork into the shared server library. Final exports use that shared Apple artwork."
                    : "Apple emoji pack ✓ Final exports use the shared Apple emoji library on both Mac and Windows. On Windows, the preview may look different, but the rendered video uses the saved Apple artwork."}
'''
if old_warning not in text:
    raise SystemExit("FFmpeg warning copy not found")
text = text.replace(old_warning, new_warning, 1)

old_preview_note = '''<div style={{ fontSize: 10.5, color: "#777", lineHeight: 1.4 }}>On your Mac, the preview and the final exported emoji both use Apple Color Emoji. Text is rendered server-side, then FFmpeg composites the finished transparent layer over the real video.</div>'''
new_preview_note = '''<div style={{ fontSize: 10.5, color: "#777", lineHeight: 1.4 }}>The preview can follow this device’s local emoji style. The final export uses the shared Apple emoji artwork, then FFmpeg composites the finished transparent layer over the real video.</div>'''
if old_preview_note not in text:
    raise SystemExit("FFmpeg preview note not found")
text = text.replace(old_preview_note, new_preview_note, 1)
ff.write_text(text)

# Force Apple devices to refresh the shared common pack after this deployment.
seeder = Path("app/AppleEmojiSeeder.tsx")
text = seeder.read_text()
if 'const PACK_VERSION = "flow-apple-emoji-pack-v1";' not in text:
    raise SystemExit("Apple emoji pack version not found")
seeder.write_text(text.replace('const PACK_VERSION = "flow-apple-emoji-pack-v1";', 'const PACK_VERSION = "flow-apple-emoji-pack-v2";', 1))
