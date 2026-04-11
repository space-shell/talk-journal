import { h, render } from 'https://esm.sh/preact@10';
import { useState, useEffect, useRef } from 'https://esm.sh/preact@10/hooks';
import { signal, batch } from 'https://esm.sh/@preact/signals@1?deps=preact@10';
import htm from 'https://esm.sh/htm@3?deps=preact@10';

export { h, render, useState, useEffect, useRef, signal, batch };
export const html = htm.bind(h);
