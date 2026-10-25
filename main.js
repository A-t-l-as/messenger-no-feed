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
  '/login',
  '/checkpoint',
  '/two_step_verification',
  '/recover',
  '/cookie',
  '/privacy/consent',
  '/auth',
];

// Optional window icon. If icon.ico isn't there, the default Electron icon is used.
const ICON_PATH = path.join(__dirname, 'icon.ico');

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
  const { pathname } = new URL(url);
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

// Windows needs an app ID to show notifications.
app.setAppUserModelId('com.messengernofeed.app');

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
    autoHideMenuBar: true, // hides the menu bar (press Alt to show it)
    webPreferences: {
      contextIsolation: true, // standard security settings:
      nodeIntegration: false, // the page has no access to your computer
    },
  });

  // Loop guard: if Facebook keeps redirecting us to a blocked page,
  // don't bounce back more often than once every 2 seconds.
  let lastBounce = 0;
  function bounceToMessages() {
    const now = Date.now();
    if (now - lastBounce < 2000) return;
    lastBounce = now;
    win.loadURL(START_URL);
  }

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

// Closing the window quits the app.
app.on('window-all-closed', () => app.quit());
