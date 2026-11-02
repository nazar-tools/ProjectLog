// Timesheet: hours per project per day, rounded to the quarter hour, ready to paste into Adjera.
// Each project's day total can be set directly; the blocks behind it open up for editing.

const tsKey = () => S.weekKey(S.addDays(new Date(), ui.tsOffset * 7));

// The rows and numbers behind a week of time: projects planned that week, then anything else
// with time on it, then overhead; each cell rounded the way Adjera gets it.
function timesheetData(wk) {
  const R = S.weekRange(wk);
  const days = weekDays(wk);
  const week = wk < curWeek() ? state.weeks[wk] : S.peekWeek(state, wk);
  const pids = [];
  const addPid = pid => { if (!pids.includes(pid)) pids.push(pid); };
  (week?.entries || []).filter(e => proj(e.pid)).forEach(e => addPid(e.pid));
  state.time.filter(x => x.pid !== 'OH' && x.date >= R.startIso && x.date <= R.endIso).forEach(x => addPid(x.pid));
  if (state.timer && state.timer.pid !== 'OH' && days.some(d => liveMinutes(state.timer.pid, d) > 0)) addPid(state.timer.pid);
  pids.push('OH');
  const minutes = (pid, d) => S.minutesFor(state, pid, d, d) + liveMinutes(pid, d);
  const grid = pids.map(pid => days.map(d => S.roundQ(minutes(pid, d) / 60)));
  const dayTotals = days.map((d, i) => sum(grid, row => row[i]));
  return { days, week, pids, minutes, grid, dayTotals };
}

function viewTime() {
  const wk = tsKey();
  const t = S.today();
  const { days, week, pids, minutes, grid, dayTotals } = timesheetData(wk);
  if (!days.includes(ui.tsDay)) ui.tsDay = days.includes(t) ? t : days[0];
  const weekTotal = sum(dayTotals, x => x);
  const entered = days.filter(d => state.adjera[d]).length;
  const daysWithTime = dayTotals.filter(x => x > 0).length;
  const hrs = v => (v ? v.toFixed(2) : '–');
  const todayCls = d => (d === t ? 'today' : '');
  const ctx = { pids, grid, minutes, dayTotals, di: days.indexOf(ui.tsDay) };

  const tableRows = pids.map((pid, r) => {
    const p = proj(pid);
    const pm = p ? person(p.pm) : null;
    const e = week?.entries.find(x => x.pid === pid);
    const cells = grid[r].map((v, i) => `<td class="${todayCls(days[i])}">${hoursCell(pid, days[i], v, minutes)}</td>`).join('');
    return `
      <tr>
        <td><span class="row tight" style="${pcVar(pm)}"><span class="dot"></span><b>${esc(pidLabel(pid))}</b><span class="sub ell maxw">${esc(pidName(pid))}</span></span></td>
        ${cells}
        <td><b>${sum(grid[r], x => x).toFixed(2)}</b></td>
        <td class="sub">${e && e.hours ? fmtH(parseFloat(e.hours)) : '—'}</td>
      </tr>`;
  }).join('');

  return `
    <div class="stickyhead">
      <div class="pagehead">
        <div class="grow">
          <h1 class="h1">Timesheet</h1>
          <div class="sub">Rounded to 0.25 h · Adjera code = project number</div>
        </div>
        <button class="btn" data-a="openReview" data-v="${esc(wk)}">${ic('check', 's')}<span class="hide-narrow">Review &amp; enter week</span><span class="only-narrow">Review</span></button>
        <a class="iconbtn only-narrow" href="#/settings" aria-label="Settings">${ic('sliders', 's')}</a>
      </div>
      ${tsWeekNav(wk)}
      <div class="daystrip" role="group" aria-label="Day">${days.map((d, i) => dayCard(d, i, dayTotals[i])).join('')}</div>
    </div>
    ${timerBar()}
    ${ui.tsOffset === 0 ? adjeraReminder(wk) : ''}
    <div class="row wrap hide-narrow stats">
      <div class="card pad stack statcard">
        <span class="lbl">This week</span>
        <span class="num bignum">${weekTotal.toFixed(2)} <span class="sub">/ ${state.settings.capacity || 40} h</span></span>
      </div>
      <div class="card pad stack statcard">
        <span class="lbl">Entered in Adjera</span>
        <span class="num bignum">${entered} <span class="sub">of ${plural(daysWithTime, 'day')} with time</span></span>
      </div>
    </div>
    <div class="card clip hide-narrow scrollx">
      <table class="ts">
        <thead><tr>
          <th>Project</th>
          ${days.map((d, i) => `<th class="${todayCls(d)}">${S.DAYS[i]} ${S.parseISO(d).getDate()}${state.adjera[d] ? ' ✓' : ''}</th>`).join('')}
          <th>Total</th><th>Planned</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr>
          <td>Day total</td>
          ${dayTotals.map((v, i) => `<td class="${todayCls(days[i])}">${hrs(v)}</td>`).join('')}
          <td>${weekTotal.toFixed(2)}</td><td></td>
        </tr></tfoot>
      </table>
    </div>
    <div class="cols">
      <section class="col-main">${dayDetail(ctx)}${addTimeCard()}</section>
      <aside class="col-side">${adjeraCopyCard(ctx)}</aside>
    </div>`;
}

// Arrows step one week; the dropdown jumps to any week with time or a plan.
function tsWeekNav(wk) {
  const cw = curWeek();
  const keys = weekKeys();
  if (!keys.includes(wk)) {
    keys.push(wk);
    keys.sort().reverse();
  }
  const year = String(new Date().getFullYear());
  const options = keys.map(k => {
    const days = weekDays(k);
    const hrs = sum(days, roundedDayHours);
    const withTime = days.filter(d => S.minutesFor(state, null, d, d) > 0);
    const allIn = withTime.length && withTime.every(d => state.adjera[d]);
    const label = (k === cw ? 'This week · ' : k > cw ? 'Planned · ' : '') + fmtRange(k) +
      (k.slice(0, 4) !== year ? ', ' + k.slice(0, 4) : '') +
      (hrs ? ` · ${fmtH(hrs)} h` : '') + (allIn ? ' · in Adjera ✓' : '');
    return `<option value="${esc(k)}"${k === wk ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
  return `
    <div class="weeknav tsweeknav">
      <button class="iconbtn" data-a="tsWeek" data-v="-1" aria-label="Previous week">${ic('chevL', 's')}</button>
      <select class="inp weeksel" id="tsweeksel" data-in="tsWeekSel" aria-label="Choose a week">${options}</select>
      <button class="iconbtn" data-a="tsWeek" data-v="1" aria-label="Next week">${ic('chevR', 's')}</button>
      ${wk !== cw ? '<button class="btn sm" data-a="tsThisWeek">This week</button>' : ''}
    </div>`;
}

// A day's total the way Adjera sees it: each project rounded on its own, then added up.
function roundedDayHours(d) {
  const pids = new Set(state.time.filter(t => t.date === d).map(t => t.pid));
  return sum([...pids], pid => S.roundQ(S.minutesFor(state, pid, d, d) / 60));
}

function dayCard(d, i, total) {
  const on = ui.tsDay === d;
  let status = '';
  if (state.adjera[d]) status = `<span class="dstate in">${ic('check', 'xs')}<span class="hide-narrow">In Adjera</span></span>`;
  else if (total) status = '<span class="dstate todo"><span class="pend"></span><span class="hide-narrow">To enter</span></span>';
  return `
    <button class="daycard${on ? ' on' : ''}${d === S.today() ? ' today' : ''}" data-a="tsDay" data-v="${d}" aria-pressed="${on}">
      <span class="dname">${S.DAYS[i]} <span class="ddate">${S.parseISO(d).getDate()}</span></span>
      <span class="dhrs num">${total ? total.toFixed(2) : '–'}</span>
      ${status || '<span class="dstate">&nbsp;</span>'}
    </button>`;
}

// A typeable hours cell for one project on one day, as on the Timesheet table and the Monday
// review. The number is what Adjera gets; changing it trims or stretches that day's blocks.
// While that project's timer is running the cell is read-only.
function hoursCell(pid, d, v, minutes) {
  const label = `${esc(pidLabel(pid))}, ${WD[S.parseISO(d).getDay()]}`;
  if (timerOn(pid) && liveMinutes(pid, d) > 0) {
    return `<span class="cellro num" title="Timer running">${v.toFixed(2)}</span>`;
  }
  const entries = state.time.filter(x => x.pid === pid && x.date === d);
  const raw = minutes(pid, d);
  const flag = raw % 15 ? `${fmtDuration(raw)} in ${plural(entries.length, 'block')}` : '';
  return `<input class="cellin num${flag ? ' flag' : ''}" id="hc-${esc(pid)}-${d}" data-in="dayCell" data-id="${esc(pid)}" data-v="${d}"
    value="${v ? v.toFixed(2) : ''}" placeholder="–" inputmode="decimal"${flag ? ` title="Rounded from ${flag}"` : ''}
    aria-label="${label}${flag ? `, rounded from ${flag}` : ''}">`;
}

// One row per project for the selected day. The number is what goes to Adjera: type a new
// value or use the steppers, and that day's blocks for the project become one entry.
function dayDetail({ pids, grid, minutes, dayTotals, di }) {
  const day = ui.tsDay;
  const groups = pids
    .map((pid, r) => ({ pid, rounded: grid[r][di], raw: minutes(pid, day), entries: state.time.filter(x => x.pid === pid && x.date === day) }))
    .filter(g => g.raw > 0 || g.entries.length);
  const status = state.adjera[day]
    ? '<span class="tag good">Entered in Adjera</span>'
    : dayTotals[di] ? '<span class="tag warn">Not in Adjera yet</span>' : '';
  const messy = groups.some(g => !timerOn(g.pid) && g.raw % 15);

  const viewSeg = `
    <div class="seg viewseg" role="group" aria-label="Show the day as">
      <button data-a="tsView" data-v="list" class="${ui.tsView === 'list' ? 'on' : ''}" aria-pressed="${ui.tsView === 'list'}">List</button>
      <button data-a="tsView" data-v="timeline" class="${ui.tsView === 'timeline' ? 'on' : ''}" aria-pressed="${ui.tsView === 'timeline'}">Timeline</button>
    </div>`;

  return `
    <div class="row between wrap">
      <h2 class="h2">${fmtDay(day)} <span class="sub dayhrs">${dayTotals[di].toFixed(2)} h</span></h2>
      <div class="row tight">${status}${viewSeg}</div>
    </div>
    ${ui.tsView === 'timeline' ? dayTimeline(day, pids) : `
      <div class="card clip list">
        ${groups.length ? groups.map(g => projectDayRow(g, pids, day)).join('') : '<div class="empty">Nothing logged. Start a timer on a card, or add time below.</div>'}
      </div>
      ${messy ? `
        <div class="row wrap tight">
          <button class="btn sm" data-a="roundDay">${ic('check', 's')}Round every project to ¼ h</button>
          <span class="sub small">Trims or stretches each project’s last block. You can undo it.</span>
        </div>` : ''}`}`;
}

function projectDayRow({ pid, rounded, raw, entries }, pids, day) {
  const id = esc(pid);
  const p = proj(pid);
  const pm = p ? person(p.pm) : null;
  const running = timerOn(pid) && liveMinutes(pid, day) > 0;
  const open = !!ui.tsOpen[pid];
  const blocks = plural(entries.length, 'block') + (running ? ' + timer' : '');
  const exact = raw % 15 && !running ? ` · ${fmtDuration(raw)} recorded` : '';
  const control = running
    ? `<span class="tag acc">${ic('clock', 'xs')}Timer running</span>`
    : `
      <div class="stepper">
        <button data-a="tsStep" data-id="${id}" data-v="-1" aria-label="Quarter hour less on ${esc(pidLabel(pid))}">−</button>
        <input class="inp num" id="tt-${id}" data-in="tsTotal" data-id="${id}" value="${rounded.toFixed(2)}" inputmode="decimal" aria-label="Hours on ${esc(pidLabel(pid))}">
        <button data-a="tsStep" data-id="${id}" data-v="1" aria-label="Quarter hour more on ${esc(pidLabel(pid))}">+</button>
      </div>`;

  return `
    <div class="tsgroup">
      <div class="tsrow" style="${pcVar(pm)}">
        <button class="fold${open ? ' open' : ''}" data-a="tsOpen" data-id="${id}" aria-expanded="${open}" aria-label="${open ? 'Hide' : 'Show'} blocks for ${esc(pidLabel(pid))}">${ic('chevR', 's')}</button>
        <span class="dot"></span>
        <div class="grow minw0">
          <div class="ell"><b class="num">${esc(pidLabel(pid))}</b> <span class="sub">${esc(pidName(pid))}</span></div>
          <div class="sub small">${blocks}${exact}</div>
        </div>
        ${control}
      </div>
      ${open ? entries.map(x => blockRow(x, pids)).join('') + (running ? liveBlock() : '') : ''}
    </div>`;
}

// A single recorded block. Timer blocks edit by start and end; hand-entered ones by hours.
function blockRow(x, pids) {
  const id = esc(x.id);
  const when = x.start
    ? `<input type="time" class="inp timein" id="es-${id}" data-in="entryStart" data-id="${id}" value="${timeValue(x.start)}" aria-label="Start">
       <span class="sub">–</span>
       <input type="time" class="inp timein" id="ee-${id}" data-in="entryEnd" data-id="${id}" value="${timeValue(x.end)}" aria-label="End">`
    : '<span class="sub srcl">No clock time</span>';
  const moveTo = pids.map(pid => `<option value="${esc(pid)}"${pid === x.pid ? ' selected' : ''}>${esc(pidLabel(pid))}</option>`).join('');
  return `
    <div class="tsblock">
      <div class="row tight when">${when}</div>
      <input class="inp num hrsin" id="eh-${id}" data-in="entryHours" data-id="${id}" value="${fmtH(x.minutes / 60)}" inputmode="decimal" aria-label="Hours">
      <input class="inp grow notein" id="en-${id}" data-in="entryNote" data-id="${id}" value="${esc(x.note)}" placeholder="Note" aria-label="Note">
      <select class="inp movein" id="em-${id}" data-in="entryPid" data-id="${id}" aria-label="Move to project">${moveTo}</select>
      <button class="iconbtn plain sm" data-a="delTime" data-id="${id}" aria-label="Delete block">${ic('x', 's')}</button>
    </div>`;
}

function liveBlock() {
  return `
    <div class="tsblock live">
      <span class="num bold">${clock(Math.max(state.timer.start, S.parseISO(ui.tsDay).getTime()))} – now</span>
      <span class="grow"></span>
      <span class="num bold" data-elapsed>${elapsedText()}</span>
    </div>`;
}

function addTimeCard() {
  const options = Object.values(state.projects)
    .sort((a, b) => (lastSort(b) > lastSort(a) ? 1 : -1))
    .map(p => `<option value="${esc(p.number)} ${esc(p.name)}"></option>`).join('');
  return `
    <div class="card pad stack">
      <span class="lbl">Add time by hand</span>
      <div class="row wrap tight">
        <input class="inp wfill" id="ts-proj" list="ts-projlist" placeholder="Project number" aria-label="Project">
        <datalist id="ts-projlist"><option value="Overhead"></option>${options}</datalist>
        <input class="inp num w90" id="ts-hours" placeholder="Hours" title="1.5 or 1:30" inputmode="decimal" aria-label="Hours">
        <input class="inp wfill" id="ts-note" placeholder="Note (optional)" aria-label="Note">
        <button class="btn" data-a="addTime">${ic('plus', 's')}Add</button>
      </div>
      ${ui.tsError ? `<span class="tag warn self-start">${esc(ui.tsError)}</span>` : ''}
    </div>`;
}

function adjeraCopyCard({ pids, grid, minutes, dayTotals, di }, day = ui.tsDay) {
  const lines = pids.map((pid, r) => [pidLabel(pid), grid[r][di]]).filter(([, h]) => h > 0);
  const copyText = lines.map(([code, h]) => `${code}\t${h.toFixed(2)}`).join('\n');
  // Monospace preview, code padded to 10 characters.
  const preview = lines.map(([code, h]) => code.padEnd(10).slice(0, 10) + h.toFixed(2)).join('\n') +
    (lines.length ? '\n' + 'Total'.padEnd(10) + dayTotals[di].toFixed(2) : '');
  // Time that rounds down to zero would silently go missing from Adjera, so call it out.
  const tooSmall = pids
    .filter((pid, r) => grid[r][di] === 0 && minutes(pid, day) >= 1)
    .map(pid => `${pidLabel(pid)} (${Math.round(minutes(pid, day))} min)`);
  return `
    <div class="card pad stack">
      <h2 class="h2">Copy for Adjera</h2>
      ${lines.length ? `<div class="copybox">${esc(preview)}</div>` : '<span class="sub">No time on this day yet.</span>'}
      ${tooSmall.length ? `<span class="sub warnline">Rounds to 0, not copied: ${esc(tooSmall.join(', '))}</span>` : ''}
      <button class="btn pri" data-a="copyDay" data-v="${esc(copyText)}"${lines.length ? '' : ' disabled'}>${ic('copy', 's')}Copy ${S.DAYS[di]}</button>
      <label class="row checkline"><input type="checkbox" class="chk" data-a="entered" data-v="${day}"${state.adjera[day] ? ' checked' : ''}>Mark ${S.DAYS[di]} as entered in Adjera</label>
      <span class="sub small">Copies one line per project: number, tab, hours. Overhead uses the code set in Settings.</span>
    </div>`;
}
