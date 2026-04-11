import { files, cfg } from './signals.js';

export async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { prompt('Copy the text below:', text); }
}

export async function shareOne(i) {
  const f = files.value[i]; if (!f?.transcript) return;
  try { await navigator.share({ title: f.name, text: f.transcript }); }
  catch { copyToClipboard(f.transcript); }
}

export async function shareAll() {
  const done = files.value.filter(f => f.transcript !== null); if (!done.length) return;
  const text = done.map(f => `${f.path}\n\n${f.transcript}`).join('\n\n---\n\n');
  try { await navigator.share({ title: 'Transcriptions', text }); }
  catch { copyToClipboard(text); }
}

export function exportAll(fmt) {
  const done = files.value.filter(f => f.transcript !== null); if (!done.length) return;
  const sep  = '\n\n---\n\n';
  const content = fmt === 'txt'
    ? done.map(f => `${f.path}\n\n${f.transcript}`).join(sep)
    : done.map(f => `## ${f.path}\n\n${f.transcript}`).join(sep);
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: 'text/plain' })),
    download: `transcriptions.${fmt}`,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

export async function sendToNotion(i) {
  const f = files.value[i]; if (!f?.transcript) return;
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${cfg.value.notion_target_id}/children`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${cfg.value.notion_api_key}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ children: [
        { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: f.name } }] } },
        { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: f.transcript } }] } },
      ] }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
    alert('Sent to Notion.');
  } catch (e) {
    alert(`Notion export failed: ${e.message}\n\nNote: Notion's API may block browser-direct requests due to CORS restrictions.`);
  }
}

export function sendToObsidian(i) {
  const f = files.value[i]; if (!f?.transcript || !cfg.value.obsidian_vault_name) return;
  const name = f.name.replace(/\.[^.]+$/, '');
  window.open(`obsidian://new?vault=${encodeURIComponent(cfg.value.obsidian_vault_name)}&name=${encodeURIComponent(name)}&content=${encodeURIComponent(f.transcript)}`);
}
