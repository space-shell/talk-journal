import { html } from '../lib.js';

export function CompatWarning() {
  return html`
    <div id="compat-warning" style="display:flex">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--yellow)">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <h1>Chromium-based browser required</h1>
      <p>This app uses the File System Access API, which is only supported in Chrome, Edge, and Brave. Please open this page in one of those browsers.</p>
    </div>`;
}
