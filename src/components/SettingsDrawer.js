import { html, useSignal, effect } from '../lib.js';
import { DEFAULTS } from '../config.js';
import { cfg, settingsOpen, storageInfo, llmStatus, llmDlProgress } from '../signals.js';
import { clearHistory } from '../storage.js';
import { nostrStatus, syncNow, autoSync } from '../nostr-sync.js';
import { loadNsec, saveNsec, clearPrivkey, generateKeypair, npubFromNsec } from '../nostr-keys.js';
import { loadRelays, saveRelays, relayStatuses, connectRelays } from '../nostr-relay.js';
import { loadLlm, unloadLlm, isLlmReady } from '../llm.js';
import { IconX } from './icons.js';

export function SettingsDrawer() {
  const open = settingsOpen.value;
  const c    = cfg.value;

  const lang        = useSignal(c.language);
  const vadOn       = useSignal(c.vad_enabled);
  const thresh      = useSignal(c.vad_threshold);
  const pad         = useSignal(c.vad_padding_ms);
  const silGap      = useSignal(c.vad_min_silence_ms);
  const autoSave    = useSignal(c.auto_save);
  const autoTx      = useSignal(c.auto_transcribe);
  const delAfter    = useSignal(c.delete_after_transcription);
  const notionKey   = useSignal(c.notion_api_key);
  const notionId    = useSignal(c.notion_target_id);
  const obsidian    = useSignal(c.obsidian_vault_name);
  const llmFmt      = useSignal(c.llm_formatting);
  const nsecInput   = useSignal(loadNsec());
  const relaysInput = useSignal(loadRelays().join('\n'));
  const si = storageInfo.value;
  const ns = nostrStatus.value;
  const rsMap = relayStatuses.value;

  let npubDisplay = '';
  try { if (nsecInput.value) npubDisplay = npubFromNsec(nsecInput.value); } catch {}

  const doGenerate = () => {
    const kp = generateKeypair();
    nsecInput.value = kp.nsec;
    saveNsec(kp.nsec);
  };

  const onNsecBlur = e => {
    const val = e.target.value.trim();
    if (!val) { clearPrivkey(); return; }
    try { saveNsec(val); } catch { /* invalid — leave as-is, save button will alert */ }
  };

  effect(() => {
    if (!settingsOpen.value) return;
    const c = cfg.value;
    lang.value = c.language; vadOn.value = c.vad_enabled; thresh.value = c.vad_threshold;
    pad.value = c.vad_padding_ms; silGap.value = c.vad_min_silence_ms; autoSave.value = c.auto_save;
    autoTx.value = c.auto_transcribe; delAfter.value = c.delete_after_transcription; notionKey.value = c.notion_api_key;
    notionId.value = c.notion_target_id; obsidian.value = c.obsidian_vault_name;
    llmFmt.value = c.llm_formatting;
    nsecInput.value = loadNsec(); relaysInput.value = loadRelays().join('\n');
  });

  const onLlmToggle = async (checked) => {
    llmFmt.value = checked;
    if (checked && !isLlmReady() && !llmStatus.value.loading) {
      llmStatus.value = { loaded: false, loading: true, error: null };
      llmDlProgress.value = { visible: true, pct: 0, label: 'Starting download…' };
      try {
        await loadLlm(p => {
          if (!p) return;
          const pct = typeof p === 'number' ? p : p.progress != null ? p.progress : null;
          llmDlProgress.value = {
            visible: true,
            pct: pct != null ? Math.min(99, pct) : llmDlProgress.value.pct,
            label: p.text || 'Downloading model…',
          };
        });
        llmDlProgress.value = { visible: true, pct: 100, label: 'Done' };
        llmStatus.value = { loaded: true, loading: false, error: null };
      } catch (e) {
        llmStatus.value = { loaded: false, loading: false, error: e.message };
        llmDlProgress.value = { visible: false, pct: 0, label: '' };
        llmFmt.value = false;
        console.error('LLM load failed:', e);
      }
    } else if (!checked) {
      unloadLlm();
      llmStatus.value = { loaded: false, loading: false, error: null };
      llmDlProgress.value = { visible: false, pct: 0, label: '' };
    }
  };

  const save = () => {
    const prevDelete = cfg.value.delete_after_transcription;
    const newCfg = {
      language:                   lang.value,
      vad_enabled:                vadOn.value,
      vad_threshold:              parseFloat(thresh.value)  || DEFAULTS.vad_threshold,
      vad_padding_ms:             parseInt(pad.value)       || DEFAULTS.vad_padding_ms,
      vad_min_silence_ms:         parseInt(silGap.value)    || DEFAULTS.vad_min_silence_ms,
      auto_save:                  autoSave.value,
      auto_transcribe:            autoTx.value,
      delete_after_transcription: delAfter.value,
      notion_api_key:             notionKey.value,
      notion_target_id:           notionId.value,
      obsidian_vault_name:        obsidian.value,
      llm_formatting:             llmFmt.value,
    };
    if (!prevDelete && delAfter.value) {
      alert('Delete after transcription enabled.\n\nSource audio files will be permanently deleted from the selected folder after each successful transcription. Ensure the folder is not your only copy of these recordings.');
    }
    cfg.value = newCfg;
    localStorage.setItem('tj_cfg', JSON.stringify(newCfg));

    // Save Nostr settings
    const urls = relaysInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    saveRelays(urls);
    if (nsecInput.value) {
      try { saveNsec(nsecInput.value); } catch { alert('Invalid nsec — Nostr settings not saved.'); return; }
    } else {
      clearPrivkey();
    }
    if (nsecInput.value && urls.length) { connectRelays(urls); autoSync(); }

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
          <input type="checkbox" checked=${autoTx.value} onChange=${e => autoTx.value = e.target.checked} />
          <label>Auto-transcribe on drive selection</label>
        </div>
        <div class="field">
          <label>Language</label>
          <input type="text" placeholder="en" maxlength="10" value=${lang.value} onInput=${e => lang.value = e.target.value} />
          <span class="hint">ISO 639-1 code (en, sv, fr…). Leave blank to auto-detect.</span>
        </div>

        <div class="section-label">Transcription Formatting</div>
        <div class="field check-row">
          <input type="checkbox" checked=${llmFmt.value} disabled=${llmStatus.value.loading}
            onChange=${e => onLlmToggle(e.target.checked)} />
          <label>Structure transcriptions with AI</label>
        </div>
        <p class="hint">Uses a small AI model (Gemma 2 2B) in your browser to add punctuation, paragraphs, and remove filler words from transcriptions. No data leaves your device. ~1.9 GB download, cached after first load.</p>
        ${llmDlProgress.value.visible && html`
          <div class="download-progress" style="margin-top:.5rem">
            <div class="download-bar"><div class="download-fill" style=${'width:' + llmDlProgress.value.pct + '%'}></div></div>
            <div class="download-label">${llmDlProgress.value.label}</div>
          </div>
        `}
        ${llmStatus.value.error && html`
          <p class="hint" style="color:var(--red);margin-top:.5rem">Failed to load model: ${llmStatus.value.error}</p>
        `}

        <div class="section-label">Silence Removal (VAD)</div>
        <div class="field check-row">
          <input type="checkbox" checked=${vadOn.value} onChange=${e => vadOn.value = e.target.checked} />
          <label>Remove silent sections before transcription</label>
        </div>
        <div style=${'opacity:' + (vadOn.value ? '1' : '.4')}>
          <div class="field" style="margin-top:.6rem">
            <label>RMS Threshold</label>
            <input type="number" step="0.001" min="0" max="1" placeholder="0.01" disabled=${!vadOn.value} value=${thresh.value} onInput=${e => thresh.value = e.target.value} />
            <span class="hint">Energy below this level is treated as silence</span>
          </div>
          <div class="field" style="margin-top:.6rem">
            <label>Padding (ms)</label>
            <input type="number" step="10" min="0" placeholder="200" disabled=${!vadOn.value} value=${pad.value} onInput=${e => pad.value = e.target.value} />
            <span class="hint">Audio retained around voiced regions</span>
          </div>
          <div class="field" style="margin-top:.6rem">
            <label>Min silence gap (ms)</label>
            <input type="number" step="10" min="0" placeholder="300" disabled=${!vadOn.value} value=${silGap.value} onInput=${e => silGap.value = e.target.value} />
            <span class="hint">Minimum gap before it is removed</span>
          </div>
        </div>

        <div class="section-label">Storage</div>
        <div class="field check-row">
          <input type="checkbox" checked=${autoSave.value} onChange=${e => autoSave.value = e.target.checked} />
          <label>Auto-save transcriptions to history</label>
        </div>
        <div style="display:flex;flex-direction:column;gap:.4rem">
          <div class="storage-bar"><div class=${'storage-fill' + (si.warn ? ' warn' : '')} style=${'width:' + si.pct + '%'}></div></div>
          <div class="storage-info">${si.text}</div>
          <button class="btn btn-danger btn-sm" style="align-self:flex-start" onClick=${clearHistory}>Clear History</button>
        </div>

        <div class="section-label">Drive</div>
        <div class="field check-row">
          <input type="checkbox" checked=${delAfter.value} onChange=${e => delAfter.value = e.target.checked} />
          <label>Delete source files after transcription</label>
        </div>
        <p class="hint">Files are deleted per-file immediately after transcription succeeds and is saved to history. You will be asked to confirm before each batch.</p>

        <div class="section-label">Connectors — Notion</div>
        <div class="field">
          <label>Integration Token</label>
          <input type="password" placeholder="secret_…" value=${notionKey.value} onInput=${e => notionKey.value = e.target.value} />
        </div>
        <div class="field">
          <label>Target Page or Database ID</label>
          <input type="text" placeholder="32-character ID" value=${notionId.value} onInput=${e => notionId.value = e.target.value} />
        </div>

        <div class="section-label">Connectors — Obsidian</div>
        <div class="field">
          <label>Vault Name</label>
          <input type="text" placeholder="My Vault" value=${obsidian.value} onInput=${e => obsidian.value = e.target.value} />
          <span class="hint">Opens a new note via obsidian:// URI. Obsidian must be running locally.</span>
        </div>

        <div class="section-label">Connectors — Coming Soon</div>
        <p class="hint" style="padding-bottom:.25rem">Claude · ChatGPT · Custom Webhook</p>

        <div class="section-label">Sync — Nostr</div>
        <p class="hint">End-to-end encrypted cross-device sync via Nostr relays. Your private key never leaves your devices — all data is encrypted with NIP-44 before being published.</p>
        ${nsecInput.value && html`<p class="hint" style="color:var(--warn,#c97a00);margin-bottom:.5rem">Your <strong>nsec</strong> is stored in plain text in this browser's localStorage. Only use Nostr sync on devices you trust.</p>`}

        <div class="field">
          <label>Private Key (nsec)</label>
          <div style="display:flex;gap:.5rem">
            <input type="password" placeholder="nsec1…" value=${nsecInput.value}
              onInput=${e => nsecInput.value = e.target.value}
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
            value=${relaysInput.value} onInput=${e => relaysInput.value = e.target.value}
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
