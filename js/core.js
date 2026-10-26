// State and helpers shared by every view. These are plain scripts with no build step, so
// anything declared at the top level here can be used by the files loaded after it (see index.html).
'use strict';

const S = window.Store;
let state = S.load();

// Screen-only state: what's open, typed into a search box, and so on. Never saved.
const ui = {
  fold: {}, addLevel: {}, editItem: null, showDone: {},
  viewWeek: null, planQ: '', planOffset: 0,
  projQ: '', projView: 'recent', projPm: 'all', projSort: 'last', projAll: false,
  edit: null, draft: null, draftError: '', pmMenu: false,
  tsOffset: 0, tsDay: null, tsError: '',
  openPerson: null, newPm: '', newVer: '',
  toast: null, modal: null
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Every value from your data goes through esc() before it lands in the page.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

const save = () => S.save(state);
const curWeek = () => S.weekKey();
const proj = id => state.projects[id];
const person = id => state.people.find(p => p.id === id) || null;
const sum = (list, fn) => list.reduce((a, x) => a + fn(x), 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pct = (part, whole) => (whole ? Math.min(100, Math.round(part / whole * 100)) : 0);
const projectHref = id => '#/p/' + encodeURIComponent(id);
const byNumberDesc = (a, b) => parseFloat(proj(b.pid).number) - parseFloat(proj(a.pid).number);
const plannedHours = entries => sum(entries, e => parseFloat(e.hours) || 0);

function fmtH(h) {
  const r = Math.round(h * 100) / 100;
  return r % 1 === 0 ? r.toFixed(1) : String(r);
}
function fmtDay(isoStr) {
  const d = S.parseISO(isoStr);
  return `${WD[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}
function fmtShort(isoStr) {
  const d = S.parseISO(isoStr);
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}
// "Oct 12 – 16", or "Sep 28 – Oct 2" when the week crosses a month.
function fmtRange(key) {
  const start = S.parseISO(key);
  const fri = S.addDays(start, 4);
  return `${fmtShort(key)} – ${fri.getMonth() === start.getMonth() ? fri.getDate() : fmtShort(S.iso(fri))}`;
}
function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${MON[+m - 1]} ${y}`;
}
function clock(ms) {
  const d = new Date(ms);
  const h = d.getHours();
  return `${(h + 11) % 12 + 1}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
const daysBetween = (a, b) => Math.round((S.parseISO(b) - S.parseISO(a)) / 86400000);

// Minutes on the running timer, optionally only for one project and/or one day.
function liveMinutes(pid, dateIso) {
  const t = state.timer;
  if (!t || (pid !== null && t.pid !== pid)) return 0;
  let from = t.start;
  let to = Date.now();
  if (dateIso) {
    const day = S.parseISO(dateIso);
    from = Math.max(from, day.getTime());
    to = Math.min(to, S.addDays(day, 1).getTime());
  }
  return Math.max(0, (to - from) / 60000);
}
function elapsedText() {
  if (!state.timer) return '0:00';
  const m = Math.floor((Date.now() - state.timer.start) / 60000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
const timerOn = pid => !!state.timer && state.timer.pid === pid;

// Time entries use 'OH' for overhead instead of a project id.
function pidLabel(pid) {
  if (pid === 'OH') return state.settings.overheadCode || 'OVERHEAD';
  return proj(pid)?.number || '?';
}
function pidName(pid) {
  if (pid === 'OH') return 'Overhead · meetings, admin';
  return proj(pid)?.name || 'Deleted project';
}

function lastOnList(pid) {
  return Object.keys(state.weeks).filter(k => S.inWeek(state, k, pid)).sort().pop() || null;
}
function lastLabel(p) {
  const k = lastOnList(p.id);
  if (k) return k === curWeek() ? 'This week' : 'Week of ' + fmtShort(k);
  return fmtMonth(p.lastSeen);
}
function lastSort(p) {
  return lastOnList(p.id) || (p.lastSeen ? p.lastSeen + '-01' : '0000');
}

function freeColor() {
  const used = state.people.filter(p => !p.archived).map(p => p.color);
  return S.COLORS.find(c => !used.includes(c)) || 'gray';
}
function addPerson(name) {
  name = (name || '').trim();
  if (!name) return null;
  const existing = state.people.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.archived = false;
    return existing;
  }
  const p = { id: S.uid('pm_'), name, color: freeColor(), archived: false };
  state.people.push(p);
  return p;
}

let toastTimer = null;
function showToast(text, undo) {
  ui.toast = { text, undo: undo || null };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast = null;
    render();
  }, 8000);
}

// Lucide-style icons, drawn on a 24x24 grid.
const ICONS = {
  week: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  plan: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  play: '<polygon points="7 4 20 12 7 20 7 4"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  grip: '<circle cx="9" cy="6" r=".6"/><circle cx="9" cy="12" r=".6"/><circle cx="9" cy="18" r=".6"/><circle cx="15" cy="6" r=".6"/><circle cx="15" cy="12" r=".6"/><circle cx="15" cy="18" r=".6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="m10 3-2 18"/><path d="m16 3-2 18"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  indent: '<path d="M21 6H11"/><path d="M21 12H11"/><path d="M21 18H11"/><path d="m3 8 4 4-4 4"/>',
  outdent: '<path d="M21 6H11"/><path d="M21 12H11"/><path d="M21 18H11"/><path d="m7 8-4 4 4 4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  logo: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'
};
// size: '' (20px), 's' (16px) or 'xs' (12px).
const ic = (name, size = '') => `<svg class="ic ${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

// PM colour as a CSS variable. Colours are checked against the palette when data loads.
const pcVar = p => `--pc: var(--c-${p ? p.color : 'gray'})`;

function pmPill(pmId) {
  const p = person(pmId);
  return `<span class="pm" style="${pcVar(p)}"><span class="dot"></span>${p ? esc(p.name) : 'No PM'}</span>`;
}

function rvtTag(p) {
  if (p.revit) return `<span class="tag acc">${esc(p.revit)}</span>`;
  return `<button class="tag dash" data-a="editProject" data-id="${esc(p.id)}" title="Set Revit version">+ RVT</button>`;
}

function revitDatalist(id) {
  const versions = [...state.settings.revitVersions, 'Not Revit (CAD)'];
  return `<datalist id="${id}">${versions.map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
}

function timerBar() {
  if (!state.timer) return '';
  const p = proj(state.timer.pid);
  const label = state.timer.pid === 'OH' ? 'Overhead' : p ? `${p.number} · ${p.name}` : 'Project';
  return `
    <div class="timerbar">
      ${ic('clock')}
      <span class="grow ell bold">${esc(label)}</span>
      <span class="t num" data-elapsed>${elapsedText()}</span>
      <button class="btn sm" data-a="stopTimer">${ic('stop', 's')}Stop</button>
    </div>`;
}
