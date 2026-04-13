import { finalizeEvent } from 'https://esm.sh/nostr-tools@2/pure';
import { NOSTR_APP_TAG, NOSTR_D_PREFIX, NOSTR_SETTINGS_D } from './config.js';
import { encrypt, decrypt } from './nostr-keys.js';

export function buildEntryEvent(entry, privkey) {
  return finalizeEvent({
    kind: 30078,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `${NOSTR_D_PREFIX}${entry.id}`],
      ['t', NOSTR_APP_TAG],
    ],
    content: encrypt(JSON.stringify({ schema: 1, ...entry }), privkey),
  }, privkey);
}

export function buildSettingsEvent(settings, privkey) {
  return finalizeEvent({
    kind: 30078,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', NOSTR_SETTINGS_D],
      ['t', NOSTR_APP_TAG],
    ],
    content: encrypt(JSON.stringify({ schema: 1, ...settings }), privkey),
  }, privkey);
}

export function decodeEntryEvent(event, privkey) {
  try { return JSON.parse(decrypt(event.content, privkey)); } catch { return null; }
}

export function getDTag(event) {
  return event.tags.find(t => t[0] === 'd')?.[1] || '';
}
