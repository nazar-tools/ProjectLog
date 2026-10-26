// Projects: every project you've had, searchable, with Revit versions editable right in the list.

const PROJECT_LIMIT = 40;

function viewProjects() {
  const all = Object.values(state.projects);
  const flags = state.seedInfo?.flags || {};
  const year = String(new Date().getFullYear());
  const views = [
    ['recent', 'Active in ' + year, p => p.status !== 'archived' && lastSort(p) >= year],
    ['all', 'All', () => true],
    ['norvt', 'No Revit', p => !p.revit],
    ['check', 'Check', p => !!flags[p.number]],
    ['arch', 'Archived', p => p.status === 'archived']
  ];
  const inCurrentView = (views.find(v => v[0] === ui.projView) || views[0])[2];
  const q = ui.projQ.trim().toLowerCase();
  const matching = all.filter(p => !q || `${p.number} ${p.name} ${person(p.pm)?.name || ''}`.toLowerCase().includes(q));
  const inView = matching.filter(inCurrentView);
  const list = inView.filter(p => ui.projPm === 'all' || p.pm === ui.projPm);
  if (ui.projSort === 'num') list.sort((a, b) => parseFloat(b.number) - parseFloat(a.number));
  else list.sort((a, b) => lastSort(b).localeCompare(lastSort(a)) || parseFloat(b.number) - parseFloat(a.number));
  const shown = ui.projAll ? list : list.slice(0, PROJECT_LIMIT);
  const noRevit = all.filter(p => !p.revit).length;

  const viewChips = views.map(([v, label, test]) =>
    `<button class="chip${ui.projView === v ? ' on' : ''}" data-a="projView" data-v="${v}">${label}<span class="n">${matching.filter(test).length}</span></button>`
  ).join('');
  const pmChips = state.people.map(pm => {
    const n = inView.filter(p => p.pm === pm.id).length;
    if (!n) return '';
    return `<button class="chip${ui.projPm === pm.id ? ' on' : ''}" data-a="projPm" data-v="${esc(pm.id)}" style="${pcVar(pm)}"><span class="dot"></span>${esc(pm.name)}<span class="n">${n}</span></button>`;
  }).join('');
  const sortSeg = [['last', 'Recent first'], ['num', 'Number ↓']].map(([v, label]) =>
    `<button data-a="projSort" data-v="${v}" class="${ui.projSort === v ? 'on' : ''}">${label}</button>`
  ).join('');

  return `
    <div class="stickyhead">
      <div class="pagehead">
        <div class="grow">
          <h1 class="h1">Projects</h1>
          <div class="sub">${all.length} projects · ${noRevit} without a Revit version</div>
        </div>
        <a class="iconbtn only-narrow" href="#/settings" aria-label="Settings">${ic('sliders', 's')}</a>
        <button class="btn pri hide-narrow" data-a="newProject">${ic('plus', 's')}New project</button>
        <button class="iconbtn pri only-narrow" data-a="newProject" aria-label="New project">${ic('plus', 's')}</button>
      </div>
      <div class="toolbar">
        <label class="search grow projsearch">
          ${ic('search', 's')}
          <input id="projq" data-in="projq" value="${esc(ui.projQ)}" placeholder="Search number, name or PM…" aria-label="Search projects" autocomplete="off">
        </label>
        <div class="seg hide-narrow">${sortSeg}</div>
      </div>
      <div class="chips">${viewChips}</div>
      <div class="chips hide-narrow">
        <span class="sub chiplabel">PM</span>
        <button class="chip${ui.projPm === 'all' ? ' on' : ''}" data-a="projPm" data-v="all">All<span class="n">${inView.length}</span></button>
        ${pmChips}
      </div>
    </div>
    ${revitDatalist('rvt-list')}
    <div class="card clip scrollx">
      <div class="gtable">
        <div class="grow-r hd"><span>Number</span><span>Name</span><span>Revit</span><span class="c-pm">PM</span><span class="c-last right">Last on list</span></div>
        ${shown.length ? shown.map(p => projectRow(p, flags)).join('') : '<div class="empty">No projects match.</div>'}
        ${!ui.projAll && list.length > PROJECT_LIMIT ? `
          <div class="row between tablefoot">
            <span class="sub">Showing ${PROJECT_LIMIT} of ${list.length}</span>
            <button class="btn sm" data-a="projAll">Show all</button>
          </div>` : ''}
      </div>
    </div>
    ${state.seedInfo?.count ? `
      <div class="note">
        ${ic('info', 's')}
        <span>${state.seedInfo.count} projects were imported once from OneNote (${esc(state.seedInfo.source)}). Only number, name, Revit version and PM came over. Rows marked Check may be duplicates or typos; hover for why.</span>
      </div>` : ''}`;
}

function projectRow(p, flags) {
  const pm = person(p.pm);
  const href = projectHref(p.id);
  const flag = flags[p.number] ? ` <span class="tag warn" title="${esc(flags[p.number])}">Check</span>` : '';
  return `
    <div class="grow-r">
      <a class="num plainlink bold" href="${href}">${esc(p.number)}</a>
      <a class="ell plainlink" href="${href}">${esc(p.name)}${flag}<span class="only-narrow sub block">${pm ? esc(pm.name) : 'No PM'} · ${esc(lastLabel(p))}</span></a>
      <input class="rvt${p.revit ? ' set' : ''}" list="rvt-list" id="r-${esc(p.id)}" data-in="rvt" data-id="${esc(p.id)}" value="${esc(p.revit)}" placeholder="+ RVT" aria-label="Revit version for ${esc(p.number)}">
      <span class="c-pm row pmcell" style="${pcVar(pm)}"><span class="dot"></span>${pm ? esc(pm.name) : '—'}</span>
      <span class="c-last sub num right">${esc(lastLabel(p))}</span>
    </div>`;
}
