// Weekly automatic backup into a folder you pick once, such as a OneDrive folder. Uses the
// browser's folder access (Edge and Chrome). The folder is remembered in IndexedDB, since
// localStorage can only hold text. After a restart the browser may want one click to allow
// writing again; the app shows a button for that when a backup is due.

const AutoBackup = (() => {
  const DB = 'projectlog-files';
  const STORE = 'handles';
  const KEY = 'backupFolder';
  let folder = null;
  // 'unsupported' | 'off' | 'ready' | 'needs-click'
  let status = window.showDirectoryPicker ? 'off' : 'unsupported';

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  async function load() {
    if (status === 'unsupported') return;
    folder = await idb('readonly', s => s.get(KEY));
    if (!folder) return;
    status = (await folder.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'ready' : 'needs-click';
  }

  async function choose() {
    folder = await window.showDirectoryPicker({ id: 'projectlog-backup', mode: 'readwrite' });
    await idb('readwrite', s => s.put(folder, KEY));
    status = 'ready';
  }

  async function forget() {
    await idb('readwrite', s => s.delete(KEY));
    folder = null;
    status = 'off';
  }

  // Needs a click (a user gesture) when the browser has dropped the permission.
  async function allow() {
    status = (await folder.requestPermission({ mode: 'readwrite' })) === 'granted' ? 'ready' : 'needs-click';
    return status === 'ready';
  }

  async function write(name, text) {
    const file = await folder.getFileHandle(name, { create: true });
    const out = await file.createWritable();
    await out.write(text);
    await out.close();
  }

  return {
    load, choose, forget, allow, write,
    get status() { return status; },
    get folderName() { return folder?.name || ''; }
  };
})();

// Due once a week: on a Friday you haven't backed up yet, or seven days after the last one.
function autoBackupDue() {
  const last = state.settings.lastAutoBackup;
  if (!last) return true;
  const today = S.today();
  return daysBetween(last, today) >= 7 || (new Date().getDay() === 5 && last < today);
}

async function runAutoBackup() {
  if (AutoBackup.status !== 'ready' || !autoBackupDue()) return;
  const today = S.today();
  try {
    await AutoBackup.write(`project-log-backup-${today}.json`, JSON.stringify(state, null, 1));
    state.settings.lastAutoBackup = today;
    state.settings.lastBackup = new Date().toISOString();
    S.saveNow(state);
  } catch (err) {
    showToast(`Automatic backup failed: ${err.message}`);
  }
  render();
}
