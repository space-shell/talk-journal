export const fmtBytes = b => b < 1048576 ? `${(b/1024).toFixed(0)} KB` : b < 1073741824 ? `${(b/1048576).toFixed(1)} MB` : `${(b/1073741824).toFixed(1)} GB`;
export const fmtDur   = b => { const m = b / (17*1048576); return m < 1 ? `~${Math.round(m*60)}s` : `~${m.toFixed(1)} min`; };
export const fmtDate  = ts => new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
export const fmtDay   = ts => new Date(ts).toLocaleDateString(undefined, { weekday: 'long' });
export const fmtTime  = ts => new Date(ts).toLocaleTimeString(undefined, { timeStyle: 'short' });
export const genId    = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16); });
