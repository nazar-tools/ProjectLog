// Routing, the page frame, and wiring events to actions. Loads last (see index.html).

function route() {
  const [name, id] = location.hash.replace(/^#\/?/, '').split('/');
  if (name === 'p' && id) return { name: 'project', id: decodeURIComponent(id) };
  if (['week', 'plan', 'projects', 'time', 'settings'].includes(name)) return { name };
  return { name: 'week' };
}

const VIEWS = {
  week: viewWeek, plan: viewPlan, projects: viewProjects, time: viewTime, settings: viewSettings,
  project: r => viewProject(r.id)
};

const NAV = [
  ['week', 'This week', 'week', 'This week'],
  ['plan', 'Plan week', 'plan', 'Plan'],
  ['projects', 'Projects', 'folder', 'Projects'],
  ['time', 'Timesheet', 'clock', 'Time'],
  ['settings', 'Settings', 'sliders']
];

function shell(content, r) {
  const active = r.name === 'project' ? 'projects' : r.name;
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
        <div class="side-foot">
          <span class="lbl">Backup</span>
          <span class="sub">${lastBackup ? 'Last backup ' + fmtShort(lastBackup.slice(0, 10)) : 'Not backed up yet'}</span>
          <button class="btn sm" data-a="export">${ic('download', 's')}Back up now</button>
        </div>
      </aside>
      <main class="main" id="main">${saveBanner()}${content}</main>
      <nav class="tabbar" aria-label="Main">${tabs}</nav>
    </div>
    ${toast}
    ${ui.modal ? newProjectModal() : ''}`;
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
function render() {
  const a = document.activeElement;
  const focus = a?.id ? { id: a.id, start: a.selectionStart, end: a.selectionEnd } : null;
  const r = route();
  document.getElementById('root').innerHTML = shell(VIEWS[r.name](r), r);
  if (!focus) return;
  const el = document.getElementById(focus.id);
  if (!el) return;
  el.focus({ preventScroll: true });
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
  if (!fn) return;
  if (t.tagName === 'A') e.preventDefault();
  if (fn(t, e) === false) return;
  save();
  render();
});

document.addEventListener('keydown', e => {
  const t = e.target;
  if (e.key === 'Escape' && ui.modal) {
    ui.modal = null;
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

  if (t.id === 'planq' && e.key === 'Enter') {
    e.preventDefault();
    const first = document.querySelector('.results [data-a="addEntry"]');
    if (first) first.click();
    return;
  }

  const k = t.dataset?.k;
  const pid = t.dataset?.id;
  if (k === 'add') {
    if (e.key === 'Tab') {
      e.preventDefault();
      ui.addLevel[pid] = S.clampLevel((ui.addLevel[pid] || 0) + (e.shiftKey ? -1 : 1));
      // The redraw rebuilds this box, so carry over what's been typed so far.
      const typed = t.value;
      render();
      document.getElementById(t.id).value = typed;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (S.addItem(state, pid, t.value, ui.addLevel[pid] || 0)) {
        t.value = '';
        save();
        render();
      }
    } else if (e.key === 'Escape') {
      t.value = '';
      ui.addLevel[pid] = 0;
      render();
    }
  } else if (k === 'editItem') {
    const it = itemById(pid);
    if (!it) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(t);
    } else if (e.key === 'Escape') {
      ui.editItem = null;
      render();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      it.text = t.value.trim() || it.text;
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

function commitEdit(input) {
  const it = itemById(input.dataset.id);
  const text = input.value.trim();
  if (it && text) it.text = text;
  ui.editItem = null;
  save();
  render();
}

// Leaving an item's edit box saves it. The delay lets a click on another item land first.
document.addEventListener('focusout', e => {
  const t = e.target;
  if (t.dataset?.k !== 'editItem' || ui.editItem !== t.dataset.id) return;
  setTimeout(() => {
    if (ui.editItem === t.dataset.id) commitEdit(t);
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
    case 'import':
      if (t.files[0]) importFile(t.files[0]);
      return;
    default:
      return;
  }
  save();
});

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

// The clock on a running timer ticks every second without a full redraw.
setInterval(() => {
  if (state.timer) document.querySelectorAll('[data-elapsed]').forEach(el => { el.textContent = elapsedText(); });
}, 1000);

// Once a minute: freeze a week that just ended, and refresh hours while a timer runs. Skipped
// while you're typing, dragging, or have a menu or dialog open, so nothing closes under you.
setInterval(() => {
  const closed = S.closePastWeeks(state);
  if (closed) save();
  if (!closed && !state.timer) return;
  if (document.hidden || dragId || ui.modal || ui.pmMenu) return;
  if (document.activeElement?.matches('input, textarea, select')) return;
  render();
}, 60000);

window.addEventListener('pagehide', () => S.saveNow(state));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) S.saveNow(state);
});

if (S.closePastWeeks(state)) S.saveNow(state);
applyTheme();
render();
