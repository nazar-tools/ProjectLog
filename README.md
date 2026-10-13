# Project Log

Weekly project planning, notes and time tracking for one person on one laptop. It's a static web app (PWA): plain HTML, CSS and JavaScript with no build step and no server. It uses the same design language as Fit Log.

## Files

```
index.html             app entry
css/styles.css         all styles (light + dark, wide + narrow layouts)
js/store.js            data model + localStorage persistence
js/app.js              screens and interactions
js/seed.js             empty on purpose (see "Your project list")
sw.js                  service worker (offline + updates)
manifest.webmanifest   lets Edge/Chrome install it as an app
icons/                 app icons
```

## Put it on GitHub Pages

1. On github.com, click **New repository**. Name it `project-log` and leave it **Public**, because free GitHub Pages needs a public repo. Click **Create repository**.
2. On the empty repo page, click **uploading an existing file**. Drag in the **contents** of this folder (`index.html`, `css`, `js`, `icons`, `manifest.webmanifest`, `sw.js`, `README.md`) so that `index.html` sits at the top level of the repo. Click **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, set Source to **Deploy from a branch**, Branch to **main** and folder to **/ (root)**, then click **Save**.
4. After a minute or two the page shows your link: `https://<your-username>.github.io/project-log/`.

## Install it and use it as a side panel

- Open the link in Edge. Click the **App available / Install** icon in the address bar, or go to **⋯ → Apps → Install this site as an app**.
- It opens in its own window. Snap that window to the narrowest width next to Revit or Bluebeam, and the narrow layout takes over automatically. Maximise it on planning day for the wide layout.

## Your project list (one-time import)

The 117 projects from your OneNote *Weekly Planning* section are in **`project-log-seed.json`**, which is delivered separately and **not** in this folder. That keeps client names out of the public repo.

On first launch, click **Import project list** and pick that file. You can also do it later from Settings → *Restore backup or import projects*. Importing again never overwrites edits you have made.

## Your data

- Everything is saved in this browser's storage on this laptop. Nothing is sent anywhere.
- Edge and Chrome keep separate copies, so use one browser.
- Clearing browser data or site data erases it. Use **Back up now** (sidebar or Settings) every week or so, and keep the file in a OneDrive folder. **Restore** in Settings brings it back on any machine.

## Updating the app later

1. Upload the changed files to the repo; uploading over a file with the same name replaces it.
2. In `sw.js`, bump `VERSION` (for example `projectlog-v1.0.1`) so the cached copy refreshes.
3. Close and reopen the app. Updates show on the next launch; a second reopen may be needed.
