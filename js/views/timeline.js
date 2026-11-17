// Timesheet › Timeline: the selected day on a clock, one lane per project so you can see what
// each block is. The "All" strip on top shows the whole day and the stretches nobody logged.
// Drag a block sideways to move it (it lands in the nearest free spot), up or down to give it to
// another project, or by its edges to stretch or squish it. Drag along a lane to add time to that
// project. Click a gap to give it to a project or to Break, which doesn't count.

const HOUR = 3600000;
const SNAP = 5 * 60000;

// Lanes on screen, top to bottom, so Alt+Up/Down can move a block to the project above or below.
let tlLaneOrder = [];

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
  const track = (pid, inner, cls = '') =>
    `<div class="tltrack${cls}" style="--hours:${(to - from) / HOUR}" data-from="${from}" data-to="${to}" data-day="${day}" data-pid="${esc(pid)}">${inner}</div>`;

  // Nothing picked yet: start on the first gap still to sort out.
  let sel = ui.tsSel;
  if (sel?.gap && !gaps.some(g => key(g) === sel.gap)) sel = null;
  if (sel?.id && !blocks.some(b => b.id === sel.id)) sel = null;
  if (!sel) {
    const open = gaps.find(g => !g.skipped);
    sel = open ? { gap: key(open) } : null;
  }

  // One lane per project with time today, in the order you worked on them; overhead and breaks
  // last; then any lane you added to draw on.
  const firstStart = pid => Math.min(...all.filter(b => b.pid === pid).map(b => b.start));
  const special = { OH: 1, BREAK: 2 };
  const lanes = [...new Set(all.map(b => b.pid))]
    .sort((a, b) => (special[a] || 0) - (special[b] || 0) || firstStart(a) - firstStart(b));
  for (const pid of ui.tlLanes[day] || []) if (!lanes.includes(pid)) lanes.push(pid);
  tlLaneOrder = lanes;

  const ticks = [];
  for (let h = from; h <= to; h += HOUR) {
    ticks.push(`<span class="tick" style="left:${left(h)}%"><span>${clock(h).replace(':00', '')}</span></span>`);
  }

  // The overview strip: everything at a glance, plus the untracked gaps to click on.
  const overview = all.map(b => {
    const pm = proj(b.pid) ? person(proj(b.pid).pm) : null;
    return `<span class="tlmini${b.pid === 'BREAK' ? ' brk' : ''}" style="${place(b.start, b.end)};${pcVar(pm)}"></span>`;
  }).join('') + gaps.map(g => {
    const on = sel?.gap === key(g);
    const aria = `Untracked ${clock(g.from)} to ${clock(g.to)}`;
    return `<button class="tlgap${on ? ' sel' : ''}" style="${place(g.from, g.to)}" data-a="tlPick" data-v="${key(g)}" aria-label="${aria}" title="${aria}"></button>`;
  }).join('');
  const range = sel?.range ? sel.range.split('-').map(Number) : null;

  const laneRows = lanes.map(pid => {
    const p = proj(pid);
    const pm = p ? person(p.pm) : null;
    const hours = S.roundQ((S.minutesFor(state, pid, day, day) + liveMinutes(pid, day)) / 60);
    const brk = pid === 'BREAK' ? ' brk' : '';
    const segs = all.filter(b => b.pid === pid).map(b => blockSeg(b, p, pm, sel, place)).join('');
    return `
      <div class="tllabel${brk}" style="${pcVar(pm)}" title="${esc(pidLabel(pid))} · ${esc(pidName(pid))}">
        <span class="dot"></span>
        <span class="grow minw0"><b class="num">${esc(pidShort(pid))}</b><span class="tlname">${esc(p ? p.name : pid === 'BREAK' ? 'Not counted' : 'Meetings, admin')}</span></span>
        <span class="num tlhrs">${hours ? hours.toFixed(2) : ''}</span>
      </div>
      ${track(pid, segs, ' lane' + brk)}`;
  }).join('');

  const addable = [...new Set([...pids, 'OH', 'BREAK'])].filter(pid => !lanes.includes(pid));
  const addLane = !addable.length ? '' : `
    <select class="inp tladd" data-in="tlAddLane" aria-label="Add a row to draw time on">
      <option value="">+ Add a row</option>
      ${addable.map(pid => `<option value="${esc(pid)}">${esc(pidShort(pid))}${proj(pid) ? ' · ' + esc(proj(pid).name) : ''}</option>`).join('')}
    </select>`;

  const lunch = !all.some(b => b.pid === 'BREAK') && state.settings.lunchFrom && state.settings.lunchTo;
  const untracked = sum(gaps, g => g.to - g.from) / 60000;
  const unsnapped = blocks.some(b => b.start % (15 * 60000) || b.end % (15 * 60000));

  return `
    <section class="card pad stack timeline" aria-label="Day timeline">
      <div class="tlgrid">
        <span></span><div class="tlticks">${ticks.join('')}</div>
        <span class="tllabel overview">All${untracked >= 1 ? `<span class="warnline small">${fmtDuration(untracked)} untracked</span>` : ''}</span>
        ${track('', overview + (range ? `<span class="tlrange" style="${place(range[0], range[1])}"></span>` : ''), ' overview')}
        ${laneRows}
      </div>
      <div class="row wrap tlfoot">
        ${addLane}
        <span class="grow"></span>
        ${lunch ? `<button class="btn sm" data-a="tlLunch">${ic('coffee', 's')}Lunch ${clock(atTime(day, state.settings.lunchFrom))} – ${clock(atTime(day, state.settings.lunchTo))}</button>` : ''}
        ${unsnapped ? `<button class="btn sm" data-a="tlSnap" title="Move every block's start and end to the nearest quarter hour">Snap times to ¼ h</button>` : ''}
      </div>
      <span class="sub small">Drag blocks to move or resize them, or up and down to another project. Drag along a row to add time to it.</span>
    </section>
    ${timelinePanel(sel, gaps, blocks, pids)}`;
}

// 9:00–12:00, without am/pm, to fit inside a block.
const hm = ms => clock(ms).replace(/ [ap]m$/, '');

function blockSeg(b, p, pm, sel, place) {
  const brk = b.pid === 'BREAK' ? ' brk' : '';
  const span = `${hm(b.start)}–${b.live ? 'now' : hm(b.end)}`;
  const what = p ? `${p.number} · ${p.name}` : pidShort(b.pid);
  const title = `${what}\n${clock(b.start)} – ${b.live ? 'now (timer running)' : clock(b.end)} · ${fmtDuration((b.end - b.start) / 60000)}${b.note ? '\n' + b.note : ''}`;
  const text = `<span class="tlt">${span}</span>${b.note ? `<span class="tln">${esc(b.note)}</span>` : ''}`;
  if (b.live) return `<span class="tlblock live${brk}" style="${place(b.start, b.end)};${pcVar(pm)}" title="${esc(title)}">${text}</span>`;
  return `
    <button class="tlblock${brk}${sel?.id === b.id ? ' sel' : ''}" id="tl-${esc(b.id)}" style="${place(b.start, b.end)};${pcVar(pm)}" data-a="tlPick" data-id="${esc(b.id)}"
      aria-label="${esc(what)}, ${clock(b.start)} to ${clock(b.end)}. Arrows move it, Shift+arrows change the end, Alt+up or down moves it to another project." title="${esc(title)}">
      <span class="edge s" data-edge="start"></span>${text}<span class="edge e" data-edge="end"></span>
    </button>`;
}

function timelinePanel(sel, gaps, blocks, pids) {
  if (sel?.id) {
    const b = blocks.find(x => x.id === sel.id);
    const p = proj(b.pid);
    return `
      <div class="card clip list">
        <div class="pad row tight blockhead" style="${pcVar(p ? person(p.pm) : null)}"><span class="dot"></span><b>${esc(pidShort(b.pid))}</b><span class="sub ell">${esc(pidName(b.pid))}</span></div>
        ${blockRow(b, pids)}
      </div>`;
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
    tlDrag = { mode, entry, el: blockEl, start: entry.start, end: entry.end, pid: entry.pid, ...tlBounds(entry) };
  } else {
    const t0 = snapTime(from + (e.clientX - box.left) * msPerPx);
    const day = track.dataset.day;
    const dayStart = S.parseISO(day).getTime();
    const blocks = state.time.filter(t => t.date === day && t.start);
    const lo = blocks.filter(t => t.end <= t0).reduce((m, t) => Math.max(m, t.end), dayStart);
    const hi = blocks.filter(t => t.start >= t0).reduce((m, t) => Math.min(m, t.start), dayStart + 24 * HOUR);
    tlDrag = { mode: 'draw', t0, start: t0, end: t0, el: null, lo, hi, pid: track.dataset.pid };
  }
  Object.assign(tlDrag, { track, from, to, msPerPx, x0: e.clientX, y0: e.clientY, moved: false, tip: null });
  track.setPointerCapture(e.pointerId);
  e.preventDefault();
});

document.addEventListener('pointermove', e => {
  const d = tlDrag;
  if (!d) return;
  if (Math.abs(e.clientX - d.x0) > 3 || Math.abs(e.clientY - d.y0) > 3) d.moved = true;
  if (!d.moved) return;
  const shift = (e.clientX - d.x0) * d.msPerPx;
  if (d.mode === 'move') {
    const len = d.entry.end - d.entry.start;
    d.start = landingSpot(d.entry, snapTime(d.entry.start + shift));
    d.end = d.start + len;
    // Dragged up or down onto another project's lane: the block follows and changes project.
    const lanes = [...document.querySelectorAll('.tltrack.lane')];
    const middle = l => {
      const r = l.getBoundingClientRect();
      return Math.abs(e.clientY - (r.top + r.bottom) / 2);
    };
    const over = lanes.reduce((best, l) => (middle(l) < middle(best) ? l : best), d.track);
    d.pid = over.dataset.pid;
    lanes.forEach(l => l.classList.toggle('droptarget', l === over && l !== d.track));
    d.dy = over.getBoundingClientRect().top - d.track.getBoundingClientRect().top;
    d.el.classList.add('dragging');
    d.el.style.transform = `translateY(${d.dy}px)`;
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
  const onto = d.mode === 'move' && d.pid !== d.entry.pid ? ` → ${pidShort(d.pid)}` : '';
  d.tip.textContent = `${clock(d.start)} – ${clock(d.end)} · ${fmtDuration((d.end - d.start) / 60000)}${onto}`;
  d.tip.style.left = pct((d.start + d.end) / 2) + '%';
  d.tip.style.marginTop = (d.dy || 0) + 'px';
});

document.addEventListener('pointerup', () => {
  const d = tlDrag;
  if (!d) return;
  tlDrag = null;
  const drawn = d.mode === 'draw' && d.moved && d.end - d.start >= SNAP;
  if (drawn && d.pid) {
    // Drawn along a project's lane: it's that project's time, no need to ask.
    const entry = S.fillGap(state, d.pid, d.track.dataset.day, d.start, d.end);
    ui.tsSel = { id: entry.id };
    save();
    showToast(`Added ${fmtDuration(entry.minutes)} to ${pidShort(d.pid)}`, () => { state.time = state.time.filter(t => t.id !== entry.id); });
  } else if (d.mode === 'draw') {
    ui.tsSel = drawn ? { range: `${d.start}-${d.end}` } : null;
  } else if (!d.moved) {
    ui.tsSel = { id: d.entry.id };
  } else {
    moveEntry(d.entry, d.start, d.end, d.pid);
  }
  render();
});

document.addEventListener('pointercancel', () => {
  if (!tlDrag) return;
  tlDrag = null;
  render();
});

// With a block focused: arrows move it 5 minutes, Shift+arrows change where it ends, and
// Alt+Up/Down moves it to the project lane above or below.
document.addEventListener('keydown', e => {
  const el = e.target;
  if (!el.matches?.('.tlblock[data-id]') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  const x = timeEntry(el.dataset.id);
  if (!x) return;
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    if (!e.altKey) return;
    e.preventDefault();
    const next = tlLaneOrder[tlLaneOrder.indexOf(x.pid) + (e.key === 'ArrowUp' ? -1 : 1)];
    if (next) moveEntry(x, x.start, x.end, next);
    render();
    return;
  }
  e.preventDefault();
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

function moveEntry(x, start, end, pid = x.pid) {
  if (start === x.start && end === x.end && pid === x.pid) return;
  const before = { start: x.start, end: x.end, minutes: x.minutes, pid: x.pid };
  Object.assign(x, { start, end, pid, minutes: Math.round((end - start) / 60000) });
  ui.tsSel = { id: x.id };
  save();
  const moved = pid !== before.pid ? ` (moved from ${pidShort(before.pid)})` : '';
  showToast(`${pidShort(x.pid)} now ${clock(start)} – ${clock(end)}${moved}`, () => {
    const t = timeEntry(x.id);
    if (t) Object.assign(t, before);
  });
}
