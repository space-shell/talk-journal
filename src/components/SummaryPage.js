import { html } from '../lib.js';
import { ATF_TYPES } from '../config.js';
import { files, appView, wizardIndex, updateFile } from '../signals.js';
import { removeTx, refreshHistory, refreshStorage } from '../storage.js';
import { startNewSession } from '../navigation.js';

export function SummaryPage() {
  const fs  = files.value;
  const all = fs.flatMap(f => (f.entries || []).map(e => ({ ...e, filename: f.name })));
  const byType = t => all.filter(e => e.type === t);
  const totalWords = fs.reduce((s, f) => s + (f.transcript ? f.transcript.split(/\s+/).filter(Boolean).length : 0), 0);

  const deleteAudio = async () => {
    if (!confirm('Permanently delete all source audio files from the selected folder? This cannot be undone.')) return;
    for (const f of files.value) {
      if (f.handle && !f.deleted) {
        try { await f.handle.remove(); updateFile(files.value.indexOf(f), { deleted: true }); } catch {}
      }
    }
  };

  const deleteTx = () => {
    if (!confirm('Remove all transcriptions and entries for this session from your browser? This cannot be undone.')) return;
    files.value.forEach(f => { if (f.savedId) removeTx(f.savedId); });
    refreshHistory(); refreshStorage();
    startNewSession();
  };

  return html`
    <div style="display:flex;flex-direction:column;gap:1rem;padding-bottom:2rem">
      <div class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Session complete</div>
            <div class="panel-meta">${fs.length} recording${fs.length !== 1 ? 's' : ''} · ${totalWords.toLocaleString()} words transcribed</div>
          </div>
          <button class="btn btn-ghost btn-sm" onClick=${() => { appView.value = 'wizard'; wizardIndex.value = files.value.length - 1; }}>← Review</button>
        </div>
        <div class="summary-stats">
          <div class="summary-stat action">
            <div class="summary-stat-value">${byType('action').length}</div>
            <div class="summary-stat-label">Actions</div>
          </div>
          <div class="summary-stat thought">
            <div class="summary-stat-value">${byType('thought').length}</div>
            <div class="summary-stat-label">Thoughts</div>
          </div>
          <div class="summary-stat feeling" style="grid-column:span 1">
            <div class="summary-stat-value">${byType('feeling').length}</div>
            <div class="summary-stat-label">Feelings</div>
          </div>
          <div class="summary-stat" style="grid-column:span 1">
            <div class="summary-stat-value">${all.length}</div>
            <div class="summary-stat-label">Total entries</div>
          </div>
        </div>
      </div>

      ${ATF_TYPES.map(({ type, label }) => {
        const items = byType(type);
        if (!items.length) return null;
        return html`
          <div class="panel" key=${type}>
            <div class="panel-head"><div class=${'panel-title atf-label ' + type}>${label}</div></div>
            <div class="summary-atf-list">
              ${items.map(e => html`
                <div class="summary-atf-item" key=${e.id}>
                  <div class="summary-atf-text">${e.text}</div>
                  <div class="summary-atf-source">${e.filename}</div>
                </div>
              `)}
            </div>
          </div>`;
      })}

      <div class="panel">
        <div class="panel-head"><div class="panel-title">Clean up</div></div>
        <div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem">
          <p style="font-size:.875rem;color:var(--muted);line-height:1.65">
            Your transcriptions and entries are saved in your browser. These options are optional.
          </p>
          <button class="btn btn-danger" onClick=${deleteAudio}>Delete source audio files</button>
          <button class="btn btn-danger" onClick=${deleteTx}>Delete transcriptions from browser</button>
          <button class="btn btn-ghost" onClick=${startNewSession}>Start new session</button>
        </div>
      </div>
    </div>`;
}
