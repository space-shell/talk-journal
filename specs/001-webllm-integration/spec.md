# Feature Specification: WebLLM In-Browser AI Assistance

**Feature Branch**: `001-webllm-integration`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User description: "utilize the webllm framework to load a light weight llm model into the browser for client side usage. The llm model will provide the ability to 'clean up' the transcribed text, removing manarisms, placing punctuation and restructuring the text to add lists, paragraphs and so on. The llm model will also provide the ability to suggest entries based on the given transcription. The llm model will also provide the ability to generate reflective questions or insigts on both a given transcription or the session as a whole. This feature is for the initial integration of webllm framework and researching the appropriate model to use for this context."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Clean Up Transcription (Priority: P1)

A user has finished recording a voice note and the transcription appears in the wizard card.
The raw transcription contains filler words ("um", "uh", "you know"), run-on sentences,
and no punctuation. The user clicks "Clean Up" and the LLM rewrites the text in-place:
removing mannerisms, adding punctuation, and restructuring into readable paragraphs or
bullet lists where appropriate. The original text is preserved and the cleaned version
replaces (or optionally sits alongside) the displayed transcription.

**Why this priority**: This is the most immediately useful LLM action — every transcription
benefits from it, and it directly addresses the biggest pain point of raw speech-to-text output.

**Independent Test**: Load the app with a single audio file already transcribed. Press
"Clean Up" on the wizard card. Verify the displayed text is a grammatically coherent
rewrite of the original, free of filler words, with punctuation and logical paragraph breaks.

**Acceptance Scenarios**:

1. **Given** a transcription containing filler words and no punctuation,
   **When** the user activates "Clean Up",
   **Then** the displayed text is rewritten with punctuation, proper sentences, and
   logical paragraph or list structure — with no filler words remaining.

2. **Given** a transcription that is already clean,
   **When** the user activates "Clean Up",
   **Then** the text is returned unchanged (or only trivially altered), confirming the
   model does not hallucinate additions.

3. **Given** the LLM model is not yet loaded,
   **When** the user activates "Clean Up",
   **Then** a clear loading indicator is shown, and the action completes once the model
   is ready — or an appropriate message is shown if the model failed to load.

---

### User Story 2 — Suggest ATF Entries (Priority: P2)

After reading a transcription (raw or cleaned), the user wants help identifying what
Action, Thought, or Feeling entries to log. They trigger "Suggest Entries" and the LLM
analyses the transcription text, then proposes up to 3–5 draft ATF entries (across types)
that the user can accept, edit, or discard with a single tap. Accepted suggestions
populate the ATF input fields exactly as if the user had typed them.

**Why this priority**: ATF entry creation is the primary value output of the wizard. LLM
suggestions lower the friction of the most cognitively demanding step.

**Independent Test**: Load a transcription that clearly describes an action taken, an
emotional state, and a thought. Trigger "Suggest Entries". Verify that at least one entry
of each relevant type is proposed, each ≤ 160 characters, and that accepting a suggestion
adds it to the card's ATF list.

**Acceptance Scenarios**:

1. **Given** a transcription describing a completed task, an emotion, and a reflection,
   **When** the user triggers "Suggest Entries",
   **Then** the LLM proposes labelled ATF entries (type + text ≤ 160 chars) covering
   at least the observable types in the transcription.

2. **Given** the user receives suggestions,
   **When** they accept one,
   **Then** it appears in the ATF section immediately, identical to a manually typed entry.

3. **Given** the user receives suggestions,
   **When** they dismiss or ignore them,
   **Then** the card state is unchanged — no entries are added.

---

### User Story 3 — Reflective Questions / Insights per Recording (Priority: P3)

On a wizard card, the user can request "Reflect" to receive 2–4 open-ended questions or
insights generated from that recording's transcription. These are read-only prompts designed
to encourage deeper journaling — they do not create entries automatically. The user can
optionally copy a question into the notes field.

**Why this priority**: Adds depth to single-entry review but is not on the critical path
for the core journaling loop.

**Independent Test**: Open a wizard card with a transcription. Trigger "Reflect". Verify
2–4 distinct, open-ended questions or observations appear that are topically relevant to
the transcription content.

**Acceptance Scenarios**:

1. **Given** a transcription about a specific event,
   **When** the user triggers "Reflect",
   **Then** 2–4 questions or insights are displayed that are clearly related to the
   transcription topic and encourage self-examination.

2. **Given** reflective questions are displayed,
   **When** the user closes or navigates away,
   **Then** no entries or notes are altered unless the user explicitly copied content.

---

### User Story 4 — Session-Wide Insights (Priority: P4)

From the Summary page, the user can trigger "Session Insights" to receive a brief
synthesis across all transcriptions in the session: recurring themes, patterns, a
suggested focus area, or noteworthy contrasts between recordings. Output is read-only
text displayed in the Summary view.

**Why this priority**: Valuable but dependent on Users 1–3; only meaningful once the LLM
is already loaded and the session contains multiple recordings.

**Independent Test**: Complete a session with 3+ recordings containing varied content.
Navigate to the Summary page and trigger "Session Insights". Verify the output
references content that spans multiple recordings and identifies at least one cross-session
theme.

**Acceptance Scenarios**:

1. **Given** a completed session with multiple transcriptions,
   **When** the user triggers "Session Insights",
   **Then** a cohesive summary is displayed that references themes or patterns visible
   across more than one recording.

2. **Given** a session with only one recording,
   **When** the user triggers "Session Insights",
   **Then** a single-recording reflection is returned, or a message explains that
   cross-session synthesis requires more recordings.

---

### Edge Cases

- What happens when the LLM generates a cleaned transcription longer than the original
  by a significant margin? (Guard against hallucinated additions.)
- What if the transcription is very short (< 10 words)? LLM actions should still complete
  without error, potentially returning a minimal or no-op result.
- What if the device lacks sufficient memory/GPU to load the chosen model? A clear,
  actionable error message must be shown and the existing transcription workflow must
  remain unaffected.
- What happens during LLM generation if the user navigates to a different wizard card?
  The queued or in-flight job completes in the background; navigation must not be blocked,
  and the result is applied to the correct card when the job finishes.
- ATF suggestions that exceed 160 characters must be automatically truncated or rejected
  before being presented to the user.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST load a lightweight LLM model entirely within the browser using
  the WebLLM framework, with no data transmitted to any server.
- **FR-002**: The app MUST display a model load progress indicator and inform the user
  when the model is ready for use.
- **FR-003**: Users MUST be able to trigger a "Clean Up" action on any transcription in
  the wizard, receiving a rewritten version free of filler words with punctuation and
  paragraph/list structure.
- **FR-004**: The original transcription text MUST be preserved and accessible even after
  a "Clean Up" action has been applied.
- **FR-005**: Users MUST be able to trigger "Suggest Entries" on any wizard card to receive
  LLM-generated ATF entry drafts (type + text ≤ 160 chars each).
- **FR-006**: Suggested ATF entries MUST be individually acceptable or dismissable; accepted
  entries MUST be added to the card's ATF list exactly as if typed manually.
- **FR-007**: Users MUST be able to trigger "Reflect" on any wizard card to receive 2–4
  open-ended questions or insights relevant to that recording's transcription.
- **FR-008**: Users MUST be able to trigger "Session Insights" from the Summary page,
  receiving a read-only cross-session synthesis.
- **FR-009**: All LLM features MUST degrade gracefully if the model fails to load — the
  core transcription and ATF workflow MUST remain fully functional regardless.
- **FR-010**: The chosen model MUST be selected based on research into the best available
  WebLLM-compatible model for this use case (journaling assistance, structured output,
  instruction-following), with the selection documented.
- **FR-011**: All LLM inference jobs (Clean Up, Suggest Entries, Reflect, Session Insights)
  MUST be routed through the same shared inference queue as Parakeet transcription jobs,
  ensuring that only one intensive task runs at a time and preventing CPU/GPU contention
  that would freeze the UI.

### Key Entities

- **LLM Model**: The specific WebLLM-compatible model selected after research; identified
  by its WebLLM model ID, download size, and capability profile.
- **Cleaned Transcription**: A rewritten version of a raw transcription produced by the
  LLM; associated with the original transcription entry.
- **ATF Suggestion**: An LLM-generated draft entry with a `type` (`action|thought|feeling`)
  and `text` (≤ 160 chars); transient until accepted by the user.
- **Reflection Output**: A set of 2–4 read-only questions or insights generated from a
  single transcription or a full session; not persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can activate "Clean Up" on a transcription and receive a readable,
  punctuated rewrite within 30 seconds on a mid-range device after the model is loaded.
- **SC-002**: ATF suggestions cover at least 2 of the 3 entry types (action/thought/feeling)
  for transcriptions that contain observable examples of each type.
- **SC-003**: The core journaling workflow (folder selection → transcription → wizard →
  summary) completes without error on devices where the LLM model fails or has not been
  downloaded.
- **SC-004**: The selected model and the rationale for its selection are documented in
  a research note within the feature spec directory, including model size, capabilities,
  and alternatives considered.
- **SC-005**: LLM actions and Parakeet transcription jobs are serialized through a shared
  queue — triggering an LLM action while a transcription is in progress queues it rather
  than running in parallel, and the UI remains responsive throughout.

## Assumptions

- The WebLLM framework supports Chromium-based browsers with WebGPU, consistent with the
  app's existing Chromium-only stance. A WASM fallback within WebLLM may be considered
  but is not required for this initial integration.
- The LLM model will be cached locally by WebLLM after the first download, similar to
  the Parakeet model caching behaviour.
- Model size will be constrained to something a typical user would be willing to download
  for a journaling aid — assumed ceiling of ~1–2 GB, with preference for smaller.
- Prompts sent to the LLM contain only the transcription text; no audio, user identity,
  or other personal metadata are included in model inputs.
- "Clean Up" replaces the displayed transcription text in the UI; the original raw text
  is retained in the stored entry so the user can revert or compare.
- ATF entry suggestions are generated as structured output (type + text pairs); the
  implementation will use prompting strategies appropriate to the chosen model's
  instruction-following capability.
- Session Insights operate on the full concatenated text of all transcriptions in the
  current session — no additional persistent summary is stored beyond what already exists
  in localStorage.
- LLM jobs are treated as standard-priority queue entries (equivalent to batch
  transcription jobs, not high-priority mic-dictation jobs), so user-triggered mic
  dictation continues to jump ahead in the queue.
