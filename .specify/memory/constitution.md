<!--
  SYNC IMPACT REPORT
  ==================
  Version change: (uninitialized) → 1.0.0
  Modified principles: N/A — initial population from template
  Added sections: Core Principles (I–V), Tech Stack Constraints, Development & Deployment, Governance
  Removed sections: None
  Templates requiring updates:
    ✅ .specify/templates/plan-template.md — Constitution Check section derives from principles below; no changes required, gates are readable from this doc
    ✅ .specify/templates/spec-template.md — no constitution-specific sections; no changes required
    ✅ .specify/templates/tasks-template.md — task categories align with principles; no changes required
  Follow-up TODOs:
    - None; all placeholder tokens resolved
-->

# Tibbs Constitution

## Core Principles

### I. Offline-First

The app MUST function entirely without network access during normal operation.
The only permitted outbound network activity is the one-time Parakeet model download.
All transcription, storage, ATF entry management, and export MUST work fully offline.
Features that require a persistent network connection MUST NOT be introduced.
Third-party connectors (Notion, Obsidian) are tolerated only as optional, non-blocking
integrations where failure degrades gracefully.

**Rationale**: The core value proposition — private, local audio journaling — collapses
the moment user data or processing moves to a server.

### II. Local Data Sovereignty

All user data (audio files, transcriptions, notes, ATF entries) MUST reside exclusively
on the user's device. No data MUST be transmitted to any server without explicit,
per-action user intent (e.g. the user pressing "Send to Notion"). Auto-sync,
telemetry, or background uploads are prohibited. Storage MUST use browser-native
mechanisms: `localStorage`, `IndexedDB`, and the File System Access API.

**Rationale**: Users dictate personal journal entries. The absence of any server-side
copy is both a privacy guarantee and a trust foundation.

### III. Build-Less / Zero-Bundler

No build step, transpiler, or bundler is permitted. The browser MUST load ES modules
directly from `src/` via `<script type="module">`. All imports MUST use explicit
relative paths or pinned CDN URLs (e.g. `esm.sh`). Dependencies that require a
compile step are prohibited. Circular imports MUST NOT exist — the key rule is that
`engine.js` MUST NOT import from `transcription.js` or `model.js`.

**Rationale**: A zero-build pipeline eliminates an entire class of toolchain failures,
keeps the project immediately runnable from any static file server, and makes the
GitHub Pages deployment trivial.

### IV. Chromium-First Compatibility

The app targets Chromium-based browsers exclusively. APIs unavailable in Firefox or
Safari (File System Access API, WebGPU) are acceptable. Capability detection MUST be
performed on load and a visible warning shown to non-Chromium users. No polyfills or
fallbacks for non-Chromium browsers are required. Do not degrade the Chromium
experience to accommodate unsupported browsers.

**Rationale**: File System Access API and WebGPU are load-bearing — there is no viable
path to full parity in other engines without a fundamentally different architecture.

### V. Simplicity & YAGNI

Code MUST be as simple as the task requires — no more. New abstractions, helpers,
or utilities MUST NOT be introduced for one-off operations. Features MUST NOT be
added beyond what is explicitly requested. Backwards-compatibility shims,
speculative configuration hooks, and defensive error handling for impossible states
are prohibited. When three similar lines are clearer than an abstraction, prefer
the three lines.

**Rationale**: The codebase is small, build-less, and maintained by a single developer.
Complexity compounds quickly without a compiler or type-checker to catch drift.

## Tech Stack Constraints

- **Language / Runtime**: Vanilla JavaScript ES2022+, browser-native ESM, no TypeScript.
- **UI**: Preact + `@preact/signals` + `htm` (imported from `esm.sh`), re-exported via `src/lib.js`.
- **Transcription**: `parakeet.js@1.4.4` via `esm.sh`; model `parakeet-tdt-0.6b-v3`; WebGPU preferred, WASM fallback.
- **Storage**: `localStorage` for transcription entries and settings; `IndexedDB` for folder handle persistence and model cache.
- **Audio pipeline**: `AudioContext.decodeAudioData()` → resample to 16 kHz mono → optional RMS VAD → `Float32Array` passed directly to Parakeet.
- **No backend**: All processing is client-side. CORS blockers on Notion integration are expected and non-blocking.
- **Supported audio**: `.wav .mp3 .m4a .aac .ogg .oga .opus .webm .flac` — anything `decodeAudioData()` accepts.

## Development & Deployment

- **Deployment**: GitHub Pages at `https://space-shell.github.io/talk-journal/`, served from `main` branch root. HTTPS is enforced.
- **No CI/CD pipeline**: Changes pushed to `main` deploy immediately via GitHub Pages.
- **`.nojekyll`** MUST remain present to bypass Jekyll processing.
- **Dev workflow**: Open `index.html` directly in Chromium or serve via any static file server (e.g. `python3 -m http.server`). No install step.
- **Module graph discipline**: New modules MUST be placed in `src/`. Any module that would create a circular dependency MUST instead be split following the `engine.js` / `model.js` / `transcription.js` precedent documented in CLAUDE.md.
- **Testing**: No automated test suite. Verification is manual, in-browser. Chrome DevTools is the primary debugging tool.

## Governance

This constitution supersedes all other practices and documents for this repository.
`CLAUDE.md` is the authoritative runtime development guide and MUST remain consistent
with the principles above; in case of conflict, this constitution takes precedence on
principles, and `CLAUDE.md` takes precedence on implementation specifics.

Amendment procedure:

1. Identify the principle or section to change and the reason.
2. Update this file; bump `CONSTITUTION_VERSION` per semantic versioning:
   - **MAJOR**: Principle removed, redefined, or made incompatible with prior behaviour.
   - **MINOR**: New principle or section added; material expansion of guidance.
   - **PATCH**: Clarification, wording fix, non-semantic refinement.
3. Update `LAST_AMENDED_DATE` to the amendment date (ISO 8601).
4. Update `CLAUDE.md` if the amendment affects implementation guidance.
5. Propagate changes to `.specify/` templates if the amendment affects plan gates,
   spec requirements, or task categories.

All implementation plans MUST include a Constitution Check gate that verifies
compliance with Principles I–V before Phase 0 research begins.

**Version**: 1.0.0 | **Ratified**: 2026-04-13 | **Last Amended**: 2026-04-13
