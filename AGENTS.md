# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tibbs** — a fully offline, single-page web app for audio journaling. Users record voice notes throughout the day (phone, dictaphone, laptop — any device), then open the app at the end (or start) of the day, select their recordings folder, and work through a guided one-by-one wizard that transcribes their audio and helps them extract structured reflections.

The journaling flow:
1. Select recordings folder → audio files are scanned and transcribed in the background
2. Wizard presents each recording one at a time — user reads the transcription, adds optional free-text notes
3. User adds structured **ATF entries** (Action / Thought / Feeling), each ≤ 160 chars, unlimited per type
4. After all recordings are reviewed, a **Summary** page shows statistics and all ATF entries across the session
5. User optionally deletes audio files and/or transcriptions at the end

Transcription runs entirely in the browser using **parakeet.js** (Parakeet TDT 0.6B via WebGPU + WASM) — no server, no API keys, no network requests during transcription. The only network activity is the one-time model download.

> **Note:** `application-design-spec.md` reflects an earlier API-based, DJI-specific design that was fully superseded. Ignore it — this CLAUDE.md is authoritative.

## Tech Stack & Constraints

- **Build-less**: No bundler or build step — the browser loads ES modules directly via `<script type="module" src="./src/main.js">`
- **Multi-file ES modules**: JavaScript is split into `src/` modules with native browser ESM imports; CSS stays embedded in `index.html`
- **ES module**: `type="module"` required to import parakeet.js via esm.sh
- **Chromium-only**: File System Access API + WebGPU are not supported in Firefox/Safari — detected on load, warning shown
- **No backend, no API**: All transcription is local. Only outbound request is the one-time model download

## Deployment

- **GitHub Pages**: `https://space-shell.github.io/talk-journal/` — serving from `main` branch root
- `.nojekyll` present to bypass Jekyll processing
- HTTPS enforced — required for Web Share API, File System Access API, and microphone access

## Architecture

### File structure

```
index.html                    HTML skeleton + all CSS; loads ./src/main.js
src/
  lib.js                      Vendor re-exports: preact, @preact/signals, htm → exports html tagged template
  config.js                   Constants: DEFAULTS, ATF_TYPES, TX_PREFIX, MODEL_KEY, AUDIO_EXTS, ATF_MAX
  compat.js                   Browser capability checks: hasFilePicker, hasWebGPU, hasSimd
  helpers.js                  Pure formatting utils + genId
  signals.js                  All Preact signals + updateFile() helper
  storage.js                  localStorage CRUD: saveTx/getTx/updateTx/removeTx + refreshHistory/refreshStorage/clearHistory
  audio.js                    prepareAudio() + removeSilence() (RMS VAD)
  engine.js                   Parakeet inference: worker, txQueue, loadParakeet, runParakeet
                                - exports parakeetModel/parakeetWorker as live ESM bindings
                                - setParakeetModel() setter for test hooks
  model.js                    checkModelStatus(), downloadModel() — imports from both engine.js and transcription.js
                                (kept separate from engine.js to avoid circular dependency)
  fs-handles.js               IndexedDB folder handle persistence (saveHandle/loadHandle)
  transcription.js            requestBatch(), startBatch(), transcribeFile(), retryFile()
  drive.js                    pickDrive(), scan(), tryAutoReconnect()
  navigation.js               goNext(), goPrev(), startNewSession()
  share.js                    exportAll(), shareAll(), sendToNotion(), sendToObsidian()
  main.js                     Entry point: window._tj test hooks, render()
  components/
    icons.js                  SVG icon components
    AtfInput.js               ATF entry input + mic dictation
    FileItem.js               Single recording card (transcript, notes, ATF)
    WizardView.js / WizardNav.js
    FilesPanel.js / ModelPanel.js / Header.js / ActionBar.js
    SummaryPage.js / SettingsDrawer.js
    App.js / CompatWarning.js
```

### Key dependency rules

- `engine.js` never imports from `transcription.js` or `model.js` — this prevents a circular dependency
- `updateFile()` lives in `signals.js` (not `drive.js`) so both `transcription.js` and components can import it without cycles
- `model.js` is the only module that imports from both `engine.js` and `transcription.js`

### UI sections
1. **Header** — model status indicator, settings gear
2. **Wizard** — one recording card at a time; transcription, notes, ATF entries, Previous/Next navigation
3. **Summary** — statistics and full ATF entry review after all cards are completed
4. **Settings drawer** — bottom sheet on mobile (`<640px`), right-side drawer on desktop (`≥640px`)

**Sticky action bar** at viewport bottom: Select all · Transcribe Selected · Export · Share.

State flow: select folder → scan audio files → transcribe (background, auto if model ready) → wizard review → summary → optional cleanup.

> **Worker status**: Transcription runs in a dedicated Web Worker (created from an inline Blob URL in `engine.js` with `{ type: 'module' }`). Audio is transferred via `ArrayBuffer` transfer (zero-copy; SharedArrayBuffer is NOT required). If the Worker fails to initialise, `loadParakeet` catches the error and falls back to main-thread execution silently. All inference — whether worker or fallback — is serialised through the shared `txQueue` in `engine.js`.

## Audio Pipeline

Supported input formats: any format decodable by `AudioContext.decodeAudioData()` — in practice: `.wav`, `.mp3`, `.m4a`, `.aac`, `.ogg`, `.oga`, `.opus`, `.webm`, `.flac`. The file scan accepts all of these extensions.

`prepareAudio(arrayBuffer) → Float32Array`

1. `AudioContext.decodeAudioData()` — decodes any supported format at any sample rate / bit depth
2. `OfflineAudioContext(1, frames, 16000).startRendering()` — resamples to 16 kHz mono
3. `removeSilence(float32, 16000)` — RMS VAD (when `vad_enabled`): classifies 20ms chunks, pads voiced regions, fills short silence gaps
4. Returns `Float32Array` directly to `runParakeet()` — no re-encoding needed

## parakeet.js Integration

- **Library**: `parakeet.js@1.4.4` via `import { fromHub } from 'https://esm.sh/parakeet.js@1.4.4'`
- **Model**: `parakeet-tdt-0.6b-v3` (multilingual: en/fr/de/es/it/pt/nl/pl/ru/uk/ja/ko/zh)
- **Init**: `fromHub(MODEL_KEY, { backend: 'webgpu'|'wasm', encoderQuant: 'fp32', decoderQuant: 'int8' })`
- **WebGPU note**: int8 encoder is silently forced to fp32, making the WebGPU download ~2.5 GB. WASM is ~650 MB.
- **Caching**: Library manages its own IndexedDB cache (`parakeet-cache-db`). No separate Cache API layer.
- **Boot gate**: `localStorage` flag `parakeet_model_ready` gates auto-load vs. download prompt
- **Transcription call**: `model.transcribeLongAudio(float32, 16000)` — handles recordings up to 30 min. Returns `{ text, chunks }`.

### Transcription Queue & Worker

All parakeet inference goes through `runParakeet(float32, priority?)` in `src/engine.js`, which wraps every call in `runQueued()`. Only one inference runs at a time.

- **`txQueue`** — array of pending jobs `{ fn, resolve, reject }`. `priority=true` puts a job at the front (mic buttons use this so user-triggered dictation isn't blocked behind a long file batch).
- **`drainTxQueue()`** — picks one job, sets `txRunning=true`, awaits it, then recurses. Never concurrent.
- **Worker path** (`parakeetWorker` non-null): `Float32Array.buffer` is transferred (zero-copy) to the worker via `postMessage`. Response arrives as `{ type: 'result', id, text }` matched by job ID in `workerPending`.
- **Fallback path** (`parakeetWorker` null, `parakeetModel` is a model object): calls `parakeetModel.transcribeLongAudio()` directly on the main thread.
- **`parakeetModel`** is `null` when not loaded, `true` (sentinel) when worker is active, or a model object when using fallback.
- **`parakeetModel` / `parakeetWorker`** are exported as live ESM bindings from `engine.js`. `setParakeetModel(v)` is the setter — nulling it also clears the worker reference. Test hook `_tj.parakeetModel = null` calls this setter so button disabled-state tests behave correctly.

## Key Settings (`localStorage` key: `tj_cfg`)

| Key | Default | Notes |
|---|---|---|
| `language` | `en` | ISO 639-1 hint — blank = auto-detect |
| `vad_enabled` | `true` | RMS silence removal |
| `vad_threshold` | `0.01` | RMS energy below = silence |
| `vad_padding_ms` | `200` | Padding around voiced regions |
| `vad_min_silence_ms` | `300` | Min gap before removal |
| `auto_save` | `true` | Persist to localStorage history |
| `auto_transcribe` | `true` | Start batch automatically on folder selection |
| `delete_after_transcription` | `false` | Per-file deletion after save confirmed |
| `notion_api_key` / `notion_target_id` | — | Notion connector |
| `obsidian_vault_name` | — | Obsidian URI connector |

## Data Model (`localStorage`)

### Transcription entries
- Index: `transcription:index` → JSON array of UUIDs, newest-first
- Entry: `transcription:{uuid}` → `{ id, filename, transcribedAt, durationSeconds, text, silenceRemoved, deleted, notes, entries }`

### ATF entries (stored inside each transcription entry)
```json
"entries": [
  { "id": "uuid", "type": "action|thought|feeling", "text": "...", "createdAt": "ISO" }
]
```
- Multiple entries per type allowed
- Max 160 characters per entry text
- Types: `action` (something to do), `thought` (cognitive reflection), `feeling` (emotional state)

## Wizard Flow

- One recording card occupies the full content area at a time
- Progress indicator shows current position (e.g. "2 / 7")
- Each card: transcription text → free-text notes → ATF entries section
- Previous / Next navigation; Next is disabled until transcription is complete for the current card
- If a file is still transcribing when the user reaches its card, a loading state is shown
- After the final card, Next navigates to the Summary page

## Summary Page

- Shows aggregate statistics: total recordings, total ATF entries, breakdown by type (action / thought / feeling), total words transcribed
- Lists all ATF entries grouped by type across the entire session
- Options to delete source audio files and/or all transcriptions (separate toggles, confirmation required)

## File Deletion

When `delete_after_transcription` is enabled:
- Confirmation banner shown before batch starts
- Deletion per-file, immediately after transcription succeeds and localStorage entry confirmed
- Failed transcriptions never deleted
- Requires `showDirectoryPicker({ mode: 'readwrite' })`

## Export & Connectors

- **Export**: `.txt` and `.md` bulk export via `Blob` + `<a download>`
- **Web Share**: `navigator.share()` with clipboard fallback
- **Notion**: `PATCH https://api.notion.com/v1/blocks/{id}/children` — may be blocked by CORS
- **Obsidian**: `obsidian://new?vault=...` URI scheme — Obsidian must be running locally
