# Tibbs — User Stories

Deployed at https://space-shell.github.io/talk-journal/

The primary persona is an **audio journaller** — someone who records voice notes throughout their day using any device (phone, dictaphone, laptop), then processes those recordings at the end of the day to extract structured reflections: actions to take, thoughts to capture, and feelings to acknowledge.

The original user stories (Epics 1–11) were written for an earlier DJI-specific transcription tool. They remain valid for the transcription and model infrastructure but the persona and app purpose have since broadened significantly. Epics 12 onwards reflect the current Tibbs vision.

---

## Epic 1 — Browser & Device Compatibility

### US-01 — Unsupported browser warning
**As a** field recorder opening the app in Firefox or Safari,
**I want to** see a clear explanation that my browser is not supported,
**so that** I understand why nothing works and know which browser to switch to.

**Acceptance criteria:**
- A full-page warning is shown before any other UI is rendered
- The message names the supported browsers (Chrome, Edge, Brave)
- No attempt is made to render the drive picker or model panel

---

### US-02 — Unsupported device warning (no WASM SIMD)
**As a** field recorder opening the app on an older Android device or browser build,
**I want to** see a clear message that my device cannot run in-browser transcription,
**so that** I do not waste time attempting a large model download that will ultimately fail.

**Acceptance criteria:**
- SIMD support is detected at boot via `WebAssembly.validate()`
- The download button is hidden; an error message is shown in its place
- The header status indicator reads "Not supported"
- The message recommends Chrome 91+ on desktop or a modern Android device

---

## Epic 2 — Model Management

### US-03 — First-time model download
**As a** field recorder using the app for the first time,
**I want to** be informed about the model download size and privacy implications before anything is downloaded,
**so that** I can make an informed choice about using the app on my network and device.

**Acceptance criteria:**
- A download panel is shown with size information (~650 MB WASM / ~2.5 GB WebGPU)
- The panel states that no audio ever leaves the device
- The model does not begin downloading until the user clicks "Download Model"
- A progress bar updates during the download

---

### US-04 — Model cached on subsequent visits
**As a** field recorder returning to the app after the initial download,
**I want to** have the model load automatically from local storage,
**so that** I can start transcribing immediately without waiting for another download.

**Acceptance criteria:**
- A `localStorage` flag gates auto-load on subsequent visits
- The model loads silently from IndexedDB in the background
- The header status indicator transitions from "Loading model…" to "Model ready"
- The download panel is not shown

---

### US-05 — Graceful recovery from cleared cache
**As a** field recorder whose browser storage has been cleared,
**I want to** be prompted to re-download the model rather than seeing a crash,
**so that** I can recover without confusion.

**Acceptance criteria:**
- If `parakeet_model_ready` is set but the IndexedDB cache is missing, the error is caught
- The flag is removed and the download panel is shown again
- The header status reads "Model not downloaded"

---

## Epic 3 — Drive Selection & File Discovery

### US-06 — Select DJI Mic 2 drive
**As a** field recorder with a DJI Mic 2 connected via USB-C,
**I want to** select the mounted drive using a directory picker,
**so that** the app can find my recordings without me having to locate each file manually.

**Acceptance criteria:**
- Clicking "Select DJI Drive" triggers the browser's native directory picker
- The picker requires a user gesture (cannot be triggered programmatically)
- The drive name and file count appear in the panel header once selected

---

### US-07 — Recursive WAV file scan
**As a** field recorder whose recordings may be in subdirectories,
**I want to** have the app scan all folders recursively,
**so that** recordings in any subfolder are discovered without me navigating manually.

**Acceptance criteria:**
- The scan traverses all subdirectories of the selected root
- Only `.wav` files (case-insensitive) are listed
- Files are sorted by path/filename

---

### US-08 — Per-file metadata display
**As a** field recorder reviewing a list of recordings,
**I want to** see the filename, file size, estimated duration, and last modified date for each file,
**so that** I can identify recordings and estimate how long transcription will take.

**Acceptance criteria:**
- File size is shown in human-readable form (KB / MB / GB)
- Duration is estimated from file size (WAV at ~17 MB/min)
- Last modified timestamp is shown in locale-appropriate short format
- Status badge shows: Pending / Transcribing / Done / Error

---

### US-09 — Selective transcription *(superseded by Epic 13 wizard flow)*
**Superseded note:** In the wizard flow (Epic 13+) all files in the selected folder are processed sequentially. Per-file selection checkboxes have been removed. Files already present in transcription history are skipped automatically.

---

## Epic 4 — Audio Processing

### US-10 — Automatic format conversion
**As a** field recorder with 24-bit PCM or 32-bit float WAV files,
**I want to** transcribe them without any manual conversion step,
**so that** the app works regardless of which DJI Mic 2 recording mode I used.

**Acceptance criteria:**
- `AudioContext.decodeAudioData()` handles any WAV format
- Audio is resampled to 16 kHz mono before transcription
- No WAV re-encoding step is required

---

### US-11 — Silence removal (VAD)
**As a** field recorder with recordings that contain long silences,
**I want to** have silent sections stripped before transcription,
**so that** the transcription is faster and the model doesn't waste time on empty audio.

**Acceptance criteria:**
- RMS energy is computed in 20ms chunks
- Chunks below the threshold are classified as silence
- Voiced regions are padded by a configurable amount before being kept
- Short silence gaps between voiced regions are filled (not removed)
- VAD can be disabled entirely in settings

---

### US-12 — Configurable VAD parameters
**As a** field recorder with noisy or quiet recording environments,
**I want to** adjust the silence detection sensitivity, padding, and minimum gap,
**so that** I can tune it for my specific recording conditions.

**Acceptance criteria:**
- RMS threshold, padding (ms), and minimum silence gap (ms) are all editable in settings
- Changes persist across sessions via `localStorage`
- Default values: threshold 0.01, padding 200ms, min silence gap 300ms

---

## Epic 5 — Transcription

### US-13 — Batch transcription
**As a** field recorder with multiple recordings,
**I want to** start a single batch job that processes all selected files sequentially,
**so that** I can step away and return to find all my transcriptions ready.

**Acceptance criteria:**
- "Transcribe Selected" processes checked files one at a time
- Each file's status badge updates in real time (Transcribing → Done / Error)
- The next file begins automatically after the previous one completes
- The action bar shows overall batch progress

---

### US-14 — Transcription result displayed inline
**As a** field recorder who has just transcribed a recording,
**I want to** see the transcription text appear directly beneath the corresponding file entry,
**so that** I can review results without navigating away.

**Acceptance criteria:**
- Text appears inline below the file entry upon completion
- The status badge changes to "Done"
- A "Copy" button is available next to each result

---

### US-15 — Per-file retry on error
**As a** field recorder whose transcription fails on one file,
**I want to** retry that file without restarting the whole batch,
**so that** I don't have to re-transcribe files that already succeeded.

**Acceptance criteria:**
- An error message is shown beneath the failed file entry
- A "Retry" button is shown for failed files
- Retrying a single file does not affect the status of other files

---

### US-16 — Multilingual transcription
**As a** field recorder who records in a language other than English,
**I want to** set a language hint before transcription,
**so that** the model produces more accurate output for my language.

**Acceptance criteria:**
- Language is configurable as an ISO 639-1 code in settings (e.g. `fr`, `de`, `sv`)
- Leaving the field blank enables auto-detection
- Supported languages: en, fr, de, es, it, pt, nl, pl, ru, uk, ja, ko, zh

---

## Epic 6 — History & Storage

### US-17 — Auto-save to history
**As a** field recorder who transcribes regularly,
**I want to** have completed transcriptions saved automatically to a local history,
**so that** I can access them later even after closing the app or disconnecting the drive.

**Acceptance criteria:**
- Each completed transcription is saved to `localStorage` with a UUID, filename, timestamp, and text
- Saving is confirmed before the source file is deleted (when delete mode is on)
- Auto-save can be disabled in settings

---

### US-18 — Browse transcription history
**As a** field recorder reviewing past sessions,
**I want to** see a list of previously transcribed recordings,
**so that** I can find and reuse text from earlier sessions.

**Acceptance criteria:**
- History entries are shown newest-first below the files panel
- Each entry shows the filename, transcription date, and estimated duration
- Entries are collapsed by default; clicking expands the full text

---

### US-19 — Delete a history entry
**As a** field recorder whose history is cluttered,
**I want to** delete individual transcription entries,
**so that** I can keep my history tidy.

**Acceptance criteria:**
- Each history entry has a Delete button
- Deletion is immediate (no confirmation required for history entries)
- The entry is removed from both the index and the individual `localStorage` key

---

### US-20 — Storage usage visibility
**As a** field recorder using the app intensively,
**I want to** see how much browser storage my transcription history is using,
**so that** I know when I need to clear old entries.

**Acceptance criteria:**
- Storage used and available quota are displayed in settings
- Values are formatted in appropriate units (KB / MB / GB)
- A "Clear History" button removes all saved transcriptions

---

## Epic 7 — Export & Sharing

### US-21 — Export all transcriptions as plain text
**As a** field recorder who wants a simple archive,
**I want to** download all transcriptions as a single `.txt` file,
**so that** I have a portable, application-independent record of my recordings.

**Acceptance criteria:**
- "Export .txt" downloads a file with each transcription separated by a filename header
- The filename is timestamped for easy identification
- Only transcriptions from the current session's file list are included

---

### US-22 — Export all transcriptions as Markdown
**As a** field recorder who writes in Markdown-based tools,
**I want to** download transcriptions as a `.md` file with heading structure,
**so that** I can paste them directly into Obsidian, Notion, or a blog.

**Acceptance criteria:**
- "Export .md" downloads a file with `##` headings per filename
- Formatting is compatible with CommonMark

---

### US-23 — Share a single transcription
**As a** field recorder who wants to send a result quickly,
**I want to** share a single transcription using the native share sheet or copy to clipboard,
**so that** I can send it to a messaging app, email, or note without exporting.

**Acceptance criteria:**
- A "Share" button appears on each completed transcription result and each history entry
- On devices with `navigator.share`, the native share sheet is invoked
- On devices without it, the text is copied to the clipboard with a confirmation toast
- The Share button in the action bar is hidden when `navigator.share` is unavailable

---

## Epic 8 — Connectors

### US-24 — Send transcription to Notion
**As a** field recorder who uses Notion as their knowledge base,
**I want to** append a transcription to a Notion page with one click,
**so that** I don't have to copy and paste manually.

**Acceptance criteria:**
- Notion Integration Token and Target Page/Database ID are configurable in settings
- Clicking "Send to Notion" on a result appends it via the Notion REST API
- If the request fails (e.g. due to CORS), an error is shown

---

### US-25 — Open transcription as a new Obsidian note
**As a** field recorder who uses Obsidian as their knowledge base,
**I want to** open a transcription as a new note in Obsidian with one click,
**so that** it is immediately available in my vault.

**Acceptance criteria:**
- Vault name is configurable in settings
- Clicking "Send to Obsidian" opens an `obsidian://new` URI with the transcription as content
- Obsidian must already be running; a note in settings explains this

---

## Epic 9 — Drive Management

### US-26 — Delete source files after transcription
**As a** field recorder who wants to free up space on the DJI Mic 2,
**I want to** have source WAV files deleted automatically after successful transcription,
**so that** I can free up the transmitter's storage in one step.

**Acceptance criteria:**
- Delete-after-transcription is opt-in via a settings toggle
- On first enable, a modal alert (not dismissable by clicking outside) explains the irreversibility
- A confirmation banner is shown in the UI before the batch starts
- Deletion happens per-file immediately after transcription succeeds AND the history entry is confirmed written
- Files that fail transcription are never deleted

---

## Epic 10 — Privacy & Offline Operation

### US-27 — Fully offline transcription
**As a** field recorder working with sensitive or confidential audio,
**I want to** be certain that my audio never leaves my device,
**so that** I can use the app in security-sensitive contexts.

**Acceptance criteria:**
- The app makes zero network requests during transcription
- The only outbound request ever made is the one-time model download from Hugging Face
- This is clearly stated in the model download panel and in the app description

---

### US-28 — No account or API key required
**As a** field recorder who wants a simple tool,
**I want to** use the app without creating an account or obtaining any API credentials,
**so that** I can start transcribing immediately.

**Acceptance criteria:**
- The app functions fully with no login, no API key, and no subscription
- Settings contain no fields that are required for transcription to work (language is optional)

---

## Epic 11 — Notes & In-Card Actions

### US-29 — Card action buttons
**As an** audio journaller reviewing a transcription card,
**I want** a minimal set of action buttons below the transcript,
**so that** the card stays focused on content rather than controls.

**Acceptance criteria:**
- Notion and Obsidian connector buttons are shown when configured in settings
- A Delete button is present to remove the transcription
- Copy and Share buttons are not shown (removed as clutter in the wizard flow)
- Buttons are in a horizontal flex row and wrap on narrow viewports

---

### US-30 — Notes: always-visible auto-save textarea
**As an** audio journaller who wants to annotate a transcription,
**I want** a notes field that is always visible below the transcript and saves automatically as I type,
**so that** I can write notes without any save/toggle ceremony.

**Acceptance criteria:**
- A notes textarea is shown below the transcript on every card that has a completed transcription
- No Notes button, no Save button, no read-only toggle — just a textarea
- Notes are auto-saved to `localStorage` 800 ms after the user stops typing (debounce)
- Existing notes are pre-populated when the card renders
- A microphone button beneath the textarea allows voice-to-notes (see US-31)

---

### US-31 — Voice note transcription into notes
**As a** field recorder who prefers to speak rather than type,
**I want** to tap a Transcribe button in the notes area to record a voice note, then tap again to stop and have my speech appended to the notes field,
**so that** I can add spoken context without typing.

**Acceptance criteria:**
- A Transcribe button is visible in the notes edit area
- First tap requests microphone permission (if not already granted) and starts recording; button label changes to Stop
- Second tap stops recording; audio is transcribed using the loaded parakeet model and appended to the notes draft (space-separated if notes already exist)
- If the parakeet model is not loaded, the Transcribe button is disabled
- If microphone access is denied, no crash occurs (error logged to console)
- While transcription is in progress the button shows "Transcribing…" and is disabled

---

### US-32 — Auto-transcribe on drive selection
**As a** field recorder who plugs in their DJI Mic 2,
**I want** untranscribed recordings to begin processing automatically after I select the drive,
**so that** I don't need to manually click Transcribe each session.

**Acceptance criteria:**
- An "Auto-transcribe on drive selection" toggle in Settings, enabled by default
- When enabled and the model is loaded, transcription starts automatically after the drive picker closes
- Only selected, untranscribed files are processed (same rules as a manual batch)
- If delete-after-transcription is enabled, the confirmation banner is shown before the batch starts (same as manual)
- If the model is not yet loaded, auto-transcribe does not start and the user must trigger manually
- The setting persists across sessions via `localStorage`

---

### US-33 — Pulsing progress feedback during transcription
**As a** field recorder monitoring a running batch,
**I want** active UI elements to pulse visually during transcription,
**so that** I can tell at a glance that work is ongoing without watching a status text.

**Acceptance criteria:**
- The Transcribe Selected button in the action bar pulses with a breathing opacity animation while a batch is running
- Per-file status badges pulse while that specific file is being converted or transcribed

---

## Epic 12 — Broad Audio Format Support

### US-34 — Accept any AudioContext-compatible audio file
**As an** audio journaller who records on different devices,
**I want** the app to accept any audio format my device produces,
**so that** I am not locked into a specific recorder or file type.

**Acceptance criteria:**
- The file scan accepts `.wav`, `.mp3`, `.m4a`, `.aac`, `.ogg`, `.oga`, `.opus`, `.webm`, `.flac` (case-insensitive)
- All formats are decoded via `AudioContext.decodeAudioData()` — no client-side conversion required
- Files in unsupported formats are silently skipped (not shown in the list)
- UI labels refer to "recordings" or "audio files", not "WAV files"

---

## Epic 13 — Journaling Wizard

### US-35 — One-at-a-time guided review
**As an** audio journaller processing my day's recordings,
**I want** each recording presented to me one at a time in a full-screen card,
**so that** I can give each entry my full attention and the process feels intentional rather than overwhelming.

**Acceptance criteria:**
- After selecting a folder, the first recording card fills the content area
- Only one card is visible at a time — no list view during the wizard
- Each card shows: recording title (day + time), filename, transcription text (or loading state), notes section, ATF entries section
- A progress indicator shows current position and total (e.g. "2 / 7")

---

### US-36 — Navigate between recordings
**As an** audio journaller working through my entries,
**I want** Previous and Next buttons to move between recording cards,
**so that** I can work through them at my own pace and revisit earlier ones.

**Acceptance criteria:**
- Previous button is hidden on the first card; Next button is hidden on the last card (replaced by "Finish")
- Previous and Next are always visible and tappable (not inside a scroll area)
- Navigating away and back preserves all notes and ATF entries entered for a card
- If the current card is still transcribing, Next is disabled with a "Transcribing…" label

---

### US-37 — Transcription runs in the background during review
**As an** audio journaller who has several recordings,
**I want** transcription to run in the background while I review earlier entries,
**so that** by the time I reach a later card it is already ready.

**Acceptance criteria:**
- Transcription begins immediately after folder selection (when auto-transcribe is on and model is loaded)
- The user can begin reviewing the first card while subsequent cards are still transcribing
- Cards that are not yet transcribed show a loading/transcribing state
- Completed transcriptions appear automatically without requiring a page reload

> **Implementation note**: Transcription currently runs on the main thread. A future improvement is to move it to a Web Worker (`postMessage` + `SharedArrayBuffer`) to fully free the UI. This needs investigation for parakeet.js WASM/WebGPU compatibility before implementation.

---

## Epic 14 — ATF Entries (Action / Thought / Feeling)

### US-38 — Add ATF entries via unified input and type selector
**As an** audio journaller reviewing a transcription,
**I want** a single text input with a type dropdown to add Action, Thought, or Feeling entries,
**so that** the interface is compact and I can quickly add any type without hunting for separate inputs.

**Acceptance criteria:**
- A single input row is shown: `[Type dropdown] [Text input ≤160 chars] [Add]`
- The type dropdown contains three options: Action, Thought, Feeling
- On first render and after each Add, the dropdown randomises to one of the three types to avoid implying priority
- Pressing Enter or clicking Add commits the entry; the input clears
- A character counter appears when the draft is within 30 characters of the limit
- Existing entries are shown above the input row, grouped by type with coloured labels
- Each entry has a × delete button

---

### US-39 — Multiple ATF entries per type
**As an** audio journaller,
**I want** to add as many entries of each type as I like,
**so that** I am not limited to one action, one thought, or one feeling per recording.

**Acceptance criteria:**
- There is no maximum on the number of entries per type per recording
- All entries of a given type appear grouped together above the input row

---

### US-40 — Character limit on ATF entries
**As an** audio journaller,
**I want** each ATF entry to be capped at 160 characters,
**so that** entries stay concise and scannable in the session summary.

**Acceptance criteria:**
- The text input has `maxlength="160"`
- A counter ("N left") appears when fewer than 30 characters remain

---

### US-41 — Delete an ATF entry
**As an** audio journaller who made a mistake or changed their mind,
**I want** to delete an individual ATF entry,
**so that** my record stays accurate.

**Acceptance criteria:**
- Each ATF entry has a delete button
- Deletion is immediate with no confirmation (entries are short and easily re-added)
- The entry is removed from localStorage

---

## Epic 15 — Session Summary

### US-42 — View session statistics
**As an** audio journaller who has finished reviewing all recordings,
**I want** to see a summary of what I produced in this session,
**so that** I get a sense of the volume and shape of my reflection.

**Acceptance criteria:**
- Summary page is reached by pressing "Finish" on the final wizard card
- Statistics shown: total recordings reviewed, total words transcribed, total ATF entries, breakdown by type (actions / thoughts / feelings)
- Summary is read-only — individual cards can be revisited via a back navigation

---

### US-43 — Review all ATF entries grouped by type
**As an** audio journaller on the summary page,
**I want** to see all my Action, Thought, and Feeling entries listed together by type,
**so that** I can see the full picture of what emerged from the session.

**Acceptance criteria:**
- Three sections on the summary: Actions, Thoughts, Feelings
- Each entry shows its text and the filename of the recording it came from
- Sections are collapsed if empty

---

### US-44 — Delete source audio files at end of session
**As an** audio journaller who no longer needs the raw recordings,
**I want** the option to delete all source audio files after the session,
**so that** I free up device storage in one step.

**Acceptance criteria:**
- A "Delete audio files" button appears on the summary page
- A clear confirmation dialog explains this is irreversible
- Only files for which transcription succeeded are eligible for deletion
- The button is absent if the folder was opened in read-only mode

---

## Epic 16 — Home Screen & Folder Reconnection

### US-46 — Workflow overview on home screen
**As a** first-time or returning audio journaller on the home screen,
**I want** to see a concise step-by-step explanation of the journaling flow,
**so that** I understand how the app works before selecting a folder.

**Acceptance criteria:**
- Three numbered steps are shown in the folder selection panel when no folder is active:
  1. Select a folder of recordings
  2. Review each recording one at a time — transcription runs in the background
  3. Add actions, thoughts, and feelings — then see your session summary
- The steps are replaced by the folder's file list once a folder is selected
- Steps are visually distinct but not distracting

---

### US-47 — Auto-reconnect to last folder
**As a** returning audio journaller who uses the same recordings folder each session,
**I want** the app to automatically re-scan my last folder on load if permission is still active,
**so that** I can pick up where I left off without having to re-select the folder.

**Acceptance criteria:**
- After a successful folder selection, the `FileSystemDirectoryHandle` is persisted to IndexedDB
- On subsequent app loads, the stored handle is retrieved and `queryPermission({ mode: 'readwrite' })` is called
- If the permission state is `'granted'`, the folder is scanned automatically and the wizard is shown
- If the permission is not granted (e.g. browser has expired it), the home screen is shown with no error
- Auto-reconnect is silent — no prompt, no banner, just the wizard appearing as if the folder was just selected

---

### US-45 — Delete all transcriptions at end of session
**As an** audio journaller who treats sessions as ephemeral,
**I want** the option to clear all transcriptions from the browser after reviewing them,
**so that** no sensitive content persists on this device.

**Acceptance criteria:**
- A separate "Delete transcriptions" button (distinct from the audio file delete) appears on the summary page
- Confirmation required — explains ATF entries will also be removed
- localStorage entries for the current session are removed
- This is independent of the audio file deletion
