# Nostr Sync — User Stories & Technical Design

## Overview

This document covers the design for cross-device sync using the Nostr protocol. Tibbs remains a static, build-less web app with no backend. Sync is opt-in, identity-keyed, and fully encrypted: relay operators see only ciphertext.

**Core protocol choices:**
- **Kind 30078** (NIP-78) — parameterized replaceable events for application-specific data storage
- **NIP-44 v2** — secp256k1 ECDH + ChaCha20 + HMAC-SHA256, self-encrypted (user's own keypair)
- **No NIP-59 Gift Wrap** — gift wrap is designed to hide sender/recipient in *messaging*; for self-encrypted personal storage it adds unnecessary overhead with no benefit
- **`nostr-tools`** — via `esm.sh` for signing, NIP-44, relay protocol; consistent with the existing build-less ESM approach

---

## User Stories

### Identity & Key Management

**US-N01** — As a new user, I can generate a Nostr keypair from the settings drawer so that I have a sync identity without needing any external Nostr client.

**US-N02** — As a user with an existing Nostr identity, I can paste my `nsec` into settings so that I use the same keypair — and therefore the same encrypted data — across all my devices.

**US-N03** — As a user, I can view my `npub` in settings so that I can verify I'm using the correct identity.

**US-N04** — As a user, I can clear my stored `nsec` from the device so that Nostr sync is disabled and no credentials remain locally.

### Relay Configuration

**US-N05** — As a user, I can add one or more WebSocket relay URLs (e.g. `wss://relay.damus.io`) in settings so that I control where my encrypted data is stored.

**US-N06** — As a user, I can remove relay URLs from my configured list so that I stop publishing to relays I no longer trust.

**US-N07** — As a user, the app shows a connection indicator per relay (connected / error) so that I know which relays are reachable.

### Publishing (Push)

**US-N08** — As a user, when I navigate past a recording in the wizard (completing its review), that entry is automatically published encrypted to all configured relays in the background.

**US-N09** — As a user, if a relay is unreachable when an entry is published, the app retries on next app open so that no entries are silently lost.

**US-N10** — As a user, when I edit notes or ATF entries on a device, saving triggers a re-publish of that entry so that the latest version propagates to other devices.

### Fetching (Pull)

**US-N11** — As a user opening Tibbs with a configured `nsec` and relay, existing encrypted entries are fetched in the background on load so that my history is available on a new device.

**US-N12** — As a user, I can press a "Sync now" button in settings to trigger an immediate pull from all configured relays.

**US-N13** — As a user, the settings drawer shows the last-synced timestamp so I know how fresh my data is.

### Conflict Resolution & Merge

**US-N14** — As a user, if I edit the same entry on two devices before syncing, the version with the later `created_at` timestamp wins so that I don't lose data unexpectedly.

**US-N15** — As a user, entries that exist on a relay but not locally are merged into my local history on pull, so that all devices converge to the same state.

### Privacy & Security

**US-N16** — As a user, all content published to relays is encrypted with NIP-44 so that relay operators and network observers cannot read my journal.

**US-N17** — As a user, I am warned when I first enter an `nsec` that it is stored in `localStorage` in plaintext, so I can make an informed decision about device trust.

**US-N18** — As a user, audio files are never uploaded to relays — only text data (transcriptions, notes, ATF entries) is synced, so recordings stay private and local.

### Opt-out

**US-N19** — As a user, if no `nsec` is configured, Nostr sync is completely inactive — no network requests are made — so the app behaves identically to today for users who don't want sync.

---

## Technical Design

### New Modules

```
src/
  nostr-keys.js       Keypair generation, nsec/npub bech32 encode/decode,
                      NIP-44 encrypt/decrypt (wraps nostr-tools)
  nostr-events.js     Build + sign Kind 30078 events; verify incoming events
  nostr-relay.js      WebSocket relay pool: connect, publish, subscribe, close
  nostr-sync.js       High-level push/pull logic; merge with localStorage;
                      pending-queue for retry
```

Existing modules touched:
- `src/signals.js` — add `nostrStatus` signal (idle / syncing / error)
- `src/storage.js` — `saveTx` / `updateTx` call `pushEntry()` from `nostr-sync.js`
- `src/components/SettingsDrawer.js` — new Nostr section (key management, relays, sync status)
- `config.js` — add `NOSTR_APP_TAG = 'tibbs'`, `NOSTR_D_PREFIX = 'tibbs:entry:'`, `NOSTR_SETTINGS_D = 'tibbs:settings'`

### Library

```js
// imported once in nostr-keys.js; all other nostr modules import from it
import {
  generateSecretKey, getPublicKey,
  finalizeEvent, verifyEvent,
  nip44, nip19
} from 'https://esm.sh/nostr-tools@2'
```

`nostr-tools@2` is a pure ES module with no build step required and is available via esm.sh.

---

### Nostr Event Schema

#### Journal Entry Event (Kind 30078)

```json
{
  "kind": 30078,
  "pubkey": "<hex-pubkey>",
  "created_at": 1744406400,
  "tags": [
    ["d", "tibbs:entry:550e8400-e29b-41d4-a716-446655440000"],
    ["t", "tibbs"]
  ],
  "content": "<NIP-44-encrypted JSON — see below>",
  "sig": "<schnorr-signature>"
}
```

**`d` tag** — `tibbs:entry:<uuid>` where `<uuid>` is the existing entry `id` from localStorage. Because Kind 30078 is *parameterized replaceable*, publishing a new event with the same `d` tag replaces the previous one on all relays, giving free update semantics.

**`created_at`** — Unix timestamp of the *last edit* to the entry (not the original transcription time). This is the conflict-resolution tiebreaker.

**`content`** — NIP-44 v2 ciphertext. The plaintext is the entry JSON (see schema below).

#### Settings Event (Kind 30078)

```json
{
  "kind": 30078,
  "pubkey": "<hex-pubkey>",
  "created_at": 1744406400,
  "tags": [
    ["d", "tibbs:settings"],
    ["t", "tibbs"]
  ],
  "content": "<NIP-44-encrypted settings JSON>",
  "sig": "<schnorr-signature>"
}
```

Settings sync is optional and covers app preferences (language, VAD settings, etc.) but **not** the `nsec` itself (the private key must never leave the device via any channel).

---

### Encrypted Payload Schemas

#### Entry Payload (plaintext before NIP-44 encryption)

```jsonc
{
  "schema": 1,                          // bump when format changes
  "id": "550e8400-...",                 // UUID — matches d-tag suffix
  "filename": "recording_001.m4a",
  "transcribedAt": "2026-04-12T10:30:00Z",
  "durationSeconds": 145,
  "text": "Today I had a meeting...",   // transcription text
  "silenceRemoved": true,
  "deleted": false,                     // soft-delete flag
  "notes": "Follow up with Alice",
  "entries": [
    {
      "id": "6ba7b810-...",
      "type": "action",                 // "action" | "thought" | "feeling"
      "text": "Book the venue",
      "createdAt": "2026-04-12T10:35:00Z"
    }
  ]
}
```

**Size note:** NIP-44 supports up to 65,535 bytes of plaintext. A 30-minute transcription at 150 wpm is ~4,500 words / ~27 KB — comfortably within limits. Entries approaching the limit will be flagged in the UI (US-N edge case, not in initial scope).

#### Settings Payload (plaintext before NIP-44 encryption)

```jsonc
{
  "schema": 1,
  "language": "en",
  "vad_enabled": true,
  "vad_threshold": 0.01,
  "vad_padding_ms": 200,
  "vad_min_silence_ms": 300,
  "auto_save": true,
  "auto_transcribe": true,
  "delete_after_transcription": false
}
```

---

### NIP-44 Self-Encryption

NIP-44's conversation key is symmetric when both sides share the same keypair:

```
conversationKey = ECDH(privkey, pubkey)
               = ECDH(privkey, privkey·G)   // self-encrypt
```

This produces a stable per-identity encryption key. `nostr-tools` exposes this directly:

```js
// nostr-keys.js
export function encrypt(plaintext, privkey) {
  const pubkey = getPublicKey(privkey)
  const conversationKey = nip44.getConversationKey(privkey, pubkey)
  return nip44.encrypt(plaintext, conversationKey)
}

export function decrypt(ciphertext, privkey) {
  const pubkey = getPublicKey(privkey)
  const conversationKey = nip44.getConversationKey(privkey, pubkey)
  return nip44.decrypt(ciphertext, conversationKey)
}
```

---

### Relay Protocol

Kind 30078 is an *addressable* (parameterised replaceable) event. Relevant relay interactions:

**Publish (push):**
```json
["EVENT", { ...signedEvent }]
```
Relay responds with `["OK", "<event-id>", true, ""]` or an error string.

**Fetch all Tibbs events (pull):**
```json
["REQ", "<sub-id>", {
  "kinds": [30078],
  "authors": ["<hex-pubkey>"],
  "#t": ["tibbs"]
}]
```
Relay streams matching events, then sends `["EOSE", "<sub-id>"]`.

The `#t` filter (tag filter on `t` = "tibbs") scopes results to Tibbs events only, avoiding pollution from other apps that also use Kind 30078.

---

### Module Responsibilities

#### `src/nostr-keys.js`
- `generateKeypair()` → `{ privkey: Uint8Array, pubkey: hex, nsec: bech32, npub: bech32 }`
- `privkeyFromNsec(nsec)` → `Uint8Array`
- `nsecFromPrivkey(privkey)` → `string`
- `encrypt(plaintext, privkey)` → `string` (NIP-44 ciphertext)
- `decrypt(ciphertext, privkey)` → `string`
- `loadPrivkey()` / `savePrivkey(nsec)` / `clearPrivkey()` — localStorage CRUD for `tj_nostr_nsec`

#### `src/nostr-events.js`
- `buildEntryEvent(entry, privkey)` → signed Kind 30078 event
- `buildSettingsEvent(settings, privkey)` → signed Kind 30078 event
- `decodeEntryEvent(event, privkey)` → entry JSON | null (returns null on decryption failure)
- `decodeSettingsEvent(event, privkey)` → settings JSON | null

#### `src/nostr-relay.js`
- `RelayPool` class — manages one WebSocket per URL
  - `connect(urls[])` — opens connections, tracks status per relay
  - `publish(event)` → `Promise<{ relay, ok, message }[]>` — fan-out, collect OK/error per relay
  - `fetchKind30078(pubkey)` → `Promise<Event[]>` — REQ + collect until EOSE, then CLOSE
  - `status` — signal: `Map<url, 'connecting'|'open'|'closed'|'error'>`
- Auto-reconnect with exponential backoff on disconnect

#### `src/nostr-sync.js`
- `pushEntry(entry)` — encrypt + sign + publish one entry; on relay failure enqueue in `tj_nostr_pending` (localStorage array of event IDs)
- `pushPending()` — flush `tj_nostr_pending` queue (called on relay connect + app open)
- `pullAll()` — fetch all Kind 30078 events, decrypt, merge into localStorage via `saveTx`/`updateTx`
- `mergeEntry(remote, local)` — returns whichever has the later `created_at`; remote wins on tie-break (relay `created_at` is the tiebreaker, not local clock)
- `autoSync()` — called from `main.js` on load if `nsec` is configured

---

### Settings Storage

New `localStorage` keys:

| Key | Type | Notes |
|---|---|---|
| `tj_nostr_nsec` | string (bech32) | User's private key. Plain text in localStorage — user warned on entry. |
| `tj_nostr_relays` | JSON array of strings | WebSocket URLs |
| `tj_nostr_last_sync` | ISO string | Timestamp of last successful pull |
| `tj_nostr_pending` | JSON array of event IDs | Events that failed to publish and need retry |

These are managed separately from `tj_cfg` to allow clearing Nostr credentials without touching app preferences.

---

### Sync Triggers

| Trigger | Action |
|---|---|
| App load (nsec configured) | `pullAll()` in background; `pushPending()` |
| Wizard "Next" (entry completed) | `pushEntry(currentEntry)` |
| `storage.updateTx()` called | `pushEntry(updatedEntry)` |
| "Sync now" button | `pullAll()` then `pushPending()` |
| Relay reconnects after error | `pushPending()` |

---

### Conflict Resolution

Kind 30078 is *replaceable per `d` tag*: relays automatically keep only the latest event (by `created_at`) for each `(pubkey, kind, d)` triple.

Client-side merge during `pullAll()`:
1. Decrypt each remote event
2. Look up matching local entry by UUID
3. If no local entry → insert via `saveTx`
4. If local entry exists → compare `created_at` (ISO string in payload) / `updated_at` fallback to `transcribedAt`; keep whichever is later
5. If remote wins → overwrite local entry via `updateTx`

No three-way merge — last-write wins is sufficient for a personal journaling app with infrequent concurrent edits.

---

### Security Considerations

| Risk | Mitigation |
|---|---|
| `nsec` exposed in localStorage | User warned on first entry; future work: password-derived key wrapping |
| Relay learns entry count / timing | All events are kind 30078 with identical structure; relay sees only ciphertext + timestamps |
| Relay-operator correlation via `#t` tag | The `t:tibbs` tag is public and identifies the app. Accept as trade-off; for maximum relay-metadata privacy, omit `#t` and filter client-side (at the cost of fetching all kind 30078 from the author) |
| Audio file exposure | Audio files are never synced. Sync is text-only by design. |
| Key rotation | Not in scope for v1. Rotation would require re-encrypting all entries with the new key and republishing. |

---

### Out of Scope (v1)

- Password-based nsec encryption at rest
- NIP-59 Gift Wrap (not needed for self-storage)
- Audio file sync (Blossom / NIP-B7)
- Multi-user shared journals
- Key rotation / re-encryption
- NIP-65 relay list (outbox model) — users configure relays directly in settings
