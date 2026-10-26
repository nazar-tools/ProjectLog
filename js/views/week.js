// This week: a card per project, grouped by deadline, PM or number. Earlier weeks open
// read-only from the week picker, for catching up on the timesheet on Monday morning.

function viewWeek() {
  const cw = curWeek();
  const wk = ui.viewWeek || cw;
  const past = wk < cw;
  const set = state.settings;
  const R = S.weekRange(wk);
  const week = past ? state.weeks[wk] || { entries: [] } : S.peekWeek(state, wk);
  const entries = week.entries.filter(e => proj(e.pid));
  if (past) entries.push(...timeOnlyEntries(entries, R));

  const present = state.people.filter(p => entries.some(e => proj(e.pid).pm === p.id));
  const pmFilter = set.group === 'pm' && present.some(p => p.id === set.pm) ? set.pm : 'all';
  const shown = entries.filter(e => pmFilter === 'all' || proj(e.pid).pm === pmFilter);
  const todo = shown.filter(e => !e.done);
  const done = shown.filter(e => e.done).sort(byNumberDesc);
  const ctx = { wk, R, past };

  let subline;
  if (past) {
    const logged = S.minutesFor(state, null, R.startIso, R.endIso) / 60;
    subline = `Past week · ${plural(entries.length, 'project')} · ${fmtH(logged)} h logged`;
  } else {
    subline = `${fmtRange(wk)} · ${WD[new Date().getDay()]} · ${todo.length} to do${done.length ? ` · ${done.length} done` : ''}`;
  }
  const title = wk === cw ? 'This week' : fmtRange(wk) + (wk.slice(0, 4) !== cw.slice(0, 4) ? ', ' + wk.slice(0, 4) : '');
  const compactLabel = set.compact ? 'Expand all' : 'Collapse all';
  const mainButton = past
    ? `<button class="btn pri" data-a="openTs" data-v="${esc(wk)}">${ic('clock', 's')}<span class="hide-narrow">Timesheet for this week</span><span class="only-narrow">Time</span></button>`
    : `<a class="btn pri hide-narrow" href="#/plan">${ic('plus', 's')}Add / remove projects</a>
       <a class="iconbtn pri only-narrow" href="#/plan" aria-label="Add or remove projects">${ic('plus', 's')}</a>`;

  return `
    <div class="stickyhead">
      <div class="pagehead">
        <div class="grow">
          <h1 class="h1">${esc(title)}</h1>
          <div class="sub">${subline}</div>
        </div>
        <div class="row">
          <a class="iconbtn only-narrow" href="#/settings" aria-label="Settings">${ic('sliders', 's')}</a>
          <button class="iconbtn" data-a="compact" aria-label="${compactLabel}" title="${compactLabel}">${ic('list', 's')}</button>
          ${mainButton}
        </div>
      </div>
      ${weekNavHtml(wk, cw)}
      ${past ? '' : timerBar() + adjeraReminder(cw)}
      ${entries.length ? groupToolbar(entries, present, pmFilter) : ''}
    </div>
    ${weekEmptyState(entries.length, past)}
    <div class="cols">
      <div class="col-main">
        <div class="groups">
          ${groupEntries(todo, wk, past).map(g => groupSection(g, ctx)).join('')}
          ${done.length ? doneSection(done, ctx) : ''}
        </div>
      </div>
      <aside class="col-side">
        ${entries.length ? loggedCard(entries, present, R, past) : ''}
        ${past ? adjeraWeekCard(wk) : scratchPad()}
      </aside>
    </div>`;
}

// Projects that weren't on the list that week but still had time logged against them.
function timeOnlyEntries(entries, R) {
  const seen = new Set(entries.map(e => e.pid));
  const extra = [];
  for (const t of state.time) {
    if (t.pid === 'OH' || !proj(t.pid) || seen.has(t.pid) || t.date < R.startIso || t.date > R.endIso) continue;
    seen.add(t.pid);
    extra.push({ pid: t.pid, hours: '', label: '', day: '', date: '', extra: true });
  }
  return extra;
}

function groupEntries(list, wk, past) {
  const group = state.settings.group;
  if (group === 'num') return [{ title: 'All projects', sub: 'Number, high to low', list: list.slice().sort(byNumberDesc) }];

  if (group === 'pm') {
    const byDeadline = (a, b) => ((S.deadlineDate(wk, a) || '9') < (S.deadlineDate(wk, b) || '9') ? -1 : 1);
    return [...state.people, null]
      .map(p => {
        const mine = list.filter(e => (p ? proj(e.pid).pm === p.id : !person(proj(e.pid).pm)));
        return { title: p ? p.name : 'No PM', dot: p, sub: plural(mine.length, 'project'), list: mine.sort(byDeadline) };
      })
      .filter(g => g.list.length);
  }

  const byDate = {};
  for (const e of list) (byDate[S.deadlineDate(wk, e) || ''] ||= []).push(e);
  // Dated groups in order, "No deadline" last.
  return Object.keys(byDate).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a < b ? -1 : 1)).map(dd => {
    const mine = byDate[dd].sort(byNumberDesc);
    if (!dd) return { title: 'No deadline', sub: String(mine.length), list: mine };
    return { title: fmtDay(dd), sub: (past ? '' : relInfo(dd, wk).rel + ' · ') + mine.length, list: mine };
  });
}

function groupToolbar(entries, present, pmFilter) {
  const group = state.settings.group;
  const options = [
    ['deadline', 'Deadline', 'flag', 'Group by next deadline'],
    ['pm', 'PM', 'user', 'Group by project manager'],
    ['num', 'Number', 'hash', 'Highest project number first']
  ];
  const seg = options.map(([v, label, icon, title]) =>
    `<button data-a="group" data-v="${v}" class="${group === v ? 'on' : ''}" aria-pressed="${group === v}" title="${title}">${ic(icon, 's')}<span>${label}</span></button>`
  ).join('');

  let chips = '';
  if (group === 'pm') {
    chips = `
      <div class="chips">
        <button class="chip${pmFilter === 'all' ? ' on' : ''}" data-a="pmf" data-v="all" aria-pressed="${pmFilter === 'all'}">All<span class="n">${entries.length}</span></button>
        ${present.map(p => {
          const n = entries.filter(e => proj(e.pid).pm === p.id).length;
          const on = pmFilter === p.id;
          return `<button class="chip${on ? ' on' : ''}" data-a="pmf" data-v="${esc(p.id)}" aria-pressed="${on}" style="${pcVar(p)}"><span class="dot"></span>${esc(p.name)}<span class="n">${n}</span></button>`;
        }).join('')}
      </div>`;
  }
  return `<div class="toolbar"><div class="seg groupseg" role="group" aria-label="Group projects by">${seg}</div>${chips}</div>`;
}

function groupSection(g, ctx) {
  return `
    <section>
      <div class="ghead">
        ${g.dot ? `<span class="dot lg" style="${pcVar(g.dot)}"></span>` : ''}
        <h2>${esc(g.title)}</h2><span class="sub">${esc(g.sub)}</span>
      </div>
      <div class="cards">${g.list.map(e => cardHtml(e, ctx)).join('')}</div>
    </section>`;
}

function doneSection(done, ctx) {
  const title = ctx.past ? 'Marked done that week' : 'Done this week';
  const hint = ctx.past ? '' : ' · still editable · click the green check to move one back up';
  return `
    <section class="donesec">
      <div class="ghead"><h2>${title}</h2><span class="sub">${done.length}${hint}</span></div>
      <div class="cards">${done.map(e => cardHtml(e, ctx)).join('')}</div>
    </section>`;
}

function weekEmptyState(count, past) {
  if (!Object.keys(state.projects).length) {
    return `
      <div class="card pad stack narrowcard">
        <h2 class="h2">Welcome to Project Log</h2>
        <p class="sub">Load your project list once to get started. Pick the <b>project-log-seed.json</b> file (your OneNote import). It stays in this browser and is never uploaded anywhere.</p>
        <div class="row wrap">
          <label class="btn pri">${ic('upload', 's')}Import project list<input type="file" accept="application/json,.json" data-in="import" class="sr"></label>
          <button class="btn" data-a="newProject">${ic('plus', 's')}Or start empty and add a project</button>
        </div>
        <p class="sub small">You can also restore a backup file here.</p>
      </div>`;
  }
  if (count) return '';
  if (past) return '<div class="card empty">Nothing was planned or logged that week.</div>';
  return `
    <div class="card empty stack center">
      <p>Nothing on this week yet.</p>
      <div class="row wrap center"><a class="btn pri" href="#/plan">${ic('plus', 's')}Plan this week</a>${oneNoteButton()}</div>
    </div>`;
}

function loggedCard(entries, present, R, past) {
  const loggedFor = list => sum(list, e => S.minutesFor(state, e.pid, R.startIso, R.endIso) + (past ? 0 : liveMinutes(e.pid))) / 60;
  const planned = plannedHours(entries);
  const logged = loggedFor(entries);
  return `
    <div class="card pad stack">
      <span class="lbl">Logged vs planned</span>
      <span class="num bignum">${fmtH(logged)} <span class="sub">/ ${fmtH(planned)} h</span></span>
      <div class="meter thick"><i style="width:${pct(logged, planned)}%"></i></div>
      ${present.map(p => {
        const mine = entries.filter(e => proj(e.pid).pm === p.id);
        return `<div class="row stat" style="${pcVar(p)}"><span class="dot"></span><span class="grow">${esc(p.name)}</span><span class="num sub">${fmtH(loggedFor(mine))} / ${fmtH(plannedHours(mine))} h</span></div>`;
      }).join('')}
    </div>`;
}

function scratchPad() {
  return `
    <div class="card pad stack scratch">
      <label class="lbl" for="scratch">Scratch pad</label>
      <textarea id="scratch" data-in="scratch" placeholder="Anything not tied to a project yet: call-backs, site visits, numbers…">${esc(state.scratch)}</textarea>
    </div>`;
}

function relInfo(dd, wk) {
  const diff = daysBetween(S.today(), dd);
  if (diff < 0) return { rel: 'Overdue', cls: 'warn' };
  if (diff === 0) return { rel: 'Today', cls: 'warn' };
  if (diff === 1) return { rel: 'Tomorrow', cls: 'warn' };
  if (dd <= S.weekRange(wk).endIso) return { rel: 'This week', cls: 'acc' };
  if (dd <= S.iso(S.addDays(S.parseISO(wk), 13))) return { rel: 'Next week', cls: '' };
  return { rel: 'Later', cls: '' };
}

function deadlineTag(e, dd, wk, past) {
  if (!dd) return e.label ? `<span class="tag">${esc(e.label)}</span>` : '';
  const R = S.weekRange(wk);
  const when = dd >= R.startIso && dd <= R.endIso ? WD[S.parseISO(dd).getDay()] : fmtShort(dd);
  const cls = past ? '' : relInfo(dd, wk).cls;
  return `<span class="tag ${cls}">${ic('flag', 'xs')}${esc(e.label ? e.label + ' · ' : '')}${when}</span>`;
}

function cardHtml(e, { wk, R, past }) {
  const p = proj(e.pid);
  const id = esc(p.id);
  const num = esc(p.number);
  const open = state.settings.compact ? !!ui.fold[p.id] : !ui.fold[p.id];
  const dd = S.deadlineDate(wk, e);
  const logged = (S.minutesFor(state, p.id, R.startIso, R.endIso) + (past ? 0 : liveMinutes(p.id))) / 60;
  const planned = parseFloat(e.hours) || 0;
  const on = timerOn(p.id);

  let body;
  if (past) body = open ? pastOutlineHtml(p.id, wk) : `<div class="psum sub">${pastSummary(p.id, wk)}</div>`;
  else if (open) body = outlineHtml(p.id);
  else {
    const its = S.itemsFor(state, p.id);
    const tasks = its.filter(i => i.kind === 'task' && !i.done).length;
    const notes = its.filter(i => i.kind === 'note').length;
    body = `<div class="psum sub">${plural(tasks, 'open task')}${notes ? ' · ' + plural(notes, 'note') : ''}</div>`;
  }

  const buttons = past ? '' : `
    <button class="iconbtn sm donebtn${e.done ? ' is-on' : ''}" data-a="weekDone" data-id="${id}" aria-pressed="${!!e.done}"
      title="${e.done ? 'Not done: bring it back to the top' : 'Done for this week'}"
      aria-label="${e.done ? 'Bring back' : 'Mark done for this week:'} ${num}">${ic('check', 's')}</button>
    <button class="iconbtn sm timerbtn${on ? ' on' : ''}" data-a="timer" data-id="${id}"
      aria-label="${on ? 'Stop' : 'Start'} timer for ${num}">${ic(on ? 'stop' : 'play', 's')}</button>`;

  return `
    <article class="card pcard${e.done ? ' is-done' : ''}">
      <div class="pcard-h">
        <button class="fold${open ? ' open' : ''}" data-a="fold" data-id="${id}" aria-label="${open ? 'Collapse' : 'Expand'} ${num}" aria-expanded="${open}">${ic('chevR', 's')}</button>
        <div class="grow stack ptop">
          <a class="ptitle" href="${projectHref(p.id)}" title="Open project notes"><b>${num}</b> <span>${esc(p.name)}</span></a>
          <div class="pmeta">
            ${rvtTag(p)}${pmPill(p.pm)}
            ${past && e.done ? '<span class="tag good">Done</span>' : ''}
            ${e.extra ? '<span class="tag">Not on list · time logged</span>' : ''}
            ${deadlineTag(e, dd, wk, past)}
          </div>
        </div>
        ${buttons}
      </div>
      <div class="hours">
        <div class="meter grow${planned && logged > planned ? ' over' : ''}"><i style="width:${pct(logged, planned)}%"></i></div>
        <span class="num sub nowrap">${planned ? `${fmtH(logged)} / ${fmtH(planned)} h` : `${fmtH(logged)} h · no plan`}</span>
      </div>
      ${body}
    </article>`;
}

// Weeks to offer in the picker: any with projects or logged time, plus this one. Newest first.
function weekKeys() {
  const keys = new Set([curWeek()]);
  for (const [k, w] of Object.entries(state.weeks)) if (w.entries.length) keys.add(k);
  for (const t of state.time) keys.add(S.weekKey(S.parseISO(t.date)));
  return [...keys].sort().reverse();
}

function weekNavHtml(wk, cw) {
  const keys = weekKeys();
  if (!keys.includes(wk)) {
    keys.push(wk);
    keys.sort().reverse();
  }
  const i = keys.indexOf(wk);
  const year = String(new Date().getFullYear());
  const options = keys.map(k => {
    const n = state.weeks[k]?.entries.length || 0;
    const R = S.weekRange(k);
    const hrs = S.minutesFor(state, null, R.startIso, R.endIso) / 60;
    const label = (k === cw ? 'This week · ' : k > cw ? 'Planned · ' : '') + fmtRange(k) +
      (k.slice(0, 4) !== year ? ', ' + k.slice(0, 4) : '') +
      (n ? ' · ' + plural(n, 'project') : '') + (hrs ? ` · ${fmtH(hrs)} h` : '');
    return `<option value="${esc(k)}"${k === wk ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');

  return `
    <div class="weeknav">
      <button class="iconbtn sm" data-a="weekNav" data-v="-1" aria-label="Previous week"${i >= keys.length - 1 ? ' disabled' : ''}>${ic('chevL', 's')}</button>
      <select class="inp weeksel" id="weeksel" data-in="weekSel" aria-label="Choose a week">${options}</select>
      <button class="iconbtn sm" data-a="weekNav" data-v="1" aria-label="Next week"${i <= 0 ? ' disabled' : ''}>${ic('chevR', 's')}</button>
      ${wk !== cw ? '<button class="btn sm" data-a="weekNow">Back to this week</button>' : ''}
    </div>`;
}

// What a past week's tasks looked like. Weeks are frozen when they end (Store.closePastWeeks);
// projects that only had time logged fall back to working it out from today's list.
function pastItems(pid, wk) {
  return state.weeks[wk]?.closed?.items[pid] || S.itemsAsOf(state, pid, wk);
}

function weekNotes(pid, wk) {
  const R = S.weekRange(wk);
  return state.journal
    .filter(j => j.pid === pid && j.date >= R.startIso && j.date <= R.endIso)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function pastSummary(pid, wk) {
  const tasks = pastItems(pid, wk).filter(i => i.kind === 'task');
  const done = tasks.filter(i => i.done).length;
  const notes = weekNotes(pid, wk).length;
  return `${done} checked off · ${tasks.length - done} still open${notes ? ' · ' + plural(notes, 'journal note') : ''}`;
}

function pastOutlineHtml(pid, wk) {
  const items = pastItems(pid, wk);
  const notes = weekNotes(pid, wk);
  if (!items.length && !notes.length) {
    return '<div class="items"><div class="sub foldline">Nothing written down for this project that week.</div></div>';
  }
  const rows = items.map(i => {
    const mark = i.kind === 'task'
      ? `<input type="checkbox" class="chk" disabled${i.done ? ' checked' : ''} aria-label="${i.done ? 'Done' : 'Open'}: ${esc(i.text)}">`
      : '<span class="notemark" aria-hidden="true">–</span>';
    const day = i.done && i.doneAt ? `<span class="sub doneday">${WD[S.parseISO(i.doneAt).getDay()]}</span>` : '';
    return `<div class="item${i.done ? ' done' : ''}" style="padding-left:${24 + i.level * 22}px">${mark}<span class="ro">${esc(i.text)}</span>${day}</div>`;
  }).join('');
  const journal = !notes.length ? '' : `
    <div class="pastnotes">
      <span class="hcap sub">Journal</span>
      ${notes.map(j => `<div class="row top"><span class="sub jday">${WD[S.parseISO(j.date).getDay()]}</span><span class="grow pre">${esc(j.text)}</span></div>`).join('')}
    </div>`;
  return `<div class="items">${rows}${journal}</div>`;
}

const weekDays = wk => S.DAYS.map((d, i) => S.iso(S.addDays(S.parseISO(wk), i)));

function adjeraWeekCard(wk) {
  const rows = weekDays(wk).map((d, i) => {
    const hrs = S.minutesFor(state, null, d, d) / 60;
    const status = state.adjera[d] ? '<span class="tag good">Entered</span>' : hrs ? '<span class="tag warn">Not entered</span>' : '';
    return `<div class="row stat"><span class="dayname">${S.DAYS[i]}</span><span class="grow num sub">${hrs ? fmtH(hrs) + ' h' : '–'}</span>${status}</div>`;
  }).join('');
  return `
    <div class="card pad stack">
      <span class="lbl">Adjera for this week</span>
      ${rows}
      <button class="btn sm" data-a="openTs" data-v="${esc(wk)}">${ic('clock', 's')}Open timesheet for this week</button>
    </div>`;
}

// Nudge on Monday when last week has hours that never got marked as entered in Adjera.
function adjeraReminder(cw) {
  const prev = S.iso(S.addDays(S.parseISO(cw), -7));
  const missing = weekDays(prev).filter(d => !state.adjera[d] && S.minutesFor(state, null, d, d) > 0);
  if (!missing.length) return '';
  return `
    <div class="note wrap center-y">
      ${ic('info', 's')}
      <span class="grow minw">Last week (${fmtRange(prev)}) has ${plural(missing.length, 'day')} with hours not marked as entered in Adjera.</span>
      <button class="btn sm" data-a="openTs" data-v="${prev}">Open last week’s timesheet</button>
      <button class="btn sm ghost" data-a="viewWeek" data-v="${prev}">Review last week</button>
    </div>`;
}

function oneNoteButton() {
  const lw = state.seedInfo?.lastOneNoteWeek;
  if (!lw || state.seedInfo.weekSeeded) return '';
  return `<button class="btn" data-a="seedWeek">Start from OneNote ${esc(lw.title)} (${plural(lw.numbers.length, 'project')})</button>`;
}
