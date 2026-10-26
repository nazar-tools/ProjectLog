// Project Log data and date helpers. Everything lives in this browser's localStorage under KEY.
(() => {
  'use strict';

  const KEY = 'projectlog.v1';
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const PALETTE = [['red', 'Red'], ['orange', 'Orange'], ['amber', 'Amber'], ['green', 'Green'], ['teal', 'Teal'],
    ['blue', 'Blue'], ['indigo', 'Indigo'], ['purple', 'Purple'], ['pink', 'Pink'], ['gray', 'Gray']];
  const COLORS = PALETTE.map(c => c[0]);
  const MAX_LEVEL = 4;
  const DEFAULT_SETTINGS = {
    revitVersions: ['RVT27', 'RVT26', 'RVT25', 'RVT24'],
    overheadCode: '', capacity: 40, group: 'deadline', pm: 'all', compact: false, theme: 'auto', lastBackup: null
  };

  const uid = (prefix = 'x') => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const clampLevel = n => Math.max(0, Math.min(MAX_LEVEL, n));

  function parseISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  // Built from y/m/d so daylight saving changes never shift the date.
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7));
  const weekKey = (d = new Date()) => iso(mondayOf(d));

  function weekRange(key) {
    const start = parseISO(key);
    return { start, end: addDays(start, 6), startIso: key, endIso: iso(addDays(start, 6)) };
  }

  const personId = name => 'pm_' + name.toLowerCase();
  const seedPerson = p => ({ id: personId(p.name), name: p.name, color: COLORS.includes(p.colour) ? p.colour : 'gray', archived: !!p.archived });
  const seedProject = (p, pm) => ({
    id: 'p_' + p.number, number: p.number, name: p.name, revit: p.revit || '', pm,
    status: 'active', notes: '', firstSeen: p.firstSeen || '', lastSeen: p.lastSeen || '', created: today()
  });
  function seedInfo(seed, weekSeeded) {
    return {
      source: seed.source || '', importedOn: seed.importedOn || today(), count: (seed.projects || []).length,
      flags: seed.flags || {}, needsReview: seed.needsReview || [], lastOneNoteWeek: seed.lastOneNoteWeek || null,
      weekSeeded
    };
  }

  function fromSeed(seed) {
    const s = {
      v: 1, created: new Date().toISOString(),
      people: (seed.people || []).map(seedPerson),
      projects: {}, items: [], journal: [], weeks: {}, time: [], timer: null, adjera: {}, scratch: '',
      settings: { ...DEFAULT_SETTINGS, revitVersions: (seed.revitVersions || DEFAULT_SETTINGS.revitVersions).slice() },
      seedInfo: seedInfo(seed, false)
    };
    for (const p of seed.projects || []) s.projects['p_' + p.number] = seedProject(p, p.pm ? personId(p.pm) : '');
    return s;
  }

  // Merges a OneNote seed into existing data. Only fills blanks, never overwrites your edits.
  function mergeSeed(s, seed) {
    for (const p of seed.people || []) {
      if (!s.people.some(x => x.name.toLowerCase() === p.name.toLowerCase())) s.people.push(seedPerson(p));
    }
    const pmByName = n => s.people.find(p => p.name.toLowerCase() === String(n || '').toLowerCase())?.id || '';
    let added = 0;
    for (const p of seed.projects || []) {
      const existing = Object.values(s.projects).find(x => x.number === p.number);
      if (existing) {
        if (!existing.revit && p.revit) existing.revit = p.revit;
        if (!existing.pm && p.pm) existing.pm = pmByName(p.pm);
        if (!existing.lastSeen) { existing.lastSeen = p.lastSeen || ''; existing.firstSeen = p.firstSeen || ''; }
        continue;
      }
      s.projects['p_' + p.number] = seedProject(p, pmByName(p.pm));
      added++;
    }
    for (const v of seed.revitVersions || []) if (!s.settings.revitVersions.includes(v)) s.settings.revitVersions.push(v);
    s.seedInfo = seedInfo(seed, !!s.seedInfo?.weekSeeded);
    return added;
  }

  // Fills in anything an older version or a hand-edited backup left out.
  function migrate(s) {
    s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
    for (const k of ['people', 'items', 'journal', 'time']) if (!Array.isArray(s[k])) s[k] = [];
    for (const k of ['projects', 'weeks', 'adjera']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
    s.seedInfo = s.seedInfo || { flags: {}, needsReview: [] };
    // Colours end up inside style attributes, so only palette names are allowed through.
    for (const p of s.people) if (!COLORS.includes(p.color)) p.color = 'gray';
    return s;
  }

  // Saving. lastSaved is the JSON this window last wrote or read, so a window that hasn't
  // changed anything never writes, and can't overwrite newer data from another window.
  let lastSaved = null;
  let pending = null;
  let saveError = null;

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch (e) {
      saveError = e;
    }
    if (raw) {
      try {
        const s = migrate(JSON.parse(raw));
        lastSaved = JSON.stringify(s);
        return s;
      } catch (e) {
        // Park the unreadable copy so the next save can't destroy it.
        localStorage.setItem(KEY + '.unreadable', raw);
        console.error(`Saved data could not be read. A copy was kept under ${KEY}.unreadable`, e);
      }
    }
    return fromSeed(window.SEED || {});
  }

  function save(s) {
    clearTimeout(pending);
    pending = setTimeout(() => saveNow(s), 150);
  }

  function saveNow(s) {
    clearTimeout(pending);
    pending = null;
    const json = JSON.stringify(s);
    if (json === lastSaved) return;
    const failedBefore = !!saveError;
    try {
      localStorage.setItem(KEY, json);
      lastSaved = json;
      saveError = null;
    } catch (e) {
      // Usually storage is full or blocked by browser settings. The app shows a banner.
      saveError = e;
    }
    if (failedBefore !== !!saveError) Store.onSaveStatus?.(saveError);
  }

  // Another window of the app (the side panel and a browser tab, say) saved. Hand its data
  // to the app, unless this window has its own change still waiting to be written.
  function onOtherWindowSave(callback) {
    window.addEventListener('storage', e => {
      if (e.key !== KEY || e.newValue == null || pending) return;
      const s = migrate(JSON.parse(e.newValue));
      lastSaved = JSON.stringify(s);
      callback(s);
    });
  }

  // A week nobody has touched yet starts as a copy of the latest earlier week: same projects
  // and hours, deadlines and done cleared. peekWeek only shows that copy; ensureWeek stores it.
  function peekWeek(s, key) {
    if (s.weeks[key]) return s.weeks[key];
    const prev = Object.keys(s.weeks).filter(k => k < key).sort().pop();
    const entries = !prev ? [] : s.weeks[prev].entries
      .filter(e => s.projects[e.pid] && s.projects[e.pid].status !== 'archived')
      .map(e => ({ pid: e.pid, hours: e.hours, label: '', day: '', date: '' }));
    return { entries, copiedFrom: prev || null };
  }

  function ensureWeek(s, key) {
    if (!s.weeks[key]) s.weeks[key] = { ...peekWeek(s, key), created: new Date().toISOString() };
    return s.weeks[key];
  }

  const inWeek = (s, key, pid) => peekWeek(s, key).entries.some(e => e.pid === pid);

  function deadlineDate(key, e) {
    if (DAYS.includes(e.day)) return iso(addDays(parseISO(key), DAYS.indexOf(e.day)));
    return e.date || '';
  }

  // Tasks and notes as they stood at the end of a week.
  function itemsAsOf(s, pid, key) {
    const { startIso, endIso } = weekRange(key);
    return itemsFor(s, pid)
      .filter(i => (i.created || '') <= endIso && !(i.done && i.doneAt && i.doneAt < startIso))
      .map(i => ({
        text: i.text, kind: i.kind, level: i.level, doneAt: i.doneAt || '',
        done: !!(i.done && (!i.doneAt || i.doneAt <= endIso))
      }));
  }

  // Freezes each finished week's tasks so later edits and deletes don't rewrite what that
  // week looked like. Runs when the app opens; weeks from before v1.4 get frozen as they are now.
  function closePastWeeks(s) {
    const current = weekKey();
    let closed = 0;
    for (const [key, w] of Object.entries(s.weeks)) {
      if (key >= current || w.closed) continue;
      const { startIso, endIso } = weekRange(key);
      const pids = new Set(w.entries.map(e => e.pid));
      for (const t of s.time) if (t.pid !== 'OH' && t.date >= startIso && t.date <= endIso) pids.add(t.pid);
      const items = {};
      for (const pid of pids) items[pid] = itemsAsOf(s, pid, key);
      w.closed = { on: today(), items };
      closed++;
    }
    return closed;
  }

  const itemsFor = (s, pid) => s.items.filter(i => i.pid === pid);

  // A leading "-" makes it a note instead of a task.
  function addItem(s, pid, text, level) {
    let t = text.trim();
    let kind = 'task';
    if (/^[-–—]\s*/.test(t)) {
      kind = 'note';
      t = t.replace(/^[-–—]\s*/, '');
    }
    if (!t) return null;
    const it = { id: uid('i'), pid, text: t, kind, level: clampLevel(level || 0), done: false, doneAt: '', created: today() };
    const last = s.items.map(x => x.pid).lastIndexOf(pid);
    s.items.splice(last === -1 ? s.items.length : last + 1, 0, it);
    return it;
  }

  // An item plus the deeper-indented items right under it.
  function subtree(list, it) {
    const i = list.indexOf(it);
    let j = i + 1;
    while (j < list.length && list[j].level > it.level) j++;
    return list.slice(i, j);
  }

  // Moves an item (with its sub-items) next to another item of the same project.
  // The moved block takes the level of the item it lands next to.
  function moveItem(s, dragId, targetId, after) {
    const d = s.items.find(i => i.id === dragId);
    const t = s.items.find(i => i.id === targetId);
    if (!d || !t || d === t || d.pid !== t.pid) return false;
    const list = itemsFor(s, d.pid);
    const block = subtree(list, d);
    if (block.includes(t)) return false;
    const rest = list.filter(x => !block.includes(x));
    let at = rest.indexOf(t);
    if (after) at += subtree(rest, t).length;
    const delta = t.level - d.level;
    for (const x of block) x.level = clampLevel(x.level + delta);
    rest.splice(at, 0, ...block);
    let k = 0;
    s.items = s.items.map(x => (x.pid === d.pid ? rest[k++] : x));
    return true;
  }

  // Alt+Up / Alt+Down: hop over the neighbouring item and its sub-items.
  function nudgeItem(s, id, dir) {
    const d = s.items.find(i => i.id === id);
    if (!d) return false;
    const list = itemsFor(s, d.pid);
    const i = list.indexOf(d);
    if (dir < 0) {
      let p = i - 1;
      while (p >= 0 && list[p].level > d.level) p--;
      return p >= 0 && moveItem(s, id, list[p].id, false);
    }
    const j = i + subtree(list, d).length;
    return j < list.length && moveItem(s, id, list[j].id, true);
  }

  // Deletes an item with its sub-items and returns what restoreItems needs to undo it.
  function deleteItem(s, id) {
    const it = s.items.find(i => i.id === id);
    if (!it) return null;
    const list = itemsFor(s, it.pid);
    const block = subtree(list, it);
    const anchor = list[list.indexOf(it) - 1];
    s.items = s.items.filter(x => !block.includes(x));
    return { block, anchorId: anchor ? anchor.id : null, pid: it.pid };
  }

  // Puts deleted items back after the item that was above them, wherever that is now.
  function restoreItems(s, { block, anchorId, pid }) {
    let at = s.items.findIndex(x => x.id === anchorId);
    if (at !== -1) at++;
    else at = s.items.findIndex(x => x.pid === pid);
    if (at === -1) at = s.items.length;
    s.items.splice(at, 0, ...block);
  }

  function minutesFor(s, pid, fromIso, toIso) {
    let total = 0;
    for (const t of s.time) if ((pid === null || t.pid === pid) && t.date >= fromIso && t.date <= toIso) total += t.minutes;
    return total;
  }

  function startTimer(s, pid) {
    const logged = stopTimer(s);
    s.timer = { pid, start: Date.now() };
    return logged;
  }

  // Logs the running timer and returns the entries it made. A timer that runs past midnight
  // is split so each day gets its own share; anything under a minute is dropped.
  function stopTimer(s) {
    if (!s.timer) return [];
    const { pid, start } = s.timer;
    const end = Date.now();
    s.timer = null;
    const logged = [];
    for (let from = start; from < end;) {
      const day = new Date(from);
      const to = Math.min(end, addDays(day, 1).getTime());
      const minutes = Math.round((to - from) / 60000);
      if (minutes >= 1) {
        const entry = { id: uid('t'), pid, date: iso(day), start: from, end: to, minutes, note: '', src: 'timer' };
        s.time.push(entry);
        logged.push(entry);
      }
      from = to;
    }
    return logged;
  }

  // Adjera takes quarter hours.
  const roundQ = hours => Math.round(hours * 4) / 4;

  const Store = {
    KEY, DAYS, PALETTE, COLORS, MAX_LEVEL,
    uid, iso, parseISO, addDays, mondayOf, weekKey, weekRange, today, clampLevel,
    load, save, saveNow, fromSeed, mergeSeed, migrate, onOtherWindowSave,
    saveError: () => saveError, onSaveStatus: null,
    peekWeek, ensureWeek, inWeek, deadlineDate, itemsAsOf, closePastWeeks,
    itemsFor, addItem, subtree, moveItem, nudgeItem, deleteItem, restoreItems,
    minutesFor, startTimer, stopTimer, roundQ
  };
  window.Store = Store;
})();
