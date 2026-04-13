export const TX_PREFIX  = 'transcription:';
export const TX_INDEX   = 'transcription:index';
export const MODEL_KEY  = 'parakeet-tdt-0.6b-v3';
export const AUDIO_EXTS = /\.(wav|mp3|m4a|aac|ogg|oga|opus|webm|flac)$/i;

export const ATF_MAX   = 160;
export const ATF_TYPES = [
  { type: 'action',  label: 'Actions',  placeholder: 'You…' },
  { type: 'thought', label: 'Thoughts', placeholder: 'You think…' },
  { type: 'feeling', label: 'Feelings', placeholder: 'You feel…' },
];

export const NOSTR_APP_TAG    = 'tibbs';
export const NOSTR_D_PREFIX   = 'tibbs:entry:';
export const NOSTR_SETTINGS_D = 'tibbs:settings';

export const DEFAULTS = {
  language:                   'en',
  vad_enabled:                true,
  vad_threshold:              0.01,
  vad_padding_ms:             200,
  vad_min_silence_ms:         300,
  delete_after_transcription: false,
  auto_save:                  true,
  auto_transcribe:            true,
  notes_enabled:              false,
  notion_api_key:             '',
  notion_target_id:           '',
  obsidian_vault_name:        '',
};
