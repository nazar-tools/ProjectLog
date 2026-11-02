// Weekly update for a PM, written from the tasks you checked off, your hours and deadlines.
// The text is a starting point: edit it, then copy it into Teams or open it in Outlook.

function updatePeople(wk) {
  const R = S.weekRange(wk);
  const pids = new Set(updateWeekEntries(wk).map(e => e.pid));
  for (const t of state.time) if (t.pid !== 'OH' && t.date >= R.startIso && t.date <= R.endIso) pids.add(t.pid);
  return state.people.filter(p => [...pids].some(pid => proj(pid)?.pm === p.id));
}

function updateWeekEntries(wk) {
  const week = wk < curWeek() ? state.weeks[wk] : S.peekWeek(state, wk);
  return (week?.entries || []).filter(e => proj(e.pid));
}

// What happened on one PM's projects that week.
function updateProjects(pmId, wk) {
  const R = S.weekRange(wk);
  const entries = updateWeekEntries(wk);
  const pids = new Set(entries.map(e => e.pid));
  for (const t of state.time) if (t.pid !== 'OH' && t.date >= R.startIso && t.date <= R.endIso) pids.add(t.pid);
  const nextWk = S.iso(S.addDays(S.parseISO(wk), 7));
  return [...pids].filter(pid => proj(pid)?.pm === pmId).map(pid => {
    const p = proj(pid);
    const items = S.itemsFor(state, pid).filter(i => i.kind === 'task');
    const entry = entries.find(e => e.pid === pid);
    const nextEntry = state.weeks[nextWk]?.entries.find(e => e.pid === pid);
    let next = '';
    for (const [e, k] of [[entry, wk], [nextEntry, nextWk]]) {
      const dd = e && S.deadlineDate(k, e);
      if (dd && dd >= S.today()) {
        next = `${e.label ? e.label + ' ' : ''}${fmtDay(dd)}`;
        break;
      }
    }
    return {
      code: p.number,
      name: p.name,
      hours: sum(weekDays(wk), d => roundedHours(pid, d)),
      done: items.filter(i => i.done && i.doneAt >= R.startIso && i.doneAt <= R.endIso).map(i => i.text),
      open: items.filter(i => !i.done && (i.created || '') <= R.endIso).map(i => i.text).slice(0, 5),
      next
    };
  }).sort((a, b) => b.hours - a.hours);
}

function updateMessage(pm, wk) {
  const set = state.settings;
  const body = updateProjects(pm.id, wk).map(p => {
    const lines = [`${p.code} ${p.name}${set.updHours ? ` (${fmtH(p.hours)} h)` : ''}`];
    if (p.done.length) lines.push('  Done: ' + p.done.join(', '));
    if (set.updOpen && p.open.length) lines.push('  Still open: ' + p.open.join(', '));
    if (set.updNext && p.next) lines.push('  Next: ' + p.next);
    return lines.join('\n');
  }).join('\n\n');
  const first = pm.name.split(' ')[0];
  return `Hi ${first}, quick update for the week of ${fmtRange(wk)}:\n\n${body}\n\nThanks${set.myName ? ',\n' + set.myName : ''}`;
}

function viewUpdate() {
  const wk = ui.updateWeek || curWeek();
  const people = updatePeople(wk);
  const pm = people.find(p => p.id === ui.updatePm) || people[0];
  const sent = state.updatesSent[wk] || {};
  const key = pm ? `${wk}|${pm.id}` : '';
  const text = pm ? ui.updateText[key] ?? updateMessage(pm, wk) : '';
  const set = state.settings;
  const toggle = (k, label) => `<label class="row checkline"><input type="checkbox" class="chk" data-a="updToggle" data-v="${k}"${set[k] ? ' checked' : ''}>${label}</label>`;

  const pmButtons = people.map(p => {
    const n = updateProjects(p.id, wk).length;
    const on = p.id === pm.id;
    return `
      <button class="pmpickrow${on ? ' on' : ''}" data-a="updPm" data-id="${esc(p.id)}" aria-pressed="${on}" style="${pcVar(p)}">
        <span class="dot"></span><span class="grow">${esc(p.name)}</span><span class="sub">${plural(n, 'project')}</span>
        ${sent[p.id] ? '<span class="tag good">Sent</span>' : ''}
      </button>`;
  }).join('');

  return `
    <div class="pagehead">
      <div class="grow stack gap1">
        <h1 class="h1">PM updates</h1>
        <span class="sub">Week of ${fmtRange(wk)} · written from your checked-off tasks, hours and deadlines. Edit before sending.</span>
      </div>
      <div class="row tight">
        <button class="iconbtn" data-a="updWeek" data-v="-1" aria-label="Previous week">${ic('chevL', 's')}</button>
        <button class="iconbtn" data-a="updWeek" data-v="1" aria-label="Next week"${wk >= curWeek() ? ' disabled' : ''}>${ic('chevR', 's')}</button>
      </div>
    </div>
    ${!pm ? '<div class="card empty">No projects with a PM on that week yet.</div>' : `
    <div class="cols">
      <aside class="col-side">
        <section class="card pad stack" aria-label="PM"><span class="lbl">Update for</span>${pmButtons}</section>
        <section class="card pad stack tight" aria-label="Include">
          <span class="lbl">Include</span>
          ${toggle('updHours', 'Hours this week')}
          ${toggle('updOpen', 'Still open')}
          ${toggle('updNext', 'Next deadline')}
          <label class="field"><span class="lbl">Sign as</span><input class="inp" id="myname" data-in="myName" value="${esc(set.myName)}" placeholder="Your name"></label>
        </section>
      </aside>
      <section class="col-main card pad stack" aria-label="Message">
        <div class="row between">
          <h2 class="h2">To ${esc(pm.name)}</h2>
          ${ui.updateText[key] != null ? '<button class="btn ghost sm" data-a="updReset">Start over from my notes</button>' : ''}
        </div>
        <textarea class="inp updtext" id="updtext" data-in="updateText" data-v="${esc(key)}" aria-label="Message">${esc(text)}</textarea>
        <div class="row wrap tight">
          <button class="btn pri" data-a="updCopy" data-id="${esc(pm.id)}">${ic('copy', 's')}Copy for Teams</button>
          <button class="btn" data-a="updMail" data-id="${esc(pm.id)}">${ic('send', 's')}Open in Outlook</button>
          ${pm.email ? '' : '<span class="sub small">Add an email for this PM in Settings to fill in the To line.</span>'}
        </div>
      </section>
    </div>`}`;
}
