import { batch } from './lib.js';
import { files, appView, wizardIndex, dirHandle, busy, deleteBannerVis } from './signals.js';

export function goNext() {
  const idx = wizardIndex.value;
  const len = files.value.length;
  if (idx < len - 1) wizardIndex.value = idx + 1;
  else appView.value = 'summary';
}

export function goPrev() {
  if (wizardIndex.value > 0) wizardIndex.value--;
}

export function startNewSession() {
  batch(() => {
    appView.value         = 'home';
    wizardIndex.value     = 0;
    files.value           = [];
    dirHandle.value       = null;
    busy.value            = false;
    deleteBannerVis.value = false;
  });
}
