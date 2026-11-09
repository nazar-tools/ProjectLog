// Routing, the page frame, and wiring events to actions. Loads last (see index.html).

function route() {
  const [name, id] = location.hash.replace(/^#\/?/, '').split('/');
  if (name === 'p' && id) return { name: 'project', id: decodeURIComponent(id) };
  if (['week', 'plan', 'projects', 'time', 'settings', 'review', 'update', 'health'].includes(name)) return { name };
  return { name: 'week' };
}

const VIEWS = {
  week: viewWeek, plan: viewPlan, projects: viewProjects, time: viewTime, settings: viewSettings,
  review: viewReview, update: viewUpdate, health: viewHealth,
  project: r => viewProject(r.id)
};

const NAV = [
  ['week', 'This week', 'week', 'This week'],
  ['plan', 'Plan week', 'plan', 'Plan'],
  ['projects', 'Projects', 'folder', 'Projects'],
  ['time', 'Timesheet', 'clock', 'Time'],
  ['update', 'PM updates', 'send'],
  ['settings', 'Settings', 'sliders']
];

function shell(content, r) {
  // Pages without their own nav entry light up the section they belong to.
  const active = { project: 'projects', health: 'projects', review: 'time' }[r.name] || r.name;
  const lastBackup = state.settings.lastBackup;
  const sideLinks = NAV.map(([key, label, icon]) =>
    `<a href="#/${key}"${active === key ? ' class="on" aria-current="page"' : ''}>${ic(icon)}${label}</a>`
  ).join('');
  // The narrow tab bar has no Settings tab; it's the sliders button on each page.
  const tabs = NAV.slice(0, 4).map(([key, , icon, short]) =>
    `<a class="tab${active === key ? ' on' : ''}" href="#/${key}">${ic(icon)}${short}</a>`
  ).join('');
  const toast = !ui.toast ? '' : `
    <div class="toast" role="status">
      <span>${esc(ui.toast.text)}</span>
      ${ui.toast.undo ? '<button data-a="undo">Undo</button>' : ''}
      <button data-a="closeToast" aria-label="Dismiss">${ic('x', 's')}</button>
    </div>`;

  return `
    <div class="app">
      <aside class="side">
        <div class="brand"><span class="logo">${ic('logo', 's')}</span>Project Log</div>
        <nav class="nav" aria-label="Main">${sideLinks}</nav>
        <button class="quickbtn" data-a="palOpen">${ic('search', 's')}<span class="grow">Quick actions</span><span class="kbd">Ctrl K</span></button>
        <div class="side-foot">
          <span class="lbl">Backup</span>
          <span class="sub">${lastBackup ? 'Last backup ' + fmtShort(lastBackup.slice(0, 10)) : 'Not backed up yet'}${AutoBackup.status === 'ready' ? ' · weekly to ' + esc(AutoBackup.folderName) : ''}</span>
          <button class="btn sm" data-a="export">${ic('download', 's')}Back up now</button>
        </div>
      </aside>
      <main class="main" id="main">${saveBanner()}${autoBackupBanner()}${guardHtml()}${content}</main>
      <nav class="tabbar" aria-label="Main">${tabs}</nav>
    </div>
    ${toast}
    ${ui.modal ? newProjectModal() : ''}
    ${ui.palette ? paletteHtml() : ''}`;
}

// The weekly backup is due but the browser dropped its permission for the folder (it does
// that after a restart). One click gives it back.
function autoBackupBanner() {
  if (AutoBackup.status !== 'needs-click' || !autoBackupDue()) return '';
  return `
    <div class="note wrap center-y">
      ${ic('folderUp', 's')}
      <span class="grow minw">This week’s automatic backup to ${esc(AutoBackup.folderName)} needs your OK.</span>
      <button class="btn sm" data-a="autoNow">Allow and back up</button>
    </div>`;
}

// Shown while saving to this browser fails, so you never keep working on changes that are lost on close.
function saveBanner() {
  const err = S.saveError();
  if (!err) return '';
  const why = err.name === 'QuotaExceededError' ? 'browser storage is full'
    : err.name === 'SecurityError' ? 'this browser is blocking site storage'
    : err.message || 'unknown error';
  return `
    <div class="savebanner" role="alert">
      ${ic('alert', 's')}
      <span class="grow">Changes are not being saved (${esc(why)}). Download a backup now so nothing is lost.</span>
      <button class="btn sm" data-a="export">${ic('download', 's')}Back up now</button>
    </div>`;
}

// Redraws the whole page, then puts the cursor back where it was.
let rendering = false;
function render() {
  const a = document.activeElement;
  // Buttons have no id, so they're found again by what they do and what they act on.
  const sel = a?.id ? '#' + CSS.escape(a.id)
    : a?.dataset?.a ? `[data-a="${CSS.escape(a.dataset.a)}"]${a.dataset.id ? `[data-id="${CSS.escape(a.dataset.id)}"]` : ''}${a.dataset.v ? `[data-v="${CSS.escape(a.dataset.v)}"]` : ''}`
    : null;
  const focus = sel ? { sel, start: a.selectionStart, end: a.selectionEnd } : null;
  const r = route();
  rendering = true;
  document.getElementById('root').innerHTML = shell(VIEWS[r.name](r), r);
  rendering = false;
  // An action asked for a particular box to get the cursor (a new pinned note, say).
  if (ui.focusId) {
    const el = document.getElementById(ui.focusId);
    ui.focusId = null;
    if (el) {
      el.focus();
      if (typeof el.value === 'string' && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
      return;
    }
  }
  if (!focus) return;
  const el = document.querySelector(focus.sel);
  if (!el) return;
  el.focus({ preventScroll: true });
  // Item buttons are hidden until hovered, so fall back to the item itself.
  if (document.activeElement !== el) el.closest('.item')?.querySelector('.txt')?.focus({ preventScroll: true });
  if (typeof focus.start === 'number' && el.setSelectionRange) el.setSelectionRange(focus.start, focus.end);
}

// Light/dark follows the system unless Settings says otherwise. The title bar colour is read
// back from the page background, so styles.css is the only place the colours live.
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).backgroundColor;
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]');
  const fn = t && actions[t.dataset.a];
  // An open tag menu closes on any click outside it.
  if (ui.tagMenu && !e.target.closest('.tagmenu') && t?.dataset.a !== 'tagMenu') {
    ui.tagMenu = null;
    if (!fn) render();
  }
  if (!fn) return;
  if (t.tagName === 'A') e.preventDefault();
  if (fn(t, e) === false) return;
  save();
  render();
});

document.addEventListener('keydown', e => {
  const t = e.target;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    ui.palette = ui.palette ? null : { q: '', sel: 0 };
    render();
    if (ui.palette) document.getElementById('palq')?.focus();
    return;
  }
  if (ui.palette && t.id === 'palq') {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = paletteItems.length;
      if (n) ui.palette.sel = (ui.palette.sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
      render();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      runPaletteItem(ui.palette.sel);
      save();
      render();
      return;
    }
  }
  if (e.key === 'Escape' && (ui.modal || ui.palette || ui.tagMenu)) {
    ui.modal = null;
    ui.palette = null;
    ui.tagMenu = null;
    render();
    return;
  }

  // Task text acts as a button: Enter or Space edits it, Alt+Up/Down moves it.
  if (t.classList?.contains('txt')) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      actions.editItem(t);
      render();
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const id = t.dataset.id;
      if (S.nudgeItem(state, id, e.key === 'ArrowUp' ? -1 : 1)) {
        save();
        render();
        document.getElementById('txt-' + id)?.focus();
      }
    }
    return;
  }

  if (t.classList?.contains('timein') && e.key === 'Enter') {
    t.blur();
    return;
  }

  if (t.dataset?.in === 'tsForm' && e.key === 'Enter') {
    e.preventDefault();
    if (actions.addTime() !== false) {
      save();
      render();
    }
    return;
  }

  if (t.id === 'planq' && e.key === 'Enter') {
    e.preventDefault();
    const first = document.querySelector('.results .res [data-a="addEntry"], .results .res .tag');
    if (first?.dataset.a === 'addEntry') first.click();
    return;
  }

  const k = t.dataset?.k;
  const pid = t.dataset?.id;
  // Backspace at the very start of an indented box steps it back out, like in OneNote.
  const atStart = t.selectionStart === 0 && t.selectionEnd === 0;
  if (k === 'add' && e.key === 'Backspace' && atStart && ui.addLevel[pid]) {
    e.preventDefault();
    ui.addLevel[pid]--;
    rerenderKeeping(t);
    return;
  }
  if (k === 'editItem' && e.key === 'Backspace' && atStart && itemById(pid)?.level) {
    e.preventDefault();
    const it = itemById(pid);
    it.text = t.value.trim() || it.text;
    it.level--;
    save();
    render();
    document.getElementById(t.id)?.setSelectionRange(0, 0);
    return;
  }
  if (k === 'add') {
    if (e.key === 'Tab') {
      e.preventDefault();
      ui.addLevel[pid] = S.clampLevel((ui.addLevel[pid] || 0) + (e.shiftKey ? -1 : 1));
      rerenderKeeping(t);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (S.addItem(state, pid, t.value, ui.addLevel[pid] || 0, ui.addTag[pid])) {
        t.value = '';
        ui.addDraft[pid] = '';
        ui.addTag[pid] = '';
        save();
        render();
      }
    } else if (e.key === 'Escape') {
      ui.addLevel[pid] = 0;
      ui.addTag[pid] = '';
      rerenderKeeping(t);
      document.getElementById(t.id)?.blur();
    }
  } else if (k === 'editItem') {
    const it = itemById(pid);
    if (!it) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(t, true);
    } else if (e.key === 'Escape') {
      ui.editItem = null;
      render();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const typed = S.splitTag(t.value.trim());
      it.text = typed.text || it.text;
      if (typed.tag) it.tag = typed.tag;
      it.level = S.clampLevel(it.level + (e.shiftKey ? -1 : 1));
      save();
      render();
    }
  } else if (e.key === 'Enter' && k) {
    e.preventDefault();
    if (k === 'journal') addJournal(pid);
    if (k === 'newpm') {
      const p = addPerson(t.value);
      if (p && ui.draft) {
        ui.draft.pm = p.id;
        ui.pmMenu = false;
      }
    }
    if (k === 'newpmS') actions.addPm();
    if (k === 'newver') actions.addVer();
    save();
    render();
  }
});

// The add box is rebuilt on redraw, so carry over what's been typed and where the cursor was.
function rerenderKeeping(input) {
  const { value, selectionStart: at } = input;
  render();
  const el = document.getElementById(input.id);
  if (!el) return;
  el.value = value;
  el.setSelectionRange(at, at);
}

function commitEdit(input, keepFocus = false) {
  const id = input.dataset.id;
  const it = itemById(id);
  const typed = S.splitTag(input.value.trim());
  if (it && typed.text) it.text = typed.text;
  if (it && typed.tag) it.tag = typed.tag;
  if (ui.editItem === id) ui.editItem = null;
  ui.editDraft = null;
  save();
  render();
  if (keepFocus) document.getElementById('txt-' + id)?.focus();
}

// Leaving an item's edit box saves it. The delay lets a click on another item land first.
// Start and end times on the timesheet also apply on leaving the box, since typing a time
// passes through half-finished values.
document.addEventListener('focusout', e => {
  const t = e.target;
  if (rendering) return;
  if (t.classList?.contains('timein')) {
    if (editTimeEntry(timeEntry(t.dataset.id), t)) save();
    setTimeout(render);
    return;
  }
  // A new pinned note left empty goes away again.
  if (t.dataset?.in === 'leftOff' && ui.pinEdit === t.dataset.id) {
    setTimeout(() => {
      if (document.activeElement?.id === t.id) return;
      ui.pinEdit = null;
      render();
    }, 120);
    return;
  }
  if (t.dataset?.k !== 'editItem') return;
  // Saved even when the click went to another task's text, which starts editing that one.
  setTimeout(() => {
    if (document.activeElement !== t && itemById(t.dataset.id)) commitEdit(t);
  }, 120);
});

// Drag the dotted handle to reorder tasks and notes. Sub-items travel with their parent.
let dragId = null;

function clearDropMarks() {
  document.querySelectorAll('.drop-before, .drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));
}

function dropTarget(e) {
  const row = e.target.closest?.('[data-item]');
  if (!row || !dragId) return null;
  const d = itemById(dragId);
  const t = itemById(row.dataset.item);
  if (!d || !t || d === t || d.pid !== t.pid) return null;
  const box = row.getBoundingClientRect();
  return { row, after: e.clientY > box.top + box.height / 2 };
}

document.addEventListener('dragstart', e => {
  const handle = e.target.closest?.('[data-drag]');
  if (!handle) return;
  dragId = handle.dataset.drag;
  const row = handle.closest('.item');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragId);
  e.dataTransfer.setDragImage(row, 16, 12);
  setTimeout(() => row.classList.add('dragging'));
});

document.addEventListener('dragover', e => {
  if (!dragId) return;
  const hit = dropTarget(e);
  clearDropMarks();
  if (!hit) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  hit.row.classList.add(hit.after ? 'drop-after' : 'drop-before');
});

document.addEventListener('drop', e => {
  if (!dragId) return;
  e.preventDefault();
  const hit = dropTarget(e);
  const id = dragId;
  dragId = null;
  clearDropMarks();
  if (hit && S.moveItem(state, id, hit.row.dataset.item, hit.after)) save();
  render();
});

document.addEventListener('dragend', () => {
  dragId = null;
  clearDropMarks();
  document.querySelectorAll('.dragging').forEach(x => x.classList.remove('dragging'));
});

// Typing. Most fields save without a redraw so the cursor stays put.
document.addEventListener('input', e => {
  const t = e.target;
  const id = t.dataset?.id;
  const k = t.dataset?.k;
  if (k === 'add') ui.addDraft[id] = t.value;
  if (k === 'editItem') ui.editDraft = { id, value: t.value };
  if (k === 'journal') ui.journalDraft[id] = t.value;
  switch (t.dataset?.in) {
    case 'scratch': state.scratch = t.value; break;
    case 'notes': if (proj(id)) proj(id).notes = t.value; break;
    case 'planq': ui.planQ = t.value; render(); return;
    case 'projq': ui.projQ = t.value; ui.projAll = false; render(); return;
    case 'hours': {
      const entry = weekEntries(planKey()).find(x => x.pid === id);
      if (entry) entry.hours = t.value.replace(',', '.');
      updatePlanTotal();
      break;
    }
    case 'label': {
      const entry = weekEntries(planKey()).find(x => x.pid === id);
      if (entry) entry.label = t.value;
      break;
    }
    case 'draft': if (ui.draft) ui.draft[t.dataset.v] = t.value; return;
    case 'np': if (ui.modal) ui.modal.draft[t.dataset.v] = t.type === 'checkbox' ? t.checked : t.value; return;
    case 'pmName': {
      const p = person(id);
      if (p && t.value.trim()) p.name = t.value;
      break;
    }
    case 'newPm': ui.newPm = t.value; return;
    case 'newVer': ui.newVer = t.value; return;
    case 'palq': ui.palette.q = t.value; ui.palette.sel = 0; render(); return;
    case 'tsForm': ui.tsForm[t.dataset.v] = t.value; return;
    case 'leftOff': {
      const p = proj(id);
      if (!p) return;
      if (t.value.trim()) p.leftOff = { text: t.value, date: S.today() };
      else delete p.leftOff;
      break;
    }
    case 'updateText': ui.updateText[t.dataset.v] = t.value; return;
    case 'myName': state.settings.myName = t.value.trim(); break;
    case 'pmEmail': {
      const p = person(id);
      if (p) p.email = t.value.trim();
      break;
    }
    case 'longTimer': state.settings.longTimerHours = parseFloat(t.value) || 3; break;
    case 'ohcode': state.settings.overheadCode = t.value.trim(); break;
    case 'capacity': state.settings.capacity = parseFloat(t.value) || 40; break;
    default: return;
  }
  save();
});

document.addEventListener('change', e => {
  const t = e.target;
  const id = t.dataset?.id;
  switch (t.dataset?.in) {
    case 'weekSel':
      ui.viewWeek = t.value === curWeek() ? null : t.value;
      render();
      window.scrollTo(0, 0);
      return;
    case 'rvt': {
      const p = proj(id);
      if (!p) return;
      p.revit = t.value.trim();
      t.classList.toggle('set', !!p.revit);
      break;
    }
    case 'date': {
      const entry = weekEntries(planKey()).find(x => x.pid === id);
      if (!entry) return;
      entry.date = t.value;
      entry.day = '';
      render();
      break;
    }
    case 'np':
      if (ui.modal) ui.modal.draft[t.dataset.v] = t.type === 'checkbox' ? t.checked : t.value;
      return;
    case 'tsWeekSel':
      ui.tsOffset = Math.round(daysBetween(curWeek(), t.value) / 7);
      ui.tsDay = null;
      ui.tsOpen = {};
      render();
      return;
    case 'dayEnd':
      if (t.value) state.settings.dayEnd = t.value;
      break;
    case 'lunchFrom':
    case 'lunchTo':
      state.settings[t.dataset.in] = t.value;
      break;
    case 'dayCell': {
      const hours = t.value.trim() ? parseHours(t.value) : 0;
      if (hours >= 0) {
        setDayHours(id, S.roundQ(hours), t.dataset.v);
        ui.tsDay = t.dataset.v;
      } else {
        showToast('Type hours like 1.5 or 1:30');
      }
      // Redraw after the Tab has moved focus, so the cursor lands in the next cell.
      setTimeout(render);
      break;
    }
    case 'tsTotal': {
      const hours = parseHours(t.value);
      if (hours >= 0) setDayHours(id, S.roundQ(hours));
      else showToast('Type hours like 1.5 or 1:30');
      setTimeout(render);
      break;
    }
    case 'tsForm':
      return;
    case 'entryHours':
    case 'entryNote':
    case 'entryPid':
      if (!editTimeEntry(timeEntry(id), t)) return;
      break;
    case 'import':
      if (t.files[0]) importFile(t.files[0]);
      return;
    default:
      return;
  }
  save();
});

// Edits one recorded block from the timesheet. Returns false when nothing changed.
function editTimeEntry(x, input) {
  if (!x) return false;
  const field = input.dataset.in;
  if (field === 'entryNote') {
    x.note = input.value.trim();
    return true;
  }
  if (field === 'entryPid') {
    x.pid = input.value;
    setTimeout(render);
    return true;
  }
  // Times never run into the neighbouring blocks, so the day can't add up to more than the clock.
  const { lo, hi } = tlBounds(x);
  if (field === 'entryHours') {
    const hours = parseHours(input.value);
    if (!(hours > 0)) {
      showToast('Type hours like 1.5 or 1:30');
      setTimeout(render);
      return false;
    }
    const end = Math.min(x.start + Math.round(hours * 60) * 60000, hi);
    if (end < x.start + hours * 3600000) showToast(`Stopped at ${clock(end)}, where the next block starts.`);
    Object.assign(x, { end, minutes: Math.round((end - x.start) / 60000) });
    setTimeout(render);
    return true;
  }
  // entryStart / entryEnd
  if (!input.value) return false;
  let start = field === 'entryStart' ? atTime(x.date, input.value) : x.start;
  let end = field === 'entryEnd' ? atTime(x.date, input.value) : x.end;
  if (end <= start) {
    showToast('The end time has to be after the start.');
    return false;
  }
  if (start < lo || end > hi) {
    start = Math.max(start, lo);
    end = Math.min(end, hi);
    showToast('Trimmed so it doesn’t overlap the blocks next to it.');
    if (end <= start) return false;
  }
  Object.assign(x, { start, end, minutes: Math.round((end - start) / 60000) });
  return true;
}

// A file with a projects list is a OneNote seed and gets merged in. Anything else is treated
// as a full backup and replaces what's here, after asking.
function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch {
      window.alert(`Could not read ${file.name}: it isn't valid JSON.`);
      return;
    }
    if (Array.isArray(data?.projects)) {
      const n = S.mergeSeed(state, data);
      S.saveNow(state);
      showToast(`Imported ${plural(n, 'project')} from ${file.name}`);
    } else if (data && typeof data.projects === 'object') {
      if (!window.confirm(`Replace everything in this app with the backup from ${file.name}?`)) return;
      state = S.migrate(data);
      S.closePastWeeks(state);
      S.saveNow(state);
      applyTheme();
      showToast('Backup restored');
    } else {
      window.alert(`${file.name} doesn't look like a Project Log backup or project list.`);
      return;
    }
    render();
  };
  reader.readAsText(file);
}

window.addEventListener('hashchange', () => {
  const r = route();
  ui.pmMenu = false;
  ui.palette = null;
  if (r.name !== 'week') ui.viewWeek = null;
  if (r.name !== 'project') closeEdit();
  render();
  window.scrollTo(0, 0);
});

// The side panel and a browser tab can both be open. When the other one saves, take its data.
S.onOtherWindowSave(fresh => {
  state = fresh;
  applyTheme();
  render();
});
S.onSaveStatus = () => render();

// Last click or key press in the app, the timer guard's best guess for when work stopped.
let lastActivity = Date.now();
for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, () => { lastActivity = Date.now(); }, true);

// The clock on a running timer ticks every second without a full redraw. A jump of more than
// five minutes between ticks means the laptop was asleep; the timer guard asks about it.
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  if (state.timer && now - lastTick > 5 * 60000) {
    ui.sleep = { pid: state.timer.pid, from: Math.max(lastTick, state.timer.start), to: now };
    render();
  }
  lastTick = now;
  if (state.timer) document.querySelectorAll('[data-elapsed]').forEach(el => { el.textContent = elapsedText(); });
}, 1000);

// Once a minute: freeze a week that just ended, and refresh hours while a timer runs. Skipped
// while you're typing, dragging, or have a menu or dialog open, so nothing closes under you.
setInterval(() => {
  runAutoBackup();
  const closed = S.closePastWeeks(state);
  if (keepCurrentWeek() || closed) save();
  if (!closed && !state.timer) return;
  if (document.hidden || dragId || tlDrag || ui.modal || ui.pmMenu || ui.palette) return;
  if (document.activeElement?.matches('input, textarea, select')) return;
  render();
}, 60000);

window.addEventListener('pagehide', () => S.saveNow(state));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) S.saveNow(state);
});

// This week's list is only a preview copy of last week until something on it changes. Keep it
// as soon as the app is in use, so next week can look back at it even if the plan was never touched.
function keepCurrentWeek() {
  const cw = curWeek();
  if (state.weeks[cw] || !S.peekWeek(state, cw).entries.length) return false;
  S.ensureWeek(state, cw);
  return true;
}

const keptWeek = keepCurrentWeek();
if (S.closePastWeeks(state) || keptWeek) S.saveNow(state);
applyTheme();
render();
AutoBackup.load().then(runAutoBackup, err => console.warn('Automatic backup folder unavailable', err));
