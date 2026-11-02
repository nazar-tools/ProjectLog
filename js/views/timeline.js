// Timesheet › Timeline: the selected day drawn on a clock face, with the stretches nobody logged.
// Click a gap to give it to a project (or mark it as a break); click a block to edit it.

const HOUR = 3600000;

function dayTimeline(day, pids) {
  const blocks = state.time.filter(x => x.date === day && x.start).sort((a, b) => a.start - b.start);
  const loose = state.time.filter(x => x.date === day && !x.start);
  const dayStart = S.parseISO(day).getTime();
  const live = state.timer && liveMinutes(null, day) > 0
    ? { id: 'live', pid: state.timer.pid, start: Math.max(state.timer.start, dayStart), end: Date.now(), live: true }
    : null;
  const all = live ? [...blocks, live] : blocks;
  const gaps = S.dayGaps(state, day, live ? [live] : []);
  const key = g => `${g.from}-${g.to}`;

  // 7 am to 6 pm, stretched to the hour around anything earlier or later.
  const from = Math.min(dayStart + 7 * HOUR, ...all.map(b => dayStart + Math.floor((b.start - dayStart) / HOUR) * HOUR));
  const to = Math.max(dayStart + 18 * HOUR, ...all.map(b => dayStart + Math.ceil((b.end - dayStart) / HOUR) * HOUR));
  const left = ms => ((ms - from) / (to - from)) * 100;
  const place = (a, b) => `left:${left(a)}%;width:calc(${left(b) - left(a)}% - 2px)`;

  // Nothing picked yet: start on the first gap still to sort out.
  let sel = ui.tsSel;
  if (sel?.gap && !gaps.some(g => key(g) === sel.gap)) sel = null;
  if (sel?.id && !blocks.some(b => b.id === sel.id)) sel = null;
  if (!sel) {
    const open = gaps.find(g => !g.skipped);
    sel = open ? { gap: key(open) } : null;
  }

  const ticks = [];
  for (let h = from; h <= to; h += HOUR) {
    ticks.push(`<span class="tick" style="left:${left(h)}%"><span>${clock(h).replace(':00', '')}</span></span>`);
  }
  const blockSegs = all.map(b => {
    const pm = proj(b.pid) ? person(proj(b.pid).pm) : null;
    const code = b.pid === 'OH' ? 'OH' : pidLabel(b.pid);
    const label = b.end - b.start >= 45 * 60000 ? esc(code) : '';
    const aria = `${esc(code)} ${clock(b.start)} to ${b.live ? 'now' : clock(b.end)}`;
    if (b.live) return `<span class="tlblock live" style="${place(b.start, b.end)};${pcVar(pm)}" title="${aria}">${label}</span>`;
    const on = sel?.id === b.id;
    return `<button class="tlblock${on ? ' sel' : ''}" style="${place(b.start, b.end)};${pcVar(pm)}" data-a="tlPick" data-id="${esc(b.id)}" aria-label="${aria}" title="${aria}">${label}</button>`;
  }).join('');
  const gapSegs = gaps.map(g => {
    const on = sel?.gap === key(g);
    const aria = `${g.skipped ? 'Break' : 'Untracked'} ${clock(g.from)} to ${clock(g.to)}`;
    return `<button class="tlgap${g.skipped ? ' skipped' : ''}${on ? ' sel' : ''}" style="${place(g.from, g.to)}" data-a="tlPick" data-v="${key(g)}" aria-label="${aria}" title="${aria}"></button>`;
  }).join('');

  const dayPids = [...new Set(all.map(b => b.pid).concat(loose.map(x => x.pid)))];
  const legend = dayPids.map(pid => {
    const pm = proj(pid) ? person(proj(pid).pm) : null;
    const h = S.roundQ((S.minutesFor(state, pid, day, day) + liveMinutes(pid, day)) / 60);
    return `<span class="row tight legend" style="${pcVar(pm)}"><span class="dot"></span><b class="num">${esc(pid === 'OH' ? 'Overhead' : pidLabel(pid))}</b><span class="sub num">${h.toFixed(2)} h</span></span>`;
  }).join('');
  const untracked = sum(gaps.filter(g => !g.skipped), g => g.to - g.from) / 60000;
  const unsnapped = blocks.some(b => b.start % (15 * 60000) || b.end % (15 * 60000));

  return `
    <section class="card pad stack timeline" aria-label="Day timeline">
      <div class="tlticks">${ticks.join('')}</div>
      <div class="tltrack">${blockSegs}${gapSegs}</div>
      <div class="row wrap tlfoot">
        ${legend}
        ${untracked >= 1 ? `<span class="row tight legend warnline"><span class="dot pend"></span>Untracked ${fmtDuration(untracked)}</span>` : ''}
        <span class="grow"></span>
        ${unsnapped ? `<button class="btn sm" data-a="tlSnap" title="Move every block's start and end to the nearest quarter hour">Snap times to ¼ h</button>` : ''}
      </div>
      ${loose.length ? `<span class="sub small">Not on the clock: ${loose.map(x => `${esc(pidLabel(x.pid))} ${fmtH(x.minutes / 60)} h`).join(', ')}</span>` : ''}
      ${!all.length ? '<span class="sub">No timer blocks on this day. Time added by hand has no start and end, so it only shows in the list.</span>' : ''}
    </section>
    ${timelinePanel(sel, gaps, blocks, pids, day)}`;
}

function timelinePanel(sel, gaps, blocks, pids, day) {
  if (sel?.id) {
    const b = blocks.find(x => x.id === sel.id);
    return `<div class="card clip list">${blockRow(b, pids)}</div>`;
  }
  const g = sel && gaps.find(x => `${x.from}-${x.to}` === sel.gap);
  if (!g) {
    return '<div class="card pad sub">Every gap is sorted. Breaks you marked stay out of Adjera.</div>';
  }
  const k = `${g.from}-${g.to}`;
  const mins = (g.to - g.from) / 60000;
  if (g.skipped) {
    return `
      <div class="card pad stack">
        <b>Break ${clock(g.from)} – ${clock(g.to)} · ${fmtDuration(mins)}</b>
        <div><button class="btn sm" data-a="tlAssign" data-id="unskip" data-v="${k}">Not a break after all</button></div>
      </div>`;
  }
  const choices = pids.map(pid => {
    const pm = proj(pid) ? person(proj(pid).pm) : null;
    return `<button class="btn sm" data-a="tlAssign" data-id="${esc(pid)}" data-v="${k}" style="${pcVar(pm)}"><span class="dot"></span>${esc(pid === 'OH' ? 'Overhead' : pidLabel(pid))}</button>`;
  }).join('');
  return `
    <div class="card pad stack">
      <div class="stack gap1">
        <b>Untracked ${clock(g.from)} – ${clock(g.to)} · ${fmtDuration(mins)}</b>
        <span class="sub">${mins > 90 ? 'Long gap, maybe lunch. Mark it as a break, or give it to a project.' : 'Probably still on the work before or after it. Give it to:'}</span>
      </div>
      <div class="row wrap tight">
        <button class="btn sm" data-a="tlAssign" data-id="skip" data-v="${k}"><span class="dot nopm"></span>Not work (break)</button>
        ${choices}
      </div>
    </div>`;
}
