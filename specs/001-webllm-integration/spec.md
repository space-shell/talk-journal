# Feature Specification: LLM Transcription Formatting (Phase 1)

**Feature Branch**: `001-webllm-integration`
**Created**: 2026-04-13
**Updated**: 2026-05-10
**Status**: Draft
**Input**: User description: "Incorporate WebLLM to load a small, capable LLM that formats transcribed audio journal entries — providing correctly structured text with sentences, punctuation, and paragraphs. The formatting LLM is opt-in, enabled in settings, and runs sequentially after transcription using the same processing queue."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Enable Transcription Formatting (Priority: P1)

A user opens the Settings drawer and sees a new "Transcription Formatting" toggle
(labeled something like "Structure transcriptions with AI"). The toggle is off by
default. When the user enables it for the first time, the LLM model download begins
immediately — a progress indicator shows download status within the settings panel.
Once downloaded, the model is cached locally for future sessions. The user can disable
the toggle at any time; when disabled, all subsequent transcriptions display raw text
only (no formatting attempt). Re-enabling uses the cached model without re-downloading.

**Why this priority**: The opt-in gate is a prerequisite for all formatting behaviour.
Without it, nothing else in this feature works. It also establishes the model download
UX pattern.

**Independent Test**: Open Settings. Toggle "Transcription Formatting" on. Verify a
download progress indicator appears. Wait for completion. Toggle off, then on again —
verify no re-download occurs (model loaded from cache). Toggle off — verify the
setting persists across page reloads.

**Acceptance Scenarios**:

1. **Given** the user has never enabled formatting, **When** they toggle it on, **Then**
   a model download begins with a visible progress indicator in the settings panel.
2. **Given** the model is already cached locally, **When** the user toggles formatting on,
   **Then** the model loads from cache without a full re-download.
3. **Given** formatting is enabled, **When** the user toggles it off, **Then** no
   formatting is attempted on subsequent transcriptions.
4. **Given** the model download fails (network error, insufficient GPU), **When** the
   user views settings, **Then** a clear error message is shown and the toggle reverts
   to off — the core transcription workflow is unaffected.

---

### User Story 2 — Automatic Post-Transcription Formatting (Priority: P1)

A user has enabled Transcription Formatting. They select a recordings folder and audio
files are transcribed as usual. After each transcription completes, the formatting job
is automatically queued. The user sees a brief status message on the card:
"Currently structuring transcription…" with an animated indicator (e.g., a subtle
pulse or spinner). Once formatting finishes, the card updates to display the structured
text — with proper sentences, punctuation, and paragraph breaks. The user can toggle
between the raw transcription and the formatted version at any time using a
"Raw / Formatted" toggle on the card.

**Why this priority**: This is the core value proposition — every transcription benefits
from readable formatting, and the automatic flow means zero extra effort from the user.

**Independent Test**: Enable formatting in settings. Load one audio file. Wait for
transcription to complete. Observe "Currently structuring transcription…" message.
Wait for formatting to complete. Verify the displayed text has proper punctuation,
sentences, and paragraphs. Toggle to "Raw" and verify the original text appears.
Toggle back to "Formatted" and verify the structured text reappears.

**Acceptance Scenarios**:

1. **Given** formatting is enabled and a file has just been transcribed, **When** the
   transcription completes, **Then** a formatting job is automatically queued and
   "Currently structuring transcription…" is shown on that card.
2. **Given** the formatting job completes, **When** the user views the card, **Then**
   the formatted text replaces the raw text in the display, with proper sentences,
   punctuation, and paragraph structure.
3. **Given** a card has both raw and formatted text, **When** the user toggles to
   "Raw", **Then** the original transcription text is displayed. **When** they toggle
   to "Formatted", the structured version is displayed.
4. **Given** formatting is enabled but the model is still downloading, **When** a
   transcription completes, **Then** the formatting job is queued and waits for the
   model to be ready before processing — the user sees the raw text until formatting
   completes.

---

### User Story 3 — Sequential Processing with Transcription Queue (Priority: P1)

A user has 7 audio files. Formatting is enabled. Transcription and formatting must
never run in parallel — they share a single processing queue. The user sees files
transcribed one at a time, then formatted one at a time. If a file finishes
transcribing, its formatting job is appended to the queue behind any remaining
transcription jobs. The UI remains responsive throughout — the user can navigate
between cards, add ATF entries, and write notes while processing continues in the
background.

**Why this priority**: Resource contention between the transcription engine (WebGPU)
and the LLM (also WebGPU) would crash or freeze the app. Serialisation through the
existing queue is a hard constraint, not a nice-to-have.

**Independent Test**: Enable formatting. Load 3+ audio files. Observe that only one
job (transcription or formatting) runs at a time. Navigate between cards while
processing — verify the UI is responsive. Verify each card transitions from
"Transcribing…" → "Currently structuring transcription…" → formatted text display.

**Acceptance Scenarios**:

1. **Given** multiple files are being processed, **When** a transcription completes,
   **Then** the formatting job is queued after all pending transcription jobs — never
   running concurrently with another transcription or formatting job.
2. **Given** jobs are processing in the queue, **When** the user navigates between
   cards, adds notes, or edits ATF entries, **Then** the UI remains responsive with
   no freezing.
3. **Given** a formatting job is running, **When** the user triggers a high-priority
   mic dictation, **Then** the dictation job jumps ahead of the formatting job in the
   queue (same priority behaviour as transcription jobs).

---

### User Story 4 — View Raw and Formatted Transcriptions (Priority: P2)

On any wizard card that has a formatted transcription, the user sees a toggle
control that switches between "Raw" and "Formatted" views. This toggle is only
visible when formatted text exists for that card. The default view after formatting
completes is "Formatted". If formatting has not yet completed (or failed), only
the raw text is shown with no toggle.

**Why this priority**: The toggle is essential UX but secondary to the automatic
formatting flow itself. It ensures users always have access to the original text.

**Independent Test**: View a card with formatted text — verify the toggle appears
and defaults to "Formatted". Toggle to "Raw" — verify original text. Toggle back.
View a card still being formatted — verify no toggle yet, only raw text with status
message. View a card where formatting failed — verify no toggle, only raw text.

**Acceptance Scenarios**:

1. **Given** a card has completed formatting, **When** the user views it, **Then** a
   "Raw / Formatted" toggle is visible, defaulting to "Formatted".
2. **Given** a card is still being formatted, **When** the user views it, **Then** no
   toggle is shown — the raw text is displayed alongside the "Currently structuring
   transcription…" status message.
3. **Given** formatting failed for a card, **When** the user views it, **Then** no
   toggle is shown and only the raw text is displayed.
4. **Given** the user toggles to "Raw" on a card, **When** they navigate away and
   return, **Then** the toggle remembers their selection (raw view is preserved).

---

### User Story 5 — Manual Re-Format (Priority: P3)

A user has formatted text on a card but wants to try formatting again (perhaps they
changed the language setting or the original formatting produced poor results). They
can trigger a "Re-format" action on the card, which queues a new formatting job using
the raw transcription text as input. The existing formatted text is replaced when the
new job completes.

**Why this priority**: Useful recovery mechanism but not critical for initial value
delivery.

**Independent Test**: View a formatted card. Trigger "Re-format". Verify the status
message reappears, the formatted text updates, and the toggle remains available.

**Acceptance Scenarios**:

1. **Given** a card has formatted text, **When** the user triggers "Re-format",
   **Then** the raw text is sent through the LLM again and the formatted text is
   replaced with the new result.
2. **Given** re-formatting is in progress, **When** the user views the card, **Then**
   the status message "Currently structuring transcription…" is shown again.

---

### Edge Cases

- What happens when the LLM generates a formatted transcription significantly longer
  than the raw text? The formatted output should be capped or flagged — the model
  should be instructed not to add content, only to restructure.
- What if the transcription is very short (< 10 words)? Formatting should still
  complete without error, potentially returning a minimally altered version.
- What if the device lacks sufficient memory/GPU to load the model? A clear, actionable
  error is shown in settings; the toggle reverts to off; transcription workflow is
  unaffected.
- What if the user enables formatting mid-session (some files already transcribed)?
  Already-transcribed files are not retroactively formatted — only new transcriptions
  get formatted. The user can use "Re-format" on individual cards if desired.
- What happens if the user disables formatting while a formatting job is queued?
  The queued job is cancelled (or allowed to complete but discarded). No new formatting
  jobs are queued until the setting is re-enabled.
- What if the model download is interrupted? The download can be resumed on next
  toggle enable — WebLLM's caching handles partial downloads.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST load a small LLM model (2–3B parameters) entirely within the
  browser using the WebLLM framework, with no data leaving the device.
- **FR-002**: Transcription formatting MUST be opt-in — disabled by default, enabled via
  a toggle in the Settings drawer.
- **FR-003**: Enabling the formatting toggle for the first time MUST trigger the model
  download with a visible progress indicator in the settings panel.
- **FR-004**: The model MUST be cached locally after download so that re-enabling the
  toggle does not require a full re-download.
- **FR-005**: When formatting is enabled, a formatting job MUST be automatically queued
  after each successful transcription, running the raw text through the LLM to produce
  a structured version with proper sentences, punctuation, and paragraph breaks.
- **FR-006**: Formatting jobs MUST be serialised through the same processing queue as
  transcription jobs — transcription and formatting MUST never run in parallel.
- **FR-007**: While a formatting job is in progress, the card MUST display a status
  message "Currently structuring transcription…" with a visible activity indicator.
- **FR-008**: The original raw transcription text MUST be preserved in storage alongside
  the formatted text. The user MUST be able to toggle between raw and formatted views.
- **FR-009**: The toggle between raw and formatted views MUST only appear on cards that
  have completed formatting. Cards without formatted text show only the raw view.
- **FR-010**: All formatting features MUST degrade gracefully — if the model fails to
  load, the toggle reverts to off and the core transcription workflow is unaffected.
- **FR-011**: The formatting toggle state MUST persist across page reloads (stored in
  settings).
- **FR-012**: The formatted text MUST be stored as a new field (`formattedText`) on the
  transcription entry alongside the existing `text` field.
- **FR-013**: Users MUST be able to trigger "Re-format" on any card that has formatted
  text, re-running the LLM on the raw transcription.
- **FR-014**: The LLM prompt MUST instruct the model to restructure text only — adding
  punctuation, sentences, and paragraphs — without adding, removing, or altering the
  meaning of the original content.

### Key Entities

- **Formatted Transcription**: A structured version of the raw transcription produced
  by the LLM. Stored as a `formattedText` field on the existing transcription entry.
  Associated 1:1 with the raw transcription. Can be regenerated via "Re-format".
- **Formatting Toggle**: A user setting (persisted in app settings) that controls whether
  transcription formatting is active. When first enabled, triggers model download.
- **LLM Model**: A small (2–3B parameter) WebLLM-compatible language model loaded in the
  browser. Cached locally after first download.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can enable transcription formatting in settings, and the model
  downloads with a visible progress indicator, completing without errors on a
  Chromium browser with WebGPU support.
- **SC-002**: After a transcription completes, the formatted version appears within
  30 seconds on a mid-range device, displaying properly punctuated text with
  paragraph breaks.
- **SC-003**: The core journaling workflow (folder selection → transcription → wizard →
  summary) works identically when formatting is disabled — zero impact on existing
  functionality.
- **SC-004**: Transcription and formatting jobs are serialised — never running in
  parallel — and the UI remains responsive (no freezing) during all processing.
- **SC-005**: Users can toggle between raw and formatted transcription views on any
  card that has completed formatting, with the toggle defaulting to "Formatted".

## Assumptions

- WebLLM supports Chromium-based browsers with WebGPU, consistent with the app's
  existing Chromium-only constraint.
- The model will be cached by WebLLM after first download (typically in IndexedDB or
  Cache API), similar to the Parakeet model caching behaviour.
- Model size is constrained to a practical download for a journaling app — target
  ~1–2 GB for the quantised model, with preference for smaller where capability allows.
- The formatted text is produced by a single LLM call with a carefully crafted prompt —
  no multi-turn conversation or iterative refinement.
- Formatting jobs are standard-priority queue entries (same as batch transcription),
  so user-triggered mic dictation continues to jump ahead in the queue.
- The LLM prompt explicitly instructs the model not to add content — only to
  restructure, punctuate, and paragraph-break the existing text.
- Files already transcribed before the setting is enabled are not retroactively
  formatted — the user can trigger "Re-format" manually if desired.

## Future Phases (Out of Scope)

The following capabilities are deferred to future phases:

- **ATF Entry Suggestions**: LLM-generated draft Action/Thought/Feeling entries from
  transcription text.
- **Reflective Questions**: Per-recording open-ended questions or insights.
- **Session-Wide Insights**: Cross-session synthesis and theme identification from
  the Summary page.
