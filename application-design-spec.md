# DJI Mic 2 \u2192 Transcription Web App
## Agent Handoff Specification

---

## 1. Overview

A self-hosted, single-page web application that allows the user to plug in a DJI Mic 2 transmitter via USB-C, browse to the mounted drive, and with a single button press batch-upload all WAV recordings to a self-hosted OpenAI-compatible transcription API. Transcriptions are displayed inline and can be copied or exported.

The app is a static HTML/CSS/JS page \u2014 no build step, no backend, no framework required. It runs entirely in the browser and communicates directly with the transcription API.

---

## 2. Target Environment

| Concern | Detail |
|---|---|
| **Browser** | Chromium-based only (Chrome, Edge, Brave). File System Access API is not supported in Firefox or Safari. The app should detect non-Chromium browsers and show a clear warning. |
| **Hosting** | Served as a static file from the same origin as the transcription API server (to avoid CORS), e.g. via Nginx on the NixOS host. |
| **Device** | DJI Mic 2 transmitter connected via USB-C. Mounts as USB Mass Storage \u2014 appears to the OS as a standard drive. No WebUSB required. |
| **API** | Self-hosted transcription service exposing a POST `/v1/audio/transcriptions` endpoint compatible with the OpenAI audio transcription spec. |

---

## 3. Device & File Details

These are known characteristics of the DJI Mic 2 to inform file handling logic:

- Recordings are saved as **WAV files** (24-bit PCM or 32-bit float depending on mode)
- Files are split automatically every **30 minutes** (24-bit) or **23 minutes** (32-bit float)
- The transmitter has **8 GB internal storage**
- When connected via USB-C, the transmitter mounts as a standard mass storage drive
- There is no proprietary folder structure \u2014 WAV files are stored at the root or in a flat directory
- The drive name as seen by the OS may vary; the user selects it manually via directory picker

---

## 4. Core User Flow

```
1. User plugs in DJI Mic 2 via USB-C
2. OS mounts it as a drive
3. User opens the web app in Chrome/Edge
4. User clicks "Select DJI Drive" \u2192 browser directory picker opens
5. User selects the mounted DJI drive
6. App scans the directory and lists all .wav files with filename, size, and duration estimate
7. User reviews the file list (can deselect individual files)
8. User clicks "Transcribe All" (or "Transcribe Selected")
9. App uploads files sequentially to the transcription API
10. Progress is shown per-file with a status indicator
11. Completed transcriptions appear below each file entry in real time
12. User can copy individual transcriptions or export all as a single .txt or .md file
```

---

## 5. Configuration

The app must support a persistent settings panel (saved to `localStorage`) with the following fields:

| Setting | Description | Default |
|---|---|---|
| `api_base_url` | Base URL of the transcription API, e.g. `https://parakeet.yourdomain.com/v1` | *(empty \u2014 required)* |
| `api_key` | Bearer token / API key. May be left blank if the server requires no auth. | *(empty)* |
| `model` | Model name string passed as the `model` field in the API request, e.g. `parakeet-tdt-0.6b-v2` | `whisper-1` |
| `language` | ISO 639-1 language code passed to the API, e.g. `sv`, `en`. | `en` |
| `response_format` | One of `json`, `text`, `srt`, `vtt`, `verbose_json` | `text` |
| `delete_after_transcription` | Boolean. If true, prompt user to confirm deletion of successfully transcribed files from the drive after completion. | `false` |

Settings should be accessible via a gear icon. The app should validate that `api_base_url` is set before allowing transcription to begin.

---

## 6. API Integration

### Endpoint

```
POST {api_base_url}/audio/transcriptions
Content-Type: multipart/form-data
Authorization: Bearer {api_key}  (omit header if api_key is blank)
```

### Request body (multipart form fields)

| Field | Value |
|---|---|
| `file` | The WAV file binary |
| `model` | Value from settings |
| `language` | Value from settings (omit if blank) |
| `response_format` | Value from settings |

### Response handling

- If `response_format` is `text`: response body is the raw transcript string
- If `response_format` is `json`: parse `response.text` field
- If `response_format` is `verbose_json`: parse `response.text` field; optionally display `response.segments` for word-level detail
- If `response_format` is `srt` or `vtt`: display as preformatted text

### Error handling

- HTTP 4xx/5xx: Display error message per file, allow retry of failed files
- Network error / CORS error: Display a clear message indicating that CORS may not be configured on the server, with a brief explanation
- Timeout: Configurable (default 120 seconds per file). Large WAV files may take time.

### Concurrency

Files should be uploaded **sequentially by default** (one at a time) to avoid overwhelming the server. A setting for concurrent uploads (1\u20133) may be added but is not required in v1.

---

## 7. File System Access API Usage

```javascript
// Directory selection
const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

// Enumerate WAV files
for await (const [name, handle] of dirHandle.entries()) {
  if (handle.kind === 'file' && name.toLowerCase().endsWith('.wav')) {
    const file = await handle.getFile();
    // file.name, file.size, file.lastModified available
  }
}

// Optional deletion after transcription
await fileHandle.remove(); // requires 'readwrite' mode
```

Key notes for the agent:
- `showDirectoryPicker` requires a user gesture (button click) \u2014 do not attempt to call it programmatically on page load
- The `readwrite` mode is required only if the delete-after-transcription feature is enabled; otherwise `read` is sufficient
- The browser may ask the user to confirm read/write access to the directory \u2014 this is expected behaviour, not an error
- Directory handle permissions do not persist across page reloads by default; the user will need to re-select the drive each session (this is a browser security constraint, not a bug)

---

## 8. UI Requirements

### Layout

- Single page, no routing required
- Three logical sections:
  1. **Header / Settings** \u2014 app title, gear icon for settings panel, API status indicator (green/red dot showing whether the configured endpoint is reachable)
  2. **Drive Panel** \u2014 "Select DJI Drive" button, file list with checkboxes, total file count and estimated total duration
  3. **Results Panel** \u2014 per-file transcription output, copy buttons, bulk export

### File List Item

Each WAV file in the list should show:
- Filename
- File size (human-readable, e.g. "42 MB")
- Estimated duration (calculate from file size: WAV at 48kHz 24-bit stereo = ~17 MB/min; display as approximate)
- Last modified timestamp
- Status badge: `Pending` / `Uploading` / `Done` / `Error`
- Checkbox for inclusion/exclusion from batch

### Transcription Result

- Displayed directly beneath the corresponding file entry after completion
- Monospace or readable text area, auto-sized to content
- "Copy" button
- If `response_format` is `srt` or `vtt`, render in a `<pre>` block

### Bulk Export

After all transcriptions complete, offer:
- **Export as .txt** \u2014 all transcriptions concatenated, separated by filename headers
- **Export as .md** \u2014 same, formatted as Markdown with `##` filename headings

### Error States

- Non-Chromium browser: full-page warning with explanation, no other UI shown
- API URL not configured: disable the "Transcribe" button, show inline prompt to open settings
- CORS error: inline explanation with suggested fix (link to relevant docs or a short note about configuring `Access-Control-Allow-Origin`)

---

## 9. Tech Stack

| Concern | Choice |
|---|---|
| Language | Vanilla JS (ES2022+) \u2014 no framework, no build step |
| Styling | CSS custom properties, no external CSS framework |
| Storage | `localStorage` for settings persistence |
| No dependencies | All logic implemented natively \u2014 no npm, no bundler |
| Single file | Delivered as a single `index.html` with embedded `<style>` and `<script>` |

The single-file constraint is intentional: the app should be trivially deployable by dropping one file into an Nginx `www` directory.

---

## 10. Deployment Context

The app is intended to be served from the same NixOS host that runs the transcription service, behind a Cloudflare Tunnel. A typical Nginx config would be:

```nginx
server {
  listen 80;
  server_name parakeet.yourdomain.com;

  # Serve the static UI at root
  location / {
    root /var/www/transcription-ui;
    index index.html;
  }

  # Proxy the transcription API
  location /v1/ {
    proxy_pass http://127.0.0.1:{PARAKEET_PORT}/v1/;
    proxy_set_header Host $host;
    # No CORS headers needed \u2014 same origin as the UI
  }
}
```

With this setup, the UI is served at `https://parakeet.yourdomain.com/` and the API is at `https://parakeet.yourdomain.com/v1/audio/transcriptions` \u2014 same origin, no CORS required.

---

## 11. Out of Scope (v1)

The following are explicitly excluded from this version:

- Multi-device support (only DJI Mic 2 is targeted; no device auto-detection)
- Streaming transcription results
- Audio playback in the browser
- Speaker diarisation
- Automatic drive detection / polling (user selects the drive manually each session)
- Mobile support
- Firefox / Safari support
- User accounts or authentication on the UI itself
- Any server-side component beyond the existing transcription API

---

## 12. Open Questions for the Agent

Before beginning implementation, the agent should confirm or resolve:

1. **Parakeet API response format** \u2014 does the server return a plain text body for `response_format=text`, or always JSON? The request handling should be defensive either way.
2. **WAV file structure on device** \u2014 are files always at the root of the drive, or inside a subfolder? The agent should implement recursive directory scanning to handle either case.
3. **32-bit float WAV compatibility** \u2014 confirm whether the transcription API accepts 32-bit float WAV, or whether files need to be resampled/converted client-side before upload. If conversion is needed, this is a significant scope