// What every button does. A button with data-a="name" runs actions.name(button, event); the
// click handler in app.js then saves and redraws. Return false to skip that.

const weekEntries = key => S.ensureWeek(state, key).entries;
const itemById = id => state.items.find(i => i.id === id);

function addEntry(key, pid) {
  const entries = weekEntries(key);
  if (entries.some(e => e.pid === pid)) return;
  entries.push({ pid, hours: '', label: '', day: '', date: '' });
  if (proj(pid)?.status === 'archived') proj(pid).status = 'active';
}

function addJournal(pid) {
  const el = document.getElementById('jn-' + pid);
  const text = el ? el.value.trim() : '';
  if (!text) return;
  state.journal.push({ id: S.uid('j'), pid, date: S.today(), text });
  el.value = '';
}

// Sets a project's hours on one day (the timesheet's selected day unless given). Blocks are
// trimmed or stretched in place; when a block disappears in the process there's an undo.
function setDayHours(pid, hours, day = ui.tsDay) {
  const change = S.setDayMinutes(state, pid, day, Math.round(hours * 60));
  const left = state.time.filter(t => t.pid === pid && t.date === day).length;
  if (left < change.before.length) {
    const what = left ? `Trimmed ${pidLabel(pid)} to ${hours.toFixed(2)} h` : `Removed ${pidLabel(pid)}`;
    showToast(`${what} on ${fmtDay(day)}`, () => S.undoDayEdit(state, change));
  }
}

const timeEntry = id => state.time.find(x => x.id === id);

function openEdit(id) {
  const p = proj(id);
  ui.edit = id;
  ui.pmMenu = false;
  ui.draftError = '';
  ui.draft = { number: p.number, name: p.name, revit: p.revit, pm: p.pm, status: p.status, budget: p.budget || '' };
}

function closeEdit() {
  ui.edit = null;
  ui.draft = null;
  ui.pmMenu = false;
}

function focusLater(id) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.focus();
    if (typeof el.value === 'string' && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
  });
}

const actions = {
  fold: t => { ui.fold[t.dataset.id] = !ui.fold[t.dataset.id]; },
  compact: () => {
    state.settings.compact = !state.settings.compact;
    ui.fold = {};
  },

  weekNav: t => {
    const keys = weekKeys();
    const j = keys.indexOf(ui.viewWeek || curWeek()) + (+t.dataset.v < 0 ? 1 : -1);
    if (j >= 0 && j < keys.length) ui.viewWeek = keys[j] === curWeek() ? null : keys[j];
    window.scrollTo(0, 0);
  },
  weekNow: () => {
    ui.viewWeek = null;
    window.scrollTo(0, 0);
  },
  viewWeek: t => {
    ui.viewWeek = t.dataset.v;
    if (route().name !== 'week') location.hash = '#/week';
    window.scrollTo(0, 0);
  },
  openTs: t => {
    ui.tsOffset = Math.round(daysBetween(curWeek(), t.dataset.v) / 7);
    ui.tsDay = null;
    location.hash = '#/time';
  },
  group: t => {
    state.settings.group = t.dataset.v;
    if (t.dataset.v !== 'pm') state.settings.pm = 'all';
  },
  pmf: t => { state.settings.pm = t.dataset.v; },
  weekDone: t => {
    const key = ui.viewWeek || curWeek();
    const pid = t.dataset.id;
    const e = weekEntries(key).find(x => x.pid === pid);
    if (!e) return;
    e.done = !e.done;
    if (e.done) {
      showToast(`${proj(pid).number} is done for this week and moved to the bottom.`, () => {
        const again = weekEntries(key).find(x => x.pid === pid);
        if (again) again.done = false;
      });
    }
  },

  timer: t => {
    const wasRunning = !!state.timer;
    const logged = timerOn(t.dataset.id) ? S.stopTimer(state) : S.startTimer(state, t.dataset.id);
    if (wasRunning && !logged.length) showToast('That timer ran under a minute, so nothing was logged.');
  },
  stopTimer: () => {
    if (!S.stopTimer(state).length) showToast('That timer ran under a minute, so nothing was logged.');
  },

  toggleItem: t => {
    const it = itemById(t.dataset.id);
    if (!it) return;
    it.done = !it.done;
    it.doneAt = it.done ? S.today() : '';
  },
  editItem: t => {
    ui.editItem = t.dataset.id;
    focusLater('edit-' + t.dataset.id);
  },
  indent: t => {
    const it = itemById(t.dataset.id);
    if (it) it.level = S.clampLevel(it.level + 1);
  },
  outdent: t => {
    const it = itemById(t.dataset.id);
    if (it) it.level = S.clampLevel(it.level - 1);
  },
  kind: t => {
    const it = itemById(t.dataset.id);
    if (!it) return;
    it.kind = it.kind === 'task' ? 'note' : 'task';
    it.done = false;
  },
  delItem: t => {
    const deleted = S.deleteItem(state, t.dataset.id);
    if (!deleted) return;
    const [first, ...under] = deleted.block;
    const extra = under.length ? ` and ${plural(under.length, 'sub-item')}` : '';
    showToast(`Deleted “${first.text.slice(0, 40)}”${extra}`, () => S.restoreItems(state, deleted));
  },
  showDone: t => { ui.showDone[t.dataset.id] = !ui.showDone[t.dataset.id]; },

  seedWeek: () => {
    const key = route().name === 'plan' ? planKey() : curWeek();
    for (const n of state.seedInfo.lastOneNoteWeek.numbers) if (proj('p_' + n)) addEntry(key, 'p_' + n);
    state.seedInfo.weekSeeded = true;
    if (route().name !== 'plan') location.hash = '#/plan';
  },
  planWeek: t => { ui.planOffset = +t.dataset.v; },
  addEntry: t => {
    addEntry(planKey(), t.dataset.id);
    ui.planQ = '';
    focusLater('h-' + t.dataset.id);
  },
  removeEntry: t => {
    const key = planKey();
    const entries = weekEntries(key);
    const i = entries.findIndex(e => e.pid === t.dataset.id);
    if (i === -1) return;
    const [removed] = entries.splice(i, 1);
    showToast(`${proj(removed.pid).number} removed from the week. Tasks and notes are kept.`, () => {
      const now = weekEntries(key);
      if (!now.some(e => e.pid === removed.pid)) now.splice(Math.min(i, now.length), 0, removed);
    });
  },
  day: t => {
    const e = weekEntries(planKey()).find(x => x.pid === t.dataset.id);
    if (!e) return;
    e.day = e.day === t.dataset.v ? '' : t.dataset.v;
    e.date = '';
  },
  addEntryHere: t => addEntry(curWeek(), t.dataset.id),
  removeEntryHere: t => {
    const entries = weekEntries(curWeek());
    const i = entries.findIndex(e => e.pid === t.dataset.id);
    if (i !== -1) entries.splice(i, 1);
  },

  editProject: t => {
    const id = t.dataset.id;
    openEdit(id);
    const r = route();
    if (r.name !== 'project' || r.id !== id) location.hash = projectHref(id);
    focusLater('ed-revit');
  },
  pmMenu: () => { ui.pmMenu = !ui.pmMenu; },
  pickPm: t => {
    ui.draft.pm = t.dataset.v;
    ui.pmMenu = false;
  },
  draftStatus: t => { ui.draft.status = t.dataset.v; },
  cancelEdit: closeEdit,
  saveEdit: t => {
    const p = proj(t.dataset.id);
    const d = ui.draft;
    const num = String(d.number || '').trim();
    if (!num) {
      ui.draftError = 'Number is required';
      return;
    }
    if (Object.values(state.projects).some(x => x.id !== p.id && x.number === num)) {
      ui.draftError = 'Another project already uses ' + num;
      return;
    }
    const budget = String(d.budget || '').trim() ? parseHours(d.budget) : 0;
    if (Number.isNaN(budget)) {
      ui.draftError = 'Budget should be a number of hours';
      return;
    }
    Object.assign(p, {
      number: num,
      name: String(d.name || '').trim() || p.name,
      revit: String(d.revit || '').trim(),
      pm: d.pm,
      status: d.status,
      budget: budget || ''
    });
    closeEdit();
  },
  deleteProject: t => {
    const p = proj(t.dataset.id);
    if (!window.confirm(`Delete ${p.number} ${p.name}? Its tasks, notes and logged time are removed too.`)) return false;
    delete state.projects[p.id];
    state.items = state.items.filter(i => i.pid !== p.id);
    state.journal = state.journal.filter(j => j.pid !== p.id);
    state.time = state.time.filter(x => x.pid !== p.id);
    for (const w of Object.values(state.weeks)) w.entries = w.entries.filter(e => e.pid !== p.id);
    if (timerOn(p.id)) state.timer = null;
    closeEdit();
    location.hash = '#/projects';
  },
  addJournal: t => addJournal(t.dataset.id),
  delJournal: t => {
    const i = state.journal.findIndex(j => j.id === t.dataset.id);
    if (i === -1) return;
    const [removed] = state.journal.splice(i, 1);
    showToast('Journal note deleted', () => state.journal.push(removed));
  },

  projView: t => {
    ui.projView = t.dataset.v;
    ui.projAll = false;
  },
  projPm: t => {
    ui.projPm = t.dataset.v;
    ui.projAll = false;
  },
  projSort: t => { ui.projSort = t.dataset.v; },
  projAll: () => { ui.projAll = true; },

  newProject: t => {
    const v = (t.dataset.v || '').trim();
    const isNumber = /^\d[\d.]*$/.test(v);
    ui.modal = {
      draft: { number: isNumber ? v : '', name: isNumber ? '' : v, revit: '', pm: '', week: route().name === 'plan' },
      error: ''
    };
    focusLater(isNumber ? 'np-name' : 'np-number');
  },
  closeModal: () => { ui.modal = null; },
  modalBg: (t, e) => {
    if (e.target !== t) return false;
    ui.modal = null;
  },
  createProject: () => {
    const d = ui.modal.draft;
    const num = String(d.number || '').trim();
    const name = String(d.name || '').trim();
    if (!num || !name) {
      ui.modal.error = 'Number and name are both needed';
      return;
    }
    if (Object.values(state.projects).some(p => p.number === num)) {
      ui.modal.error = num + ' already exists. Search for it instead.';
      return;
    }
    let id = 'p_' + num.replace(/[^\w.]/g, '_');
    if (state.projects[id]) id = S.uid('p_');
    state.projects[id] = {
      id, number: num, name, revit: String(d.revit || '').trim(), pm: d.pm || '',
      status: 'active', notes: '', firstSeen: '', lastSeen: '', created: S.today()
    };
    if (d.week) addEntry(planKey(), id);
    ui.modal = null;
    ui.planQ = '';
    if (route().name === 'projects') location.hash = projectHref(id);
  },

  tsWeek: t => {
    ui.tsOffset += +t.dataset.v;
    ui.tsDay = null;
    ui.tsOpen = {};
    ui.tsSel = null;
  },
  tsThisWeek: () => {
    ui.tsOffset = 0;
    ui.tsDay = null;
    ui.tsOpen = {};
    ui.tsSel = null;
  },
  tsDay: t => {
    ui.tsDay = t.dataset.v;
    ui.tsOpen = {};
    ui.tsSel = null;
  },
  tsOpen: t => { ui.tsOpen[t.dataset.id] = !ui.tsOpen[t.dataset.id]; },
  tsStep: t => {
    const now = S.roundQ(S.minutesFor(state, t.dataset.id, ui.tsDay, ui.tsDay) / 60);
    setDayHours(t.dataset.id, Math.max(0, now + 0.25 * +t.dataset.v));
  },
  roundDay: () => {
    const changes = S.roundDay(state, ui.tsDay);
    if (!changes.length) return;
    showToast(`Rounded ${plural(changes.length, 'project')} to quarter hours`, () => {
      changes.slice().reverse().forEach(c => S.undoDayEdit(state, c));
    });
  },
  delTime: t => {
    const i = state.time.findIndex(x => x.id === t.dataset.id);
    if (i === -1) return;
    const [removed] = state.time.splice(i, 1);
    showToast('Time entry deleted', () => state.time.push(removed));
  },
  addTime: () => {
    const typed = document.getElementById('ts-proj').value.trim();
    const hours = parseHours(document.getElementById('ts-hours').value);
    const note = document.getElementById('ts-note').value.trim();
    const number = typed.split(/\s+/)[0];
    const pid = /^overhead/i.test(typed) ? 'OH' : Object.values(state.projects).find(p => p.number === number)?.id;
    ui.tsError = '';
    if (!pid) {
      ui.tsError = 'Pick a project from the list (or type Overhead)';
      return;
    }
    if (!(hours > 0)) {
      ui.tsError = 'Enter hours, e.g. 1.5 or 1:30';
      return;
    }
    S.addTime(state, pid, ui.tsDay, hours * 60, note);
  },
  copyDay: t => {
    const text = t.dataset.v;
    const fallback = () => window.prompt('Copy this:', text);
    if (!navigator.clipboard) {
      fallback();
      return false;
    }
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied. Paste into Adjera.');
      render();
    }, fallback);
    return false;
  },
  entered: t => {
    const d = t.dataset.v;
    if (state.adjera[d]) delete state.adjera[d];
    else state.adjera[d] = new Date().toISOString();
  },

  openPm: t => { ui.openPerson = ui.openPerson === t.dataset.id ? null : t.dataset.id; },
  pmColor: t => {
    const p = person(t.dataset.id);
    if (p && S.COLORS.includes(t.dataset.v)) p.color = t.dataset.v;
  },
  archivePm: t => {
    const p = person(t.dataset.id);
    if (!p) return;
    p.archived = true;
    ui.openPerson = null;
  },
  restorePm: t => {
    const p = person(t.dataset.id);
    if (p) p.archived = false;
  },
  addPm: () => {
    const p = addPerson(ui.newPm);
    if (!p) return;
    ui.newPm = '';
    ui.openPerson = p.id;
  },
  delVer: t => { state.settings.revitVersions = state.settings.revitVersions.filter(v => v !== t.dataset.v); },
  addVer: () => {
    const v = ui.newVer.trim().toUpperCase();
    if (v && !state.settings.revitVersions.includes(v)) state.settings.revitVersions.unshift(v);
    ui.newVer = '';
  },
  theme: t => {
    state.settings.theme = t.dataset.v;
    applyTheme();
  },

  export: () => {
    state.settings.lastBackup = new Date().toISOString();
    S.saveNow(state);
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `project-log-backup-${S.today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast('Backup downloaded. Keep it in a OneDrive folder.');
  },
  reset: () => {
    if (!window.confirm('Erase everything in this app on this browser? Download a backup first if you want to keep your data.')) return false;
    state = S.fromSeed(window.SEED || {});
    closeEdit();
    location.hash = '#/week';
  },
  undo: () => {
    ui.toast?.undo?.();
    ui.toast = null;
  },
  closeToast: () => { ui.toast = null; },

  tsView: t => {
    ui.tsView = t.dataset.v;
    ui.tsSel = null;
  },
  tlPick: t => { ui.tsSel = t.dataset.id ? { id: t.dataset.id } : { gap: t.dataset.v }; },
  tlCancel: () => { ui.tsSel = null; },
  tlAssign: t => {
    const day = ui.tsDay;
    const key = t.dataset.v;
    const [from, to] = key.split('-').map(Number);
    const skips = state.gapSkips[day] || [];
    if (t.dataset.id === 'skip') state.gapSkips[day] = [...skips, key];
    else if (t.dataset.id === 'unskip') state.gapSkips[day] = skips.filter(k => k !== key);
    else S.fillGap(state, t.dataset.id, day, from, to);
    ui.tsSel = null;
  },
  tlSnap: () => {
    const before = S.snapDay(state, ui.tsDay);
    if (before.length) showToast(`Moved ${plural(before.length, 'block')} to quarter hours`, () => S.unsnapDay(state, before));
  },

  openReview: t => {
    ui.reviewWeek = t.dataset.v || null;
    ui.reviewDay = null;
    location.hash = '#/review';
  },
  reviewWeek: t => {
    ui.reviewWeek = S.iso(S.addDays(S.parseISO(ui.reviewWeek || lastWeekKey()), 7 * +t.dataset.v));
    ui.reviewDay = null;
  },
  reviewDay: t => { ui.reviewDay = t.dataset.v; },
  reviewFill: t => {
    const pid = t.dataset.id;
    setDayHours(pid, roundedHours(pid, ui.reviewDay) + parseFloat(t.dataset.v), ui.reviewDay);
  },
  reviewNext: t => {
    state.adjera[t.dataset.v] = new Date().toISOString();
    ui.reviewDay = null;
  },

  pmUpdate: t => {
    ui.updatePm = t.dataset.id;
    ui.updateWeek = null;
    location.hash = '#/update';
  },
  updPm: t => { ui.updatePm = t.dataset.id; },
  updWeek: t => {
    const wk = S.iso(S.addDays(S.parseISO(ui.updateWeek || curWeek()), 7 * +t.dataset.v));
    ui.updateWeek = wk >= curWeek() ? null : wk;
  },
  updToggle: t => {
    const k = t.dataset.v;
    state.settings[k] = !state.settings[k];
    delete ui.updateText[updateKey()];
  },
  updReset: () => { delete ui.updateText[updateKey()]; },
  updCopy: t => {
    const text = document.getElementById('updtext').value;
    navigator.clipboard.writeText(text).then(() => {
      markUpdateSent(t.dataset.id);
      showToast('Copied. Paste it into Teams.');
      save();
      render();
    });
    return false;
  },
  updMail: t => {
    const pm = person(t.dataset.id);
    const text = document.getElementById('updtext').value;
    const subject = `Update: week of ${fmtRange(ui.updateWeek || curWeek())}`;
    markUpdateSent(pm.id);
    location.href = `mailto:${encodeURIComponent(pm.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  },

  healthVer: t => { ui.healthOpen = ui.healthOpen === t.dataset.v ? null : t.dataset.v; },

  palOpen: () => {
    ui.palette = { q: '', sel: 0 };
    focusLater('palq');
  },
  palClose: (t, e) => {
    if (e.target !== t) return false;
    ui.palette = null;
  },
  palRun: t => runPaletteItem(+t.dataset.v),

  guardSleepRemove: () => {
    const { pid, from, to } = ui.sleep;
    ui.sleep = null;
    if (!timerOn(pid)) return;
    S.stopTimer(state, from);
    state.timer = { pid, start: to };
  },
  guardSleepKeep: () => { ui.sleep = null; },
  guardLongKeep: () => { state.timer.askedLong = true; },
  guardEndKeep: () => { state.timer.askedEnd = true; },
  guardStopNow: () => { S.stopTimer(state); },
  guardStopAt: () => {
    const value = document.getElementById('guard-at').value;
    if (!value) return false;
    // The time is on the day the timer started, or today if that would be before it started.
    let at = atTime(S.iso(new Date(state.timer.start)), value);
    if (at <= state.timer.start) at = atTime(S.today(), value);
    if (at <= state.timer.start || at > Date.now()) {
      showToast('Pick a time between when the timer started and now.');
      return;
    }
    S.stopTimer(state, at);
    showToast(`Timer stopped at ${clock(at)}.`);
  },

  autoChoose: () => {
    AutoBackup.choose()
      .then(() => {
        state.settings.lastAutoBackup = '';
        return runAutoBackup();
      })
      .catch(err => { if (err.name !== 'AbortError') showToast(`Could not use that folder: ${err.message}`); })
      .finally(render);
    return false;
  },
  autoNow: () => {
    const go = AutoBackup.status === 'ready' ? Promise.resolve(true) : AutoBackup.allow();
    go.then(ok => {
      if (!ok) return render();
      state.settings.lastAutoBackup = '';
      return runAutoBackup().then(() => showToast(`Backed up to ${AutoBackup.folderName}.`));
    }).finally(render);
    return false;
  },
  autoOff: () => {
    AutoBackup.forget().finally(render);
    return false;
  }
};

const updateKey = () => {
  const wk = ui.updateWeek || curWeek();
  const pm = updatePeople(wk).find(p => p.id === ui.updatePm) || updatePeople(wk)[0];
  return pm ? `${wk}|${pm.id}` : '';
};

function markUpdateSent(pmId) {
  const wk = ui.updateWeek || curWeek();
  state.updatesSent[wk] = { ...state.updatesSent[wk], [pmId]: new Date().toISOString() };
}

function runPaletteItem(i) {
  const item = paletteItems[i];
  ui.palette = null;
  if (item) item.run();
}
