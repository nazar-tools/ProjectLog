/* Project Log — app. Vanilla JS, no build step. */
(function () {
  'use strict';
  var S = window.Store;
  var state = S.load();
  var ui = {
    fold: {}, addLevel: {}, editItem: null, showDone: {},
    planQ: '', planOffset: 0,
    projQ: '', projView: 'recent', projPm: 'all', projSort: 'last', projAll: false,
    edit: null, draft: null, pmMenu: false,
    tsOffset: 0, tsDay: null,
    openPerson: null, newPm: '', newVer: '',
    toast: null, modal: null
  };
  var toastTimer = null;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtH(h) { var r = Math.round(h * 100) / 100; return r % 1 === 0 ? r.toFixed(1) : String(r); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fmtDay(isoStr) { var d = S.parseISO(isoStr); return WD[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate(); }
  function fmtShort(isoStr) { var d = S.parseISO(isoStr); return MON[d.getMonth()] + ' ' + d.getDate(); }
  function fmtRange(key) { var r = S.weekRange(key); var f = S.addDays(r.start, 4); return fmtShort(key) + ' – ' + (f.getMonth() === r.start.getMonth() ? f.getDate() : fmtShort(S.iso(f))); }
  function fmtMonth(ym) { if (!ym) return ''; var a = ym.split('-'); return MON[+a[1] - 1] + ' ' + a[0]; }
  function daysBetween(a, b) { return Math.round((S.parseISO(b) - S.parseISO(a)) / 86400000); }
  function proj(id) { return state.projects[id]; }
  function person(id) { return state.people.find(function (p) { return p.id === id; }) || null; }
  function pcVar(p) { return '--pc: var(--c-' + (p ? p.color : 'gray') + ')'; }
  function pmPill(pid) {
    var p = person(pid);
    if (!p) return '<span class="pm" style="--pc: var(--c-gray)"><span class="dot"></span>No PM</span>';
    return '<span class="pm" style="' + pcVar(p) + '"><span class="dot"></span>' + esc(p.name) + '</span>';
  }
  function save() { S.save(state); }
  function curWeek() { return S.weekKey(); }
  function liveMinutes(pid, dateIso) {
    if (!state.timer) return 0;
    if (pid !== null && state.timer.pid !== pid) return 0;
    if (dateIso && S.iso(new Date(state.timer.start)) !== dateIso) return 0;
    return Math.max(0, (Date.now() - state.timer.start) / 60000);
  }
  function elapsedText() {
    if (!state.timer) return '0:00';
    var m = Math.floor((Date.now() - state.timer.start) / 60000);
    return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  }
  function pidLabel(pid) { if (pid === 'OH') return state.settings.overheadCode || 'OVERHEAD'; var p = proj(pid); return p ? p.number : '?'; }
  function pidName(pid) { if (pid === 'OH') return 'Overhead · meetings, admin'; var p = proj(pid); return p ? p.name : 'Deleted project'; }
  function lastOnList(pid) {
    var keys = Object.keys(state.weeks).filter(function (k) { return S.inWeek(state, k, pid); }).sort();
    if (keys.length) return keys[keys.length - 1];
    return null;
  }
  function lastLabel(p) {
    var k = lastOnList(p.id);
    if (k) return k === curWeek() ? 'This week' : 'Week of ' + fmtShort(k);
    return fmtMonth(p.lastSeen);
  }
  function lastSort(p) { var k = lastOnList(p.id); return k ? k : (p.lastSeen ? p.lastSeen + '-01' : '0000'); }
  function freeColor() {
    var used = state.people.filter(function (p) { return !p.archived; }).map(function (p) { return p.color; });
    var f = S.PALETTE.find(function (c) { return used.indexOf(c[0]) === -1; });
    return f ? f[0] : 'gray';
  }
  function addPerson(name) {
    name = (name || '').trim();
    if (!name) return null;
    var ex = state.people.find(function (p) { return p.name.toLowerCase() === name.toLowerCase(); });
    if (ex) { ex.archived = false; return ex; }
    var p = { id: S.uid('pm_'), name: name, color: freeColor(), archived: false };
    state.people.push(p);
    return p;
  }
  function showToast(text, undo) {
    ui.toast = { text: text, undo: undo || null };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast = null; render(); }, 8000);
  }

  var IC = {
    week: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    plan: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
    play: '<polygon points="7 4 20 12 7 20 7 4"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', check: '<path d="M20 6 9 17l-5-5"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    grip: '<circle cx="9" cy="6" r=".6"/><circle cx="9" cy="12" r=".6"/><circle cx="9" cy="18" r=".6"/><circle cx="15" cy="6" r=".6"/><circle cx="15" cy="12" r=".6"/><circle cx="15" cy="18" r=".6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="m10 3-2 18"/><path d="m16 3-2 18"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>', chevL: '<path d="m15 18-6-6 6-6"/>', chevD: '<path d="m6 9 6 6 6-6"/>',
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    indent: '<path d="M21 6H11"/><path d="M21 12H11"/><path d="M21 18H11"/><path d="m3 8 4 4-4 4"/>',
    outdent: '<path d="M21 6H11"/><path d="M21 12H11"/><path d="M21 18H11"/><path d="m7 8-4 4 4 4"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    logo: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'
  };
  function ic(name, cls, style) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"' + (style ? ' style="' + style + '"' : '') + '>' + IC[name] + '</svg>'; }

  /* ---------- routing ---------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    if (parts[0] === 'p' && parts[1]) return { name: 'project', id: decodeURIComponent(parts[1]) };
    if (['week', 'plan', 'projects', 'time', 'settings'].indexOf(parts[0]) !== -1) return { name: parts[0] };
    return { name: 'week' };
  }

  /* ---------- shell ---------- */
  function shell(content, r) {
    var nav = [['week', 'This week', 'week'], ['plan', 'Plan week', 'plan'], ['projects', 'Projects', 'folder'], ['time', 'Timesheet', 'clock'], ['settings', 'Settings', 'sliders']];
    var active = r.name === 'project' ? 'projects' : r.name;
    var lb = state.settings.lastBackup;
    var backupText = lb ? 'Last backup ' + fmtShort(lb.slice(0, 10)) : 'Not backed up yet';
    var html = '<div class="app"><aside class="side"><div class="brand"><span class="logo">' + ic('logo', 's') + '</span>Project Log</div><nav class="nav" aria-label="Main">' +
      nav.map(function (n) { return '<a href="#/' + n[0] + '"' + (active === n[0] ? ' class="on" aria-current="page"' : '') + '>' + ic(n[2]) + n[1] + '</a>'; }).join('') +
      '</nav><div class="side-foot"><span class="lbl">Backup</span><span class="sub">' + esc(backupText) + '</span><button class="btn sm" data-a="export">' + ic('download', 's') + 'Back up now</button></div></aside>' +
      '<main class="main" id="main">' + content + '</main>' +
      '<nav class="tabbar" aria-label="Main">' + nav.slice(0, 4).map(function (n) {
        return '<a class="tab' + (active === n[0] ? ' on' : '') + '" href="#/' + n[0] + '">' + ic(n[2]) + (n[0] === 'time' ? 'Time' : n[0] === 'plan' ? 'Plan' : n[1]) + '</a>';
      }).join('') + '</nav></div>';
    if (ui.toast) html += '<div class="toast" role="status"><span>' + esc(ui.toast.text) + '</span>' + (ui.toast.undo ? '<button data-a="undo">Undo</button>' : '') + '<button data-a="closeToast" aria-label="Dismiss">' + ic('x', 's') + '</button></div>';
    if (ui.modal) html += modalHtml();
    return html;
  }

  /* ---------- outline (tasks & notes) ---------- */
  function outlineHtml(pid, opts) {
    opts = opts || {};
    var wk = curWeek();
    var all = S.itemsFor(state, pid);
    var showAll = ui.showDone[pid];
    var items = all.filter(function (i) { return !i.done || i.doneAt >= wk || showAll; });
    var hidden = all.length - items.length;
    var h = '<div class="items">';
    items.forEach(function (it) {
      var pad = 24 + it.level * 22;
      h += '<div class="item' + (it.done ? ' done' : '') + '" data-item="' + it.id + '" style="padding-left:' + pad + 'px">' +
        '<span class="grip" draggable="true" data-drag="' + it.id + '" title="Drag to reorder (or Alt + ↑/↓)">' + ic('grip', 'xs') + '</span>';
      if (it.kind === 'task') h += '<input type="checkbox" class="chk" data-a="toggleItem" data-id="' + it.id + '"' + (it.done ? ' checked' : '') + ' aria-label="Done: ' + esc(it.text) + '">';
      else h += '<span class="notemark" aria-hidden="true">–</span>';
      if (ui.editItem === it.id) h += '<input class="edit" id="edit-' + it.id + '" data-k="editItem" data-id="' + it.id + '" value="' + esc(it.text) + '" aria-label="Edit item">';
      else h += '<span class="txt" id="txt-' + it.id + '" data-a="editItem" data-id="' + it.id + '" tabindex="0" role="button" aria-label="Edit: ' + esc(it.text) + '">' + esc(it.text) + '</span>';
      h += '<span class="acts"><button data-a="outdent" data-id="' + it.id + '" title="Outdent" aria-label="Outdent">' + ic('outdent', 'xs') + '</button>' +
        '<button data-a="indent" data-id="' + it.id + '" title="Indent" aria-label="Indent">' + ic('indent', 'xs') + '</button>' +
        '<button data-a="kind" data-id="' + it.id + '" title="' + (it.kind === 'task' ? 'Make it a note' : 'Make it a task') + '" aria-label="Switch task or note">' + ic('list', 'xs') + '</button>' +
        '<button data-a="delItem" data-id="' + it.id + '" title="Delete" aria-label="Delete">' + ic('x', 'xs') + '</button></span></div>';
    });
    var lvl = ui.addLevel[pid] || 0;
    h += '<div class="addline" style="padding-left:' + (18 + lvl * 22) + 'px"><input id="add-' + pid + '" data-k="add" data-id="' + pid + '" placeholder="' + (opts.placeholder || 'Add task…  – for a note · Tab indents') + '" aria-label="Add a task or note">' +
      (lvl ? '<span class="lvl">level ' + lvl + '</span>' : '') + '</div>';
    if (hidden > 0) h += '<div style="padding:0 14px 8px"><button class="btn ghost sm" data-a="showDone" data-id="' + pid + '">Show ' + hidden + ' finished</button></div>';
    else if (showAll && all.some(function (i) { return i.done && i.doneAt < wk; })) h += '<div style="padding:0 14px 8px"><button class="btn ghost sm" data-a="showDone" data-id="' + pid + '">Hide older finished</button></div>';
    return h + '</div>';
  }

  /* ---------- This week ---------- */
  function relInfo(dd, wk) {
    var t = S.today(), diff = daysBetween(t, dd);
    var weekEnd = S.weekRange(wk).endIso, nextEnd = S.iso(S.addDays(S.parseISO(wk), 13));
    if (diff < 0) return { rel: 'Overdue', cls: 'warn' };
    if (diff === 0) return { rel: 'Today', cls: 'warn' };
    if (diff === 1) return { rel: 'Tomorrow', cls: 'warn' };
    if (dd <= weekEnd) return { rel: 'This week', cls: 'acc' };
    if (dd <= nextEnd) return { rel: 'Next week', cls: '' };
    return { rel: 'Later', cls: '' };
  }
  function dlText(e, dd, wk) {
    var r = S.weekRange(wk);
    var when = dd >= r.startIso && dd <= r.endIso ? WD[S.parseISO(dd).getDay()] : fmtShort(dd);
    return (e.label ? e.label + ' · ' : '') + when;
  }
  function viewWeek() {
    var wk = curWeek(), W = S.ensureWeek(state, wk), R = S.weekRange(wk), set = state.settings;
    var entries = W.entries.filter(function (e) { return proj(e.pid); });
    var present = state.people.filter(function (p) { return entries.some(function (e) { return proj(e.pid).pm === p.id; }); });
    if (set.pm !== 'all' && !present.some(function (p) { return p.id === set.pm; })) set.pm = 'all';
    if (set.group !== 'pm') set.pm = 'all';
    var vis = entries.filter(function (e) { return set.pm === 'all' || proj(e.pid).pm === set.pm; });
    var doneList = vis.filter(function (e) { return e.done; }).sort(function (a, b) { return parseFloat(proj(b.pid).number) - parseFloat(proj(a.pid).number); });
    vis = vis.filter(function (e) { return !e.done; });
    var groups = [];
    if (set.group === 'num') {
      groups = [{ title: 'All projects', sub: 'Number, high to low', list: vis.slice().sort(function (a, b) { return parseFloat(proj(b.pid).number) - parseFloat(proj(a.pid).number); }) }];
    } else if (set.group === 'pm') {
      state.people.concat([null]).forEach(function (p) {
        var list = vis.filter(function (e) { return p ? proj(e.pid).pm === p.id : !person(proj(e.pid).pm); });
        if (list.length) groups.push({ title: p ? p.name : 'No PM', dot: p, sub: list.length + (list.length === 1 ? ' project' : ' projects'), list: list.sort(function (a, b) { return (S.deadlineDate(wk, a) || '9') < (S.deadlineDate(wk, b) || '9') ? -1 : 1; }) });
      });
    } else {
      var map = {};
      vis.forEach(function (e) { var dd = S.deadlineDate(wk, e) || ''; (map[dd] = map[dd] || []).push(e); });
      Object.keys(map).sort(function (a, b) { return a === '' ? 1 : b === '' ? -1 : a < b ? -1 : 1; }).forEach(function (dd) {
        var list = map[dd].sort(function (a, b) { return parseFloat(proj(b.pid).number) - parseFloat(proj(a.pid).number); });
        groups.push(dd ? { title: fmtDay(dd), sub: relInfo(dd, wk).rel + ' · ' + list.length, list: list } : { title: 'No deadline', sub: String(list.length), list: list });
      });
    }
    var planned = entries.reduce(function (a, e) { return a + (parseFloat(e.hours) || 0); }, 0);
    var logged = entries.reduce(function (a, e) { return a + S.minutesFor(state, e.pid, R.startIso, R.endIso) + liveMinutes(e.pid); }, 0) / 60;

    var h = '<div class="stickyhead"><div class="pagehead"><div class="grow"><h1 class="h1">This week</h1><div class="sub">' + fmtRange(wk) + ' · ' + WD[new Date().getDay()] + ' · ' + vis.length + ' to do' + (doneList.length ? ' · ' + doneList.length + ' done' : '') + '</div></div>' +
      '<div class="row"><a class="iconbtn only-narrow" href="#/settings" aria-label="Settings">' + ic('sliders', 's') + '</a>' +
      '<button class="iconbtn" data-a="compact" aria-label="' + (set.compact ? 'Expand all' : 'Collapse all') + '" title="' + (set.compact ? 'Expand all' : 'Collapse all') + '">' + ic('list', 's') + '</button>' +
      '<a class="btn pri hide-narrow" href="#/plan">' + ic('plus', 's') + 'Add / remove projects</a><a class="iconbtn pri only-narrow" href="#/plan" aria-label="Add or remove projects">' + ic('plus', 's') + '</a></div></div>';
    h += timerBar();
    if (entries.length) {
      h += '<div class="toolbar"><div class="seg groupseg" role="group" aria-label="Group projects by">' + [['deadline', 'Deadline', 'flag', 'Group by next deadline'], ['pm', 'PM', 'user', 'Group by project manager'], ['num', 'Number', 'hash', 'Highest project number first']].map(function (o) {
        return '<button data-a="group" data-v="' + o[0] + '" class="' + (set.group === o[0] ? 'on' : '') + '" aria-pressed="' + (set.group === o[0]) + '" title="' + o[3] + '">' + ic(o[2], 's') + '<span>' + o[1] + '</span></button>';
      }).join('') + '</div>' + (set.group !== 'pm' ? '' : '<div class="chips">' +
        '<button class="chip' + (set.pm === 'all' ? ' on' : '') + '" data-a="pmf" data-v="all" aria-pressed="' + (set.pm === 'all') + '">All<span class="n">' + entries.length + '</span></button>' +
        present.map(function (p) {
          var n = entries.filter(function (e) { return proj(e.pid).pm === p.id; }).length;
          return '<button class="chip' + (set.pm === p.id ? ' on' : '') + '" data-a="pmf" data-v="' + p.id + '" aria-pressed="' + (set.pm === p.id) + '" style="' + pcVar(p) + '"><span class="dot"></span>' + esc(p.name) + '<span class="n">' + n + '</span></button>';
        }).join('') + '</div>') + '</div>';
    }
    h += '</div>';

    if (!Object.keys(state.projects).length) {
      h += '<div class="card pad stack" style="max-width:640px"><h2 class="h2">Welcome to Project Log</h2><p class="sub">Load your project list once to get started. Pick the <b>project-log-seed.json</b> file (your OneNote import). It stays in this browser and is never uploaded anywhere.</p>' +
        '<div class="row wrap"><label class="btn pri">' + ic('upload', 's') + 'Import project list<input type="file" accept="application/json,.json" data-in="import" class="sr"></label>' +
        '<button class="btn" data-a="newProject">' + ic('plus', 's') + 'Or start empty and add a project</button></div><p class="sub" style="font-size:12px">You can also restore a backup file here.</p></div>';
    } else if (!entries.length) {
      h += '<div class="card empty stack" style="align-items:center"><p>Nothing on this week yet.</p><div class="row wrap" style="justify-content:center">' +
        '<a class="btn pri" href="#/plan">' + ic('plus', 's') + 'Plan this week</a>' + oneNoteButton() + '</div></div>';
    }
    h += '<div class="cols"><div class="col-main"><div class="groups">';
    groups.forEach(function (g) {
      h += '<section><div class="ghead">' + (g.dot ? '<span class="dot" style="' + pcVar(g.dot) + ';width:11px;height:11px"></span>' : '') + '<h2>' + esc(g.title) + '</h2><span class="sub">' + esc(g.sub) + '</span></div><div class="cards">' +
        g.list.map(function (e) { return cardHtml(e, wk, R); }).join('') + '</div></section>';
    });
    if (doneList.length) {
      h += '<section class="donesec"><div class="ghead"><h2>Done this week</h2><span class="sub">' + doneList.length + ' · still editable · click the green check to move one back up</span></div><div class="cards">' +
        doneList.map(function (e) { return cardHtml(e, wk, R); }).join('') + '</div></section>';
    }
    h += '</div></div><aside class="col-side">';
    if (entries.length) {
      var pct = planned ? Math.min(100, Math.round(logged / planned * 100)) : 0;
      h += '<div class="card pad stack"><span class="lbl">Logged vs planned</span><span class="num" style="font-size:26px;font-weight:800">' + fmtH(logged) + ' <span class="sub" style="font-size:15px">/ ' + fmtH(planned) + ' h</span></span>' +
        '<div class="meter" style="height:9px"><i style="width:' + pct + '%"></i></div>' +
        present.map(function (p) {
          var es = entries.filter(function (e) { return proj(e.pid).pm === p.id; });
          var pl = es.reduce(function (a, e) { return a + (parseFloat(e.hours) || 0); }, 0);
          var lg = es.reduce(function (a, e) { return a + S.minutesFor(state, e.pid, R.startIso, R.endIso) + liveMinutes(e.pid); }, 0) / 60;
          return '<div class="row" style="font-size:13.5px;' + pcVar(p) + '"><span class="dot"></span><span class="grow">' + esc(p.name) + '</span><span class="num sub">' + fmtH(lg) + ' / ' + fmtH(pl) + ' h</span></div>';
        }).join('') + '</div>';
    }
    h += '<div class="card pad stack scratch"><label class="lbl" for="scratch">Scratch pad</label><textarea id="scratch" data-in="scratch" placeholder="Anything not tied to a project yet: call-backs, site visits, numbers…">' + esc(state.scratch) + '</textarea></div>';
    h += '</aside></div>';
    return h;
  }
  function oneNoteButton() {
    var lw = state.seedInfo && state.seedInfo.lastOneNoteWeek;
    if (!lw || state.seedInfo.weekSeeded) return '';
    return '<button class="btn" data-a="seedWeek">Start from OneNote ' + esc(lw.title) + ' (' + lw.numbers.length + ' projects)</button>';
  }
  function timerBar() {
    if (!state.timer) return '';
    var p = proj(state.timer.pid);
    var label = state.timer.pid === 'OH' ? 'Overhead' : p ? p.number + ' · ' + p.name : 'Project';
    return '<div class="timerbar">' + ic('clock') + '<span class="grow ell" style="font-weight:700">' + esc(label) + '</span><span class="t num" data-elapsed>' + elapsedText() + '</span><button class="btn sm" data-a="stopTimer">' + ic('stop', 's') + 'Stop</button></div>';
  }
  function cardHtml(e, wk, R) {
    var p = proj(e.pid), set = state.settings;
    var flipped = !!ui.fold[p.id], open = set.compact ? flipped : !flipped;
    var dd = S.deadlineDate(wk, e);
    var logged = (S.minutesFor(state, p.id, R.startIso, R.endIso) + liveMinutes(p.id)) / 60;
    var planned = parseFloat(e.hours) || 0;
    var pct = planned ? Math.min(100, Math.round(logged / planned * 100)) : 0;
    var on = state.timer && state.timer.pid === p.id;
    var h = '<article class="card pcard' + (e.done ? ' is-done' : '') + '"><div class="pcard-h">' +
      '<button class="fold' + (open ? ' open' : '') + '" data-a="fold" data-id="' + p.id + '" aria-label="' + (open ? 'Collapse ' : 'Expand ') + esc(p.number) + '" aria-expanded="' + open + '">' + ic('chevR', 's') + '</button>' +
      '<div class="grow stack" style="gap:6px;padding-top:3px"><a class="ptitle" href="#/p/' + encodeURIComponent(p.id) + '" title="Open project notes"><b>' + esc(p.number) + '</b> <span>' + esc(p.name) + '</span></a><div class="pmeta">' +
      (p.revit ? '<span class="tag acc">' + esc(p.revit) + '</span>' : '<button class="tag dash" data-a="editProject" data-id="' + p.id + '" title="Set Revit version">+ RVT</button>') +
      pmPill(p.pm) +
      (dd ? '<span class="tag ' + relInfo(dd, wk).cls + '">' + ic('flag', 'xs') + esc(dlText(e, dd, wk)) + '</span>' : (e.label ? '<span class="tag">' + esc(e.label) + '</span>' : '')) +
      '</div></div><button class="iconbtn sm donebtn' + (e.done ? ' is-on' : '') + '" data-a="weekDone" data-id="' + p.id + '" aria-pressed="' + !!e.done + '" title="' + (e.done ? 'Not done: bring it back to the top' : 'Done for this week') + '" aria-label="' + (e.done ? 'Bring back ' : 'Mark done for this week: ') + esc(p.number) + '">' + ic('check', 's', 'width:15px;height:15px') + '</button>' +
      '<button class="iconbtn sm' + (on ? ' on' : '') + '" data-a="timer" data-id="' + p.id + '" aria-label="' + (on ? 'Stop timer for ' : 'Start timer for ') + esc(p.number) + '">' + ic(on ? 'stop' : 'play', 's', 'width:14px;height:14px') + '</button></div>' +
      '<div class="hours"><div class="meter grow' + (planned && logged > planned ? ' over' : '') + '"><i style="width:' + pct + '%"></i></div><span class="num sub" style="white-space:nowrap">' + (planned ? fmtH(logged) + ' / ' + fmtH(planned) + ' h' : fmtH(logged) + ' h · no plan') + '</span></div>';
    if (open) h += outlineHtml(p.id);
    else {
      var its = S.itemsFor(state, p.id);
      var nt = its.filter(function (i) { return i.kind === 'task' && !i.done; }).length, nn = its.filter(function (i) { return i.kind === 'note'; }).length;
      h += '<div class="psum sub">' + nt + (nt === 1 ? ' open task' : ' open tasks') + (nn ? ' · ' + nn + (nn === 1 ? ' note' : ' notes') : '') + '</div>';
    }
    return h + '</article>';
  }

  /* ---------- Plan week ---------- */
  function planKey() { return S.weekKey(S.addDays(new Date(), ui.planOffset * 7)); }
  function viewPlan() {
    var wk = planKey(), W = S.ensureWeek(state, wk);
    var entries = W.entries.filter(function (e) { return proj(e.pid); });
    var inW = {}; entries.forEach(function (e) { inW[e.pid] = true; });
    var q = ui.planQ.trim().toLowerCase();
    var h = '<div class="stickyhead"><div class="pagehead"><div class="grow"><h1 class="h1">Plan week</h1><div class="sub">Week of ' + fmtRange(wk) +
      (W.copiedFrom ? ' · copied from week of ' + fmtShort(W.copiedFrom) : '') + '</div></div><div class="row">' +
      '<div class="seg hide-narrow"><button data-a="planWeek" data-v="0" class="' + (ui.planOffset === 0 ? 'on' : '') + '">This week</button><button data-a="planWeek" data-v="1" class="' + (ui.planOffset === 1 ? 'on' : '') + '">Next week</button></div>' +
      '<a class="btn pri" href="#/week">' + ic('check', 's') + 'Done</a></div></div>' +
      '<div class="seg only-narrow"><button data-a="planWeek" data-v="0" class="' + (ui.planOffset === 0 ? 'on' : '') + '">This week</button><button data-a="planWeek" data-v="1" class="' + (ui.planOffset === 1 ? 'on' : '') + '">Next week</button></div>' +
      '<label class="search accent">' + ic('search', '', 'color:var(--accent)') + '<input id="planq" data-in="planq" value="' + esc(ui.planQ) + '" placeholder="Add a project: type a number or name" aria-label="Add a project to this week" autocomplete="off"></label>';
    if (q) {
      var res = Object.keys(state.projects).map(proj).filter(function (p) { return (p.number + ' ' + p.name).toLowerCase().indexOf(q) !== -1; })
        .sort(function (a, b) { return lastSort(b) > lastSort(a) ? 1 : -1; }).slice(0, 8);
      h += '<div class="card clip results list">' + res.map(function (p) {
        var pp = person(p.pm);
        return '<div class="res"><span class="dot" style="' + pcVar(pp) + '"></span><div class="grow"><b>' + esc(p.number) + '</b> ' + esc(p.name) + '<div class="sub">' + (p.revit ? esc(p.revit) + ' · ' : '') + (pp ? esc(pp.name) : 'No PM') + ' · ' + esc(lastLabel(p)) + '</div></div>' +
          (inW[p.id] ? '<span class="tag good">In week</span>' : '<button class="addbtn" data-a="addEntry" data-id="' + p.id + '">' + ic('plus', 's') + 'Add</button>') + '</div>';
      }).join('') + '<div class="res"><button class="btn ghost sm" data-a="newProject" data-v="' + esc(ui.planQ.trim()) + '">' + ic('plus', 's') + 'New project “' + esc(ui.planQ.trim()) + '”</button><span class="sub">Enter adds the top match</span></div></div>';
    }
    h += '</div>';
    if (!entries.length && oneNoteButton()) h += '<div class="note">' + ic('info', 's') + '<div class="grow stack" style="gap:8px"><span>Your OneNote projects are imported. Start this week from your last OneNote page, or search to add projects.</span><div>' + oneNoteButton() + '</div></div></div>';
    h += '<div class="cols"><section class="col-main" aria-label="Projects on this week"><div class="row" style="justify-content:space-between"><h2 class="h2">On this week · ' + entries.length + '</h2><span class="sub hide-narrow">Removing keeps the project’s tasks and notes</span></div>';
    h += '<div class="card clip list">';
    if (!entries.length) h += '<div class="empty">No projects yet. Search above to add one.</div>';
    entries.forEach(function (e) {
      var p = proj(e.pid);
      var open = S.itemsFor(state, p.id).filter(function (i) { return i.kind === 'task' && !i.done; }).length;
      h += '<div class="prow"><div class="who"><div><b>' + esc(p.number) + '</b> <span style="font-weight:600">' + esc(p.name) + '</span></div><div class="pmeta">' +
        (p.revit ? '<span class="tag acc">' + esc(p.revit) + '</span>' : '<button class="tag dash" data-a="editProject" data-id="' + p.id + '">+ RVT</button>') + pmPill(p.pm) +
        (e.done ? '<span class="tag good">Done</span>' : '') +
        (open ? '<span class="sub">' + open + (open === 1 ? ' open task' : ' open tasks') + '</span>' : '') + '</div></div>' +
        '<input class="inp num hrs" id="h-' + p.id + '" data-in="hours" data-id="' + p.id + '" value="' + esc(e.hours) + '" inputmode="decimal" placeholder="h" aria-label="Planned hours for ' + esc(p.number) + '">' +
        '<input class="inp dl" id="l-' + p.id + '" data-in="label" data-id="' + p.id + '" value="' + esc(e.label) + '" placeholder="Deadline, e.g. QA/QC Print" aria-label="Deadline for ' + esc(p.number) + '">' +
        '<div class="days" role="group" aria-label="Deadline day for ' + esc(p.number) + '">' + S.DAYS.map(function (d) {
          return '<button data-a="day" data-id="' + p.id + '" data-v="' + d + '" class="' + (e.day === d ? 'on' : '') + '" aria-pressed="' + (e.day === d) + '">' + d + '</button>';
        }).join('') + '<input type="date" id="d-' + p.id + '" data-in="date" data-id="' + p.id + '" value="' + esc(e.date) + '" aria-label="Other deadline date"></div>' +
        '<button class="xbtn" data-a="removeEntry" data-id="' + p.id + '" aria-label="Remove ' + esc(p.number) + ' from this week" title="Remove from this week">' + ic('x', 's') + '</button></div>';
    });
    h += '</div></section><aside class="col-side">';
    var total = entries.reduce(function (a, e) { return a + (parseFloat(e.hours) || 0); }, 0);
    var cap = parseFloat(state.settings.capacity) || 40;
    h += '<div class="card pad stack"><span class="lbl">Planned this week</span><span class="num" style="font-size:28px;font-weight:800"><span data-bind="planTotal">' + fmtH(total) + '</span> <span class="sub" style="font-size:15px">/ ' + cap + ' h</span></span><div class="meter" style="height:9px"><i data-bind="planMeter" style="width:' + Math.min(100, Math.round(total / cap * 100)) + '%"></i></div>' +
      state.people.filter(function (pp) { return entries.some(function (e) { return proj(e.pid).pm === pp.id; }); }).map(function (pp) {
        var es = entries.filter(function (e) { return proj(e.pid).pm === pp.id; });
        return '<div class="row" style="font-size:13.5px;' + pcVar(pp) + '"><span class="dot"></span><span class="grow">' + esc(pp.name) + '</span><span class="num sub">' + es.length + (es.length === 1 ? ' project' : ' projects') + '</span></div>';
      }).join('') + '</div>';
    var recent = recentProjects(wk, inW);
    h += '<div class="card clip"><div class="pad stack" style="gap:2px;padding-bottom:8px"><b>Recently on your list</b><span class="sub">Not on this week · one click to add back</span></div><div class="list">' +
      (recent.length ? recent.map(function (p) {
        var pp = person(p.pm);
        return '<div class="res"><span class="dot" style="' + pcVar(pp) + '"></span><div class="grow"><b>' + esc(p.number) + '</b> ' + esc(p.name) + '<div class="sub">' + (pp ? esc(pp.name) : 'No PM') + ' · ' + esc(lastLabel(p)) + '</div></div><button class="addbtn" data-a="addEntry" data-id="' + p.id + '" aria-label="Add ' + esc(p.number) + '">' + ic('plus', 's') + '</button></div>';
      }).join('') : '<div class="empty sub">Nothing recent that isn’t already on the week.</div>') + '</div></div>';
    h += '</aside></div>';
    return h;
  }
  function recentProjects(wk, inW) {
    var seen = {}, out = [];
    Object.keys(state.weeks).filter(function (k) { return k !== wk; }).sort().reverse().slice(0, 8).forEach(function (k) {
      state.weeks[k].entries.forEach(function (e) { if (!inW[e.pid] && !seen[e.pid] && proj(e.pid)) { seen[e.pid] = 1; out.push(proj(e.pid)); } });
    });
    var cutoff = S.iso(S.addDays(new Date(), -75)).slice(0, 7);
    Object.keys(state.projects).map(proj).filter(function (p) { return !inW[p.id] && !seen[p.id] && p.status !== 'archived' && p.lastSeen && p.lastSeen >= cutoff; })
      .sort(function (a, b) { return a.lastSeen < b.lastSeen ? 1 : -1; }).forEach(function (p) { out.push(p); });
    return out.slice(0, 10);
  }

  /* ---------- Projects ---------- */
  function viewProjects() {
    var all = Object.keys(state.projects).map(proj);
    var flags = (state.seedInfo && state.seedInfo.flags) || {};
    var yr = String(new Date().getFullYear());
    var VIEWS = [
      ['recent', 'Active in ' + yr, function (p) { return p.status !== 'archived' && lastSort(p) >= yr; }],
      ['all', 'All', function (p) { return true; }],
      ['norvt', 'No Revit', function (p) { return !p.revit; }],
      ['check', 'Check', function (p) { return !!flags[p.number]; }],
      ['arch', 'Archived', function (p) { return p.status === 'archived'; }]
    ];
    var vf = (VIEWS.find(function (v) { return v[0] === ui.projView; }) || VIEWS[0])[2];
    var q = ui.projQ.trim().toLowerCase();
    var base = all.filter(function (p) { return !q || (p.number + ' ' + p.name + ' ' + (person(p.pm) ? person(p.pm).name : '')).toLowerCase().indexOf(q) !== -1; });
    var inView = base.filter(vf);
    var list = inView.filter(function (p) { return ui.projPm === 'all' || p.pm === ui.projPm; });
    if (ui.projSort === 'num') list.sort(function (a, b) { return parseFloat(b.number) - parseFloat(a.number); });
    else list.sort(function (a, b) { var x = lastSort(a), y = lastSort(b); return x < y ? 1 : x > y ? -1 : parseFloat(b.number) - parseFloat(a.number); });
    var LIMIT = 40, shown = ui.projAll ? list : list.slice(0, LIMIT);
    var noRvt = all.filter(function (p) { return !p.revit; }).length;
    var h = '<div class="stickyhead"><div class="pagehead"><div class="grow"><h1 class="h1">Projects</h1><div class="sub">' + all.length + ' projects · ' + noRvt + ' without a Revit version</div></div>' +
      '<a class="iconbtn only-narrow" href="#/settings" aria-label="Settings">' + ic('sliders', 's') + '</a>' +
      '<button class="btn pri hide-narrow" data-a="newProject">' + ic('plus', 's') + 'New project</button><button class="iconbtn pri only-narrow" data-a="newProject" aria-label="New project">' + ic('plus', 's') + '</button></div>' +
      '<div class="toolbar"><label class="search grow" style="flex:1 1 260px">' + ic('search', 's', 'color:var(--muted)') + '<input id="projq" data-in="projq" value="' + esc(ui.projQ) + '" placeholder="Search number, name or PM…" aria-label="Search projects" autocomplete="off"></label>' +
      '<div class="seg hide-narrow">' + [['last', 'Recent first'], ['num', 'Number ↓']].map(function (o) { return '<button data-a="projSort" data-v="' + o[0] + '" class="' + (ui.projSort === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="chips">' + VIEWS.map(function (v) { var n = base.filter(v[2]).length; return '<button class="chip' + (ui.projView === v[0] ? ' on' : '') + '" data-a="projView" data-v="' + v[0] + '">' + v[1] + '<span class="n">' + n + '</span></button>'; }).join('') + '</div>' +
      '<div class="chips hide-narrow"><span class="sub" style="align-self:center;font-weight:700">PM</span><button class="chip' + (ui.projPm === 'all' ? ' on' : '') + '" data-a="projPm" data-v="all">All<span class="n">' + inView.length + '</span></button>' +
      state.people.map(function (pp) { var n = inView.filter(function (p) { return p.pm === pp.id; }).length; return n ? '<button class="chip' + (ui.projPm === pp.id ? ' on' : '') + '" data-a="projPm" data-v="' + pp.id + '" style="' + pcVar(pp) + '"><span class="dot"></span>' + esc(pp.name) + '<span class="n">' + n + '</span></button>' : ''; }).join('') + '</div></div>';
    h += '<datalist id="rvt-list">' + state.settings.revitVersions.map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join('') + '<option value="Not Revit (CAD)"></option></datalist>';
    h += '<div class="card clip" style="overflow-x:auto"><div class="gtable"><div class="grow-r hd"><span>Number</span><span>Name</span><span>Revit</span><span class="c-pm">PM</span><span class="c-last" style="text-align:right">Last on list</span></div>';
    if (!shown.length) h += '<div class="empty">No projects match.</div>';
    shown.forEach(function (p) {
      var pp = person(p.pm);
      h += '<div class="grow-r"><a class="num" href="#/p/' + encodeURIComponent(p.id) + '" style="font-weight:800;color:var(--text-primary);text-decoration:none">' + esc(p.number) + '</a>' +
        '<a class="ell" href="#/p/' + encodeURIComponent(p.id) + '" style="color:var(--text-primary);text-decoration:none">' + esc(p.name) + (flags[p.number] ? ' <span class="tag warn" title="' + esc(flags[p.number]) + '">Check</span>' : '') +
        '<span class="only-narrow sub" style="display:block">' + (pp ? esc(pp.name) : 'No PM') + ' · ' + esc(lastLabel(p)) + '</span></a>' +
        '<input class="rvt' + (p.revit ? ' set' : '') + '" list="rvt-list" id="r-' + p.id + '" data-in="rvt" data-id="' + p.id + '" value="' + esc(p.revit) + '" placeholder="+ RVT" aria-label="Revit version for ' + esc(p.number) + '">' +
        '<span class="c-pm row" style="gap:7px;font-size:14px;' + pcVar(pp) + '"><span class="dot"></span>' + (pp ? esc(pp.name) : '—') + '</span>' +
        '<span class="c-last sub num" style="text-align:right">' + esc(lastLabel(p)) + '</span></div>';
    });
    if (!ui.projAll && list.length > LIMIT) h += '<div class="row" style="padding:10px 16px;border-top:1px solid var(--gridline);justify-content:space-between"><span class="sub">Showing ' + LIMIT + ' of ' + list.length + '</span><button class="btn sm" data-a="projAll">Show all</button></div>';
    h += '</div></div>';
    if (state.seedInfo && state.seedInfo.count) h += '<div class="note">' + ic('info', 's') + '<span>' + state.seedInfo.count + ' projects were imported once from OneNote (' + esc(state.seedInfo.source) + '). Only number, name, Revit version and PM came over. Rows marked Check may be duplicates or typos; hover for why.</span></div>';
    return h;
  }

  /* ---------- Project ---------- */
  function viewProject(id) {
    var p = proj(id);
    if (!p) return '<div class="card empty">That project doesn’t exist any more. <a href="#/projects">Back to projects</a></div>';
    var wk = curWeek(), R = S.weekRange(wk);
    var onWeek = S.inWeek(state, wk, p.id);
    var entry = onWeek ? S.ensureWeek(state, wk).entries.find(function (e) { return e.pid === p.id; }) : null;
    var editing = ui.edit === p.id && ui.draft;
    var on = state.timer && state.timer.pid === p.id;
    var h = '<a href="#/week" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;text-decoration:none;min-height:32px;align-self:flex-start">' + ic('back', 's') + 'This week</a>';
    h += '<header class="pagehead" style="align-items:flex-start"><div class="grow stack" style="gap:8px"><h1 class="h1">' + esc(p.number) + ' · ' + esc(p.name) + '</h1><div class="pmeta">' +
      (p.revit ? '<span class="tag acc">' + esc(p.revit) + '</span>' : '<span class="tag warn">Revit not set</span>') + pmPill(p.pm) +
      (p.status === 'archived' ? '<span class="tag">Archived</span>' : '') +
      (entry ? '<span class="tag good">On this week' + (entry.hours ? ' · ' + esc(entry.hours) + ' h' : '') + '</span>' : '') + '</div></div>' +
      '<div class="row"><button class="iconbtn' + (on ? ' on' : '') + '" data-a="timer" data-id="' + p.id + '" aria-label="' + (on ? 'Stop timer' : 'Start timer') + '">' + ic(on ? 'stop' : 'play', 's') + '</button>' +
      (onWeek ? '<button class="btn hide-narrow" data-a="removeEntryHere" data-id="' + p.id + '">Remove from week</button>' : '<button class="btn" data-a="addEntryHere" data-id="' + p.id + '">' + ic('plus', 's') + '<span class="hide-narrow">Add to this week</span><span class="only-narrow">Week</span></button>') +
      '<button class="btn" data-a="editProject" data-id="' + p.id + '" aria-label="Edit project">' + ic('plan', 's') + '<span class="hide-narrow">Edit project</span></button></div></header>';
    if (editing) h += editFormHtml(p);
    h += '<div class="cols"><div class="col-main">';
    h += '<section class="card pad stack"><div class="row" style="justify-content:space-between"><h2 class="h2">Project notes</h2><span class="sub hide-narrow">Always true for this project · saves as you type</span></div>' +
      '<textarea class="inp" id="notes-' + p.id + '" data-in="notes" data-id="' + p.id + '" rows="6" placeholder="Service, equipment, who to ask, where things live…">' + esc(p.notes) + '</textarea></section>';
    var js = state.journal.filter(function (j) { return j.pid === p.id; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.id < b.id ? 1 : -1); });
    h += '<section class="stack"><div class="row" style="justify-content:space-between"><h2 class="h2">Journal</h2><span class="sub">Dated notes, newest first</span></div><div class="card clip list">' +
      '<div class="row pad" style="padding:10px 12px"><input class="inp grow" id="jn-' + p.id + '" data-k="journal" data-id="' + p.id + '" placeholder="Add a note for today… (Enter)" aria-label="New journal note"><button class="btn" data-a="addJournal" data-id="' + p.id + '">Add</button></div>' +
      js.map(function (j) { return '<div class="jrow"><span class="d sub">' + fmtDay(j.date) + '</span><span class="grow" style="white-space:pre-wrap">' + esc(j.text) + '</span><button class="iconbtn plain sm" data-a="delJournal" data-id="' + j.id + '" aria-label="Delete note">' + ic('x', 's') + '</button></div>'; }).join('') +
      '</div></section></div><aside class="col-side">';
    h += '<div class="card clip"><div class="pad" style="padding-bottom:4px"><b>Tasks and notes</b></div>' + outlineHtml(p.id) + '</div>';
    var wkMin = S.minutesFor(state, p.id, R.startIso, R.endIso) + liveMinutes(p.id);
    var allMin = S.minutesFor(state, p.id, '0000-00-00', '9999-12-31') + liveMinutes(p.id);
    var weeks = Object.keys(state.weeks).filter(function (k) { return S.inWeek(state, k, p.id); }).length;
    var planned = entry ? parseFloat(entry.hours) || 0 : 0;
    h += '<div class="card pad stack"><span class="lbl">This week</span><span class="num" style="font-size:26px;font-weight:800">' + fmtH(wkMin / 60) + (planned ? ' <span class="sub" style="font-size:15px">/ ' + fmtH(planned) + ' h</span>' : ' <span class="sub" style="font-size:15px">h</span>') + '</span>' +
      (planned ? '<div class="meter"><i style="width:' + Math.min(100, Math.round(wkMin / 60 / planned * 100)) + '%"></i></div>' : '') +
      '<div class="row sub" style="justify-content:space-between"><span>All time logged</span><span class="num">' + fmtH(allMin / 60) + ' h</span></div>' +
      '<div class="row sub" style="justify-content:space-between"><span>Weeks on your list</span><span class="num">' + weeks + '</span></div>' +
      (p.firstSeen ? '<div class="row sub" style="justify-content:space-between"><span>In OneNote</span><span>' + fmtMonth(p.firstSeen) + ' – ' + fmtMonth(p.lastSeen) + '</span></div>' : '') + '</div>';
    h += '</aside></div>';
    return h;
  }
  function editFormHtml(p) {
    var d = ui.draft, dp = person(d.pm);
    var people = state.people.filter(function (x) { return !x.archived || x.id === d.pm; });
    return '<section class="card pad stack" style="border-color:var(--accent);gap:14px" aria-label="Edit project">' +
      '<div class="row" style="justify-content:space-between"><h2 class="h2">Edit project</h2><span class="sub hide-narrow">Changes show on every card and week</span></div>' +
      '<div class="row wrap" style="align-items:flex-start;gap:12px"><label class="field" style="flex:0 1 150px"><span class="lbl">Number (= Adjera code)</span><input class="inp num" id="ed-number" data-in="draft" data-v="number" value="' + esc(d.number) + '"></label>' +
      '<label class="field" style="flex:1 1 280px"><span class="lbl">Name</span><input class="inp" id="ed-name" data-in="draft" data-v="name" value="' + esc(d.name) + '"></label></div>' +
      '<div class="row wrap" style="align-items:flex-start;gap:12px"><label class="field" style="flex:0 1 200px"><span class="lbl">Revit version</span><input class="inp" id="ed-revit" list="rvt-list-ed" data-in="draft" data-v="revit" value="' + esc(d.revit) + '" placeholder="Type or pick, e.g. RVT27">' +
      '<datalist id="rvt-list-ed">' + state.settings.revitVersions.map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join('') + '<option value="Not Revit (CAD)"></option></datalist><span class="sub" style="font-size:12px">Pick from the list or type any version</span></label>' +
      '<div class="field menuwrap" style="flex:1 1 220px"><span class="lbl">PM / lead</span><button class="inp row" type="button" data-a="pmMenu" aria-haspopup="listbox" aria-expanded="' + ui.pmMenu + '" style="cursor:pointer;text-align:left;' + pcVar(dp) + '"><span class="dot"></span><span class="grow">' + (dp ? esc(dp.name) : 'No PM') + '</span>' + ic('chevD', 's', 'color:var(--muted)') + '</button>' +
      (ui.pmMenu ? '<div class="menu" role="listbox" aria-label="Choose PM">' + people.map(function (x) {
        return '<button class="opt' + (x.id === d.pm ? ' sel' : '') + '" role="option" aria-selected="' + (x.id === d.pm) + '" data-a="pickPm" data-v="' + x.id + '" style="' + pcVar(x) + '"><span class="dot"></span>' + esc(x.name) + '</button>';
      }).join('') + '<button class="opt" data-a="pickPm" data-v=""><span class="dot" style="--pc:var(--baseline)"></span>No PM</button>' +
        '<div class="row" style="padding:6px;border-top:1px solid var(--gridline)"><input class="inp" id="newpm" data-k="newpm" placeholder="+ New PM name, Enter" aria-label="New PM name" style="min-height:34px;font-size:14px"><a class="btn sm" href="#/settings">Colours…</a></div></div>' : '') + '</div>' +
      '<div class="field" style="flex:0 1 220px"><span class="lbl">Status</span><div class="seg"><button data-a="draftStatus" data-v="active" class="' + (d.status !== 'archived' ? 'on' : '') + '">Active</button><button data-a="draftStatus" data-v="archived" class="' + (d.status === 'archived' ? 'on' : '') + '">Archived</button></div></div></div>' +
      (ui.draftError ? '<div class="tag warn" style="align-self:flex-start">' + esc(ui.draftError) + '</div>' : '') +
      '<div class="row" style="justify-content:space-between"><button class="btn ghost danger" data-a="deleteProject" data-id="' + p.id + '">Delete project</button><div class="row"><button class="btn" data-a="cancelEdit">Cancel</button><button class="btn pri" data-a="saveEdit" data-id="' + p.id + '">Save</button></div></div></section>';
  }

  /* ---------- Timesheet ---------- */
  function tsKey() { return S.weekKey(S.addDays(new Date(), ui.tsOffset * 7)); }
  function viewTime() {
    var wk = tsKey(), R = S.weekRange(wk), t = S.today();
    var days = S.DAYS.map(function (d, i) { return S.iso(S.addDays(R.start, i)); });
    if (!ui.tsDay || days.indexOf(ui.tsDay) === -1) ui.tsDay = days.indexOf(t) !== -1 ? t : days[0];
    var W = state.weeks[wk];
    var pids = [];
    (W ? W.entries : []).forEach(function (e) { if (pids.indexOf(e.pid) === -1 && proj(e.pid)) pids.push(e.pid); });
    state.time.forEach(function (x) { if (x.date >= R.startIso && x.date <= R.endIso && x.pid !== 'OH' && pids.indexOf(x.pid) === -1) pids.push(x.pid); });
    if (state.timer && state.timer.pid !== 'OH' && pids.indexOf(state.timer.pid) === -1 && days.indexOf(S.iso(new Date(state.timer.start))) !== -1) pids.push(state.timer.pid);
    pids.push('OH');
    function cell(pid, d) { return S.roundQ((S.minutesFor(state, pid, d, d) + liveMinutes(pid, d)) / 60); }
    var grid = pids.map(function (pid) { return days.map(function (d) { return cell(pid, d); }); });
    var dayTot = days.map(function (d, i) { return grid.reduce(function (a, r) { return a + r[i]; }, 0); });
    var weekTot = dayTot.reduce(function (a, b) { return a + b; }, 0);
    var entered = days.filter(function (d) { return state.adjera[d]; }).length;
    var daysWith = days.filter(function (d, i) { return dayTot[i] > 0; }).length;
    var h = '<div class="stickyhead"><div class="pagehead"><div class="grow"><h1 class="h1">Timesheet</h1><div class="sub">Rounded to 0.25 h · Adjera code = project number</div></div><div class="row">' +
      '<button class="iconbtn" data-a="tsWeek" data-v="-1" aria-label="Previous week">' + ic('chevL', 's') + '</button><span style="font-weight:800;min-width:110px;text-align:center">' + fmtRange(wk) + '</span><button class="iconbtn" data-a="tsWeek" data-v="1" aria-label="Next week">' + ic('chevR', 's') + '</button></div></div>' +
      timerBar() + '<div class="seg dayseg" role="group" aria-label="Day">' + days.map(function (d, i) {
        return '<button data-a="tsDay" data-v="' + d + '" class="' + (ui.tsDay === d ? 'on' : '') + '"><b>' + S.DAYS[i] + (state.adjera[d] ? ' ✓' : '') + '</b><span>' + (dayTot[i] ? dayTot[i].toFixed(2) : '–') + '</span></button>';
      }).join('') + '</div></div>';
    h += '<div class="row wrap hide-narrow" style="gap:12px"><div class="card pad stack" style="flex:1 1 200px;gap:4px"><span class="lbl">This week</span><span class="num" style="font-size:24px;font-weight:800">' + weekTot.toFixed(2) + ' <span class="sub" style="font-size:14px">/ ' + (state.settings.capacity || 40) + ' h</span></span></div>' +
      '<div class="card pad stack" style="flex:1 1 200px;gap:4px"><span class="lbl">Entered in Adjera</span><span class="num" style="font-size:24px;font-weight:800">' + entered + ' <span class="sub" style="font-size:14px">of ' + daysWith + ' days with time</span></span></div></div>';
    h += '<div class="card clip hide-narrow" style="overflow-x:auto"><table class="ts"><thead><tr><th>Project</th>' + days.map(function (d, i) { return '<th class="' + (d === t ? 'today' : '') + '">' + S.DAYS[i] + ' ' + S.parseISO(d).getDate() + (state.adjera[d] ? ' ✓' : '') + '</th>'; }).join('') + '<th>Total</th><th>Planned</th></tr></thead><tbody>' +
      pids.map(function (pid, r) {
        var p = proj(pid), pp = p ? person(p.pm) : null;
        var e = W ? W.entries.find(function (x) { return x.pid === pid; }) : null;
        var tot = grid[r].reduce(function (a, b) { return a + b; }, 0);
        return '<tr><td><span class="row" style="gap:8px;' + pcVar(pp) + '"><span class="dot"></span><b>' + esc(pidLabel(pid)) + '</b><span class="sub ell" style="max-width:240px">' + esc(pidName(pid)) + '</span></span></td>' +
          grid[r].map(function (v, i) { return '<td class="' + (days[i] === t ? 'today ' : '') + (v ? '' : 'empty') + '">' + (v ? v.toFixed(2) : '–') + '</td>'; }).join('') +
          '<td><b>' + tot.toFixed(2) + '</b></td><td class="sub">' + (e && e.hours ? fmtH(parseFloat(e.hours)) : '—') + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td>Day total</td>' + dayTot.map(function (v, i) { return '<td class="' + (days[i] === t ? 'today' : '') + '">' + (v ? v.toFixed(2) : '–') + '</td>'; }).join('') + '<td>' + weekTot.toFixed(2) + '</td><td></td></tr></tfoot></table></div>';
    // day detail
    var di = days.indexOf(ui.tsDay);
    var lines = pids.map(function (pid, r) { return [pidLabel(pid), grid[r][di]]; }).filter(function (x) { return x[1] > 0; });
    var copyText = lines.map(function (x) { return x[0] + '\t' + x[1].toFixed(2); }).join('\n');
    var shownText = lines.map(function (x) { return (x[0] + '          ').slice(0, 10) + x[1].toFixed(2); }).join('\n') + (lines.length ? '\n' + ('Total     ').slice(0, 10) + dayTot[di].toFixed(2) : '');
    var entries = state.time.filter(function (x) { return x.date === ui.tsDay; }).sort(function (a, b) { return (b.start || 0) - (a.start || 0); });
    h += '<div class="cols"><section class="col-main"><div class="row" style="justify-content:space-between"><h2 class="h2">' + fmtDay(ui.tsDay) + '</h2>' + (state.adjera[ui.tsDay] ? '<span class="tag good">Entered in Adjera</span>' : (dayTot[di] ? '<span class="tag warn">Not in Adjera yet</span>' : '')) + '</div>' +
      '<div class="card clip list">' + (state.timer && S.iso(new Date(state.timer.start)) === ui.tsDay ? '<div class="erow" style="background:var(--accent-soft);color:var(--accent-strong)"><span class="num" style="flex:0 0 110px;font-weight:700">' + clock(state.timer.start) + ' – now</span><b>' + esc(pidLabel(state.timer.pid)) + '</b><span class="grow ell">' + esc(pidName(state.timer.pid)) + '</span><span class="num" style="font-weight:800" data-elapsed>' + elapsedText() + '</span></div>' : '') +
      (entries.length ? entries.map(function (x) {
        return '<div class="erow"><span class="num sub" style="flex:0 0 110px">' + (x.start ? clock(x.start) + ' – ' + clock(x.end) : 'Added by hand') + '</span><b class="num">' + esc(pidLabel(x.pid)) + '</b><span class="grow ell sub">' + esc(x.note || pidName(x.pid)) + '</span><span class="num">' + fmtH(x.minutes / 60) + ' h</span><button class="iconbtn plain sm" data-a="delTime" data-id="' + x.id + '" aria-label="Delete entry">' + ic('x', 's') + '</button></div>';
      }).join('') : (state.timer && S.iso(new Date(state.timer.start)) === ui.tsDay ? '' : '<div class="empty">Nothing logged. Start a timer on a card, or add time below.</div>')) + '</div>' +
      '<div class="card pad stack"><span class="lbl">Add time by hand</span><div class="row wrap" style="gap:8px"><input class="inp" id="ts-proj" list="ts-projlist" placeholder="Project number" style="flex:1 1 160px" aria-label="Project"><datalist id="ts-projlist"><option value="Overhead"></option>' +
      Object.keys(state.projects).map(proj).sort(function (a, b) { return lastSort(b) > lastSort(a) ? 1 : -1; }).map(function (p) { return '<option value="' + esc(p.number) + ' ' + esc(p.name) + '"></option>'; }).join('') + '</datalist>' +
      '<input class="inp num" id="ts-hours" placeholder="Hours" inputmode="decimal" style="flex:0 0 90px" aria-label="Hours"><input class="inp" id="ts-note" placeholder="Note (optional)" style="flex:1 1 160px" aria-label="Note"><button class="btn" data-a="addTime">' + ic('plus', 's') + 'Add</button></div>' + (ui.tsError ? '<span class="tag warn" style="align-self:flex-start">' + esc(ui.tsError) + '</span>' : '') + '</div></section>' +
      '<aside class="col-side"><div class="card pad stack"><h2 class="h2">Copy for Adjera</h2>' + (lines.length ? '<div class="copybox">' + esc(shownText) + '</div>' : '<span class="sub">No time on this day yet.</span>') +
      '<button class="btn pri" data-a="copyDay" data-v="' + esc(copyText) + '"' + (lines.length ? '' : ' disabled') + '>' + ic('copy', 's') + 'Copy ' + S.DAYS[di] + '</button>' +
      '<label class="row" style="min-height:40px"><input type="checkbox" class="chk" data-a="entered" data-v="' + ui.tsDay + '"' + (state.adjera[ui.tsDay] ? ' checked' : '') + '>Mark ' + S.DAYS[di] + ' as entered in Adjera</label>' +
      '<span class="sub" style="font-size:12px">Copies one line per project: number, tab, hours. Overhead uses the code set in Settings.</span></div></aside></div>';
    return h;
  }
  function clock(ms) { var d = new Date(ms); var hh = d.getHours(), mm = d.getMinutes(); return ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' am' : ' pm'); }

  /* ---------- Settings ---------- */
  function viewSettings() {
    var set = state.settings;
    var count = function (pid) { return Object.keys(state.projects).filter(function (k) { return state.projects[k].pm === pid; }).length; };
    function personRow(p) {
      var open = ui.openPerson === p.id;
      var same = state.people.filter(function (o) { return o.id !== p.id && !o.archived && o.color === p.color; }).map(function (o) { return o.name; });
      var h = '<div><div class="row" style="padding:10px 16px;' + pcVar(p) + '"><span class="dot" style="width:14px;height:14px"></span><div class="grow stack" style="gap:1px"><b>' + esc(p.name) + '</b><span class="sub">' + count(p.id) + ' projects</span></div>' +
        (p.archived ? '<button class="btn ghost" data-a="restorePm" data-id="' + p.id + '">Restore</button>' : '<button class="btn ghost" data-a="openPm" data-id="' + p.id + '" aria-expanded="' + open + '">' + ic('plan', 's') + (open ? 'Done' : 'Edit') + '</button>') + '</div>';
      if (open) {
        h += '<div class="stack" style="padding:2px 16px 14px 42px"><label class="field" style="max-width:280px"><span class="lbl">Name</span><input class="inp" id="pn-' + p.id + '" data-in="pmName" data-id="' + p.id + '" value="' + esc(p.name) + '"></label>' +
          '<div class="stack" style="gap:6px"><span class="lbl">Colour</span><div class="row wrap" style="gap:8px" role="radiogroup" aria-label="Colour for ' + esc(p.name) + '">' +
          S.PALETTE.map(function (c) { return '<button class="sw' + (p.color === c[0] ? ' on' : '') + '" role="radio" aria-checked="' + (p.color === c[0]) + '" aria-label="' + c[1] + '" title="' + c[1] + '" style="--pc:var(--c-' + c[0] + ')" data-a="pmColor" data-id="' + p.id + '" data-v="' + c[0] + '"></button>'; }).join('') + '</div>' +
          '<span class="sub" style="font-size:12px">' + (same.length ? 'Also used by ' + esc(same.join(', ')) + '.' : 'Only ' + esc(p.name) + ' uses this colour.') + '</span></div>' +
          '<div><button class="btn" data-a="archivePm" data-id="' + p.id + '">Archive ' + esc(p.name) + '</button></div></div>';
      }
      return h + '</div>';
    }
    var active = state.people.filter(function (p) { return !p.archived; }), archived = state.people.filter(function (p) { return p.archived; });
    var h = '<div class="pagehead"><div class="grow"><h1 class="h1">Settings</h1><div class="sub">PMs and colours, Revit versions, backup</div></div></div><div class="cols"><section class="card clip" style="flex:999 1 480px;min-width:0" aria-label="PMs">' +
      '<div class="pad stack"><div class="row" style="justify-content:space-between"><h2 class="h2">PMs / project leads</h2><span class="sub hide-narrow">Colour shows on cards, filters and timesheet</span></div>' +
      '<div class="row"><input class="inp grow" id="newpm-s" data-k="newpmS" value="' + esc(ui.newPm) + '" data-in="newPm" placeholder="Add a PM, e.g. Taylor" aria-label="New PM name"><button class="btn pri" data-a="addPm">' + ic('plus', 's') + 'Add PM</button></div></div>' +
      '<div class="list" style="border-top:1px solid var(--gridline)">' + active.map(personRow).join('') + '</div>' +
      (archived.length ? '<div style="padding:10px 16px 4px;border-top:1px solid var(--gridline)"><span class="lbl">Archived · hidden from filters, kept on old projects</span></div><div class="list">' + archived.map(personRow).join('') + '</div>' : '') + '</section>';
    h += '<aside class="col-side"><section class="card pad stack" aria-label="Revit versions"><h2 class="h2">Revit versions</h2><span class="sub">Suggested first in the Revit field. Any other version can still be typed.</span><div class="row wrap" style="gap:6px">' +
      set.revitVersions.map(function (v) { return '<span class="vchip">' + esc(v) + '<button data-a="delVer" data-v="' + esc(v) + '" aria-label="Remove ' + esc(v) + '">' + ic('x', 's', 'width:13px;height:13px') + '</button></span>'; }).join('') + '</div>' +
      '<div class="row"><input class="inp grow" id="newver" data-k="newver" data-in="newVer" value="' + esc(ui.newVer) + '" placeholder="e.g. RVT28" aria-label="Add Revit version"><button class="btn" data-a="addVer">Add</button></div></section>';
    h += '<section class="card pad stack" aria-label="Timesheet"><h2 class="h2">Timesheet</h2><label class="field"><span class="lbl">Adjera code for overhead (meetings, admin)</span><input class="inp" id="ohcode" data-in="ohcode" value="' + esc(set.overheadCode) + '" placeholder="e.g. the overhead number"></label>' +
      '<label class="field"><span class="lbl">Hours per week</span><input class="inp num" id="cap" data-in="capacity" value="' + esc(set.capacity) + '" inputmode="decimal"></label></section>';
    h += '<section class="card pad stack" aria-label="Appearance"><h2 class="h2">Appearance</h2><div class="seg">' + [['auto', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) { return '<button data-a="theme" data-v="' + o[0] + '" class="' + (set.theme === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div></section>';
    h += '<section class="card pad stack" aria-label="Data"><h2 class="h2">Data</h2><span class="sub">Saved only in this browser on this laptop. Back up now and then: clearing browser data erases it.</span>' +
      '<div class="row wrap"><button class="btn" data-a="export">' + ic('download', 's') + 'Back up (download file)</button><label class="btn">' + ic('upload', 's') + 'Restore backup or import projects<input type="file" accept="application/json,.json" data-in="import" class="sr"></label></div>' +
      '<span class="sub" style="font-size:12px">' + (set.lastBackup ? 'Last backup ' + fmtDay(set.lastBackup.slice(0, 10)) : 'Never backed up') + '</span>' +
      (state.seedInfo && state.seedInfo.count ? '<details><summary class="sub" style="cursor:pointer">OneNote import: ' + state.seedInfo.count + ' projects · items to check</summary><ul class="sub" style="padding-left:18px;margin:8px 0 0">' + (state.seedInfo.needsReview || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' : '') +
      '<button class="btn ghost danger" data-a="reset" style="align-self:flex-start">Erase all data on this browser</button></section></aside></div>';
    return h;
  }

  /* ---------- modal: new project ---------- */
  function modalHtml() {
    var m = ui.modal, d = m.draft;
    return '<div class="modal-bg" data-a="modalBg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="np-h"><h2 class="h2" id="np-h">New project</h2>' +
      '<div class="row wrap" style="gap:12px;align-items:flex-start"><label class="field" style="flex:0 1 140px"><span class="lbl">Number</span><input class="inp num" id="np-number" data-in="np" data-v="number" value="' + esc(d.number) + '"></label>' +
      '<label class="field" style="flex:1 1 240px"><span class="lbl">Name</span><input class="inp" id="np-name" data-in="np" data-v="name" value="' + esc(d.name) + '"></label></div>' +
      '<div class="row wrap" style="gap:12px;align-items:flex-start"><label class="field" style="flex:0 1 180px"><span class="lbl">Revit version</span><input class="inp" id="np-revit" list="np-rvt" data-in="np" data-v="revit" value="' + esc(d.revit) + '" placeholder="e.g. RVT26"><datalist id="np-rvt">' + state.settings.revitVersions.map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join('') + '</datalist></label>' +
      '<label class="field" style="flex:1 1 200px"><span class="lbl">PM</span><select class="inp" id="np-pm" data-in="np" data-v="pm"><option value="">No PM</option>' + state.people.filter(function (p) { return !p.archived; }).map(function (p) { return '<option value="' + p.id + '"' + (d.pm === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="row"><input type="checkbox" class="chk" id="np-week" data-in="np" data-v="week"' + (d.week ? ' checked' : '') + '>Add to the week being planned</label>' +
      (m.error ? '<span class="tag warn" style="align-self:flex-start">' + esc(m.error) + '</span>' : '') +
      '<div class="row" style="justify-content:flex-end"><button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="createProject">Create</button></div></div></div>';
  }

  /* ---------- render ---------- */
  function render() {
    var a = document.activeElement, f = null;
    if (a && a.id) { f = { id: a.id }; try { f.s = a.selectionStart; f.e = a.selectionEnd; } catch (e) { /* not text */ } }
    var r = route(), c;
    if (r.name === 'plan') c = viewPlan();
    else if (r.name === 'projects') c = viewProjects();
    else if (r.name === 'project') c = viewProject(r.id);
    else if (r.name === 'time') c = viewTime();
    else if (r.name === 'settings') c = viewSettings();
    else c = viewWeek();
    document.getElementById('root').innerHTML = shell(c, r);
    if (f) {
      var el = document.getElementById(f.id);
      if (el) { el.focus({ preventScroll: true }); if (f.s != null) { try { el.setSelectionRange(f.s, f.e); } catch (e) { /* ignore */ } } }
    }
    save();
  }
  function applyTheme() {
    var t = state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  function focusLater(id) { setTimeout(function () { var el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* */ } } }, 0); }

  /* ---------- actions ---------- */
  function itemById(id) { return state.items.find(function (i) { return i.id === id; }); }
  /* An item moves together with its sub-items. It takes the level of the item it lands next to. */
  function subtree(list, it) {
    var i = list.indexOf(it), j = i + 1;
    while (j < list.length && list[j].level > it.level) j++;
    return list.slice(i, j);
  }
  function moveItem(dragId, targetId, after) {
    var d = itemById(dragId), t = itemById(targetId);
    if (!d || !t || d === t || d.pid !== t.pid) return false;
    var list = S.itemsFor(state, d.pid);
    var block = subtree(list, d);
    if (block.indexOf(t) !== -1) return false;
    var rest = list.filter(function (x) { return block.indexOf(x) === -1; });
    var idx = rest.indexOf(t);
    if (after) idx += subtree(rest, t).length;
    var delta = t.level - d.level;
    block.forEach(function (x) { x.level = Math.max(0, Math.min(4, x.level + delta)); });
    Array.prototype.splice.apply(rest, [idx, 0].concat(block));
    var k = 0;
    state.items = state.items.map(function (x) { return x.pid === d.pid ? rest[k++] : x; });
    return true;
  }
  function nudgeItem(id, dir) {
    var d = itemById(id);
    if (!d) return false;
    var list = S.itemsFor(state, d.pid), i = list.indexOf(d);
    if (dir < 0) {
      var p = i - 1;
      while (p >= 0 && list[p].level > d.level) p--;
      return p >= 0 && moveItem(id, list[p].id, false);
    }
    var j = i + subtree(list, d).length;
    return j < list.length && moveItem(id, list[j].id, true);
  }
  function weekEntries(key) { return S.ensureWeek(state, key).entries; }
  function addEntry(key, pid) {
    var es = weekEntries(key);
    if (es.some(function (e) { return e.pid === pid; })) return;
    es.push({ pid: pid, hours: '', label: '', day: '', date: '' });
    if (state.projects[pid] && state.projects[pid].status === 'archived') state.projects[pid].status = 'active';
  }
  function openEdit(id) {
    var p = proj(id);
    ui.edit = id; ui.pmMenu = false; ui.draftError = '';
    ui.draft = { number: p.number, name: p.name, revit: p.revit, pm: p.pm, status: p.status };
  }

  var actions = {
    fold: function (t) { ui.fold[t.dataset.id] = !ui.fold[t.dataset.id]; },
    compact: function () { state.settings.compact = !state.settings.compact; ui.fold = {}; },
    group: function (t) { state.settings.group = t.dataset.v; if (t.dataset.v !== 'pm') state.settings.pm = 'all'; },
    weekDone: function (t) {
      var e = weekEntries(curWeek()).find(function (x) { return x.pid === t.dataset.id; });
      if (!e) return;
      e.done = !e.done;
      if (e.done) showToast(proj(e.pid).number + ' is done for this week and moved to the bottom.', function () { e.done = false; });
    },
    pmf: function (t) { state.settings.pm = t.dataset.v; },
    timer: function (t) {
      var id = t.dataset.id;
      if (state.timer && state.timer.pid === id) S.stopTimer(state); else S.startTimer(state, id);
    },
    stopTimer: function () { S.stopTimer(state); },
    toggleItem: function (t) { var it = itemById(t.dataset.id); if (!it) return; it.done = !it.done; it.doneAt = it.done ? S.today() : ''; },
    editItem: function (t) { ui.editItem = t.dataset.id; focusLater('edit-' + t.dataset.id); },
    indent: function (t) { var it = itemById(t.dataset.id); if (it) it.level = Math.min(4, it.level + 1); },
    outdent: function (t) { var it = itemById(t.dataset.id); if (it) it.level = Math.max(0, it.level - 1); },
    kind: function (t) { var it = itemById(t.dataset.id); if (it) { it.kind = it.kind === 'task' ? 'note' : 'task'; it.done = false; } },
    delItem: function (t) {
      var i = state.items.findIndex(function (x) { return x.id === t.dataset.id; });
      if (i === -1) return;
      var removed = state.items.splice(i, 1)[0];
      showToast('Deleted “' + removed.text.slice(0, 40) + '”', function () { state.items.splice(i, 0, removed); });
    },
    showDone: function (t) { ui.showDone[t.dataset.id] = !ui.showDone[t.dataset.id]; },
    seedWeek: function () {
      var lw = state.seedInfo.lastOneNoteWeek, key = route().name === 'plan' ? planKey() : curWeek();
      lw.numbers.forEach(function (n) { if (state.projects['p_' + n]) addEntry(key, 'p_' + n); });
      state.seedInfo.weekSeeded = true;
      if (route().name !== 'plan') location.hash = '#/plan';
    },
    planWeek: function (t) { ui.planOffset = +t.dataset.v; },
    addEntry: function (t) { addEntry(planKey(), t.dataset.id); ui.planQ = ''; focusLater('h-' + t.dataset.id); },
    removeEntry: function (t) {
      var key = planKey(), es = weekEntries(key), i = es.findIndex(function (e) { return e.pid === t.dataset.id; });
      if (i === -1) return;
      var removed = es.splice(i, 1)[0];
      showToast(proj(removed.pid).number + ' removed from the week. Tasks and notes are kept.', function () { weekEntries(key).splice(i, 0, removed); });
    },
    day: function (t) {
      var e = weekEntries(planKey()).find(function (x) { return x.pid === t.dataset.id; });
      if (!e) return;
      e.day = e.day === t.dataset.v ? '' : t.dataset.v; e.date = '';
    },
    addEntryHere: function (t) { addEntry(curWeek(), t.dataset.id); },
    removeEntryHere: function (t) {
      var es = weekEntries(curWeek()), i = es.findIndex(function (e) { return e.pid === t.dataset.id; });
      if (i !== -1) es.splice(i, 1);
    },
    editProject: function (t) {
      openEdit(t.dataset.id);
      if (route().name !== 'project' || route().id !== t.dataset.id) location.hash = '#/p/' + encodeURIComponent(t.dataset.id);
      focusLater('ed-revit');
    },
    pmMenu: function () { ui.pmMenu = !ui.pmMenu; },
    pickPm: function (t) { ui.draft.pm = t.dataset.v; ui.pmMenu = false; },
    draftStatus: function (t) { ui.draft.status = t.dataset.v; },
    cancelEdit: function () { ui.edit = null; ui.draft = null; ui.pmMenu = false; },
    saveEdit: function (t) {
      var p = proj(t.dataset.id), d = ui.draft;
      var num = String(d.number || '').trim();
      if (!num) { ui.draftError = 'Number is required'; return; }
      var clash = Object.keys(state.projects).some(function (k) { return k !== p.id && state.projects[k].number === num; });
      if (clash) { ui.draftError = 'Another project already uses ' + num; return; }
      p.number = num; p.name = String(d.name || '').trim() || p.name; p.revit = String(d.revit || '').trim(); p.pm = d.pm; p.status = d.status;
      ui.edit = null; ui.draft = null; ui.pmMenu = false;
    },
    deleteProject: function (t) {
      var p = proj(t.dataset.id);
      if (!window.confirm('Delete ' + p.number + ' ' + p.name + '? Its tasks, notes and logged time are removed too.')) return;
      delete state.projects[p.id];
      state.items = state.items.filter(function (i) { return i.pid !== p.id; });
      state.journal = state.journal.filter(function (j) { return j.pid !== p.id; });
      state.time = state.time.filter(function (x) { return x.pid !== p.id; });
      Object.keys(state.weeks).forEach(function (k) { state.weeks[k].entries = state.weeks[k].entries.filter(function (e) { return e.pid !== p.id; }); });
      if (state.timer && state.timer.pid === p.id) state.timer = null;
      ui.edit = null; ui.draft = null;
      location.hash = '#/projects';
    },
    addJournal: function (t) { addJournal(t.dataset.id); },
    delJournal: function (t) {
      var i = state.journal.findIndex(function (j) { return j.id === t.dataset.id; });
      if (i === -1) return;
      var removed = state.journal.splice(i, 1)[0];
      showToast('Journal note deleted', function () { state.journal.splice(i, 0, removed); });
    },
    projView: function (t) { ui.projView = t.dataset.v; ui.projAll = false; },
    projPm: function (t) { ui.projPm = t.dataset.v; ui.projAll = false; },
    projSort: function (t) { ui.projSort = t.dataset.v; },
    projAll: function () { ui.projAll = true; },
    newProject: function (t) {
      var v = (t.dataset.v || '').trim(), isNum = /^\d[\d.]*$/.test(v);
      ui.modal = { draft: { number: isNum ? v : '', name: isNum ? '' : v, revit: '', pm: '', week: route().name === 'plan' }, error: '' };
      focusLater(isNum ? 'np-name' : 'np-number');
    },
    closeModal: function () { ui.modal = null; },
    modalBg: function (t, e) { if (e.target === t) ui.modal = null; else return false; },
    createProject: function () {
      var d = ui.modal.draft, num = String(d.number || '').trim(), name = String(d.name || '').trim();
      if (!num || !name) { ui.modal.error = 'Number and name are both needed'; return; }
      if (Object.keys(state.projects).some(function (k) { return state.projects[k].number === num; })) { ui.modal.error = num + ' already exists. Search for it instead.'; return; }
      var id = 'p_' + num.replace(/[^\w.]/g, '_');
      if (state.projects[id]) id = S.uid('p_');
      state.projects[id] = { id: id, number: num, name: name, revit: String(d.revit || '').trim(), pm: d.pm || '', status: 'active', notes: '', firstSeen: '', lastSeen: '', created: S.today() };
      if (d.week) addEntry(planKey(), id);
      ui.modal = null; ui.planQ = '';
      if (route().name === 'projects') location.hash = '#/p/' + encodeURIComponent(id);
    },
    tsWeek: function (t) { ui.tsOffset += +t.dataset.v; ui.tsDay = null; },
    tsDay: function (t) { ui.tsDay = t.dataset.v; },
    delTime: function (t) {
      var i = state.time.findIndex(function (x) { return x.id === t.dataset.id; });
      if (i === -1) return;
      var removed = state.time.splice(i, 1)[0];
      showToast('Time entry deleted', function () { state.time.splice(i, 0, removed); });
    },
    addTime: function () {
      var pv = (document.getElementById('ts-proj').value || '').trim();
      var hv = parseFloat((document.getElementById('ts-hours').value || '').replace(',', '.'));
      var note = (document.getElementById('ts-note').value || '').trim();
      ui.tsError = '';
      var pid = null;
      if (/^overhead/i.test(pv)) pid = 'OH';
      else {
        var num = pv.split(/\s+/)[0];
        var k = Object.keys(state.projects).find(function (x) { return state.projects[x].number === num; });
        if (k) pid = k;
      }
      if (!pid) { ui.tsError = 'Pick a project from the list (or type Overhead)'; return; }
      if (!(hv > 0)) { ui.tsError = 'Enter hours, e.g. 1.5'; return; }
      state.time.push({ id: S.uid('t'), pid: pid, date: ui.tsDay, start: 0, end: 0, minutes: Math.round(hv * 60), note: note, src: 'manual' });
    },
    copyDay: function (t) {
      var text = t.dataset.v;
      var done = function () { showToast('Copied. Paste into Adjera.'); render(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this:', text); });
      else window.prompt('Copy this:', text);
      return false;
    },
    entered: function (t) { var d = t.dataset.v; if (state.adjera[d]) delete state.adjera[d]; else state.adjera[d] = new Date().toISOString(); },
    openPm: function (t) { ui.openPerson = ui.openPerson === t.dataset.id ? null : t.dataset.id; },
    pmColor: function (t) { var p = person(t.dataset.id); if (p) p.color = t.dataset.v; },
    archivePm: function (t) { var p = person(t.dataset.id); if (p) { p.archived = true; ui.openPerson = null; } },
    restorePm: function (t) { var p = person(t.dataset.id); if (p) p.archived = false; },
    addPm: function () { var p = addPerson(ui.newPm); if (p) { ui.newPm = ''; ui.openPerson = p.id; } },
    delVer: function (t) { state.settings.revitVersions = state.settings.revitVersions.filter(function (v) { return v !== t.dataset.v; }); },
    addVer: function () {
      var v = ui.newVer.trim().toUpperCase();
      if (v && state.settings.revitVersions.indexOf(v) === -1) state.settings.revitVersions.unshift(v);
      ui.newVer = '';
    },
    theme: function (t) { state.settings.theme = t.dataset.v; applyTheme(); },
    export: function () {
      state.settings.lastBackup = new Date().toISOString();
      S.saveNow(state);
      var blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'project-log-backup-' + S.today() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      showToast('Backup downloaded. Keep it in a OneDrive folder.');
    },
    reset: function () {
      if (!window.confirm('Erase everything in this app on this browser? Download a backup first if you want to keep your data.')) return false;
      state = S.fromSeed(window.SEED || {});
      ui.edit = null; ui.draft = null;
      location.hash = '#/week';
    },
    undo: function () { if (ui.toast && ui.toast.undo) ui.toast.undo(); ui.toast = null; },
    closeToast: function () { ui.toast = null; }
  };

  function addJournal(pid) {
    var el = document.getElementById('jn-' + pid);
    var text = el ? el.value.trim() : '';
    if (!text) return;
    state.journal.push({ id: S.uid('j'), pid: pid, date: S.today(), text: text });
    if (el) el.value = '';
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-a]');
    if (!t) return;
    var fn = actions[t.dataset.a];
    if (!fn) return;
    if (t.tagName === 'A') e.preventDefault();
    var res = fn(t, e);
    if (res !== false) render();
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key === 'Escape' && ui.modal) { ui.modal = null; render(); return; }
    if (e.key === 'Enter' && t.classList && t.classList.contains('txt')) { e.preventDefault(); actions.editItem(t); render(); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && t.classList && t.classList.contains('txt')) {
      e.preventDefault();
      var mid = t.dataset.id;
      if (nudgeItem(mid, e.key === 'ArrowUp' ? -1 : 1)) { render(); var el = document.getElementById('txt-' + mid); if (el) el.focus(); }
      return;
    }
    var k = t.dataset && t.dataset.k;
    if (!k) {
      if (e.key === 'Enter' && t.id === 'planq') {
        e.preventDefault();
        var first = document.querySelector('.results [data-a="addEntry"]');
        if (first) { actions.addEntry(first); render(); }
      }
      return;
    }
    if (k === 'add') {
      var pid = t.dataset.id;
      if (e.key === 'Tab') { e.preventDefault(); ui.addLevel[pid] = Math.max(0, Math.min(4, (ui.addLevel[pid] || 0) + (e.shiftKey ? -1 : 1))); render(); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (S.addItem(state, pid, t.value, ui.addLevel[pid] || 0)) { t.value = ''; render(); } return; }
      if (e.key === 'Escape') { t.value = ''; ui.addLevel[pid] = 0; render(); }
      return;
    }
    if (k === 'editItem') {
      var it = itemById(t.dataset.id);
      if (!it) return;
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(t); return; }
      if (e.key === 'Escape') { ui.editItem = null; render(); return; }
      if (e.key === 'Tab') { e.preventDefault(); it.text = t.value.trim() || it.text; it.level = Math.max(0, Math.min(4, it.level + (e.shiftKey ? -1 : 1))); render(); return; }
      return;
    }
    if (k === 'journal' && e.key === 'Enter') { e.preventDefault(); addJournal(t.dataset.id); render(); return; }
    if (k === 'newpm' && e.key === 'Enter') { e.preventDefault(); var p = addPerson(t.value); if (p && ui.draft) { ui.draft.pm = p.id; ui.pmMenu = false; } render(); return; }
    if (k === 'newpmS' && e.key === 'Enter') { e.preventDefault(); actions.addPm(); render(); return; }
    if (k === 'newver' && e.key === 'Enter') { e.preventDefault(); actions.addVer(); render(); }
  });
  function commitEdit(t) {
    var it = itemById(t.dataset.id);
    if (it) {
      var v = t.value.trim();
      if (v) it.text = v;
    }
    ui.editItem = null;
    render();
  }
  /* Drag and drop to reorder tasks and notes (grab the dotted handle on the left). */
  var dragId = null;
  function clearDrop() { document.querySelectorAll('.drop-before, .drop-after').forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); }); }
  function dropRow(e) {
    var row = e.target && e.target.closest ? e.target.closest('[data-item]') : null;
    if (!row || !dragId) return null;
    var d = itemById(dragId), t = itemById(row.dataset.item);
    if (!d || !t || d.pid !== t.pid || d === t) return null;
    var r = row.getBoundingClientRect();
    return { row: row, after: e.clientY > r.top + r.height / 2 };
  }
  document.addEventListener('dragstart', function (e) {
    var g = e.target && e.target.closest ? e.target.closest('[data-drag]') : null;
    if (!g) return;
    dragId = g.dataset.drag;
    var row = g.closest('.item');
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); if (row) e.dataTransfer.setDragImage(row, 16, 12); } catch (err) { /* older browsers */ }
    if (row) setTimeout(function () { row.classList.add('dragging'); }, 0);
  });
  document.addEventListener('dragover', function (e) {
    if (!dragId) return;
    var hit = dropRow(e);
    clearDrop();
    if (!hit) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* */ }
    hit.row.classList.add(hit.after ? 'drop-after' : 'drop-before');
  });
  document.addEventListener('drop', function (e) {
    if (!dragId) return;
    e.preventDefault();
    var hit = dropRow(e), id = dragId;
    dragId = null; clearDrop();
    if (hit) moveItem(id, hit.row.dataset.item, hit.after);
    render();
  });
  document.addEventListener('dragend', function () {
    dragId = null; clearDrop();
    document.querySelectorAll('.dragging').forEach(function (x) { x.classList.remove('dragging'); });
  });

  document.addEventListener('focusout', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.k === 'editItem' && ui.editItem === t.dataset.id) setTimeout(function () { if (ui.editItem === t.dataset.id) commitEdit(t); }, 120);
  });
  document.addEventListener('input', function (e) {
    var t = e.target, k = t.dataset && t.dataset.in;
    if (!k) return;
    var key = planKey();
    switch (k) {
      case 'scratch': state.scratch = t.value; save(); break;
      case 'notes': if (proj(t.dataset.id)) { proj(t.dataset.id).notes = t.value; save(); } break;
      case 'planq': ui.planQ = t.value; render(); break;
      case 'projq': ui.projQ = t.value; ui.projAll = false; render(); break;
      case 'hours': {
        var e1 = weekEntries(key).find(function (x) { return x.pid === t.dataset.id; });
        if (e1) { e1.hours = t.value.replace(',', '.'); save(); updatePlanTotal(key); }
        break;
      }
      case 'label': {
        var e2 = weekEntries(key).find(function (x) { return x.pid === t.dataset.id; });
        if (e2) { e2.label = t.value; save(); }
        break;
      }
      case 'draft': if (ui.draft) ui.draft[t.dataset.v] = t.value; break;
      case 'np': if (ui.modal) ui.modal.draft[t.dataset.v] = t.type === 'checkbox' ? t.checked : t.value; break;
      case 'pmName': { var pp = person(t.dataset.id); if (pp && t.value.trim()) { pp.name = t.value; save(); } break; }
      case 'newPm': ui.newPm = t.value; break;
      case 'newVer': ui.newVer = t.value; break;
      case 'ohcode': state.settings.overheadCode = t.value.trim(); save(); break;
      case 'capacity': state.settings.capacity = parseFloat(t.value) || 40; save(); break;
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, k = t.dataset && t.dataset.in;
    if (!k) return;
    if (k === 'rvt') {
      var p = proj(t.dataset.id);
      if (p) { p.revit = t.value.trim(); t.classList.toggle('set', !!p.revit); save(); }
    } else if (k === 'date') {
      var e3 = weekEntries(planKey()).find(function (x) { return x.pid === t.dataset.id; });
      if (e3) { e3.date = t.value; e3.day = ''; render(); }
    } else if (k === 'np') {
      if (ui.modal) ui.modal.draft[t.dataset.v] = t.type === 'checkbox' ? t.checked : t.value;
    } else if (k === 'import') {
      var file = t.files && t.files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var data = JSON.parse(rd.result);
          if (data && Array.isArray(data.projects)) {
            var n = S.mergeSeed(state, data);
            S.saveNow(state);
            showToast('Imported ' + n + ' projects from ' + file.name);
            render();
            return;
          }
          if (!data || typeof data.projects !== 'object') throw new Error('Not a Project Log backup');
          if (!window.confirm('Replace everything in this app with the backup from ' + file.name + '?')) return;
          state = S.migrate(data); S.saveNow(state); showToast('Backup restored'); render();
        } catch (err) { window.alert('Could not read that file: ' + err.message); }
      };
      rd.readAsText(file);
    }
  });
  function updatePlanTotal(key) {
    var es = weekEntries(key);
    var total = es.reduce(function (a, e) { return a + (parseFloat(e.hours) || 0); }, 0);
    var cap = parseFloat(state.settings.capacity) || 40;
    var a = document.querySelector('[data-bind="planTotal"]'), m = document.querySelector('[data-bind="planMeter"]');
    if (a) a.textContent = fmtH(total);
    if (m) m.style.width = Math.min(100, Math.round(total / cap * 100)) + '%';
  }

  window.addEventListener('hashchange', function () { ui.pmMenu = false; if (route().name !== 'project') { ui.edit = null; ui.draft = null; } render(); window.scrollTo(0, 0); });
  setInterval(function () { if (!state.timer) return; document.querySelectorAll('[data-elapsed]').forEach(function (el) { el.textContent = elapsedText(); }); }, 1000);
  setInterval(function () { if (state.timer && !document.activeElement.matches('input, textarea')) render(); }, 60000);
  window.addEventListener('beforeunload', function () { S.saveNow(state); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) S.saveNow(state); });

  applyTheme();
  render();
})();
