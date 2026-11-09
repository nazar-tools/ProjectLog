// Projects › Hours and health: logged hours against each project's budget, tasks that keep
// getting carried over, and which Revit versions your active projects are on.

function viewHealth() {
  const all = Object.values(state.projects);
  const cw = curWeek();
  const recent = S.iso(S.addDays(new Date(), -30));
  const onWeek = new Set(S.peekWeek(state, cw).entries.map(e => e.pid));
  const logged = pid => S.minutesFor(state, pid, '0000-00-00', '9999-12-31') / 60;
  const shown = all
    .filter(p => p.status !== 'archived' && (p.budget || onWeek.has(p.id) || state.time.some(t => t.pid === p.id && t.date >= recent)))
    .map(p => ({ p, budget: parseFloat(p.budget) || 0, used: logged(p.id) }))
    .sort((a, b) => (b.budget ? b.used / b.budget : -1) - (a.budget ? a.used / a.budget : -1));

  const rows = shown.map(({ p, budget, used }) => {
    const pm = person(p.pm);
    const share = budget ? used / budget : 0;
    const level = share >= 0.9 ? 'crit' : share >= 0.75 ? 'warn' : '';
    let note;
    if (!budget) note = `<button class="btn sm" data-a="editProject" data-id="${esc(p.id)}" data-v="budget">Add budget</button>`;
    else if (share >= 1) note = `<span class="tag crit">Over budget${pm ? ' · tell ' + esc(pm.name) : ''}</span>`;
    else if (share >= 0.9) note = `<span class="tag crit">${Math.round(share * 100)}%${pm ? ' · tell ' + esc(pm.name) : ''}</span>`;
    else if (share >= 0.75) note = `<span class="tag warn">${Math.round(share * 100)}% used</span>`;
    else note = '<span class="tag good">On track</span>';
    return `
      <div class="hrow">
        <a class="row tight minw0 plainlink" href="${projectHref(p.id)}" style="${pcVar(pm)}"><span class="dot"></span><b class="num">${esc(p.number)}</b><span class="sub ell">${esc(p.name)}</span></a>
        <span class="num right">${budget ? fmtH(budget) + ' h' : '—'}</span>
        <span class="num right">${fmtH(used)} h</span>
        <div class="meter thick ${level}" role="img" aria-label="${budget ? Math.round(share * 100) + '% used' : 'No budget set'}">${budget ? `<i style="width:${Math.min(100, share * 100)}%"></i>` : ''}</div>
        <span class="num right">${budget ? fmtH(Math.max(0, budget - used)) + ' h' : '—'}</span>
        <span>${note}</span>
      </div>`;
  }).join('');

  return `
    <a class="backlink" href="#/projects">${ic('back', 's')}Projects</a>
    <div class="pagehead">
      <div class="grow stack gap1">
        <h1 class="h1">Hours and health</h1>
        <span class="sub">Set a budget with the pencil on each project. Logged includes all timesheet hours.</span>
      </div>
    </div>
    <section class="card clip scrollx" aria-label="Hours budget">
      <div class="htable">
        <div class="hrow hd"><span>Project</span><span class="right">Budget</span><span class="right">Logged</span><span>Used</span><span class="right">Left</span><span>Heads-up</span></div>
        ${rows || '<div class="empty">No active projects yet.</div>'}
      </div>
    </section>
    <div class="cols">
      <section class="col-main">${staleCard()}</section>
      <aside class="col-side">${revitCard(all)}</aside>
    </div>`;
}

function staleCard() {
  const stale = state.items
    .filter(i => staleWeeks(i) && proj(i.pid) && proj(i.pid).status !== 'archived')
    .sort((a, b) => (a.created < b.created ? -1 : 1));
  const rows = stale.map(i => `
    <div class="taskrow">
      <span class="tag warn">${staleWeeks(i)} wk</span>
      <a class="num bold plainlink" href="${projectHref(i.pid)}">${esc(proj(i.pid).number)}</a>
      <span class="grow minw0">${esc(i.text)}</span>
      <button class="btn sm" data-a="toggleItem" data-id="${esc(i.id)}">Done</button>
      <button class="btn sm" data-a="delItem" data-id="${esc(i.id)}">Drop</button>
    </div>`).join('');
  return `
    <div class="card clip">
      <div class="pad stack gap1">
        <h2 class="h2">Carried over 3+ weeks</h2>
        <span class="sub">Tasks left open for 3 weeks or more.</span>
      </div>
      <div class="list ruled">${rows || '<div class="empty sub">Nothing older than three weeks. Nice.</div>'}</div>
    </div>`;
}

// Active projects (as on the Projects page) grouped by Revit version, newest first. Anything
// more than two versions behind the newest gets flagged for the next upgrade round.
function revitCard(all) {
  const year = String(new Date().getFullYear());
  const active = all.filter(p => p.status !== 'archived' && lastSort(p) >= year);
  const groups = {};
  for (const p of active) (groups[p.revit || 'Not set'] ||= []).push(p);
  const ver = v => parseInt((v.match(/\d+/) || ['0'])[0], 10);
  const newest = Math.max(0, ...Object.keys(groups).map(ver));
  const names = Object.keys(groups).sort((a, b) => ver(b) - ver(a));
  const rows = names.map(v => {
    const old = ver(v) && ver(v) < newest - 2;
    const open = ui.healthOpen === v;
    const list = !open ? '' : `<div class="verlist">${groups[v].map(p => `<a class="plainlink" href="${projectHref(p.id)}"><b class="num">${esc(p.number)}</b> <span class="sub">${esc(p.name)}</span></a>`).join('')}</div>`;
    return `
      <div>
        <button class="verrow" data-a="healthVer" data-v="${esc(v)}" aria-expanded="${open}">
          <b class="${old ? 'warnline' : ''}">${esc(v)}</b><span class="sub num">${plural(groups[v].length, 'project')}</span>${ic(open ? 'chevD' : 'chevR', 's')}
        </button>
        ${list}
      </div>`;
  }).join('');
  return `
    <div class="card pad stack">
      <h2 class="h2">Revit versions</h2>
      <span class="sub">Active projects by version. Click one to list them.</span>
      <div class="list">${rows}</div>
    </div>`;
}
