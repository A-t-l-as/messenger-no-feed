// =====================================================================
//  Build script — packages the app for the system you run it on.
//
//    npm run package   -> builds the app into dist/
//    npm run dist      -> builds the app AND packs it into an archive
//                         (this is what GitHub Actions runs)
//
//  Electron apps can only be reliably built for the system they're built
//  on (macOS apps need macOS tools), so the release workflow runs this
//  script three times: on Windows, macOS and Linux.
// =====================================================================

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { packager } = require('@electron/packager');
const png2icons = require('png2icons');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'dist');
const ICON_DIR = path.join(ROOT, 'build-icons');
const APP_NAME = 'Messenger';
const pkg = require('./package.json');

// Version: from the git tag on GitHub (v1.2.3 -> 1.2.3), otherwise package.json.
const version =
  process.env.GITHUB_REF_TYPE === 'tag'
    ? process.env.GITHUB_REF_NAME.replace(/^v/, '')
    : pkg.version;

// Target system and architecture.
//   Windows: x64.  Linux: x64.
//   macOS: "universal" = one app that runs on both Intel and Apple Silicon Macs.
const platform = process.platform; // 'win32', 'darwin' or 'linux'
const arch = platform === 'darwin' ? 'universal' : 'x64';

// Short system names used in archive file names.
const OS_LABEL = { win32: 'win', darwin: 'mac', linux: 'linux' }[platform];

// ---------------------------------------------------------------------
// 1) Icons. You keep a single icon.png (512x512 or bigger) in the repo.
//    Windows needs .ico and macOS needs .icns, so we generate them here.
//    Linux uses the PNG directly. No icon.png = default Electron icon.
// ---------------------------------------------------------------------
function makeIcon() {
  const source = path.join(ROOT, 'icon.png');
  if (!fs.existsSync(source)) {
    console.log('No icon.png found, using the default Electron icon.');
    return undefined;
  }

  const png = fs.readFileSync(source);
  fs.mkdirSync(ICON_DIR, { recursive: true });

  if (platform === 'win32') {
    const ico = png2icons.createICO(png, png2icons.BICUBIC, 0, false, true);
    if (!ico) throw new Error('Could not convert icon.png to .ico');
    const file = path.join(ICON_DIR, 'icon.ico');
    fs.writeFileSync(file, ico);
    return file;
  }

  if (platform === 'darwin') {
    const icns = png2icons.createICNS(png, png2icons.BICUBIC, 0);
    if (!icns) throw new Error('Could not convert icon.png to .icns');
    const file = path.join(ICON_DIR, 'icon.icns');
    fs.writeFileSync(file, icns);
    return file;
  }

  return source; // Linux
}

// ---------------------------------------------------------------------
// 2) Packaging: bundle our code together with Electron into an app.
// ---------------------------------------------------------------------
async function build() {
  console.log(`Building ${APP_NAME} ${version} for ${platform}-${arch}...`);

  const [appPath] = await packager({
    dir: ROOT,
    name: APP_NAME,
    platform,
    arch,
    out: OUT_DIR,
    overwrite: true,
    icon: makeIcon(),
    appVersion: version,
    appBundleId: 'com.messengernofeed.app', // macOS app identifier
    // Don't copy build-only files into the app.
    ignore: [
      /^\/build-icons($|\/)/,
      /^\/\.github($|\/)/,
      /^\/build\.js$/,
      /^\/README\.md$/,
      /^\/Messenger-.*\.(zip|tar\.gz)$/, // archives from previous builds
    ],
  });

  console.log(`Built: ${appPath}`);
  return appPath;
}

// ---------------------------------------------------------------------
// 3) Archive: one file per system, ready to attach to a GitHub Release.
// ---------------------------------------------------------------------
function archive(appPath) {
  const base = `${APP_NAME}-${version}-${OS_LABEL}-${arch}`;

  if (platform === 'win32') {
    // A plain zip, built with the PowerShell that ships with Windows.
    // We zip the folder itself (not its contents), so unzipping creates one
    // "Messenger-win32-x64" folder instead of spilling ~80 files everywhere.
    const file = path.join(ROOT, `${base}.zip`);
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${appPath}' -DestinationPath '${file}' -Force`,
    ], { stdio: 'inherit' });
    return file;
  }

  if (platform === 'darwin') {
    // macOS apps are folders full of symlinks; "ditto" is the macOS tool
    // that zips them without breaking anything.
    const file = path.join(ROOT, `${base}.zip`);
    execFileSync('ditto', [
      '-c', '-k', '--sequesterRsrc', '--keepParent',
      path.join(appPath, `${APP_NAME}.app`),
      file,
    ], { stdio: 'inherit' });
    return file;
  }

  // Linux: tar.gz keeps the "executable" flag on the program file.
  const file = path.join(ROOT, `${base}.tar.gz`);
  execFileSync('tar', ['-czf', file, '-C', OUT_DIR, path.basename(appPath)], {
    stdio: 'inherit',
  });
  return file;
}

// ---------------------------------------------------------------------

(async () => {
  const appPath = await build();
  if (process.argv.includes('--archive')) {
    const file = archive(appPath);
    console.log(`Archive: ${file}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
