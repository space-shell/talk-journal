# Implementation Plan: LLM Transcription Formatting (Phase 1)

**Branch**: `001-webllm-integration` | **Date**: 2026-05-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-webllm-integration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: JavaScript (ES modules, no build step)
**Primary Dependencies**: Preact, @preact/signals, htm, parakeet.js, @mlc-ai/web-llm
**Storage**: localStorage (transcription entries + settings), IndexedDB (WebLLM model cache)
**Testing**: Manual / browser-based
**Target Platform**: Chromium browsers with WebGPU
**Project Type**: Build-less single-page web app
**Performance Goals**: Formatting completes within 30s on mid-range device; UI remains responsive during processing
**Constraints**: No backend/API; WebGPU required; transcription and LLM must share a single serial queue
**Scale/Scope**: Single-user, offline, ~10-50 audio files per session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/001-webllm-integration/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (model selection research)
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── config.js            # Add llm_formatting default setting + LLM model constants
├── signals.js           # Add formatting state signals
├── storage.js           # Update saveTx/getTx for formattedText field
├── engine.js            # Shared txQueue — formatting jobs use same queue
├── llm.js               # NEW: WebLLM model loading, formatting inference
├── transcription.js     # Hook: auto-queue formatting after transcription
├── components/
│   ├── FileItem.js      # Toggle raw/formatted view + status message
│   ├── SettingsDrawer.js # Formatting toggle + download progress
│   └── ...
└── main.js              # Entry point
```

## Complexity Tracking

> No constitution violations anticipated. Feature follows existing patterns (signal-based state, queue serialisation, settings toggle, localStorage persistence).
