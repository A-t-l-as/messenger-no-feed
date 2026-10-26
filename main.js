// =====================================================================
//  Messenger No Feed — a minimal Electron wrapper
//  Opens Facebook messages only and blocks access to the news feed.
// =====================================================================

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// The URL we start at and return to whenever navigation "escapes".
const START_URL = 'https://www.facebook.com/messages/';

// Facebook/Messenger hosts that we handle inside the app at all.
const FB_HOSTS = ['www.facebook.com', 'facebook.com', 'www.messenger.com', 'messenger.com'];

// Paths on Facebook that are allowed.
// Everything else (the feed "/", /watch, /reel, /marketplace, /groups...) is blocked.
// Login and two-factor paths must be here, otherwise you can't sign in.
// If login keeps looping, log the URLs Facebook redirects to
// (see the README) and add the missing path here.
const ALLOWED_PATHS = [
  '/messages',
  '/messenger_media', // full-screen viewer for photos and videos sent in a chat
  '/login',
  '/checkpoint',
  '/two_step_verification',
  '/recover',
  '/cookie',
  '/privacy/consent',
  '/auth',
];

// Exceptions to the list above: addresses that start with an allowed path but
// still lead somewhere we don't want. Checked FIRST, so they always win.
// Each entry is a piece of text searched for in the path + query string.
const BLOCKED = [
  'flow=fb_dma_marketplace', // /privacy/consent screen that leads into Marketplace
];

// Optional window icon. If icon.png isn't there, the default Electron icon is used.
// (On macOS the window icon is ignored; the Dock uses the icon baked into
// the .app by build.js.)
const ICON_PATH = path.join(__dirname, 'icon.png');

// Does the URL belong to Facebook/Messenger?
function isFacebook(url) {
  try {
    return FB_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false; // invalid URL
  }
}

// Is the app allowed to show this URL?
function isAllowed(url) {
  if (!isFacebook(url)) return false;
  const { pathname, search } = new URL(url);
  if (BLOCKED.some((b) => (pathname + search).includes(b))) return false;
  return ALLOWED_PATHS.some((p) => pathname.startsWith(p));
}

// Links outside Facebook (e.g. an article a friend sent you) open in your default browser.
// Only http/https, so no page can launch anything through another protocol.
function openOutside(url) {
  try {
    const { protocol } = new URL(url);
    if (protocol === 'http:' || protocol === 'https:') shell.openExternal(url);
  } catch {}
}

// Facebook can be suspicious of Electron, so we strip the Electron and app
// tokens from the User-Agent. The site then sees a regular Chrome browser.
app.userAgentFallback = app.userAgentFallback
  .replace(/ Electron\/\S+/, '')
  .replace(` ${app.name}/${app.getVersion()}`, '');

// Windows needs an app ID to show notifications. Other systems don't use it.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.messengernofeed.app');
}

// Allow only one instance. Clicking the icon again focuses the open
// window instead of starting another copy.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 750,
    title: 'Messenger',
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    autoHideMenuBar: true, // Windows/Linux: hides the menu bar (press Alt to show it)
    webPreferences: {
      contextIsolation: true, // standard security settings:
      nodeIntegration: false, // the page has no access to your computer
    },
  });

  // Send the window back to messages.
  //
  // Loop guard: if Facebook keeps redirecting us to a blocked page, we don't
  // reload more often than once every 2 seconds. A bounce that comes too soon
  // is NOT dropped, it's postponed until the 2 seconds are up. Otherwise
  // clicking the feed twice in a row would let the second click through.
  const BOUNCE_INTERVAL = 2000;
  let lastBounce = 0;
  let bounceTimer = null;

  function bounceToMessages() {
    if (bounceTimer) return; // a bounce is already on its way

    const wait = Math.max(0, lastBounce + BOUNCE_INTERVAL - Date.now());
    bounceTimer = setTimeout(() => {
      bounceTimer = null;
      if (win.isDestroyed()) return;
      // Check where we are NOW: if you're already back in messages
      // (or a blocked click was cancelled), there's nothing to do.
      if (isAllowed(win.webContents.getURL())) return;
      lastBounce = Date.now();
      win.loadURL(START_URL);
    }, wait);
  }

  // Safety net: once a second, check the address of the window. Facebook has
  // many ways to change pages, and if any of them slips past the guards
  // below, this catches it within a second.
  const watchdog = setInterval(() => {
    if (win.isDestroyed()) return;
    const url = win.webContents.getURL();
    if (isFacebook(url) && !isAllowed(url)) bounceToMessages();
  }, 1000);
  win.on('closed', () => clearInterval(watchdog));

  // 1) Regular navigation (clicking a link, reloading).
  //    This event fires BEFORE navigating, so we can cancel it.
  win.webContents.on('will-navigate', (event, url) => {
    if (isAllowed(url)) return;
    event.preventDefault();
    if (isFacebook(url)) bounceToMessages();
    else openOutside(url);
  });

  // 2) In-page navigation. Facebook is a single-page app: clicking the logo
  //    changes the URL without a reload, so will-navigate doesn't fire.
  //    We catch it here (after the fact) and go back to messages.
  win.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
    if (isMainFrame && !isAllowed(url)) bounceToMessages();
  });

  // 3) Server-side redirects (e.g. after login Facebook sends you to "/").
  win.webContents.on('did-navigate', (event, url) => {
    if (!isAllowed(url)) bounceToMessages();
  });

  // 4) Links that try to open a new window (target="_blank").
  //    We never open new windows inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isFacebook(url)) openOutside(url);
    return { action: 'deny' };
  });

  win.loadURL(START_URL);
}

// The icon was clicked while the app is already running: show the existing window.
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(createWindow);

// Closing the window quits the app, on every system (including macOS,
// where apps usually keep running; for a single-window tool this is simpler).
app.on('window-all-closed', () => app.quit());
