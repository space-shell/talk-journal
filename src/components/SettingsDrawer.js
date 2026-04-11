import { html, useState, useEffect } from '../lib.js';
import { DEFAULTS } from '../config.js';
import { cfg, settingsOpen, storageInfo } from '../signals.js';
import { clearHistory } from '../storage.js';
import { IconX } from './icons.js';

export function SettingsDrawer() {
  const open = settingsOpen.value;
  const c    = cfg.value;

  const [lang,      setLang]      = useState(c.language);
  const [vadOn,     setVadOn]     = useState(c.vad_enabled);
  const [thresh,    setThresh]    = useState(c.vad_threshold);
  const [pad,       setPad]       = useState(c.vad_padding_ms);
  const [silGap,    setSilGap]    = useState(c.vad_min_silence_ms);
  const [autoSave,  setAutoSave]  = useState(c.auto_save);
  const [autoTx,    setAutoTx]    = useState(c.auto_transcribe);
  const [delAfter,  setDelAfter]  = useState(c.delete_after_transcription);
  const [notionKey, setNotionKey] = useState(c.notion_api_key);
  const [notionId,  setNotionId]  = useState(c.notion_target_id);
  const [obsidian,  setObsidian]  = useState(c.obsidian_vault_name);
  const si = storageInfo.value;

  // Reset draft when drawer opens
  useEffect(() => {
    if (!open) return;
    const c = cfg.value;
    setLang(c.language); setVadOn(c.vad_enabled); setThresh(c.vad_threshold);
    setPad(c.vad_padding_ms); setSilGap(c.vad_min_silence_ms); setAutoSave(c.auto_save);
    setAutoTx(c.auto_transcribe); setDelAfter(c.delete_after_transcription); setNotionKey(c.notion_api_key);
    setNotionId(c.notion_target_id); setObsidian(c.obsidian_vault_name);
  }, [open]);

  const save = () => {
    const prevDelete = cfg.value.delete_after_transcription;
    const newCfg = {
      language:                   lang,
      vad_enabled:                vadOn,
      vad_threshold:              parseFloat(thresh)  || DEFAULTS.vad_threshold,
      vad_padding_ms:             parseInt(pad)       || DEFAULTS.vad_padding_ms,
      vad_min_silence_ms:         parseInt(silGap)    || DEFAULTS.vad_min_silence_ms,
      auto_save:                  autoSave,
      auto_transcribe:            autoTx,
      delete_after_transcription: delAfter,
      notion_api_key:             notionKey,
      notion_target_id:           notionId,
      obsidian_vault_name:        obsidian,
    };
    if (!prevDelete && delAfter) {
      alert('Delete after transcription enabled.\n\nSource audio files will be permanently deleted from the selected folder after each successful transcription. Ensure the folder is not your only copy of these recordings.');
    }
    cfg.value = newCfg;
    localStorage.setItem('tj_cfg', JSON.stringify(newCfg));
    settingsOpen.value = false;
  };

  if (!open) return null;
  return html`
    <div class="overlay open" onClick=${e => { if (e.target === e.currentTarget) settingsOpen.value = false; }}>
      <div class="drawer">
        <div class="drawer-handle"></div>
        <div class="drawer-head">
          <h2>Settings</h2>
          <button class="icon-btn" aria-label="Close settings" onClick=${() => settingsOpen.value = false}><${IconX} /></button>
        </div>

        <div class="section-label">Transcription</div>
        <div class="field check-row">
          <input type="checkbox" checked=${autoTx} onChange=${e => setAutoTx(e.target.checked)} />
          <label>Auto-transcribe on drive selection</label>
        </div>
        <div class="field">
          <label>Language</label>
          <input type="text" placeholder="en" maxlength="10" value=${lang} onInput=${e => setLang(e.target.value)} />
          <span class="hint">ISO 639-1 code (en, sv, fr…). Leave blank to auto-detect.</span>
        </div>

        <div class="section-label">Silence Removal (VAD)</div>
        <div class="field check-row">
          <input type="checkbox" checked=${vadOn} onChange=${e => setVadOn(e.target.checked)} />
          <label>Remove silent sections before transcription</label>
        </div>
        <div style=${'opacity:' + (vadOn ? '1' : '.4')}>
          <div class="field" style="margin-top:.6rem">
            <label>RMS Threshold</label>
            <input type="number" step="0.001" min="0" max="1" placeholder="0.01" disabled=${!vadOn} value=${thresh} onInput=${e => setThresh(e.target.value)} />
            <span class="hint">Energy below this level is treated as silence</span>
          </div>
          <div class="field" style="margin-top:.6rem">
            <label>Padding (ms)</label>
            <input type="number" step="10" min="0" placeholder="200" disabled=${!vadOn} value=${pad} onInput=${e => setPad(e.target.value)} />
            <span class="hint">Audio retained around voiced regions</span>
          </div>
          <div class="field" style="margin-top:.6rem">
            <label>Min silence gap (ms)</label>
            <input type="number" step="10" min="0" placeholder="300" disabled=${!vadOn} value=${silGap} onInput=${e => setSilGap(e.target.value)} />
            <span class="hint">Minimum gap before it is removed</span>
          </div>
        </div>

        <div class="section-label">Storage</div>
        <div class="field check-row">
          <input type="checkbox" checked=${autoSave} onChange=${e => setAutoSave(e.target.checked)} />
          <label>Auto-save transcriptions to history</label>
        </div>
        <div style="display:flex;flex-direction:column;gap:.4rem">
          <div class="storage-bar"><div class=${'storage-fill' + (si.warn ? ' warn' : '')} style=${'width:' + si.pct + '%'}></div></div>
          <div class="storage-info">${si.text}</div>
          <button class="btn btn-danger btn-sm" style="align-self:flex-start" onClick=${clearHistory}>Clear History</button>
        </div>

        <div class="section-label">Drive</div>
        <div class="field check-row">
          <input type="checkbox" checked=${delAfter} onChange=${e => setDelAfter(e.target.checked)} />
          <label>Delete source files after transcription</label>
        </div>
        <p class="hint">Files are deleted per-file immediately after transcription succeeds and is saved to history. You will be asked to confirm before each batch.</p>

        <div class="section-label">Connectors — Notion</div>
        <div class="field">
          <label>Integration Token</label>
          <input type="password" placeholder="secret_…" value=${notionKey} onInput=${e => setNotionKey(e.target.value)} />
        </div>
        <div class="field">
          <label>Target Page or Database ID</label>
          <input type="text" placeholder="32-character ID" value=${notionId} onInput=${e => setNotionId(e.target.value)} />
        </div>

        <div class="section-label">Connectors — Obsidian</div>
        <div class="field">
          <label>Vault Name</label>
          <input type="text" placeholder="My Vault" value=${obsidian} onInput=${e => setObsidian(e.target.value)} />
          <span class="hint">Opens a new note via obsidian:// URI. Obsidian must be running locally.</span>
        </div>

        <div class="section-label">Connectors — Coming Soon</div>
        <p class="hint" style="padding-bottom:.25rem">Claude · ChatGPT · Custom Webhook</p>

        <button class="btn btn-primary" onClick=${save}>Save Settings</button>
      </div>
    </div>`;
}
