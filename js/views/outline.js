// The task and note list on each project card and project page.
// Done tasks stay visible for the week they were checked off, then fold away.

function outlineHtml(pid) {
  const wk = curWeek();
  const all = S.itemsFor(state, pid);
  const showAll = ui.showDone[pid];
  const items = all.filter(i => !i.done || i.doneAt >= wk || showAll);
  const hidden = all.length - items.length;
  const olderDone = showAll && all.some(i => i.done && i.doneAt < wk);
  const toggle = label => `<div class="foldline"><button class="btn ghost sm" data-a="showDone" data-id="${esc(pid)}">${label}</button></div>`;

  return `
    <div class="items">
      ${pinnedNote(pid)}
      ${items.map(itemRow).join('')}
      ${addLine(pid)}
      ${hidden > 0 ? toggle(`Show ${hidden} done`) : olderDone ? toggle('Hide older done') : ''}
    </div>`;
}

// The "Add task" box. Tab / Shift+Tab (or Backspace at the start) change its indent, and the
// arrow button shows up to bring it back out. The tag and pin buttons are always there, so
// nothing shifts around when you hover.
function addLine(pid) {
  const id = esc(pid);
  const level = ui.addLevel[pid] || 0;
  const tag = ui.addTag[pid];
  const hasPin = !!proj(pid)?.leftOff || ui.pinEdit === pid;
  return `
    <div class="addline" style="padding-left:${18 + level * 22}px">
      ${level ? `<button class="addbtn-ic" data-a="addOutdent" data-id="${id}" title="Outdent (Shift+Tab)" aria-label="Outdent">${ic('outdent', 'xs')}</button>` : ''}
      ${tag ? `<button class="addbtn-ic" data-a="setAddTag" data-id="${id}" data-v="" title="Remove tag">${tagMark(tag)}</button>` : ''}
      <input id="add-${id}" data-k="add" data-id="${id}" value="${esc(ui.addDraft[pid])}" placeholder="Add task" aria-label="Add a task. Start with - for a note; Tab indents.">
      <span class="addtools">
        <button class="addbtn-ic" data-a="tagMenu" data-id="add:${id}" title="Tag the next item" aria-label="Tag the next item" aria-expanded="${ui.tagMenu === 'add:' + pid}">${ic('tag', 'xs')}</button>
        ${hasPin ? '' : `<button class="addbtn-ic" data-a="pinNote" data-id="${id}" title="Add a pinned note" aria-label="Add a pinned note">${ic('pin', 'xs')}</button>`}
      </span>
      ${ui.tagMenu === 'add:' + pid ? tagMenu('setAddTag', pid, tag) : ''}
    </div>`;
}

function itemRow(it) {
  const id = esc(it.id);
  const text = esc(it.text);
  const tag = tagOf(it);
  const stale = staleWeeks(it);
  const check = it.kind === 'task'
    ? `<input type="checkbox" class="chk" data-a="toggleItem" data-id="${id}"${it.done ? ' checked' : ''} aria-label="Done: ${text}">`
    : '<span class="notemark" aria-hidden="true">–</span>';
  const label = ui.editItem === it.id
    ? `<input class="edit" id="edit-${id}" data-k="editItem" data-id="${id}" value="${esc(ui.editDraft?.id === it.id ? ui.editDraft.value : it.text)}" aria-label="Edit item">`
    : `<span class="txt" id="txt-${id}" data-a="editItem" data-id="${id}" tabindex="0" role="button" aria-label="Edit: ${text}">${text}</span>`;

  return `
    <div class="item${it.done ? ' done' : ''}${tag === 'highlight' ? ' hl' : ''}" data-item="${id}" style="padding-left:${24 + it.level * 22}px">
      <span class="grip" draggable="true" data-drag="${id}" title="Drag to reorder (or Alt + ↑/↓)">${ic('grip', 'xs')}</span>
      ${check}
      ${tagMark(tag)}
      ${label}
      ${stale ? `<span class="tag warn stale" title="Open for ${stale} weeks. Any task left open 3 weeks or more gets this.">${stale} wk old</span>` : ''}
      <span class="acts">
        <button data-a="outdent" data-id="${id}" title="Outdent (Shift+Tab)" aria-label="Outdent">${ic('outdent', 'xs')}</button>
        <button data-a="indent" data-id="${id}" title="Indent (Tab)" aria-label="Indent">${ic('indent', 'xs')}</button>
        <button data-a="tagMenu" data-id="${id}" title="Tag" aria-label="Tag" aria-expanded="${ui.tagMenu === it.id}">${ic('tag', 'xs')}</button>
        <button data-a="kind" data-id="${id}" title="${it.kind === 'task' ? 'Make it a note' : 'Make it a task'}" aria-label="Switch task or note">${ic('list', 'xs')}</button>
        <button data-a="delItem" data-id="${id}" title="Delete" aria-label="Delete">${ic('x', 'xs')}</button>
      </span>
      ${ui.tagMenu === it.id ? tagMenu('setTag', it.id, tag) : ''}
    </div>`;
}

// A note that stays at the top of the card until you clear it: where you left off, who to call
// back, the file you were in. Only shows when there is one, or right after clicking the pin.
function pinnedNote(pid) {
  const note = proj(pid)?.leftOff;
  if (!note && ui.pinEdit !== pid) return '';
  const when = note ? (note.date === S.today() ? 'today' : fmtShort(note.date)) : '';
  return `
    <label class="pinned">
      ${ic('pin', 'xs')}
      <input id="lo-${esc(pid)}" data-in="leftOff" data-id="${esc(pid)}" value="${esc(note?.text)}" placeholder="Pinned note" aria-label="Pinned note">
      ${when ? `<span class="sub small">${when}</span>` : ''}
      ${note ? `<button class="addbtn-ic" data-a="unpin" data-id="${esc(pid)}" title="Remove pinned note" aria-label="Remove pinned note">${ic('x', 'xs')}</button>` : ''}
    </label>`;
}

// action: 'setTag' for an existing item (id = item id), 'setAddTag' for the add box (id = project).
function tagMenu(action, id, current) {
  const rows = TAGS.map(([tag, label, typed]) => `
    <button class="opt${current === tag ? ' sel' : ''}" data-a="${action}" data-id="${esc(id)}" data-v="${tag}">
      <span class="tgslot">${tag === 'highlight' ? '<span class="hlswatch"></span>' : tagMark(tag)}</span>
      <span class="grow">${label}</span><span class="kbd" title="Type this at the start of a task">${esc(typed)}</span>
    </button>`).join('');
  return `
    <div class="menu tagmenu" role="menu" aria-label="Tags">
      ${rows}
      ${current ? `<button class="opt" data-a="${action}" data-id="${esc(id)}" data-v=""><span class="tgslot"></span><span class="grow">Remove tag</span></button>` : ''}
      <div class="sub small tagtip">Or type the symbol at the start of a task.</div>
    </div>`;
}
