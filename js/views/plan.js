// Plan week: search to add projects, set hours and a deadline for each, X to take one off.

const planKey = () => S.weekKey(S.addDays(new Date(), ui.planOffset * 7));

function viewPlan() {
  const wk = planKey();
  const week = S.peekWeek(state, wk);
  const entries = week.entries.filter(e => proj(e.pid));
  const onWeek = new Set(entries.map(e => e.pid));
  const weekSeg = cls => `
    <div class="seg ${cls}">
      <button data-a="planWeek" data-v="0" class="${ui.planOffset === 0 ? 'on' : ''}">This week</button>
      <button data-a="planWeek" data-v="1" class="${ui.planOffset === 1 ? 'on' : ''}">Next week</button>
    </div>`;

  return `
    <div class="stickyhead">
      <div class="pagehead">
        <div class="grow">
          <h1 class="h1">Plan week</h1>
          <div class="sub">Week of ${fmtRange(wk)}${week.copiedFrom ? ' · copied from week of ' + fmtShort(week.copiedFrom) : ''}</div>
        </div>
        <div class="row">
          ${weekSeg('hide-narrow')}
          <a class="btn pri" href="#/week">${ic('check', 's')}Done</a>
        </div>
      </div>
      ${weekSeg('only-narrow')}
      <label class="search accent">
        ${ic('search')}
        <input id="planq" data-in="planq" value="${esc(ui.planQ)}" placeholder="Add a project: type a number or name" aria-label="Add a project to this week" autocomplete="off">
      </label>
      ${ui.planQ.trim() ? searchResults(onWeek) : ''}
    </div>
    ${!entries.length && oneNoteButton() ? `
      <div class="note">
        ${ic('info', 's')}
        <div class="grow stack">
          <span>Your OneNote projects are imported. Start this week from your last OneNote page, or search to add projects.</span>
          <div>${oneNoteButton()}</div>
        </div>
      </div>` : ''}
    <div class="cols">
      <section class="col-main" aria-label="Projects on this week">
        <div class="row between">
          <h2 class="h2">On this week · ${entries.length}</h2>
          <span class="sub hide-narrow">Removing keeps the project’s tasks and notes</span>
        </div>
        <div class="card clip list">
          ${entries.length ? entries.map(planRow).join('') : '<div class="empty">No projects yet. Search above to add one.</div>'}
        </div>
      </section>
      <aside class="col-side">
        ${plannedCard(entries)}
        ${recentCard(wk, onWeek)}
      </aside>
    </div>`;
}

function searchResults(onWeek) {
  const q = ui.planQ.trim();
  const needle = q.toLowerCase();
  const matches = Object.values(state.projects)
    .filter(p => `${p.number} ${p.name}`.toLowerCase().includes(needle))
    .sort((a, b) => (lastSort(b) > lastSort(a) ? 1 : -1))
    .slice(0, 8);
  return `
    <div class="card clip results list">
      ${matches.map(p => {
        const pm = person(p.pm);
        const add = onWeek.has(p.id)
          ? '<span class="tag good">In week</span>'
          : `<button class="addbtn" data-a="addEntry" data-id="${esc(p.id)}">${ic('plus', 's')}Add</button>`;
        return `
          <div class="res">
            <span class="dot" style="${pcVar(pm)}"></span>
            <div class="grow"><b>${esc(p.number)}</b> ${esc(p.name)}<div class="sub">${p.revit ? esc(p.revit) + ' · ' : ''}${pm ? esc(pm.name) : 'No PM'} · ${esc(lastLabel(p))}</div></div>
            ${add}
          </div>`;
      }).join('')}
      <div class="res">
        <button class="btn ghost sm" data-a="newProject" data-v="${esc(q)}">${ic('plus', 's')}New project “${esc(q)}”</button>
        <span class="sub">Enter adds the top match</span>
      </div>
    </div>`;
}

function planRow(e) {
  const p = proj(e.pid);
  const id = esc(p.id);
  const num = esc(p.number);
  const open = S.itemsFor(state, p.id).filter(i => i.kind === 'task' && !i.done).length;
  const days = S.DAYS.map(d =>
    `<button data-a="day" data-id="${id}" data-v="${d}" class="${e.day === d ? 'on' : ''}" aria-pressed="${e.day === d}">${d}</button>`
  ).join('');

  return `
    <div class="prow">
      <div class="who">
        <div><b>${num}</b> <span class="semibold">${esc(p.name)}</span></div>
        <div class="pmeta">
          ${rvtTag(p)}${pmPill(p.pm)}
          ${e.done ? '<span class="tag good">Done</span>' : ''}
          ${open ? `<span class="sub">${plural(open, 'open task')}</span>` : ''}
        </div>
      </div>
      <input class="inp num hrs" id="h-${id}" data-in="hours" data-id="${id}" value="${esc(e.hours)}" inputmode="decimal" placeholder="h" aria-label="Planned hours for ${num}">
      <input class="inp dl" id="l-${id}" data-in="label" data-id="${id}" value="${esc(e.label)}" placeholder="Deadline, e.g. QA/QC Print" aria-label="Deadline for ${num}">
      <div class="days" role="group" aria-label="Deadline day for ${num}">
        ${days}
        <input type="date" id="d-${id}" data-in="date" data-id="${id}" value="${esc(e.date)}" aria-label="Other deadline date">
      </div>
      <button class="xbtn" data-a="removeEntry" data-id="${id}" aria-label="Remove ${num} from this week" title="Remove from this week">${ic('x', 's')}</button>
    </div>`;
}

function plannedCard(entries) {
  const total = plannedHours(entries);
  const cap = parseFloat(state.settings.capacity) || 40;
  const pms = state.people.filter(pm => entries.some(e => proj(e.pid).pm === pm.id));
  return `
    <div class="card pad stack">
      <span class="lbl">Planned this week</span>
      <span class="num bignum"><span data-bind="planTotal">${fmtH(total)}</span> <span class="sub">/ ${cap} h</span></span>
      <div class="meter thick"><i data-bind="planMeter" style="width:${pct(total, cap)}%"></i></div>
      ${pms.map(pm => {
        const n = entries.filter(e => proj(e.pid).pm === pm.id).length;
        return `<div class="row stat" style="${pcVar(pm)}"><span class="dot"></span><span class="grow">${esc(pm.name)}</span><span class="num sub">${plural(n, 'project')}</span></div>`;
      }).join('')}
    </div>`;
}

// Hours typed into the plan update the total in place, so the input keeps focus.
function updatePlanTotal() {
  const entries = S.peekWeek(state, planKey()).entries.filter(e => proj(e.pid));
  const total = plannedHours(entries);
  const cap = parseFloat(state.settings.capacity) || 40;
  const label = document.querySelector('[data-bind="planTotal"]');
  const meter = document.querySelector('[data-bind="planMeter"]');
  if (label) label.textContent = fmtH(total);
  if (meter) meter.style.width = pct(total, cap) + '%';
}

function recentCard(wk, onWeek) {
  const recent = recentProjects(wk, onWeek);
  const rows = recent.map(p => {
    const pm = person(p.pm);
    return `
      <div class="res">
        <span class="dot" style="${pcVar(pm)}"></span>
        <div class="grow"><b>${esc(p.number)}</b> ${esc(p.name)}<div class="sub">${pm ? esc(pm.name) : 'No PM'} · ${esc(lastLabel(p))}</div></div>
        <button class="addbtn" data-a="addEntry" data-id="${esc(p.id)}" aria-label="Add ${esc(p.number)}">${ic('plus', 's')}</button>
      </div>`;
  }).join('');
  return `
    <div class="card clip">
      <div class="pad stack cardhead"><b>Recently on your list</b><span class="sub">Not on this week · one click to add back</span></div>
      <div class="list">${rows || '<div class="empty sub">Nothing recent that isn’t already on the week.</div>'}</div>
    </div>`;
}

// Projects from the last 8 planned weeks first, then anything OneNote saw in the last 75 days.
function recentProjects(wk, onWeek) {
  const out = [];
  const seen = new Set(onWeek);
  const take = p => {
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  };
  Object.keys(state.weeks).filter(k => k !== wk).sort().reverse().slice(0, 8)
    .forEach(k => state.weeks[k].entries.forEach(e => take(proj(e.pid))));
  const cutoff = S.iso(S.addDays(new Date(), -75)).slice(0, 7);
  Object.values(state.projects)
    .filter(p => p.status !== 'archived' && p.lastSeen && p.lastSeen >= cutoff)
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1))
    .forEach(take);
  return out.slice(0, 10);
}
