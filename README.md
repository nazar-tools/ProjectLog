# Project Log

Weekly project planning, notes and time tracking for one person on one laptop. It's a static web app (PWA): plain HTML, CSS and JavaScript with no build step and no server. It uses the same design language as Fit Log.

## Files

```
index.html               app entry; loads the scripts below in order
css/styles.css           all styles; colours are defined once at the top (light and dark)
js/version.js            version number; bump it when you upload changes
js/seed.js               empty on purpose (see "Your project list")
js/store.js              data, saving, weeks, timers, task ordering
js/core.js               shared state and small helpers (formatting, icons, PM pills)
js/views/outline.js      task and note list on cards and project pages
js/views/week.js         This week, including past weeks
js/views/plan.js         Plan week
js/views/projects.js     Projects list
js/views/project.js      one project, its edit form, and the New project dialog
js/views/time.js         Timesheet and Copy for Adjera
js/views/settings.js     Settings
js/actions.js            what each button does (data-a="name" runs actions.name)
js/app.js                routing, page frame, keyboard and drag events, startup
sw.js                    service worker (offline + updates)
tests.html               open it in the browser to check the data logic after edits
manifest.webmanifest     lets Edge/Chrome install it as an app
icons/                   app icons
```

To change how a screen looks, edit its file in `js/views/`. Each one is HTML written as
template strings, one element per line, so it reads close to the page it draws.

## Put it on GitHub Pages

1. On github.com, click **New repository**. Name it `project-log` and leave it **Public**, because free GitHub Pages needs a public repo. Click **Create repository**.
2. On the empty repo page, click **uploading an existing file**. Drag in the **contents** of this folder (`index.html`, `css`, `js`, `icons`, `manifest.webmanifest`, `sw.js`, `tests.html`, `README.md`) so that `index.html` sits at the top level of the repo. Click **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, set Source to **Deploy from a branch**, Branch to **main** and folder to **/ (root)**, then click **Save**.
4. After a minute or two the page shows your link: `https://<your-username>.github.io/project-log/`.

## Install it and use it as a side panel

- Open the link in Edge. Click the **App available / Install** icon in the address bar, or go to **⋯ → Apps → Install this site as an app**.
- It opens in its own window. Snap that window to the narrowest width next to Revit or Bluebeam, and the narrow layout takes over automatically. Maximise it on planning day for the wide layout.

## Your project list (one-time import)

The 117 projects from your OneNote *Weekly Planning* section are in **`project-log-seed.json`**, which is delivered separately and **not** in this folder. That keeps client names out of the public repo.

On first launch, click **Import project list** and pick that file. You can also do it later from Settings → *Restore or import*. Importing again never overwrites edits you have made.

## Your data

- Everything is saved in this browser's storage on this laptop. Nothing is sent anywhere.
- Edge and Chrome keep separate copies, so use one browser. Within that browser, the installed app and a normal tab stay in sync with each other.
- If saving ever fails (storage full or blocked), a yellow banner says so at the top of every page. Click Back up now right away.
- Clearing browser data or site data erases it. Use **Back up now** (sidebar or Settings) every week or so, and keep the file in a OneDrive folder. **Restore** in Settings brings it back on any machine.
- Each week is frozen when it ends, so looking back at it later shows the tasks as they were, even if you've since edited or deleted them.

## Updating the app later

1. Upload the changed files to the repo; uploading over a file with the same name replaces it.
2. Edit `js/version.js` on GitHub and bump the number (for example `1.4.1`). That one line is what tells the installed app to update.
3. Reopen the app. It picks up the update and reloads itself once, within a few seconds.
4. If you changed `js/store.js`, open `https://<your-username>.github.io/<repo>/tests.html` and check every line is green.
