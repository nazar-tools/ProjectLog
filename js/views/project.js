// One project: standing notes, a dated journal, tasks, hours. The pencil opens the edit form.
// Also the New project dialog.

function viewProject(id) {
  const p = proj(id);
  if (!p) return '<div class="card empty">That project doesn’t exist any more. <a href="#/projects">Back to projects</a></div>';
  const pid = esc(p.id);
  const wk = curWeek();
  const R = S.weekRange(wk);
  const entry = S.peekWeek(state, wk).entries.find(e => e.pid === p.id);
  const on = timerOn(p.id);
  const journal = state.journal
    .filter(j => j.pid === p.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const weekButton = entry
    ? `<button class="btn hide-narrow" data-a="removeEntryHere" data-id="${pid}">Remove from week</button>`
    : `<button class="btn" data-a="addEntryHere" data-id="${pid}">${ic('plus', 's')}<span class="hide-narrow">Add to this week</span><span class="only-narrow">Week</span></button>`;

  return `
    <a class="backlink" href="#/week">${ic('back', 's')}This week</a>
    <header class="pagehead top">
      <div class="grow stack">
        <h1 class="h1">${esc(p.number)} · ${esc(p.name)}</h1>
        <div class="pmeta">
          ${p.revit ? `<span class="tag acc">${esc(p.revit)}</span>` : '<span class="tag warn">Revit not set</span>'}
          ${pmPill(p.pm)}
          ${p.status === 'archived' ? '<span class="tag">Archived</span>' : ''}
          ${entry ? `<span class="tag good">On this week${entry.hours ? ` · ${esc(entry.hours)} h` : ''}</span>` : ''}
        </div>
      </div>
      <div class="row">
        <button class="iconbtn${on ? ' on' : ''}" data-a="timer" data-id="${pid}" aria-label="${on ? 'Stop' : 'Start'} timer">${ic(on ? 'stop' : 'play', 's')}</button>
        ${weekButton}
        <button class="btn" data-a="editProject" data-id="${pid}" aria-label="Edit project">${ic('plan', 's')}<span class="hide-narrow">Edit project</span></button>
      </div>
    </header>
    ${ui.edit === p.id && ui.draft ? editFormHtml(p) : ''}
    <div class="cols">
      <div class="col-main">
        <section class="card pad stack">
          <div class="row between">
            <h2 class="h2">Project notes</h2>
            <span class="sub hide-narrow">Always true for this project · saves as you type</span>
          </div>
          <textarea class="inp" id="notes-${pid}" data-in="notes" data-id="${pid}" rows="6" placeholder="Service, equipment, who to ask, where things live…">${esc(p.notes)}</textarea>
        </section>
        <section class="stack">
          <div class="row between"><h2 class="h2">Journal</h2><span class="sub">Dated notes, newest first</span></div>
          <div class="card clip list">
            <div class="row journaladd">
              <input class="inp grow" id="jn-${pid}" data-k="journal" data-id="${pid}" placeholder="Add a note for today… (Enter)" aria-label="New journal note">
              <button class="btn" data-a="addJournal" data-id="${pid}">Add</button>
            </div>
            ${journal.map(j => `
              <div class="jrow">
                <span class="d sub">${fmtDay(j.date)}</span>
                <span class="grow pre">${esc(j.text)}</span>
                <button class="iconbtn plain sm" data-a="delJournal" data-id="${esc(j.id)}" aria-label="Delete note">${ic('x', 's')}</button>
              </div>`).join('')}
          </div>
        </section>
      </div>
      <aside class="col-side">
        <div class="card clip"><div class="pad cardhead"><b>Tasks and notes</b></div>${outlineHtml(p.id)}</div>
        ${projectHoursCard(p, entry, R)}
      </aside>
    </div>`;
}

function projectHoursCard(p, entry, R) {
  const week = (S.minutesFor(state, p.id, R.startIso, R.endIso) + liveMinutes(p.id)) / 60;
  const allTime = (S.minutesFor(state, p.id, '0000-00-00', '9999-12-31') + liveMinutes(p.id)) / 60;
  const weeks = Object.keys(state.weeks).filter(k => S.inWeek(state, k, p.id)).length;
  const planned = entry ? parseFloat(entry.hours) || 0 : 0;
  const line = (label, value) => `<div class="row sub between"><span>${label}</span><span class="num">${value}</span></div>`;
  return `
    <div class="card pad stack">
      <span class="lbl">This week</span>
      <span class="num bignum">${fmtH(week)} <span class="sub">${planned ? `/ ${fmtH(planned)} h` : 'h'}</span></span>
      ${planned ? `<div class="meter"><i style="width:${pct(week, planned)}%"></i></div>` : ''}
      ${line('All time logged', fmtH(allTime) + ' h')}
      ${line('Weeks on your list', weeks)}
      ${p.firstSeen ? line('In OneNote', `${fmtMonth(p.firstSeen)} – ${fmtMonth(p.lastSeen)}`) : ''}
    </div>`;
}

function editFormHtml(p) {
  const d = ui.draft;
  const current = person(d.pm);
  const people = state.people.filter(x => !x.archived || x.id === d.pm);
  const menu = !ui.pmMenu ? '' : `
    <div class="menu" role="listbox" aria-label="Choose PM">
      ${people.map(x => `<button class="opt${x.id === d.pm ? ' sel' : ''}" role="option" aria-selected="${x.id === d.pm}" data-a="pickPm" data-v="${esc(x.id)}" style="${pcVar(x)}"><span class="dot"></span>${esc(x.name)}</button>`).join('')}
      <button class="opt" data-a="pickPm" data-v=""><span class="dot nopm"></span>No PM</button>
      <div class="row menufoot">
        <input class="inp" id="newpm" data-k="newpm" placeholder="+ New PM name, Enter" aria-label="New PM name">
        <a class="btn sm" href="#/settings">Colours…</a>
      </div>
    </div>`;

  return `
    <section class="card pad stack editform" aria-label="Edit project">
      <div class="row between"><h2 class="h2">Edit project</h2><span class="sub hide-narrow">Changes show on every card and week</span></div>
      <div class="row wrap fields">
        <label class="field w150"><span class="lbl">Number (= Adjera code)</span><input class="inp num" id="ed-number" data-in="draft" data-v="number" value="${esc(d.number)}"></label>
        <label class="field wfill"><span class="lbl">Name</span><input class="inp" id="ed-name" data-in="draft" data-v="name" value="${esc(d.name)}"></label>
      </div>
      <div class="row wrap fields">
        <label class="field w200">
          <span class="lbl">Revit version</span>
          <input class="inp" id="ed-revit" list="rvt-list-ed" data-in="draft" data-v="revit" value="${esc(d.revit)}" placeholder="Type or pick, e.g. RVT27">
          ${revitDatalist('rvt-list-ed')}
          <span class="sub small">Pick from the list or type any version</span>
        </label>
        <div class="field menuwrap wfill">
          <span class="lbl">PM / lead</span>
          <button class="inp row pmpick" type="button" data-a="pmMenu" aria-haspopup="listbox" aria-expanded="${ui.pmMenu}" style="${pcVar(current)}">
            <span class="dot"></span><span class="grow">${current ? esc(current.name) : 'No PM'}</span>${ic('chevD', 's')}
          </button>
          ${menu}
        </div>
        <div class="field w220">
          <span class="lbl">Status</span>
          <div class="seg">
            <button data-a="draftStatus" data-v="active" class="${d.status !== 'archived' ? 'on' : ''}">Active</button>
            <button data-a="draftStatus" data-v="archived" class="${d.status === 'archived' ? 'on' : ''}">Archived</button>
          </div>
        </div>
      </div>
      ${ui.draftError ? `<div class="tag warn self-start">${esc(ui.draftError)}</div>` : ''}
      <div class="row between">
        <button class="btn ghost danger" data-a="deleteProject" data-id="${esc(p.id)}">Delete project</button>
        <div class="row">
          <button class="btn" data-a="cancelEdit">Cancel</button>
          <button class="btn pri" data-a="saveEdit" data-id="${esc(p.id)}">Save</button>
        </div>
      </div>
    </section>`;
}

function newProjectModal() {
  const { draft: d, error } = ui.modal;
  const people = state.people.filter(p => !p.archived);
  return `
    <div class="modal-bg" data-a="modalBg">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="np-h">
        <h2 class="h2" id="np-h">New project</h2>
        <div class="row wrap fields">
          <label class="field w140"><span class="lbl">Number</span><input class="inp num" id="np-number" data-in="np" data-v="number" value="${esc(d.number)}"></label>
          <label class="field wfill"><span class="lbl">Name</span><input class="inp" id="np-name" data-in="np" data-v="name" value="${esc(d.name)}"></label>
        </div>
        <div class="row wrap fields">
          <label class="field w180">
            <span class="lbl">Revit version</span>
            <input class="inp" id="np-revit" list="np-rvt" data-in="np" data-v="revit" value="${esc(d.revit)}" placeholder="e.g. RVT26">
            ${revitDatalist('np-rvt')}
          </label>
          <label class="field wfill">
            <span class="lbl">PM</span>
            <select class="inp" id="np-pm" data-in="np" data-v="pm">
              <option value="">No PM</option>
              ${people.map(p => `<option value="${esc(p.id)}"${d.pm === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="row"><input type="checkbox" class="chk" id="np-week" data-in="np" data-v="week"${d.week ? ' checked' : ''}>Add to the week being planned</label>
        ${error ? `<span class="tag warn self-start">${esc(error)}</span>` : ''}
        <div class="row end">
          <button class="btn" data-a="closeModal">Cancel</button>
          <button class="btn pri" data-a="createProject">Create</button>
        </div>
      </div>
    </div>`;
}
