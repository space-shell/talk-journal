const DEV_KEY = new URLSearchParams(document.location.search).has("devMode")

export const hasFilePicker = DEV_KEY || ('showDirectoryPicker' in window);
export const hasWebGPU     = DEV_KEY || ('gpu' in navigator);
// WebAssembly SIMD is required by the WASM backend of parakeet.js
export const hasSimd = DEV_KEY || (typeof WebAssembly !== 'undefined' && WebAssembly.validate(new Uint8Array([
  0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11
])));
