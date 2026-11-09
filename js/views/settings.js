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
          <div class="row between"><h2 class="h2">PMs / project leads</h2></div>
          <div class="row">
            <input class="inp grow" id="newpm-s" data-k="newpmS" data-in="newPm" value="${esc(ui.newPm)}" placeholder="New PM name" aria-label="New PM name">
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
          <span class="sub">Shown first in the Revit field.</span>
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
          <label class="field"><span class="lbl">Adjera code for overhead (meetings, admin)</span><input class="inp" id="ohcode" data-in="ohcode" value="${esc(set.overheadCode)}" placeholder="Overhead code"></label>
          <label class="field"><span class="lbl">Hours per week</span><input class="inp num" id="cap" data-in="capacity" value="${esc(set.capacity)}" inputmode="decimal"></label>
        </section>
        <section class="card pad stack" aria-label="Timer guard">
          <h2 class="h2">Timer guard</h2>
          <span class="sub">Catches forgotten timers and laptop sleep.</span>
          <div class="row wrap tight">
            <label class="field w140"><span class="lbl">My day ends at</span><input type="time" class="inp" id="dayend" data-in="dayEnd" value="${esc(set.dayEnd)}"></label>
            <label class="field w140"><span class="lbl">Long timer after (h)</span><input class="inp num" id="longtimer" data-in="longTimer" value="${esc(set.longTimerHours)}" inputmode="decimal"></label>
          </div>
          <div class="row wrap tight">
            <label class="field w140"><span class="lbl">Usual lunch from</span><input type="time" class="inp" id="lunchfrom" data-in="lunchFrom" value="${esc(set.lunchFrom)}"></label>
            <label class="field w140"><span class="lbl">to</span><input type="time" class="inp" id="lunchto" data-in="lunchTo" value="${esc(set.lunchTo)}"></label>
          </div>
          <span class="sub small">Adds a one-click Break on the timeline. Breaks don’t count toward your hours.</span>
        </section>
        <section class="card pad stack" aria-label="Appearance">
          <h2 class="h2">Appearance</h2>
          <div class="seg">${themes.map(([v, label]) => `<button data-a="theme" data-v="${v}" class="${set.theme === v ? 'on' : ''}">${label}</button>`).join('')}</div>
        </section>
        <section class="card pad stack" aria-label="Data">
          <h2 class="h2">Data</h2>
          <span class="sub">Stored in this browser only. Clearing browser data erases it, so back up regularly.</span>
          <div class="row wrap">
            <button class="btn" data-a="export">${ic('download', 's')}Back up (download file)</button>
            <label class="btn">${ic('upload', 's')}Restore or import<input type="file" accept="application/json,.json" data-in="import" class="sr"></label>
          </div>
          <span class="sub small">${set.lastBackup ? 'Last backup ' + fmtDay(set.lastBackup.slice(0, 10)) : 'Never backed up'}</span>
          ${autoBackupSetting()}
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
      <div class="row wrap tight">
        <label class="field w220"><span class="lbl">Name</span><input class="inp" id="pn-${id}" data-in="pmName" data-id="${id}" value="${name}"></label>
        <label class="field wfill"><span class="lbl">Email (for PM updates)</span><input class="inp" type="email" id="pe-${id}" data-in="pmEmail" data-id="${id}" value="${esc(p.email)}" placeholder="name@windsorengineers.com"></label>
      </div>
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

function autoBackupSetting() {
  const st = AutoBackup.status;
  if (st === 'unsupported') return '<span class="sub small">Automatic backup to a folder needs Edge or Chrome.</span>';
  const last = state.settings.lastAutoBackup;
  let body;
  if (st === 'off') {
    body = `<span class="sub">Saves a backup to a folder of your choice (OneDrive works well) every Friday.</span>
      <button class="btn self-start" data-a="autoChoose">${ic('folderUp', 's')}Choose folder</button>`;
  } else {
    body = `
      <span class="sub">Saving to <b>${esc(AutoBackup.folderName)}</b> every Friday.${last ? ` Last one ${fmtDay(last)}.` : ''}</span>
      ${st === 'needs-click' ? '<span class="sub warnline">Edge needs your permission again to save there.</span>' : ''}
      <div class="row wrap tight">
        ${st === 'needs-click' ? `<button class="btn pri" data-a="autoNow">Allow and back up</button>` : `<button class="btn" data-a="autoNow">Back up there now</button>`}
        <button class="btn ghost" data-a="autoChoose">Change folder</button>
        <button class="btn ghost danger" data-a="autoOff">Turn off</button>
      </div>`;
  }
  return `<div class="stack tight autobackup"><span class="lbl">Automatic weekly backup</span>${body}</div>`;
}
