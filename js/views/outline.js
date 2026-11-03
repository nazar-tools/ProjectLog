// The task and note list on each project card and project page.
// Finished tasks stay visible for the week they were checked off, then fold away.

function outlineHtml(pid) {
  const wk = curWeek();
  const all = S.itemsFor(state, pid);
  const showAll = ui.showDone[pid];
  const items = all.filter(i => !i.done || i.doneAt >= wk || showAll);
  const hidden = all.length - items.length;
  const olderDone = showAll && all.some(i => i.done && i.doneAt < wk);
  const level = ui.addLevel[pid] || 0;
  const toggle = label => `<div class="foldline"><button class="btn ghost sm" data-a="showDone" data-id="${esc(pid)}">${label}</button></div>`;

  return `
    <div class="items">
      ${leftOffLine(pid)}
      ${items.map(itemRow).join('')}
      <div class="addline" style="padding-left:${18 + level * 22}px">
        ${tagMark(ui.addTag[pid])}
        <input id="add-${esc(pid)}" data-k="add" data-id="${esc(pid)}" placeholder="Add task…  – note · ! critical · Tab indents" aria-label="Add a task or note. Ctrl+3, 5, 8 or 9 tags it.">
        ${level ? `<span class="lvl">level ${level}</span>` : ''}
      </div>
      ${hidden > 0 ? toggle(`Show ${hidden} finished`) : olderDone ? toggle('Hide older finished') : ''}
    </div>`;
}

function itemRow(it) {
  const id = esc(it.id);
  const text = esc(it.text);
  const check = it.kind === 'task'
    ? `<input type="checkbox" class="chk" data-a="toggleItem" data-id="${id}"${it.done ? ' checked' : ''} aria-label="Done: ${text}">`
    : '<span class="notemark" aria-hidden="true">–</span>';
  const label = ui.editItem === it.id
    ? `<input class="edit" id="edit-${id}" data-k="editItem" data-id="${id}" value="${text}" aria-label="Edit item">`
    : `<span class="txt" id="txt-${id}" data-a="editItem" data-id="${id}" tabindex="0" role="button" aria-label="Edit: ${text}">${text}</span>`;

  return `
    <div class="item${it.done ? ' done' : ''}${it.tag === 'remember' ? ' hl' : ''}" data-item="${id}" style="padding-left:${24 + it.level * 22}px">
      <span class="grip" draggable="true" data-drag="${id}" title="Drag to reorder (or Alt + ↑/↓)">${ic('grip', 'xs')}</span>
      ${check}
      ${tagMark(it.tag)}
      ${label}
      ${staleWeeks(it) ? `<span class="tag warn stale" title="Open for ${staleWeeks(it)} weeks">${staleWeeks(it)} wk</span>` : ''}
      <span class="acts">
        <button data-a="outdent" data-id="${id}" title="Outdent" aria-label="Outdent">${ic('outdent', 'xs')}</button>
        <button data-a="indent" data-id="${id}" title="Indent" aria-label="Indent">${ic('indent', 'xs')}</button>
        <button data-a="tagMenu" data-id="${id}" title="Tag (Ctrl+3, 5, 7, 8, 9)" aria-label="Tag" aria-expanded="${ui.tagMenu === it.id}">${ic('tag', 'xs')}</button>
        <button data-a="kind" data-id="${id}" title="${it.kind === 'task' ? 'Make it a note' : 'Make it a task'} (Ctrl+1)" aria-label="Switch task or note">${ic('list', 'xs')}</button>
        <button data-a="delItem" data-id="${id}" title="Delete" aria-label="Delete">${ic('x', 'xs')}</button>
      </span>
      ${ui.tagMenu === it.id ? tagMenu(it) : ''}
    </div>`;
}

// One line for "where I left off", saved as you type and dated, so tomorrow starts here.
// Empty, it only shows while you hover or work in the card.
function leftOffLine(pid) {
  const lo = proj(pid)?.leftOff;
  const when = lo ? (lo.date === S.today() ? 'today' : WD[S.parseISO(lo.date).getDay()]) : '';
  return `
    <label class="leftoff${lo ? '' : ' empty'}">
      ${ic('bookmark', 'xs')}
      <input id="lo-${esc(pid)}" data-in="leftOff" data-id="${esc(pid)}" value="${esc(lo?.text)}" placeholder="Where I left off… (shows here next time)" aria-label="Where I left off">
      ${when ? `<span class="sub small">${when}</span>` : ''}
    </label>`;
}

function tagMenu(it) {
  const rows = TAGS.map(([tag, label, key]) => `
    <button class="opt${it.tag === tag ? ' sel' : ''}" data-a="setTag" data-id="${esc(it.id)}" data-v="${tag}">
      <span class="tgslot">${tag === 'remember' ? '<span class="hlswatch"></span>' : tagMark(tag)}</span>
      <span class="grow">${label}</span>${key ? `<span class="kbd">Ctrl ${key}</span>` : ''}
    </button>`).join('');
  return `
    <div class="menu tagmenu" role="menu" aria-label="Tags">
      ${rows}
      <button class="opt" data-a="setTag" data-id="${esc(it.id)}" data-v=""><span class="tgslot"></span><span class="grow">Remove tag</span><span class="kbd">Ctrl 0</span></button>
    </div>`;
}
