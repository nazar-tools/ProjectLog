/* Project Log — data store. Everything lives in this browser's localStorage. */
(function () {
  'use strict';
  var KEY = 'projectlog.v1';
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  var PALETTE = [['red', 'Red'], ['orange', 'Orange'], ['amber', 'Amber'], ['green', 'Green'], ['teal', 'Teal'],
    ['blue', 'Blue'], ['indigo', 'Indigo'], ['purple', 'Purple'], ['pink', 'Pink'], ['gray', 'Gray']];

  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) { var a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function mondayOf(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function weekKey(d) { return iso(mondayOf(d || new Date())); }
  function today() { return iso(new Date()); }

  function fromSeed(seed) {
    var s = {
      v: 1, created: new Date().toISOString(),
      people: [], projects: {}, items: [], journal: [], weeks: {}, time: [], timer: null, adjera: {}, scratch: '',
      settings: {
        revitVersions: (seed.revitVersions || ['RVT27', 'RVT26', 'RVT25', 'RVT24']).slice(),
        overheadCode: '', capacity: 40, group: 'deadline', pm: 'all', compact: false, theme: 'auto', lastBackup: null
      },
      seedInfo: {
        source: seed.source || '', importedOn: seed.importedOn || '', count: (seed.projects || []).length,
        flags: seed.flags || {}, needsReview: seed.needsReview || [], lastOneNoteWeek: seed.lastOneNoteWeek || null
      }
    };
    (seed.people || []).forEach(function (p) {
      s.people.push({ id: 'pm_' + p.name.toLowerCase(), name: p.name, color: p.colour || 'gray', archived: !!p.archived });
    });
    (seed.projects || []).forEach(function (p) {
      var id = 'p_' + p.number;
      s.projects[id] = {
        id: id, number: p.number, name: p.name, revit: p.revit || '', pm: p.pm ? 'pm_' + p.pm.toLowerCase() : '',
        status: 'active', notes: '', firstSeen: p.firstSeen || '', lastSeen: p.lastSeen || '', created: today()
      };
    });
    return s;
  }

  /* Merge a OneNote seed file into existing data (never overwrites what you've edited). */
  function mergeSeed(s, seed) {
    var added = 0;
    (seed.people || []).forEach(function (p) {
      if (!s.people.some(function (x) { return x.name.toLowerCase() === p.name.toLowerCase(); })) {
        s.people.push({ id: 'pm_' + p.name.toLowerCase(), name: p.name, color: p.colour || 'gray', archived: !!p.archived });
      }
    });
    var byName = function (n) { var x = s.people.find(function (p) { return p.name.toLowerCase() === String(n || '').toLowerCase(); }); return x ? x.id : ''; };
    (seed.projects || []).forEach(function (p) {
      var existing = Object.keys(s.projects).map(function (k) { return s.projects[k]; }).find(function (x) { return x.number === p.number; });
      if (existing) {
        if (!existing.revit && p.revit) existing.revit = p.revit;
        if (!existing.pm && p.pm) existing.pm = byName(p.pm);
        if (!existing.lastSeen) { existing.lastSeen = p.lastSeen || ''; existing.firstSeen = p.firstSeen || ''; }
        return;
      }
      var id = 'p_' + p.number;
      s.projects[id] = { id: id, number: p.number, name: p.name, revit: p.revit || '', pm: byName(p.pm), status: 'active', notes: '', firstSeen: p.firstSeen || '', lastSeen: p.lastSeen || '', created: today() };
      added++;
    });
    (seed.revitVersions || []).forEach(function (v) { if (s.settings.revitVersions.indexOf(v) === -1) s.settings.revitVersions.push(v); });
    s.seedInfo = {
      source: seed.source || '', importedOn: seed.importedOn || today(), count: (seed.projects || []).length,
      flags: seed.flags || {}, needsReview: seed.needsReview || [], lastOneNoteWeek: seed.lastOneNoteWeek || null,
      weekSeeded: s.seedInfo ? !!s.seedInfo.weekSeeded : false
    };
    return added;
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (raw) {
      try { return migrate(JSON.parse(raw)); } catch (e) { console.error('Could not read saved data', e); }
    }
    return fromSeed(window.SEED || {});
  }
  function migrate(s) {
    s.settings = Object.assign({ revitVersions: ['RVT27', 'RVT26', 'RVT25', 'RVT24'], overheadCode: '', capacity: 40, group: 'deadline', pm: 'all', compact: false, theme: 'auto', lastBackup: null }, s.settings || {});
    ['people', 'items', 'journal', 'time'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
    if (!s.projects) s.projects = {};
    if (!s.weeks) s.weeks = {};
    if (!s.adjera) s.adjera = {};
    if (!s.seedInfo) s.seedInfo = { flags: {}, needsReview: [] };
    return s;
  }
  var saveTimer = null, saveError = null;
  function save(s) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveNow(s); }, 150);
  }
  function saveNow(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); saveError = null; }
    catch (e) { saveError = e; console.error('Save failed', e); }
  }

  /* ---------- weeks ---------- */
  function ensureWeek(s, key) {
    if (s.weeks[key]) return s.weeks[key];
    var prev = Object.keys(s.weeks).filter(function (k) { return k < key; }).sort().pop();
    var entries = [];
    if (prev) {
      entries = s.weeks[prev].entries
        .filter(function (e) { return s.projects[e.pid] && s.projects[e.pid].status !== 'archived'; })
        .map(function (e) { return { pid: e.pid, hours: e.hours, label: '', day: '', date: '' }; });
    }
    s.weeks[key] = { entries: entries, created: new Date().toISOString(), copiedFrom: prev || null };
    return s.weeks[key];
  }
  function weekRange(key) {
    var start = parseISO(key);
    return { start: start, end: addDays(start, 6), startIso: key, endIso: iso(addDays(start, 6)) };
  }
  function inWeek(s, key, pid) {
    var w = s.weeks[key];
    return !!(w && w.entries.some(function (e) { return e.pid === pid; }));
  }
  function deadlineDate(weekKeyStr, e) {
    if (e.day && DAYS.indexOf(e.day) !== -1) return iso(addDays(parseISO(weekKeyStr), DAYS.indexOf(e.day)));
    if (e.date) return e.date;
    return '';
  }

  /* ---------- items (tasks & notes) ---------- */
  function itemsFor(s, pid) { return s.items.filter(function (i) { return i.pid === pid; }); }
  function addItem(s, pid, text, level) {
    var kind = 'task';
    var t = text.trim();
    if (/^[-–—]\s*/.test(t)) { kind = 'note'; t = t.replace(/^[-–—]\s*/, ''); }
    if (!t) return null;
    var it = { id: uid('i'), pid: pid, text: t, kind: kind, level: Math.max(0, Math.min(4, level || 0)), done: false, doneAt: '', created: today() };
    var idx = -1;
    s.items.forEach(function (x, i) { if (x.pid === pid) idx = i; });
    if (idx === -1) s.items.push(it); else s.items.splice(idx + 1, 0, it);
    return it;
  }

  /* ---------- time ---------- */
  function minutesFor(s, pid, fromIso, toIso) {
    return s.time.reduce(function (a, t) {
      return a + ((pid === null || t.pid === pid) && t.date >= fromIso && t.date <= toIso ? t.minutes : 0);
    }, 0);
  }
  function startTimer(s, pid) {
    stopTimer(s);
    s.timer = { pid: pid, start: Date.now() };
  }
  function stopTimer(s) {
    if (!s.timer) return null;
    var mins = Math.round((Date.now() - s.timer.start) / 60000);
    var entry = null;
    if (mins >= 1) {
      var d = new Date(s.timer.start);
      entry = { id: uid('t'), pid: s.timer.pid, date: iso(d), start: s.timer.start, end: Date.now(), minutes: mins, note: '', src: 'timer' };
      s.time.push(entry);
    }
    s.timer = null;
    return entry;
  }
  function roundQ(hours) { return Math.round(hours * 4) / 4; }

  window.Store = {
    KEY: KEY, DAYS: DAYS, PALETTE: PALETTE,
    uid: uid, iso: iso, parseISO: parseISO, addDays: addDays, mondayOf: mondayOf, weekKey: weekKey, today: today,
    load: load, save: save, saveNow: saveNow, fromSeed: fromSeed, mergeSeed: mergeSeed, migrate: migrate, lastError: function () { return saveError; },
    ensureWeek: ensureWeek, weekRange: weekRange, inWeek: inWeek, deadlineDate: deadlineDate,
    itemsFor: itemsFor, addItem: addItem, minutesFor: minutesFor, startTimer: startTimer, stopTimer: stopTimer, roundQ: roundQ
  };
})();
