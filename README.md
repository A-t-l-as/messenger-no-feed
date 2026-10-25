# Messenger No Feed

A tiny desktop app for Windows that opens Facebook Messenger in its own window and **blocks the news feed**. You get your messages; you don't get the endless scroll.

Built with [Electron](https://www.electronjs.org/). The whole app is a single, commented `main.js` file (~140 lines), so you can read and understand every line of it.

## Features

- Opens straight into `facebook.com/messages`
- Blocks the feed, Reels, Watch, Marketplace, Groups and everything else on Facebook
- Links outside Facebook open in your default browser
- Single instance: clicking the icon again focuses the existing window
- Native Windows notifications
- No tracking, no extra code injected into the page

## How it works

The app keeps an **allowlist of paths** (`ALLOWED_PATHS` in `main.js`). Only `/messages` and the login/verification pages are allowed; any other Facebook URL sends you back to your messages.

A page can be reached in four different ways, so there are four guards:

| Event | What it catches |
|---|---|
| `will-navigate` | Regular link clicks. Cancelled *before* the page loads. |
| `did-navigate-in-page` | Facebook is a single-page app, so clicking the logo changes the URL without a reload. Caught *after* the fact and bounced back. |
| `did-navigate` | Server-side redirects, e.g. Facebook sending you to the feed after login. |
| `setWindowOpenHandler` | Links that try to open a new window. Never opened inside the app. |

A small loop guard makes sure the app doesn't bounce more than once every 2 seconds, in case Facebook redirects repeatedly.

## Requirements

- Windows 10 or 11
- [Node.js](https://nodejs.org/) (LTS version)

## Getting started

```bash
git clone https://github.com/A-t-l-as/messenger-no-feed.git
cd messenger-no-feed
npm install
npm start
```

Sign in and try clicking the Facebook logo: you should land right back in your messages.

## Building the .exe

```bash
npm run package
```

The app ends up in `dist/Messenger-win32-x64/`. To get a desktop shortcut, right-click `Messenger.exe` → **Send to** → **Desktop (create shortcut)**.

## Custom icon

Put an `icon.ico` file (256×256 recommended) in the project folder, next to `main.js`. It's used both for the window and for the `.exe`. Convert a PNG to ICO with any online converter.

> `npm run package` expects `icon.ico` to exist. If you don't want a custom icon, remove `--icon=icon.ico` from the `package` script in `package.json`.

If Windows still shows the old icon after rebuilding, delete the shortcut and create it again.

## Troubleshooting

**Login keeps looping.** Facebook is redirecting to a path that isn't on the allowlist. To see which one, temporarily add a log line in the `did-navigate` handler:

```js
win.webContents.on('did-navigate', (event, url) => {
  console.log(url);
  if (!isAllowed(url)) bounceToMessages();
});
```

Run `npm start`, watch the terminal, and add the missing path to `ALLOWED_PATHS`.

**No notifications.** Facebook asks for permission on first run, so accept it. Also check *Settings → System → Notifications* in Windows and make sure "Messenger" is enabled.

## Disclaimer

This is an unofficial personal project, not affiliated with, endorsed by, or connected to Meta Platforms, Inc. "Facebook" and "Messenger" are trademarks of Meta. The app simply displays the regular Facebook website in a window; it doesn't use any private API and doesn't store or send your data anywhere.

## License

[MIT](LICENSE)
