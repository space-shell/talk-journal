import { html, useState, useEffect } from '../lib.js';
import { DEFAULTS } from '../config.js';
import { cfg, settingsOpen, storageInfo } from '../signals.js';
import { clearHistory } from '../storage.js';
import { nostrStatus, syncNow, autoSync } from '../nostr-sync.js';
import { loadNsec, saveNsec, clearPrivkey, generateKeypair, npubFromNsec } from '../nostr-keys.js';
import { loadRelays, saveRelays, relayStatuses, connectRelays } from '../nostr-relay.js';
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
  const [nsecInput,   setNsecInput]   = useState(() => loadNsec());
  const [relaysInput, setRelaysInput] = useState(() => loadRelays().join('\n'));
  const si = storageInfo.value;
  const ns = nostrStatus.value;
  const rsMap = relayStatuses.value;

  let npubDisplay = '';
  try { if (nsecInput) npubDisplay = npubFromNsec(nsecInput); } catch {}

  const doGenerate = () => {
    const kp = generateKeypair();
    setNsecInput(kp.nsec);
    saveNsec(kp.nsec);
  };

  const onNsecBlur = e => {
    const val = e.target.value.trim();
    if (!val) { clearPrivkey(); return; }
    try { saveNsec(val); } catch { /* invalid — leave as-is, save button will alert */ }
  };

  // Reset draft when drawer opens
  useEffect(() => {
    if (!open) return;
    const c = cfg.value;
    setLang(c.language); setVadOn(c.vad_enabled); setThresh(c.vad_threshold);
    setPad(c.vad_padding_ms); setSilGap(c.vad_min_silence_ms); setAutoSave(c.auto_save);
    setAutoTx(c.auto_transcribe); setDelAfter(c.delete_after_transcription); setNotionKey(c.notion_api_key);
    setNotionId(c.notion_target_id); setObsidian(c.obsidian_vault_name);
    setNsecInput(loadNsec()); setRelaysInput(loadRelays().join('\n'));
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

    // Save Nostr settings
    const urls = relaysInput.split('\n').map(s => s.trim()).filter(Boolean);
    saveRelays(urls);
    if (nsecInput) {
      try { saveNsec(nsecInput); } catch { alert('Invalid nsec — Nostr settings not saved.'); return; }
    } else {
      clearPrivkey();
    }
    if (nsecInput && urls.length) { connectRelays(urls); autoSync(); }

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

        <div class="section-label">Sync — Nostr</div>
        <p class="hint">End-to-end encrypted cross-device sync via Nostr relays. Your private key never leaves your devices — all data is encrypted with NIP-44 before being published.</p>
        ${nsecInput && html`<p class="hint" style="color:var(--warn,#c97a00);margin-bottom:.5rem">Your <strong>nsec</strong> is stored in plain text in this browser's localStorage. Only use Nostr sync on devices you trust.</p>`}

        <div class="field">
          <label>Private Key (nsec)</label>
          <div style="display:flex;gap:.5rem">
            <input type="password" placeholder="nsec1…" value=${nsecInput}
              onInput=${e => setNsecInput(e.target.value)}
              onBlur=${onNsecBlur}
              style="flex:1;font-family:monospace;font-size:.8rem" />
            <button type="button" class="btn btn-sm" onClick=${doGenerate} style="white-space:nowrap">Generate</button>
          </div>
          <span class="hint">Paste an existing nsec or click Generate to create a new identity. Keep a copy — it cannot be recovered.</span>
        </div>

        ${npubDisplay && html`
          <div class="field">
            <label>Public Key (npub)</label>
            <input type="text" readonly value=${npubDisplay} style="font-family:monospace;font-size:.75rem;color:var(--text-muted,#888)" />
          </div>
        `}

        <div class="field">
          <label>Relay URLs</label>
          <textarea rows="3" placeholder="wss://relay.damus.io${'\n'}wss://nos.lol"
            value=${relaysInput} onInput=${e => setRelaysInput(e.target.value)}
            style="font-family:monospace;font-size:.8rem;resize:vertical" />
          <span class="hint">One relay per line. Changes take effect after saving.</span>
        </div>

        ${[...rsMap.entries()].length > 0 && html`
          <div style="display:flex;flex-direction:column;gap:.25rem;margin-bottom:.5rem">
            ${[...rsMap.entries()].map(([url, status]) => html`
              <div style="display:flex;align-items:center;gap:.4rem;font-size:.8rem">
                <span style=${'width:8px;height:8px;border-radius:50%;background:' + (status === 'open' ? '#22c55e' : status === 'error' ? '#ef4444' : '#f59e0b')}></span>
                <span style="color:var(--text-muted,#888);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${url}</span>
                <span style="margin-left:auto;color:var(--text-muted,#888)">${status}</span>
              </div>
            `)}
          </div>
        `}

        <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:.25rem">
          <button type="button" class="btn btn-sm" onClick=${syncNow}
            disabled=${ns.state === 'syncing'}>
            ${ns.state === 'syncing' ? 'Syncing…' : 'Sync Now'}
          </button>
          ${ns.lastSync && html`<span class="hint" style="margin:0">Last synced: ${new Date(ns.lastSync).toLocaleString()}</span>`}
          ${ns.error && html`<span class="hint" style="color:#ef4444;margin:0">${ns.error}</span>`}
        </div>

        <button class="btn btn-primary" onClick=${save}>Save Settings</button>
      </div>
    </div>`;
}
