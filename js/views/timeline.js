// Timesheet › Timeline: the selected day drawn on a clock face, with the stretches nobody logged.
// Drag a block anywhere to move it (it lands in the nearest free spot), drag its edges to
// stretch or squish it, drag across empty track to draw a new one. Click a gap to give it to a
// project or to Break, which blocks out the time without counting it.

const HOUR = 3600000;
const SNAP = 5 * 60000;

function dayTimeline(day, pids) {
  const blocks = state.time.filter(x => x.date === day && x.start).sort((a, b) => a.start - b.start);
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
    const aria = `${esc(code)} ${clock(b.start)} to ${b.live ? 'now (timer running)' : clock(b.end)}`;
    const brk = b.pid === 'BREAK' ? ' brk' : '';
    if (b.live) return `<span class="tlblock live${brk}" style="${place(b.start, b.end)};${pcVar(pm)}" title="${aria}">${label}</span>`;
    const on = sel?.id === b.id;
    return `
      <button class="tlblock${brk}${on ? ' sel' : ''}" id="tl-${esc(b.id)}" style="${place(b.start, b.end)};${pcVar(pm)}" data-a="tlPick" data-id="${esc(b.id)}"
        aria-label="${aria}. Arrow keys move it, Shift+arrows change the end." title="${aria}">
        <span class="edge s" data-edge="start"></span>${label}<span class="edge e" data-edge="end"></span>
      </button>`;
  }).join('');
  const gapSegs = gaps.map(g => {
    const on = sel?.gap === key(g);
    const aria = `${g.skipped ? 'Break' : 'Untracked'} ${clock(g.from)} to ${clock(g.to)}`;
    return `<button class="tlgap${g.skipped ? ' skipped' : ''}${on ? ' sel' : ''}" style="${place(g.from, g.to)}" data-a="tlPick" data-v="${key(g)}" aria-label="${aria}" title="${aria}"></button>`;
  }).join('');
  const range = sel?.range ? sel.range.split('-').map(Number) : null;

  const legend = [...new Set(all.map(b => b.pid))].sort((a, b) => (a === 'BREAK') - (b === 'BREAK')).map(pid => {
    const pm = proj(pid) ? person(proj(pid).pm) : null;
    const h = S.roundQ((S.minutesFor(state, pid, day, day) + liveMinutes(pid, day)) / 60);
    const note = pid === 'BREAK' ? ' · not counted' : '';
    return `<span class="row tight legend${pid === 'BREAK' ? ' brk' : ''}" style="${pcVar(pm)}"><span class="dot"></span><b class="num">${esc(pidShort(pid))}</b><span class="sub num">${h.toFixed(2)} h${note}</span></span>`;
  }).join('');
  const lunch = !all.some(b => b.pid === 'BREAK') && state.settings.lunchFrom && state.settings.lunchTo;
  const untracked = sum(gaps.filter(g => !g.skipped), g => g.to - g.from) / 60000;
  const unsnapped = blocks.some(b => b.start % (15 * 60000) || b.end % (15 * 60000));

  return `
    <section class="card pad stack timeline" aria-label="Day timeline">
      <div class="tlticks">${ticks.join('')}</div>
      <div class="tltrack" data-from="${from}" data-to="${to}" data-day="${day}">
        ${blockSegs}${gapSegs}
        ${range ? `<span class="tlrange" style="${place(range[0], range[1])}"></span>` : ''}
      </div>
      <div class="row wrap tlfoot">
        ${legend}
        ${untracked >= 1 ? `<span class="row tight legend warnline"><span class="dot pend"></span>Untracked ${fmtDuration(untracked)}</span>` : ''}
        <span class="grow"></span>
        ${lunch ? `<button class="btn sm" data-a="tlLunch">${ic('coffee', 's')}Lunch ${clock(atTime(day, state.settings.lunchFrom))} – ${clock(atTime(day, state.settings.lunchTo))}</button>` : ''}
        ${unsnapped ? `<button class="btn sm" data-a="tlSnap" title="Move every block's start and end to the nearest quarter hour">Snap times to ¼ h</button>` : ''}
      </div>
      <span class="sub small">Drag a block anywhere to move it, drag its edges to change its length, or drag across empty space to add time.</span>
    </section>
    ${timelinePanel(sel, gaps, blocks, pids)}`;
}

function timelinePanel(sel, gaps, blocks, pids) {
  if (sel?.id) {
    const b = blocks.find(x => x.id === sel.id);
    return `<div class="card clip list">${blockRow(b, pids)}</div>`;
  }
  const choices = k => ['BREAK', ...pids.filter(pid => pid !== 'BREAK')].map(pid => {
    const pm = proj(pid) ? person(proj(pid).pm) : null;
    const label = pid === 'BREAK' ? 'Break (not counted)' : pidShort(pid);
    return `<button class="btn sm${pid === 'BREAK' ? ' brk' : ''}" data-a="tlAssign" data-id="${esc(pid)}" data-v="${k}" style="${pcVar(pm)}"><span class="dot"></span>${esc(label)}</button>`;
  }).join('');

  if (sel?.range) {
    const [from, to] = sel.range.split('-').map(Number);
    return `
      <div class="card pad stack">
        <b>New block ${clock(from)} – ${clock(to)} · ${fmtDuration((to - from) / 60000)}</b>
        <div class="row wrap tight">${choices(sel.range)}<button class="btn sm ghost" data-a="tlCancel">Cancel</button></div>
      </div>`;
  }
  const g = sel && gaps.find(x => `${x.from}-${x.to}` === sel.gap);
  if (!g) {
    return '<div class="card pad sub">Every gap is sorted. Breaks you marked stay out of Adjera.</div>';
  }
  const k = `${g.from}-${g.to}`;
  const mins = (g.to - g.from) / 60000;
  return `
    <div class="card pad stack">
      <div class="stack gap1">
        <b>Untracked ${clock(g.from)} – ${clock(g.to)} · ${fmtDuration(mins)}</b>
        <span class="sub">${mins > 45 ? 'Long gap, maybe lunch. Mark it as a break, or give it to a project.' : 'Probably still on the work before or after it. Give it to:'}</span>
      </div>
      <div class="row wrap tight">${choices(k)}</div>
    </div>`;
}

// How far a block can go before it runs into its neighbours (or the running timer).
function tlBounds(entry) {
  const day = S.parseISO(entry.date).getTime();
  const others = state.time.filter(t => t.date === entry.date && t !== entry && t.start);
  if (state.timer && liveMinutes(null, entry.date) > 0) others.push({ start: Math.max(state.timer.start, day), end: Date.now() });
  return {
    lo: others.filter(t => t.end <= entry.start).reduce((m, t) => Math.max(m, t.end), day),
    hi: others.filter(t => t.start >= entry.end).reduce((m, t) => Math.min(m, t.start), day + 24 * HOUR)
  };
}

// Where a moved block lands: the free spot nearest to where you're dragging it, so it can jump
// over lunch or other blocks to the end of the day.
function landingSpot(entry, want) {
  const day = S.parseISO(entry.date).getTime();
  const len = entry.end - entry.start;
  const others = state.time.filter(t => t.date === entry.date && t !== entry && t.start).sort((a, b) => a.start - b.start);
  if (state.timer && liveMinutes(null, entry.date) > 0) others.push({ start: Math.max(state.timer.start, day), end: Date.now() });
  others.sort((a, b) => a.start - b.start);
  const free = [];
  let at = day;
  for (const b of others) {
    if (b.start > at) free.push([at, b.start]);
    at = Math.max(at, b.end);
  }
  if (at < day + 24 * HOUR) free.push([at, day + 24 * HOUR]);
  let best = null;
  for (const [a, b] of free) {
    if (b - a < len) continue;
    const start = clamp(want, a, b - len);
    if (best === null || Math.abs(start - want) < Math.abs(best - want)) best = start;
  }
  return best ?? entry.start;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const snapTime = t => Math.round(t / SNAP) * SNAP;

// Dragging. Moves are drawn straight onto the page while the pointer moves (no redraw), and
// saved once on release. Everything snaps to 5 minutes and stops at the neighbouring blocks.
let tlDrag = null;

document.addEventListener('pointerdown', e => {
  const track = e.target.closest?.('.tltrack');
  if (!track || e.button !== 0 || e.target.closest('.tlgap, .tlblock.live')) return;
  const box = track.getBoundingClientRect();
  const from = +track.dataset.from;
  const to = +track.dataset.to;
  const msPerPx = (to - from) / box.width;
  const blockEl = e.target.closest('.tlblock[data-id]');
  if (blockEl) {
    const entry = timeEntry(blockEl.dataset.id);
    if (!entry) return;
    const mode = e.target.closest('[data-edge]')?.dataset.edge || 'move';
    tlDrag = { mode, entry, el: blockEl, start: entry.start, end: entry.end, ...tlBounds(entry) };
  } else {
    const t0 = snapTime(from + (e.clientX - box.left) * msPerPx);
    const day = track.dataset.day;
    const dayStart = S.parseISO(day).getTime();
    const blocks = state.time.filter(t => t.date === day && t.start);
    const lo = blocks.filter(t => t.end <= t0).reduce((m, t) => Math.max(m, t.end), dayStart);
    const hi = blocks.filter(t => t.start >= t0).reduce((m, t) => Math.min(m, t.start), dayStart + 24 * HOUR);
    tlDrag = { mode: 'draw', t0, start: t0, end: t0, el: null, lo, hi };
  }
  Object.assign(tlDrag, { track, from, to, msPerPx, x0: e.clientX, moved: false, tip: null });
  track.setPointerCapture(e.pointerId);
  e.preventDefault();
});

document.addEventListener('pointermove', e => {
  const d = tlDrag;
  if (!d) return;
  if (Math.abs(e.clientX - d.x0) > 3) d.moved = true;
  if (!d.moved) return;
  const shift = (e.clientX - d.x0) * d.msPerPx;
  if (d.mode === 'move') {
    const len = d.entry.end - d.entry.start;
    d.start = landingSpot(d.entry, snapTime(d.entry.start + shift));
    d.end = d.start + len;
  } else if (d.mode === 'start') {
    d.start = clamp(snapTime(d.entry.start + shift), d.lo, d.entry.end - SNAP);
  } else if (d.mode === 'end') {
    d.end = clamp(snapTime(d.entry.end + shift), d.entry.start + SNAP, d.hi);
  } else {
    const t = clamp(snapTime(d.t0 + shift), d.lo, d.hi);
    d.start = Math.min(d.t0, t);
    d.end = Math.max(d.t0, t);
    if (!d.el) {
      d.el = document.createElement('span');
      d.el.className = 'tlrange';
      d.track.append(d.el);
    }
  }
  const pct = ms => ((ms - d.from) / (d.to - d.from)) * 100;
  d.el.style.left = pct(d.start) + '%';
  d.el.style.width = `calc(${pct(d.end) - pct(d.start)}% - 2px)`;
  if (!d.tip) {
    d.tip = document.createElement('span');
    d.tip.className = 'tltip';
    d.track.append(d.tip);
  }
  d.tip.textContent = `${clock(d.start)} – ${clock(d.end)} · ${fmtDuration((d.end - d.start) / 60000)}`;
  d.tip.style.left = pct((d.start + d.end) / 2) + '%';
});

document.addEventListener('pointerup', () => {
  const d = tlDrag;
  if (!d) return;
  tlDrag = null;
  if (d.mode === 'draw') {
    ui.tsSel = d.moved && d.end - d.start >= SNAP ? { range: `${d.start}-${d.end}` } : null;
  } else if (!d.moved) {
    ui.tsSel = { id: d.entry.id };
  } else {
    moveEntry(d.entry, d.start, d.end);
  }
  render();
});

document.addEventListener('pointercancel', () => {
  if (!tlDrag) return;
  tlDrag = null;
  render();
});

// With a block focused: arrows move it 5 minutes, Shift+arrows change where it ends.
document.addEventListener('keydown', e => {
  const el = e.target;
  if (!el.matches?.('.tlblock[data-id]') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  e.preventDefault();
  const x = timeEntry(el.dataset.id);
  if (!x) return;
  const step = e.key === 'ArrowLeft' ? -SNAP : SNAP;
  const { hi } = tlBounds(x);
  if (e.shiftKey) {
    moveEntry(x, x.start, clamp(x.end + step, x.start + SNAP, hi));
  } else {
    const len = x.end - x.start;
    const start = landingSpot(x, x.start + step);
    moveEntry(x, start, start + len);
  }
  render();
});

function moveEntry(x, start, end) {
  if (start === x.start && end === x.end) return;
  const before = { start: x.start, end: x.end, minutes: x.minutes };
  Object.assign(x, { start, end, minutes: Math.round((end - start) / 60000) });
  ui.tsSel = { id: x.id };
  save();
  showToast(`${pidLabel(x.pid)} now ${clock(start)} – ${clock(end)}`, () => {
    const t = timeEntry(x.id);
    if (t) Object.assign(t, before);
  });
}
