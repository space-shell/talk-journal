import { h, render } from 'https://esm.sh/preact@10';
import { signal, batch, effect, useSignal } from 'https://esm.sh/@preact/signals@1?deps=preact@10';
import htm from 'https://esm.sh/htm@3?deps=preact@10';

export { h, render, signal, batch, effect, useSignal };
export const html = htm.bind(h);
