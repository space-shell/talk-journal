# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A fully offline, single-page web app for batch-transcribing WAV recordings from a DJI Mic 2 transmitter. Transcription runs entirely in the browser using **parakeet.js** (Parakeet TDT 0.6B via WebGPU + WASM) — no server, no API keys, no network requests during transcription. The only network activity is the one-time model download.

The design specification lives in `application-design-spec.md`. **Note:** that file reflects an earlier API-based design that was superseded. The current implementation diverges from it — treat this CLAUDE.md as the authoritative description of what is actually built.

## Tech Stack & Constraints

- **Single file**: Everything in `index.html` — embedded `<style>` and `<script type="module">`, no build step
- **ES module**: `<script type="module">` is required to import parakeet.js via esm.sh. Functions used in inline `onclick` handlers must be explicitly exported to `window` — see the `Object.assign(window, {...})` block at the bottom of the script
- **Chromium-only**: File System Access API + WebGPU are not supported in Firefox/Safari — browser is detected on load and a warning is shown
- **No backend, no API**: All transcription is local. The only outbound request is the one-time model download from Hugging Face (via the parakeet.js library)

## Deployment

- **GitHub Pages**: `https://space-shell.github.io/talk-journal/` — serving from `main` branch root
- `.nojekyll` file present to bypass Jekyll processing
- HTTPS is enforced, which is required for Web Share API and File System Access API

## Architecture

Three UI sections:
1. **Header** — model status indicator (cached / loading / not downloaded), settings gear
2. **Files panel** — drive picker, recursive WAV file list with checkboxes and per-file metadata, delete confirmation banner
3. **History panel** — saved transcriptions from `localStorage`, expandable, with copy/share/delete per entry

**Sticky action bar** fixed to viewport bottom: Select all · Transcribe Selected · Export .txt · Export .md · Share (when `navigator.share` available).

**Settings drawer** — bottom sheet on mobile (`<640px`), right-side drawer on desktop. Saved to `localStorage` under key `tj_cfg`.

State flow: select drive → scan WAVs → (model loaded?) → transcribe sequentially → results inline → auto-save to history.

## parakeet.js Integration

- **Library**: `parakeet.js@1.4.4` — loaded via `import { fromHub } from 'https://esm.sh/parakeet.js@1.4.4'`
- **Model**: `parakeet-tdt-0.6b-v3` (multilingual: en/fr/de/es/it/pt/nl/pl/ru/uk/ja/ko/zh)
- **Init**: `fromHub(MODEL_KEY, { backend: 'webgpu'|'wasm', encoderQuant: 'fp32', decoderQuant: 'int8' })`
- **WebGPU note**: When `backend: 'webgpu'`, int8 encoder quantisation is silently forced to fp32 by the library. This means the WebGPU download is ~2.5 GB (fp32 encoder). WASM mode uses int8 encoder (~650 MB total).
- **Caching**: The library manages its own IndexedDB cache (`parakeet-cache-db`). Do not implement a separate Cache API layer.
- **Boot gate**: A `localStorage` flag (`parakeet_model_ready`) controls whether the model auto-loads on boot (fast, from IndexedDB) or shows the download prompt. This prevents auto-downloading 2.5 GB without user consent.
- **Transcription call**: `model.transcribeLongAudio(float32, 16000)` — use this (not `transcribe()`) for DJI Mic 2 recordings which can be up to 30 minutes. Returns `{ text: string, chunks: [...] }`.
- **Input format**: `Float32Array`, mono, 16 kHz. The audio pipeline handles conversion.

## Audio Pipeline

`prepareAudio(arrayBuffer) → Float32Array`

1. `AudioContext.decodeAudioData()` — decodes any WAV format (24-bit PCM, 32-bit float, any sample rate)
2. `OfflineAudioContext(1, frames, 16000).startRendering()` — resamples to 16 kHz mono
3. `removeSilence(float32, 16000)` — RMS VAD (when `vad_enabled`): classifies 20ms chunks, expands voiced regions by padding, fills short silence gaps
4. Returns `Float32Array` directly to `runParakeet()` — **no WAV re-encoding needed**

The pipeline does not need `encodeWav` or `pcmEncode`. Those were removed when parakeet.js integration was confirmed.

## Key Settings (`localStorage` key: `tj_cfg`)

| Key | Default | Notes |
|---|---|---|
| `language` | `en` | ISO 639-1 hint |
| `vad_enabled` | `true` | RMS silence removal |
| `vad_threshold` | `0.01` | RMS energy below = silence |
| `vad_padding_ms` | `200` | Padding around voiced regions |
| `vad_min_silence_ms` | `300` | Min gap before removal |
| `auto_save` | `true` | Persist to localStorage history |
| `delete_after_transcription` | `false` | Per-file, after localStorage confirmed |
| `notion_api_key` / `notion_target_id` | — | Notion connector |
| `obsidian_vault_name` | — | Obsidian URI connector |

## Transcription History (`localStorage`)

- Index: key `transcription:index` → JSON array of UUIDs, newest-first
- Entries: key `transcription:{uuid}` → `{ id, filename, transcribedAt, durationSeconds, text, silenceRemoved, deleted }`
- Storage usage displayed via `navigator.storage.estimate()` in the settings panel

## File Deletion

When `delete_after_transcription` is enabled:
- A confirmation banner is shown **before** the batch starts (not per-file)
- Deletion happens **per-file immediately** after transcription succeeds **and** the entry is confirmed written to `localStorage`
- Failed transcriptions are never deleted
- On first enable, `alert()` is used deliberately (cannot be dismissed by clicking outside)
- Requires `showDirectoryPicker({ mode: 'readwrite' })`

## Export & Connectors

- **Export**: `.txt` and `.md` bulk export via `Blob` + `<a download>`
- **Web Share**: `navigator.share()` with clipboard fallback; Share button hidden when unavailable
- **Notion**: `PATCH https://api.notion.com/v1/blocks/{id}/children` — may be blocked by CORS in some environments
- **Obsidian**: `obsidian://new?vault=...&name=...&content=...` URI scheme — Obsidian must be running locally
- **Coming soon** (settings placeholder only): Claude, ChatGPT, Custom Webhook
