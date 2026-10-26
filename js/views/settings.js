// Settings: PMs and their colours, Revit versions, timesheet, appearance, backup.

function viewSettings() {
  const set = state.settings;
  const active = state.people.filter(p => !p.archived);
  const archived = state.people.filter(p => p.archived);
  const themes = [['auto', 'Match system'], ['light', 'Light'], ['dark', 'Dark']];
  const review = state.seedInfo?.count ? `
    <details>
      <summary class="sub pointer">OneNote import: ${state.seedInfo.count} projects · items to check</summary>
      <ul class="sub reviewlist">${(state.seedInfo.needsReview || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    </details>` : '';

  return `
    <div class="pagehead">
      <div class="grow">
        <h1 class="h1">Settings</h1>
        <div class="sub">PMs and colours, Revit versions, backup · version ${esc(window.APP_VERSION || '')}</div>
      </div>
    </div>
    <div class="cols">
      <section class="card clip pmcard" aria-label="PMs">
        <div class="pad stack">
          <div class="row between"><h2 class="h2">PMs / project leads</h2><span class="sub hide-narrow">Colour shows on cards, filters and timesheet</span></div>
          <div class="row">
            <input class="inp grow" id="newpm-s" data-k="newpmS" data-in="newPm" value="${esc(ui.newPm)}" placeholder="Add a PM, e.g. Taylor" aria-label="New PM name">
            <button class="btn pri" data-a="addPm">${ic('plus', 's')}Add PM</button>
          </div>
        </div>
        <div class="list ruled">${active.map(personRow).join('')}</div>
        ${archived.length ? `
          <div class="ruled archhead"><span class="lbl">Archived · hidden from filters, kept on old projects</span></div>
          <div class="list">${archived.map(personRow).join('')}</div>` : ''}
      </section>
      <aside class="col-side">
        <section class="card pad stack" aria-label="Revit versions">
          <h2 class="h2">Revit versions</h2>
          <span class="sub">Suggested first in the Revit field. Any other version can still be typed.</span>
          <div class="row wrap tight">
            ${set.revitVersions.map(v => `<span class="vchip">${esc(v)}<button data-a="delVer" data-v="${esc(v)}" aria-label="Remove ${esc(v)}">${ic('x', 's')}</button></span>`).join('')}
          </div>
          <div class="row">
            <input class="inp grow" id="newver" data-k="newver" data-in="newVer" value="${esc(ui.newVer)}" placeholder="e.g. RVT28" aria-label="Add Revit version">
            <button class="btn" data-a="addVer">Add</button>
          </div>
        </section>
        <section class="card pad stack" aria-label="Timesheet">
          <h2 class="h2">Timesheet</h2>
          <label class="field"><span class="lbl">Adjera code for overhead (meetings, admin)</span><input class="inp" id="ohcode" data-in="ohcode" value="${esc(set.overheadCode)}" placeholder="e.g. the overhead number"></label>
          <label class="field"><span class="lbl">Hours per week</span><input class="inp num" id="cap" data-in="capacity" value="${esc(set.capacity)}" inputmode="decimal"></label>
        </section>
        <section class="card pad stack" aria-label="Appearance">
          <h2 class="h2">Appearance</h2>
          <div class="seg">${themes.map(([v, label]) => `<button data-a="theme" data-v="${v}" class="${set.theme === v ? 'on' : ''}">${label}</button>`).join('')}</div>
        </section>
        <section class="card pad stack" aria-label="Data">
          <h2 class="h2">Data</h2>
          <span class="sub">Saved only in this browser on this laptop. Back up now and then: clearing browser data erases it.</span>
          <div class="row wrap">
            <button class="btn" data-a="export">${ic('download', 's')}Back up (download file)</button>
            <label class="btn">${ic('upload', 's')}Restore or import<input type="file" accept="application/json,.json" data-in="import" class="sr"></label>
          </div>
          <span class="sub small">${set.lastBackup ? 'Last backup ' + fmtDay(set.lastBackup.slice(0, 10)) : 'Never backed up'}</span>
          ${review}
          <button class="btn ghost danger self-start" data-a="reset">Erase all data on this browser</button>
        </section>
      </aside>
    </div>`;
}

function personRow(p) {
  const id = esc(p.id);
  const name = esc(p.name);
  const open = ui.openPerson === p.id;
  const projects = Object.values(state.projects).filter(x => x.pm === p.id).length;
  const sameColour = state.people.filter(o => o.id !== p.id && !o.archived && o.color === p.color).map(o => o.name);
  const button = p.archived
    ? `<button class="btn ghost" data-a="restorePm" data-id="${id}">Restore</button>`
    : `<button class="btn ghost" data-a="openPm" data-id="${id}" aria-expanded="${open}">${ic('plan', 's')}${open ? 'Done' : 'Edit'}</button>`;
  const swatches = S.PALETTE.map(([c, label]) =>
    `<button class="sw${p.color === c ? ' on' : ''}" role="radio" aria-checked="${p.color === c}" aria-label="${label}" title="${label}" style="--pc:var(--c-${c})" data-a="pmColor" data-id="${id}" data-v="${c}"></button>`
  ).join('');
  const editor = !open ? '' : `
    <div class="stack pmedit">
      <label class="field w280"><span class="lbl">Name</span><input class="inp" id="pn-${id}" data-in="pmName" data-id="${id}" value="${name}"></label>
      <div class="stack tight">
        <span class="lbl">Colour</span>
        <div class="row wrap tight" role="radiogroup" aria-label="Colour for ${name}">${swatches}</div>
        <span class="sub small">${sameColour.length ? `Also used by ${esc(sameColour.join(', '))}.` : `Only ${name} uses this colour.`}</span>
      </div>
      <div><button class="btn" data-a="archivePm" data-id="${id}">Archive ${name}</button></div>
    </div>`;

  return `
    <div>
      <div class="row pmrow" style="${pcVar(p)}">
        <span class="dot md"></span>
        <div class="grow stack gap1"><b>${name}</b><span class="sub">${plural(projects, 'project')}</span></div>
        ${button}
      </div>
      ${editor}
    </div>`;
}
