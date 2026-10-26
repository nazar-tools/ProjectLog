// Timesheet: hours per project per day, rounded to the quarter hour, ready to paste into Adjera.

const tsKey = () => S.weekKey(S.addDays(new Date(), ui.tsOffset * 7));

function viewTime() {
  const wk = tsKey();
  const R = S.weekRange(wk);
  const t = S.today();
  const days = weekDays(wk);
  if (!days.includes(ui.tsDay)) ui.tsDay = days.includes(t) ? t : days[0];
  const week = wk < curWeek() ? state.weeks[wk] : S.peekWeek(state, wk);

  // Rows: projects planned that week, then anything else with time on it, then overhead.
  const pids = [];
  const addPid = pid => { if (!pids.includes(pid)) pids.push(pid); };
  (week?.entries || []).filter(e => proj(e.pid)).forEach(e => addPid(e.pid));
  state.time.filter(x => x.pid !== 'OH' && x.date >= R.startIso && x.date <= R.endIso).forEach(x => addPid(x.pid));
  if (state.timer && state.timer.pid !== 'OH' && days.some(d => liveMinutes(state.timer.pid, d) > 0)) addPid(state.timer.pid);
  pids.push('OH');

  const minutes = (pid, d) => S.minutesFor(state, pid, d, d) + liveMinutes(pid, d);
  const grid = pids.map(pid => days.map(d => S.roundQ(minutes(pid, d) / 60)));
  const dayTotals = days.map((d, i) => sum(grid, row => row[i]));
  const weekTotal = sum(dayTotals, x => x);
  const entered = days.filter(d => state.adjera[d]).length;
  const daysWithTime = dayTotals.filter(x => x > 0).length;
  const hrs = v => (v ? v.toFixed(2) : '–');
  const todayCls = d => (d === t ? 'today' : '');

  const daySeg = days.map((d, i) =>
    `<button data-a="tsDay" data-v="${d}" class="${ui.tsDay === d ? 'on' : ''}"><b>${S.DAYS[i]}${state.adjera[d] ? ' ✓' : ''}</b><span>${hrs(dayTotals[i])}</span></button>`
  ).join('');

  const tableRows = pids.map((pid, r) => {
    const p = proj(pid);
    const pm = p ? person(p.pm) : null;
    const e = week?.entries.find(x => x.pid === pid);
    return `
      <tr>
        <td><span class="row tight" style="${pcVar(pm)}"><span class="dot"></span><b>${esc(pidLabel(pid))}</b><span class="sub ell maxw">${esc(pidName(pid))}</span></span></td>
        ${grid[r].map((v, i) => `<td class="${todayCls(days[i])} ${v ? '' : 'empty'}">${hrs(v)}</td>`).join('')}
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
        <div class="row">
          <button class="iconbtn" data-a="tsWeek" data-v="-1" aria-label="Previous week">${ic('chevL', 's')}</button>
          <span class="tsweek">${fmtRange(wk)}</span>
          <button class="iconbtn" data-a="tsWeek" data-v="1" aria-label="Next week">${ic('chevR', 's')}</button>
        </div>
      </div>
      ${timerBar()}
      ${ui.tsOffset === 0 ? adjeraReminder(wk) : ''}
      <div class="seg dayseg" role="group" aria-label="Day">${daySeg}</div>
    </div>
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
    ${dayDetail(pids, grid, dayTotals, days.indexOf(ui.tsDay), minutes)}`;
}

function dayDetail(pids, grid, dayTotals, di, minutes) {
  const day = ui.tsDay;
  const lines = pids.map((pid, r) => [pidLabel(pid), grid[r][di]]).filter(([, h]) => h > 0);
  const copyText = lines.map(([code, h]) => `${code}\t${h.toFixed(2)}`).join('\n');
  // Monospace preview, code padded to 10 characters.
  const preview = lines.map(([code, h]) => code.padEnd(10).slice(0, 10) + h.toFixed(2)).join('\n') +
    (lines.length ? '\n' + 'Total'.padEnd(10) + dayTotals[di].toFixed(2) : '');
  // Time that rounds down to zero would silently go missing from Adjera, so call it out.
  const tooSmall = pids
    .filter((pid, r) => grid[r][di] === 0 && minutes(pid, day) >= 1)
    .map(pid => `${pidLabel(pid)} (${Math.round(minutes(pid, day))} min)`);

  const timerToday = state.timer && liveMinutes(null, day) > 0;
  const entries = state.time.filter(x => x.date === day).sort((a, b) => (b.start || 0) - (a.start || 0));
  const status = state.adjera[day]
    ? '<span class="tag good">Entered in Adjera</span>'
    : dayTotals[di] ? '<span class="tag warn">Not in Adjera yet</span>' : '';

  const running = !timerToday ? '' : `
    <div class="erow live">
      <span class="num when bold">${clock(Math.max(state.timer.start, S.parseISO(day).getTime()))} – now</span>
      <b>${esc(pidLabel(state.timer.pid))}</b>
      <span class="grow ell">${esc(pidName(state.timer.pid))}</span>
      <span class="num bold" data-elapsed>${elapsedText()}</span>
    </div>`;
  const rows = entries.map(x => `
    <div class="erow">
      <span class="num sub when">${x.start ? `${clock(x.start)} – ${clock(x.end)}` : 'Added by hand'}</span>
      <b class="num">${esc(pidLabel(x.pid))}</b>
      <span class="grow ell sub">${esc(x.note || pidName(x.pid))}</span>
      <span class="num">${fmtH(x.minutes / 60)} h</span>
      <button class="iconbtn plain sm" data-a="delTime" data-id="${esc(x.id)}" aria-label="Delete entry">${ic('x', 's')}</button>
    </div>`).join('');
  const projectOptions = Object.values(state.projects)
    .sort((a, b) => (lastSort(b) > lastSort(a) ? 1 : -1))
    .map(p => `<option value="${esc(p.number)} ${esc(p.name)}"></option>`).join('');

  return `
    <div class="cols">
      <section class="col-main">
        <div class="row between"><h2 class="h2">${fmtDay(day)}</h2>${status}</div>
        <div class="card clip list">
          ${running}
          ${rows || (timerToday ? '' : '<div class="empty">Nothing logged. Start a timer on a card, or add time below.</div>')}
        </div>
        <div class="card pad stack">
          <span class="lbl">Add time by hand</span>
          <div class="row wrap tight">
            <input class="inp wfill" id="ts-proj" list="ts-projlist" placeholder="Project number" aria-label="Project">
            <datalist id="ts-projlist"><option value="Overhead"></option>${projectOptions}</datalist>
            <input class="inp num w90" id="ts-hours" placeholder="Hours" inputmode="decimal" aria-label="Hours">
            <input class="inp wfill" id="ts-note" placeholder="Note (optional)" aria-label="Note">
            <button class="btn" data-a="addTime">${ic('plus', 's')}Add</button>
          </div>
          ${ui.tsError ? `<span class="tag warn self-start">${esc(ui.tsError)}</span>` : ''}
        </div>
      </section>
      <aside class="col-side">
        <div class="card pad stack">
          <h2 class="h2">Copy for Adjera</h2>
          ${lines.length ? `<div class="copybox">${esc(preview)}</div>` : '<span class="sub">No time on this day yet.</span>'}
          ${tooSmall.length ? `<span class="sub warnline">Rounds to 0, not copied: ${esc(tooSmall.join(', '))}</span>` : ''}
          <button class="btn pri" data-a="copyDay" data-v="${esc(copyText)}"${lines.length ? '' : ' disabled'}>${ic('copy', 's')}Copy ${S.DAYS[di]}</button>
          <label class="row checkline"><input type="checkbox" class="chk" data-a="entered" data-v="${day}"${state.adjera[day] ? ' checked' : ''}>Mark ${S.DAYS[di]} as entered in Adjera</label>
          <span class="sub small">Copies one line per project: number, tab, hours. Overhead uses the code set in Settings.</span>
        </div>
      </aside>
    </div>`;
}
