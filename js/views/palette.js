// Ctrl+K (Cmd+K on a Mac): type a project number or what you want to do, Enter runs it.

let paletteItems = [];

function paletteActions() {
  const go = hash => () => { location.hash = hash; };
  const lastWeek = lastWeekKey();
  return [
    { label: 'Log a 30 min meeting to Overhead', hint: 'adds to today', words: 'meeting overhead log 30', run: logMeeting },
    { label: state.timer?.pid === 'BREAK' ? 'End break' : 'Start a break', hint: 'lunch, not counted', words: 'break lunch pause', run: () => actions.timer({ dataset: { id: 'BREAK' } }) },
    { label: 'Copy today for Adjera', hint: fmtDay(S.today()), words: 'copy adjera today timesheet', run: copyToday },
    { label: 'Review and enter last week', hint: fmtRange(lastWeek), words: 'review last week adjera monday', run: () => actions.openReview({ dataset: { v: lastWeek } }) },
    { label: 'Plan next week', hint: 'Plan week', words: 'plan next week', run: () => { ui.planOffset = 1; location.hash = '#/plan'; } },
    { label: 'PM updates', hint: 'weekly update for a PM', words: 'pm update friday status teams email', run: go('#/update') },
    { label: 'Hours and health', hint: 'budgets, stale tasks, Revit versions', words: 'hours budget health stale revit', run: go('#/health') },
    { label: 'Timesheet', hint: 'this week', words: 'timesheet time', run: () => { ui.tsOffset = 0; location.hash = '#/time'; } },
    { label: 'New project', hint: '', words: 'new project add create', run: () => actions.newProject({ dataset: {} }) },
    { label: 'Back up now', hint: 'download the backup file', words: 'backup back up save export', run: actions.export }
  ].map(a => ({ ...a, group: 'Actions', pid: null }));
}

function projectActions(q) {
  const onWeek = new Set(S.peekWeek(state, curWeek()).entries.map(e => e.pid));
  const matches = Object.values(state.projects)
    .filter(p => (q ? q.split(/\s+/).some(w => `${p.number} ${p.name}`.toLowerCase().includes(w)) : onWeek.has(p.id)))
    .sort((a, b) => (onWeek.has(b.id) - onWeek.has(a.id)) || (lastSort(b) > lastSort(a) ? 1 : -1))
    .slice(0, 5);
  return matches.flatMap(p => {
    const words = `${p.number} ${p.name}`;
    const running = timerOn(p.id);
    return [
      { label: `${running ? 'Stop' : 'Start'} timer · ${p.number}`, hint: p.name, words: words + ' timer start stop', run: () => actions.timer({ dataset: { id: p.id } }) },
      { label: `Add a task to ${p.number}`, hint: p.name, words: words + ' add task todo', run: () => { location.hash = projectHref(p.id); focusLater('add-' + p.id); } },
      { label: `Open ${p.number}`, hint: 'notes and journal', words: words + ' open notes journal', run: () => { location.hash = projectHref(p.id); } }
    ].map(a => ({ ...a, group: 'Projects', pid: p.id }));
  });
}

function paletteHtml() {
  const q = ui.palette.q.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  // Every typed word has to appear in the action or the project it's for.
  const matches = [...projectActions(q), ...paletteActions()]
    .filter(i => words.every(w => `${i.label} ${i.hint} ${i.words}`.toLowerCase().includes(w)));
  paletteItems = matches.slice(0, 10);
  ui.palette.sel = Math.min(ui.palette.sel, Math.max(0, paletteItems.length - 1));

  let group = '';
  const rows = paletteItems.map((it, i) => {
    const heading = it.group !== group ? `<div class="palgroup">${it.group}</div>` : '';
    group = it.group;
    const pm = it.pid ? person(proj(it.pid).pm) : null;
    return `${heading}
      <button class="palrow${i === ui.palette.sel ? ' on' : ''}" data-a="palRun" data-v="${i}" style="${pcVar(pm)}">
        <span class="dot"></span><span class="grow minw0 ell"><b>${esc(it.label)}</b> <span class="sub">${esc(it.hint)}</span></span>
        ${i === ui.palette.sel ? '<span class="kbd">Enter</span>' : ''}
      </button>`;
  }).join('');

  return `
    <div class="modal-bg palbg" data-a="palClose">
      <div class="palette" role="dialog" aria-modal="true" aria-label="Quick actions">
        <label class="palsearch">
          ${ic('search')}
          <input id="palq" data-in="palq" value="${esc(ui.palette.q)}" placeholder="Search projects or actions" aria-label="Search actions" autocomplete="off">
          <span class="kbd">Esc</span>
        </label>
        <div class="palresults">${rows || '<div class="sub empty">Nothing matches.</div>'}</div>
        <div class="row wrap palfoot sub"><span><span class="kbd">↑</span> <span class="kbd">↓</span> choose</span><span><span class="kbd">Enter</span> run</span><span><span class="kbd">Ctrl</span> <span class="kbd">K</span> open from anywhere</span></div>
      </div>
    </div>`;
}

function logMeeting() {
  const entry = S.addTime(state, 'OH', S.today(), 30, 'Meeting');
  showToast('Logged 30 min to Overhead for today', () => { state.time = state.time.filter(t => t.id !== entry.id); });
}

function copyToday() {
  const d = S.today();
  const pids = [...new Set(state.time.filter(t => t.date === d && t.pid !== 'BREAK').map(t => t.pid))];
  const text = pids.map(pid => [pidLabel(pid), roundedHours(pid, d)]).filter(([, h]) => h > 0)
    .map(([code, h]) => `${code}\t${h.toFixed(2)}`).join('\n');
  if (!text) {
    showToast('No time logged today yet.');
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied today. Paste into Adjera.');
    render();
  });
}
