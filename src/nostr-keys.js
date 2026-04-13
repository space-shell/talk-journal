import { generateSecretKey, getPublicKey } from 'https://esm.sh/nostr-tools@2/pure';
import * as nip19 from 'https://esm.sh/nostr-tools@2/nip19';
import * as nip44 from 'https://esm.sh/nostr-tools@2/nip44';

const NSEC_KEY = 'tj_nostr_nsec';

export function generateKeypair() {
  const privkey = generateSecretKey();
  const pubkey  = getPublicKey(privkey);
  return { privkey, nsec: nip19.nsecEncode(privkey), npub: nip19.npubEncode(pubkey) };
}

export function privkeyFromNsec(nsec) {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') throw new Error('Not an nsec');
  return decoded.data; // Uint8Array
}

export function pubkeyFromPrivkey(privkey) {
  return getPublicKey(privkey); // hex string
}

export function npubFromNsec(nsec) {
  return nip19.npubEncode(getPublicKey(privkeyFromNsec(nsec)));
}

export function loadPrivkey() {
  const nsec = localStorage.getItem(NSEC_KEY);
  if (!nsec) return null;
  try { return privkeyFromNsec(nsec); } catch { return null; }
}

export function loadNsec() {
  return localStorage.getItem(NSEC_KEY) || '';
}

export function saveNsec(nsec) {
  privkeyFromNsec(nsec); // throws if invalid
  localStorage.setItem(NSEC_KEY, nsec);
}

export function clearPrivkey() {
  localStorage.removeItem(NSEC_KEY);
}

export function encrypt(plaintext, privkey) {
  const convKey = nip44.getConversationKey(privkey, getPublicKey(privkey));
  return nip44.encrypt(plaintext, convKey);
}

export function decrypt(ciphertext, privkey) {
  const convKey = nip44.getConversationKey(privkey, getPublicKey(privkey));
  return nip44.decrypt(ciphertext, convKey);
}
