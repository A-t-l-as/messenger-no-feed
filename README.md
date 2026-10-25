# Messenger No Feed

A tiny desktop app for Windows, macOS and Linux that opens Facebook Messenger in its own window and **blocks the news feed**. You get your messages; you don't get the endless scroll.

Built with [Electron](https://www.electronjs.org/). The whole app is a single, commented `main.js` file (~150 lines), so you can read and understand every line of it.

## Features

- Opens straight into `facebook.com/messages`
- Blocks the feed, Reels, Watch, Marketplace, Groups and everything else on Facebook
- Links outside Facebook open in your default browser
- Single instance: clicking the icon again focuses the existing window
- Native notifications
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

## Download

Get the file for your system from the [latest release](https://github.com/A-t-l-as/messenger-no-feed/releases/latest):

| System | File |
|---|---|
| Windows 10/11 | `Messenger-x.y.z-win-x64.zip` |
| macOS (Intel and Apple Silicon) | `Messenger-x.y.z-mac-universal.zip` |
| Linux | `Messenger-x.y.z-linux-x64.tar.gz` |

The app isn't code-signed, so each system needs a small extra step on first launch. If you'd rather not trust a prebuilt file, [build it yourself](#building-from-source).

### Windows

Unzip anywhere (you'll get a `Messenger-win32-x64` folder) and run `Messenger.exe` inside it. To get a desktop shortcut, right-click `Messenger.exe` → **Send to** → **Desktop (create shortcut)**.

SmartScreen may warn you on first launch: click **More info** → **Run anyway**.

### macOS

Unzip and drag `Messenger.app` to **Applications**. Because the app isn't signed with an Apple Developer certificate, macOS may block it or claim it is "damaged". Remove the download quarantine flag once in Terminal:

```bash
xattr -cr /Applications/Messenger.app
```

Then open it normally.

### Linux

```bash
tar -xzf Messenger-x.y.z-linux-x64.tar.gz
cd Messenger-linux-x64
./Messenger
```

If it refuses to start with an error about the **SUID sandbox helper**, give Chromium's sandbox helper the permissions it needs (once):

```bash
sudo chown root:root chrome-sandbox
sudo chmod 4755 chrome-sandbox
```

## Building from source

### Requirements

- Windows 10/11, macOS or Linux
- [Node.js](https://nodejs.org/) (LTS version)

### Getting started

```bash
git clone https://github.com/A-t-l-as/messenger-no-feed.git
cd messenger-no-feed
npm install
npm start
```

Sign in and try clicking the Facebook logo: you should land right back in your messages.

### Building the app

| Command | What it does |
|---|---|
| `npm run package` | Builds the app for your system into `dist/` |
| `npm run dist` | Same, plus packs it into a `.zip` / `.tar.gz` archive |

Everything lives in the commented `build.js`. It always builds for the system you run it on (macOS apps need macOS tools), which is why the release workflow runs it on three machines.

## Releasing

Releases are built automatically by GitHub Actions (`.github/workflows/release.yml`). Push a version tag and the workflow builds the app on Windows, macOS and Linux at the same time, then publishes one release with all three archives and auto-generated notes:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The app version is taken from the tag, so there's no need to edit `package.json`. You can also run the workflow by hand from the **Actions** tab; a manual run only builds the archives and keeps them as downloadable artifacts.

## Custom icon

Put an `icon.png` (512×512 or bigger, square) in the project folder, next to `main.js`. That's the only icon file you need: `build.js` converts it to `.ico` for Windows and `.icns` for macOS automatically. Without it, the default Electron icon is used.

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

**No notifications.** Facebook asks for permission on first run, so accept it. Also check your system's notification settings and make sure "Messenger" is allowed.

## Disclaimer

This is an unofficial personal project, not affiliated with, endorsed by, or connected to Meta Platforms, Inc. "Facebook" and "Messenger" are trademarks of Meta. The app simply displays the regular Facebook website in a window; it doesn't use any private API and doesn't store or send your data anywhere.

## License

[MIT](LICENSE)
