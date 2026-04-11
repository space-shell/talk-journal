import { html } from '../lib.js';
import { modelPanelVis, dlProgress, simdErrorVis } from '../signals.js';
import { downloadModel } from '../model.js';

export function ModelPanel() {
  if (!modelPanelVis.value) return null;
  const dl   = dlProgress.value;
  const simd = simdErrorVis.value;
  return html`
    <div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Parakeet Model Required</div>
          <div class="panel-meta">One-time download · Cached in browser · No audio ever leaves your device</div>
        </div>
      </div>
      <div style="padding:1rem;display:flex;flex-direction:column;gap:.875rem">
        <p style="font-size:.875rem;color:var(--muted);line-height:1.65">
          Transcription runs entirely in your browser using the Parakeet TDT 0.6B model via WebGPU and WASM.
          The model is downloaded once and cached locally (~650 MB in WASM mode, ~2.5 GB in WebGPU mode).
          No audio ever leaves your device.
        </p>
        ${simd && html`
          <p style="font-size:.875rem;color:var(--red);line-height:1.65;margin:0">
            Your browser does not support WebAssembly SIMD, which is required for in-browser transcription.
            Please use Chrome 91+ on a desktop computer or a modern Android device (Chrome 91+).
          </p>
        `}
        ${dl.visible && html`
          <div class="download-progress">
            <div class="download-bar"><div class="download-fill" style=${'width:' + dl.pct + '%'}></div></div>
            <div class="download-label">${dl.label}</div>
          </div>
        `}
        ${!simd && html`
          <button class="btn btn-primary" style="align-self:flex-start" disabled=${dl.visible} onClick=${downloadModel}>
            Download Model (~650 MB)
          </button>
        `}
      </div>
    </div>`;
}
