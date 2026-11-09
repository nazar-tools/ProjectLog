// Monday morning: go through last week one day at a time, fix anything odd, and enter it in
// Adjera. Every cell can be typed into; amber dots mark hours rounded from timer blocks.

const lastWeekKey = () => S.iso(S.addDays(S.parseISO(curWeek()), -7));

function viewReview() {
  const wk = ui.reviewWeek || lastWeekKey();
  const { days, pids, minutes, grid, dayTotals } = timesheetData(wk);
  const target = dayTarget();
  const todo = days.filter((d, i) => dayTotals[i] > 0 && !state.adjera[d]);
  if (!days.includes(ui.reviewDay)) ui.reviewDay = todo[0] || days[0];
  const di = days.indexOf(ui.reviewDay);
  const weekTotal = sum(dayTotals, x => x);
  const allDone = dayTotals.some(x => x > 0) && !todo.length;
  const year = wk.slice(0, 4) !== S.today().slice(0, 4) ? ', ' + wk.slice(0, 4) : '';

  const steps = days.map((d, i) => {
    const done = !!state.adjera[d];
    const cls = d === ui.reviewDay ? ' on' : done ? ' done' : dayTotals[i] ? '' : ' empty';
    return `<button class="step${cls}" data-a="reviewDay" data-v="${d}" aria-pressed="${d === ui.reviewDay}">${done ? ic('check', 's') : ''}${S.DAYS[i]} ${S.parseISO(d).getDate()}</button>`;
  }).join('');

  const head = `
    <div class="gr hd">
      <span>Project</span>
      ${days.map((d, i) => `<button class="colhead${i === di ? ' cur' : ''}" data-a="reviewDay" data-v="${d}">${S.DAYS[i]} ${S.parseISO(d).getDate()}${state.adjera[d] ? ' ✓' : ''}</button>`).join('')}
      <span>Total</span>
    </div>`;
  const rows = pids.map((pid, r) => {
    const pm = proj(pid) ? person(proj(pid).pm) : null;
    const cells = days.map((d, i) => `<span class="${i === di ? 'cur' : ''}">${hoursCell(pid, d, grid[r][i], minutes)}</span>`).join('');
    return `
      <div class="gr${pid === 'BREAK' ? ' brkrow' : ''}">
        <span class="row tight minw0" style="${pcVar(pm)}"><span class="dot"></span><b class="num">${esc(pidLabel(pid))}</b><span class="sub ell">${esc(pidName(pid))}</span></span>
        ${cells}
        <b class="num">${sum(grid[r], x => x).toFixed(2)}</b>
      </div>`;
  }).join('');
  const foot = `
    <div class="gr ft">
      <span>Day total</span>
      ${dayTotals.map((v, i) => `<span class="num${i === di ? ' cur' : ''}${v && v < target ? ' short' : ''}">${v ? v.toFixed(2) : '–'}</span>`).join('')}
      <span class="num">${weekTotal.toFixed(2)}</span>
    </div>`;

  // Whole week as a grid, project number then Mon-Fri, for pasting into a weekly view.
  const weekText = pids.map((pid, r) => [pidLabel(pid), ...grid[r].map(v => v.toFixed(2))].join('\t'))
    .filter((line, r) => pids[r] !== 'BREAK' && sum(grid[r], x => x) > 0).join('\n');

  return `
    <div class="pagehead">
      <div class="grow stack gap1">
        <h1 class="h1">Review week · ${fmtRange(wk)}${year}</h1>
        <span class="sub">Check each day, then mark it entered in Adjera.</span>
      </div>
      <div class="row tight">
        <button class="iconbtn" data-a="reviewWeek" data-v="-1" aria-label="Previous week">${ic('chevL', 's')}</button>
        <button class="iconbtn" data-a="reviewWeek" data-v="1" aria-label="Next week">${ic('chevR', 's')}</button>
        <button class="btn" data-a="openTs" data-v="${esc(wk)}">${ic('clock', 's')}<span class="hide-narrow">Timesheet</span></button>
      </div>
    </div>
    <div class="steps" role="group" aria-label="Days">${steps}</div>
    <div class="cols">
      <section class="col-main">
        <div class="card clip scrollx"><div class="reviewgrid">${head}${rows}${foot}</div></div>
        <span class="sub small row tight"><span class="dot pend"></span>Rounded from timer blocks. Type a new number to trim or stretch that project’s blocks for the day.</span>
      </section>
      <aside class="col-side">
        ${allDone ? reviewDoneCard(wk, weekTotal) : reviewDayCard(pids, grid, minutes, dayTotals, days, di, target)}
        <div class="card pad stack">
          <span class="lbl">Or all at once</span>
          <span class="sub">Project and Mon–Fri hours per row, tab separated.</span>
          <button class="btn sm self-start" data-a="copyDay" data-v="${esc(weekText)}"${weekText ? '' : ' disabled'}>${ic('copy', 's')}Copy whole week</button>
        </div>
      </aside>
    </div>`;
}

function reviewDayCard(pids, grid, minutes, dayTotals, days, di, target) {
  const day = days[di];
  const gap = S.roundQ(target - dayTotals[di]);
  const fill = !state.adjera[day] && dayTotals[di] > 0 && gap > 0;
  // Offer overhead first, then the two projects with the most time that day.
  const top = pids.map((pid, r) => [pid, grid[r][di]]).filter(([pid, h]) => pid !== 'OH' && pid !== 'BREAK' && h > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([pid]) => pid);
  const next = days.slice(di + 1).find((d, i) => dayTotals[di + 1 + i] > 0 && !state.adjera[d]);
  return `
    ${adjeraCopyCard({ pids, grid, minutes, dayTotals, di }, day)}
    ${fill ? `
      <div class="card pad stack shortcard">
        <b>${dayTotals[di].toFixed(2)} of ${fmtH(target)} h · ${gap.toFixed(2)} h short</b>
        <span class="small">Fill the gap with:</span>
        <div class="row wrap tight">
          ${['OH', ...top].map(pid => `<button class="btn sm" data-a="reviewFill" data-id="${esc(pid)}" data-v="${gap}">+ ${gap.toFixed(2)} ${esc(pid === 'OH' ? 'Overhead' : pidLabel(pid))}</button>`).join('')}
        </div>
      </div>` : ''}
    ${state.adjera[day] ? '' : `
      <button class="btn pri" data-a="reviewNext" data-v="${day}"${dayTotals[di] ? '' : ' disabled'}>
        ${ic('check', 's')}Mark ${S.DAYS[di]} entered${next ? ` · next: ${S.DAYS[days.indexOf(next)]}` : ''}
      </button>`}`;
}

function reviewDoneCard(wk, total) {
  return `
    <div class="card pad stack">
      <span class="tag good self-start">Every day entered</span>
      <h2 class="h2">${fmtRange(wk)} is done</h2>
      <span class="sub">${total.toFixed(2)} h entered in Adjera. The Monday reminder goes away.</span>
      <a class="btn self-start" href="#/week">Back to this week</a>
    </div>`;
}
