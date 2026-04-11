import { signal } from './lib.js';
import { DEFAULTS } from './config.js';
import { hasWebGPU } from './compat.js';

export const cfg             = signal((() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('tj_cfg') || '{}') }; } catch { return { ...DEFAULTS }; } })());
export const files           = signal([]);
export const dirHandle       = signal(null);
export const busy            = signal(false);
export const settingsOpen    = signal(false);
export const modelStatus     = signal({ dot: 'missing', label: 'Model not downloaded' });
export const modelPanelVis   = signal(false);
export const simdErrorVis    = signal(false);
export const dlProgress      = signal({ visible: false, pct: 0, label: '' });
export const webgpuNoticeVis = signal(!hasWebGPU);
export const deleteBannerVis = signal(false);
export const historyEntries  = signal([]);
export const storageInfo     = signal({ pct: 0, text: 'Calculating…', warn: false });
export const appView         = signal('home');   // 'home' | 'wizard' | 'summary'
export const wizardIndex     = signal(0);

export function updateFile(i, patch) {
  files.value = files.value.map((f, idx) => idx === i ? { ...f, ...patch } : f);
}
