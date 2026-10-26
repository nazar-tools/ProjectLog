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
      ${items.map(itemRow).join('')}
      <div class="addline" style="padding-left:${18 + level * 22}px">
        <input id="add-${esc(pid)}" data-k="add" data-id="${esc(pid)}" placeholder="Add task…  – for a note · Tab indents" aria-label="Add a task or note">
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
    <div class="item${it.done ? ' done' : ''}" data-item="${id}" style="padding-left:${24 + it.level * 22}px">
      <span class="grip" draggable="true" data-drag="${id}" title="Drag to reorder (or Alt + ↑/↓)">${ic('grip', 'xs')}</span>
      ${check}
      ${label}
      <span class="acts">
        <button data-a="outdent" data-id="${id}" title="Outdent" aria-label="Outdent">${ic('outdent', 'xs')}</button>
        <button data-a="indent" data-id="${id}" title="Indent" aria-label="Indent">${ic('indent', 'xs')}</button>
        <button data-a="kind" data-id="${id}" title="${it.kind === 'task' ? 'Make it a note' : 'Make it a task'}" aria-label="Switch task or note">${ic('list', 'xs')}</button>
        <button data-a="delItem" data-id="${id}" title="Delete" aria-label="Delete">${ic('x', 'xs')}</button>
      </span>
    </div>`;
}
