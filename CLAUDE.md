# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static single-page web app for batch-transcribing WAV recordings from a DJI Mic 2 transmitter. The full design is in `application-design-spec.md`.

## Tech Stack & Constraints

- **Single file**: Everything lives in `index.html` — embedded `<style>` and `<script>`, no external dependencies, no build step, no npm
- **Vanilla JS (ES2022+)**: No framework, no bundler
- **Chromium-only**: Uses File System Access API (`showDirectoryPicker`), which is unsupported in Firefox/Safari — detect and warn on load
- **No backend**: All logic runs in the browser; settings persist via `localStorage`

## Architecture

The app has three logical UI sections:
1. **Header/Settings** — gear icon opens a settings panel (persisted to `localStorage`), API reachability indicator
2. **Drive Panel** — directory picker button, WAV file list with checkboxes, per-file metadata
3. **Results Panel** — transcription output per file, copy buttons, bulk export (.txt / .md)

State flows one way: select drive → enumerate WAV files → user triggers transcription → files upload sequentially → results render inline.

## Key Implementation Details

**File System Access API**
- `showDirectoryPicker({ mode: 'readwrite' })` must be called from a user gesture
- Use recursive directory scanning (files may be at root or in subfolders)
- `fileHandle.remove()` for delete-after-transcription (requires `readwrite` mode)
- Directory handle permissions don't persist across page reloads — by design

**API Integration**
- `POST {api_base_url}/audio/transcriptions` with `multipart/form-data`
- Fields: `file`, `model`, `language` (omit if blank), `response_format`
- `Authorization: Bearer {api_key}` header — omit entirely if `api_key` is blank
- Response handling varies by `response_format`: `text` → raw string; `json`/`verbose_json` → parse `.text`; `srt`/`vtt` → render in `<pre>`
- Sequential uploads by default (one at a time)
- Default timeout: 120 seconds per file

**Duration estimation**: WAV at 48kHz 24-bit stereo ≈ 17 MB/min — use file size for approximate display

**Settings** (all stored in `localStorage`):
- `api_base_url` (required — disable transcription button if unset)
- `api_key`, `model` (default: `whisper-1`), `language` (default: `en`)
- `response_format` (default: `text`), `delete_after_transcription` (default: `false`)

## Deployment

Served as a static file from the same origin as the transcription API (co-located on the same Nginx host) to avoid CORS. See `application-design-spec.md` §10 for the Nginx config pattern.
