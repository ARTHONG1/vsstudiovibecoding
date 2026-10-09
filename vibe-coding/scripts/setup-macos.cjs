#!/usr/bin/env node
'use strict';
// macOS counterpart of setup.ps1. Run it through setup-macos.sh, which picks
// Node.js 18+ or the JavaScript runtime bundled with VS Code. Only built-in
// modules are used. Without --apply the script prints the plan and changes nothing.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const jsonc = require('./jsonc.cjs');

const USAGE = [
  'Usage: setup-macos.sh (--project <folder> | --create-sample) [options]',
  '  --entry <file>        Entry file inside the project (default: detected)',
  '  --preview-url <url>   Verified localhost development server URL',
  '  --code-app <path>     Location of Visual Studio Code.app',
  '  --codex <path>        OpenAI Codex CLI executable',
  '  --codex-arg <arg>     Verified Codex startup argument (repeatable)',
  '  --root <folder>       Isolated data folder (default: ~/Library/VibeCoding)',
  '  --desktop <folder>    Launcher destination (default: ~/Desktop)',
  '  --apply               Apply the plan; without it only the plan is printed',
  '  --launch              Open the generated launcher after applying'
].join('\n');

const VIBE_COMMANDS = ['vibe.toggleTerminal', 'vibe.restoreLayout', 'vibe.togglePreview', 'vibe.openExternalBrowser', 'vibe.pasteImage'];
const REQUIRED_EXTENSIONS = ['MS-CEINTL.vscode-language-pack-ko', 'ms-vscode.live-server'];

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error('Missing value for ' + flag);
      return argv[++i];
    };
    switch (flag) {
      case '--project': case '--project-path': opts.projectPath = value(); break;
      case '--entry': case '--entry-file': opts.entryFile = value(); break;
      case '--preview-url': opts.previewUrl = value(); opts.previewUrlGiven = true; break;
      case '--code-app': opts.codeApp = value(); break;
      case '--codex': case '--codex-path': opts.codexPath = value(); break;
      case '--codex-arg': (opts.codexArgs = opts.codexArgs || []).push(value()); break;
      case '--root': opts.root = value(); break;
      case '--desktop': opts.desktop = value(); break;
      case '--skill-root': opts.skillRoot = value(); break;
      case '--create-sample': opts.createSample = true; break;
      case '--apply': opts.apply = true; break;
      case '--launch': opts.launch = true; break;
      case '-h': case '--help': opts.help = true; break;
      default: throw new Error('Unknown option: ' + flag + '\n' + USAGE);
    }
  }
  return opts;
}

function isFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function isExecutable(p) { try { fs.accessSync(p, fs.constants.X_OK); return isFile(p); } catch { return false; } }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

function findOnPath(name, env) {
  for (const dir of String(env.PATH || '').split(':').filter(Boolean)) {
    const candidate = path.join(dir, name);
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

function codeCliOf(app) {
  return path.join(app, 'Contents', 'Resources', 'app', 'bin', 'code');
}

// Known locations come first; Spotlight is asked only when none of them has VS Code.
function findVsCodeApp(opts, deps) {
  if (opts.codeApp) {
    const app = path.resolve(opts.codeApp);
    return isExecutable(codeCliOf(app)) ? app : null;
  }
  const list = [];
  if (deps.env.VIBE_CODE_APP) list.push(deps.env.VIBE_CODE_APP);
  const shellCommand = findOnPath('code', deps.env);
  if (shellCommand) {
    try {
      const match = fs.realpathSync(shellCommand).match(/^(.*?\.app)\/Contents\/Resources\/app\/bin\/code$/);
      if (match) list.push(match[1]);
    } catch {}
  }
  list.push('/Applications/Visual Studio Code.app', path.join(deps.home, 'Applications', 'Visual Studio Code.app'));
  const known = list.find(app => isExecutable(codeCliOf(app)));
  if (known) return known;
  try {
    const found = deps.run('/usr/bin/mdfind', ['kMDItemCFBundleIdentifier == "com.microsoft.VSCode"'], { timeout: 10000 });
    return found.split('\n').map(line => line.trim()).filter(Boolean).find(app => isExecutable(codeCliOf(app))) || null;
  } catch { return null; }
}

function codexCandidates(deps) {
  const home = deps.home;
  const list = [];
  const onPath = findOnPath('codex', deps.env);
  if (onPath) list.push(onPath);
  list.push('/opt/homebrew/bin/codex', '/usr/local/bin/codex',
    path.join(home, '.local', 'bin', 'codex'), path.join(home, '.npm-global', 'bin', 'codex'),
    path.join(home, '.volta', 'bin', 'codex'), path.join(home, '.bun', 'bin', 'codex'));
  try {
    const nvm = path.join(home, '.nvm', 'versions', 'node');
    for (const version of fs.readdirSync(nvm).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
      list.push(path.join(nvm, version, 'bin', 'codex'));
    }
  } catch {}
  return [...new Set(list)];
}

// Codex installed by npm is a script that runs node from PATH. Keep the
// caller's PATH order and add only missing fallback folders.
function codexEnv(codexPath, env) {
  const current = String(env.PATH || '').split(':').filter(Boolean);
  const extra = [codexPath ? path.dirname(codexPath) : null, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].filter(Boolean);
  return { ...env, PATH: [...new Set([...current, ...extra])].join(':') };
}

function commandLineToolsMissing(deps) {
  try { deps.run('/usr/bin/xcode-select', ['-p'], { timeout: 10000 }); return false; } catch { return true; }
}

function buildPlan(opts, deps) {
  if (deps.platform !== 'darwin') throw new Error('setup-macos supports macOS only. On Windows use scripts/setup.ps1.');
  if (opts.createSample && opts.projectPath) throw new Error('Choose --project OR --create-sample.');
  if (!opts.projectPath && !opts.createSample) throw new Error('Specify --project <folder>, or --create-sample for a new demo.');
  const root = path.resolve(opts.root || path.join(deps.home, 'Library', 'VibeCoding'));
  // Quoted launcher arguments can use any user path. Only the phone's workspace
  // URL needs an ASCII path; keep that alias separate from the data directory.
  const safeRoot = /^[a-z0-9_./:\\-]+$/i.test(root);
  const uid = deps.uid !== undefined ? deps.uid : (typeof process.getuid === 'function' ? process.getuid() : 'user');
  const workspaceBase = safeRoot ? null : (deps.workspaceBase || path.join('/Users/Shared', 'VibeCoding-' + uid + '-' + sha256(Buffer.from(deps.home)).slice(0, 10)));
  const projectPath = opts.createSample ? path.join(root, 'SampleProject') : path.resolve(opts.projectPath);
  if (!opts.createSample && !isDir(projectPath)) throw new Error('Project does not exist: ' + projectPath);

  let entryFile = opts.entryFile;
  if (!entryFile) {
    const candidates = ['index.html', 'public/index.html', 'src/index.html', 'src/App.tsx', 'src/App.jsx', 'src/App.vue', 'src/main.ts', 'src/main.js', 'app/page.tsx'];
    entryFile = candidates.find(candidate => isFile(path.join(projectPath, candidate))) || 'index.html';
  }
  entryFile = entryFile.replace(/\\/g, '/');
  const entryPath = path.resolve(projectPath, entryFile);
  if (!entryPath.startsWith(projectPath.replace(/[\\/]+$/, '') + path.sep)) throw new Error('Entry file must stay within the project.');
  if (!opts.createSample && !isFile(entryPath)) throw new Error('Entry file does not exist: ' + entryPath);

  let previewUrl = opts.previewUrl;
  if (!opts.previewUrlGiven) {
    try { previewUrl = JSON.parse(fs.readFileSync(path.join(projectPath, '.vibe', 'remote-config.json'), 'utf8')).previewUrl || undefined; } catch {}
  }
  if (!previewUrl && isFile(path.join(projectPath, 'package.json'))) {
    try {
      const pkgText = fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8');
      if (/"vite"/.test(pkgText)) previewUrl = 'http://localhost:5173';
      else if (/"next"/.test(pkgText) || /"react-scripts"/.test(pkgText)) previewUrl = 'http://localhost:3000';
      else if (/"astro"/.test(pkgText)) previewUrl = 'http://localhost:4321';
    } catch {}
  }
  if (previewUrl) {
    let url;
    try { url = new URL(previewUrl); } catch { throw new Error('--preview-url is not a valid URL.'); }
    if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('--preview-url must be a localhost HTTP(S) development server.');
    }
  }

  const codeApp = findVsCodeApp(opts, deps);
  const codexPath = opts.codexPath ? path.resolve(opts.codexPath) : (codexCandidates(deps).find(isExecutable) || null);
  const missing = [];
  const warnings = [];
  if (!codeApp) missing.push('Visual Studio Code.app (official build in /Applications)');
  else if (/\/AppTranslocation\//.test(codeApp)) missing.push('Visual Studio Code.app runs from a temporary translocated copy; move it to /Applications');
  else if (!/^(\/Applications\/|.*\/Applications\/)/.test(codeApp)) warnings.push('VS Code is outside an Applications folder; move it to /Applications so updates and the launcher keep working.');
  if (!codexPath || !isExecutable(codexPath)) missing.push('OpenAI Codex CLI with execute permission (codex)');
  if (commandLineToolsMissing(deps)) warnings.push('macOS Command Line Tools are missing. Git and the Vibe time machine need them: run xcode-select --install and let the user approve the installer.');

  let identityPath = projectPath;
  try { identityPath = fs.realpathSync(projectPath); } catch {}
  let id = sha256(Buffer.from('mac\0' + identityPath.normalize('NFC'), 'utf8')).slice(0, 10);
  const workspaceDir = path.join(workspaceBase || root, 'Workspaces');
  // Keep existing launchers/settings when upgrading, but reuse a legacy ID
  // only if it belongs to this exact directory (not a case-distinct sibling).
  const legacyId = sha256(Buffer.from(projectPath.normalize('NFC').toLowerCase(), 'utf8')).slice(0, 10);
  const legacyFile = path.join(workspaceDir, 'vibe-' + legacyId + '.code-workspace');
  if (fs.existsSync(legacyFile)) {
    const legacy = readObject(legacyFile);
    const folder = Array.isArray(legacy.folders) && legacy.folders[0];
    if (folder && typeof folder.path === 'string') {
      let legacyPath = path.resolve(path.dirname(legacyFile), folder.path);
      try { legacyPath = fs.realpathSync(legacyPath); } catch {}
      if (legacyPath.normalize('NFC') === identityPath.normalize('NFC')) id = legacyId;
    }
  }
  const name = path.basename(projectPath).normalize('NFC').replace(/[/:]/g, '_').replace(/^\.+/, '') || 'project';
  const desktop = path.resolve(opts.desktop || path.join(deps.home, 'Desktop'));
  return {
    platform: 'darwin',
    project: projectPath,
    entry: entryPath,
    entryFile,
    previewUrl: previewUrl || '',
    root,
    code: codeApp,
    codeCli: codeApp ? codeCliOf(codeApp) : null,
    agent: 'Codex',
    codex: codexPath,
    workspace: path.join(workspaceDir, 'vibe-' + id + '.code-workspace'),
    workspaceBase,
    shortcut: path.join(desktop, 'Vibe Coding - ' + name + '-' + id + '.app'),
    desktop,
    missing,
    warnings,
    applied: false
  };
}

function stamp(date) {
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + '-' + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds()) + '-' + pad(date.getMilliseconds(), 3);
}

function readObject(file) {
  return jsonc.readObject(file);
}

function backupFile(file, backupDir) {
  if (!isFile(file)) return null;
  const target = path.join(backupDir, sha256(Buffer.from(path.resolve(file), 'utf8')) + '-' + path.basename(file));
  if (!fs.existsSync(target)) fs.copyFileSync(file, target);
  return target;
}

function saveJson(file, value, backupDir) {
  backupFile(file, backupDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  fs.writeFileSync(file, jsonc.updateObjectText(text, value), 'utf8');
}

function listFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (entry.name === '.DS_Store') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(full));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Writes a stored (uncompressed) ZIP with forward-slash names, the format
// VS Code accepts for a .vsix package.
function createZip(sourceDir, destFile) {
  const parts = [];
  const central = [];
  let offset = 0;
  const DOS_TIME = 0;
  const DOS_DATE = (1 << 5) | 1; // 1980-01-01
  const files = listFiles(sourceDir);
  for (const file of files) {
    const name = Buffer.from(path.relative(sourceDir, file).split(path.sep).join('/'), 'utf8');
    const data = fs.readFileSync(file);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, data);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(DOS_TIME, 12);
    header.writeUInt16LE(DOS_DATE, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);
    offset += local.length + name.length + data.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, Buffer.concat([...parts, centralBuffer, end]));
  return files.length;
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

// VS Code adds __metadata to the installed package.json; every other file
// must match the skill source byte for byte.
function extensionMatches(sourceDir, installedDir) {
  if (!isDir(sourceDir) || !isDir(installedDir)) return false;
  for (const file of listFiles(sourceDir)) {
    const relative = path.relative(sourceDir, file);
    const target = path.join(installedDir, relative);
    if (!isFile(target)) return false;
    if (relative === 'package.json') {
      try {
        const expected = JSON.parse(fs.readFileSync(file, 'utf8'));
        const actual = JSON.parse(fs.readFileSync(target, 'utf8'));
        delete expected.__metadata;
        delete actual.__metadata;
        if (stableJson(expected) !== stableJson(actual)) return false;
      } catch { return false; }
    } else if (sha256(fs.readFileSync(file)) !== sha256(fs.readFileSync(target))) {
      return false;
    }
  }
  return true;
}

// VS Code writes languagepacks.json only after its window starts, when the
// display language has already been chosen, so a new profile opened in English
// once. Write the same file (format and hash as in VS Code's LanguagePacksCache)
// right after the CLI installs the Korean language pack.
function writeLanguagePacks(userDir, extensionsDir) {
  let registry = [];
  try { registry = JSON.parse(fs.readFileSync(path.join(extensionsDir, 'extensions.json'), 'utf8')); } catch {}
  const packs = {};
  for (const entry of Array.isArray(registry) ? registry : []) {
    const id = entry && entry.identifier && entry.identifier.id;
    const dir = entry && entry.relativeLocation ? path.join(extensionsDir, entry.relativeLocation) : null;
    if (!id || !dir) continue;
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { continue; }
    const localizations = manifest.contributes && Array.isArray(manifest.contributes.localizations) ? manifest.contributes.localizations : [];
    for (const localization of localizations) {
      if (typeof localization.languageId !== 'string' || !Array.isArray(localization.translations) || !localization.translations.length) continue;
      const pack = packs[localization.languageId] || (packs[localization.languageId] = { hash: '', label: localization.localizedLanguageName || localization.languageName, extensions: [], translations: {} });
      const uuid = entry.identifier.uuid || (entry.metadata && entry.metadata.id);
      pack.extensions.push({ extensionIdentifier: uuid ? { id, uuid } : { id }, version: manifest.version });
      for (const translation of localization.translations) {
        if (typeof translation.id === 'string' && typeof translation.path === 'string') pack.translations[translation.id] = path.join(dir, translation.path);
      }
    }
  }
  for (const pack of Object.values(packs)) {
    const md5 = crypto.createHash('md5');
    for (const extension of pack.extensions) md5.update(extension.extensionIdentifier.uuid || extension.extensionIdentifier.id).update(extension.version);
    pack.hash = md5.digest('hex');
  }
  if (!packs.ko) return false;
  const file = path.join(userDir, 'languagepacks.json');
  let current = {};
  try { current = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch {}
  if (current.ko && current.ko.hash === packs.ko.hash && JSON.stringify(current.ko.translations) === JSON.stringify(packs.ko.translations)) return false;
  fs.writeFileSync(file, JSON.stringify({ ...current, ...packs }), 'utf8');
  return true;
}

function appleScriptString(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// open -n starts VS Code through LaunchServices, so VS Code loads the login
// shell PATH (Homebrew, nvm) and can find Codex and Node. Starting it through
// the code CLI would skip that step.
function launcherSource({ appPath, userDir, extensionsDir, workspacePath }) {
  const args = ['--new-window', '--skip-release-notes', '--skip-welcome', '--locale', 'ko', '--user-data-dir', userDir, '--extensions-dir', extensionsDir, workspacePath];
  const quoted = args.map(arg => ' & " " & quoted form of ' + appleScriptString(arg)).join('');
  return [
    '-- Vibe Coding launcher. Generated by setup-macos.cjs; rerun setup to change it.',
    'on run',
    '\tdo shell script "/usr/bin/open -n -a " & quoted form of ' + appleScriptString(appPath) + ' & " --args"' + quoted,
    'end run',
    ''
  ].join('\n');
}

function vsCodeIcon(appPath) {
  const resources = path.join(appPath, 'Contents', 'Resources');
  if (isFile(path.join(resources, 'Code.icns'))) return path.join(resources, 'Code.icns');
  try {
    const found = fs.readdirSync(resources).find(name => /\.icns$/i.test(name) && /code/i.test(name));
    return found ? path.join(resources, found) : null;
  } catch { return null; }
}

function moveAside(source, backupDir, deps) {
  let target = path.join(backupDir, path.basename(source));
  for (let suffix = 1; fs.existsSync(target); suffix++) target = path.join(backupDir, path.basename(source) + '-' + suffix);
  try { fs.renameSync(source, target); }
  catch (error) {
    if (error.code !== 'EXDEV') throw error;
    deps.run('/usr/bin/ditto', [source, target]);
    fs.rmSync(source, { recursive: true, force: true });
  }
  return target;
}

function createLauncher(plan, ctx, deps) {
  if (!isDir(plan.desktop)) throw new Error('Desktop folder not found: ' + plan.desktop + '. Pass --desktop <folder>.');
  const sourcePath = path.join(ctx.backup, 'launcher.applescript');
  fs.writeFileSync(sourcePath, launcherSource({ appPath: plan.code, userDir: ctx.userDir, extensionsDir: ctx.extensionsDir, workspacePath: plan.workspace }), 'utf8');
  const staging = fs.mkdtempSync(path.join(plan.desktop, '.vibe-launcher-'));
  const stagedApp = path.join(staging, 'launcher.app');
  let previous = null;
  try {
    deps.run('/usr/bin/osacompile', ['-o', stagedApp, sourcePath]);
  // Show the VS Code icon; re-sign ad hoc because the icon is part of the bundle seal.
  const icon = vsCodeIcon(plan.code);
  const appletIcon = path.join(stagedApp, 'Contents', 'Resources', 'applet.icns');
  if (icon && isFile(appletIcon)) {
    const original = fs.readFileSync(appletIcon);
    fs.copyFileSync(icon, appletIcon);
    try { deps.run('/usr/bin/codesign', ['--force', '--sign', '-', stagedApp]); }
    catch {
      fs.writeFileSync(appletIcon, original);
      try { deps.run('/usr/bin/codesign', ['--force', '--sign', '-', stagedApp]); } catch {}
    }
  }
    if (fs.existsSync(plan.shortcut)) previous = moveAside(plan.shortcut, ctx.backup, deps);
    try { fs.renameSync(stagedApp, plan.shortcut); }
    catch (error) {
      if (previous && !fs.existsSync(plan.shortcut)) {
        try { fs.renameSync(previous, plan.shortcut); }
        catch (restoreError) {
          if (restoreError.code !== 'EXDEV') throw restoreError;
          deps.run('/usr/bin/ditto', [previous, plan.shortcut]);
        }
      }
      throw error;
    }
    try { const now = new Date(); fs.utimesSync(plan.shortcut, now, now); } catch {}
    return previous;
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
}

function applySetup(plan, opts, deps) {
  if (plan.missing.length) throw new Error('Install/discover prerequisites first: ' + plan.missing.join(', '));
  const skillRoot = opts.skillRoot ? path.resolve(opts.skillRoot) : deps.skillRoot;
  const codexVersion = deps.run(plan.codex, ['--version'], { env: codexEnv(plan.codex, deps.env), timeout: 60000 }).trim();
  const userDir = path.join(plan.root, 'VSCodeUserData');
  const extensionsDir = path.join(plan.root, 'VSCodeExtensions');
  const backup = path.join(plan.root, 'Backups', 'setup-' + stamp(deps.now()));
  const settingsPath = path.join(userDir, 'User', 'settings.json');
  const settings = readObject(settingsPath);
  const workspace = readObject(plan.workspace);
  const argvPath = path.join(userDir, 'argv.json');
  const argv = readObject(argvPath);
  const remotePath = path.join(plan.project, '.vibe', 'remote-config.json');
  const remote = readObject(remotePath);
  // Reject an unsafe shared alias before changing any user files. This private
  // directory is owned by the user; never follow another user's planted symlink.
  if (plan.workspaceBase) {
    if (!fs.existsSync(plan.workspaceBase)) fs.mkdirSync(plan.workspaceBase, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(plan.workspaceBase);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (typeof process.getuid === 'function' && stat.uid !== process.getuid())) {
      throw new Error('Mobile workspace alias must be a private directory owned by the current user: ' + plan.workspaceBase);
    }
    if (process.platform === 'darwin') fs.chmodSync(plan.workspaceBase, 0o700);
    const workspaces = path.join(plan.workspaceBase, 'Workspaces');
    if (fs.existsSync(workspaces) && fs.lstatSync(workspaces).isSymbolicLink()) throw new Error('Mobile workspace directory cannot be a symlink: ' + workspaces);
  }
  for (const dir of [path.join(userDir, 'User'), extensionsDir, path.dirname(plan.workspace), backup]) fs.mkdirSync(dir, { recursive: true });

  if (opts.createSample) {
    fs.mkdirSync(plan.project, { recursive: true });
    if (!isFile(plan.entry)) fs.copyFileSync(path.join(skillRoot, 'assets', 'sample.html'), plan.entry);
  }
  if (plan.previewUrl && isFile(path.join(plan.project, 'package.json'))) {
    const tasksPath = path.join(plan.project, '.vscode', 'tasks.json');
    if (!fs.existsSync(tasksPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(plan.project, 'package.json'), 'utf8'));
        const scripts = pkg.scripts || {};
        const scriptName = scripts.dev ? 'dev' : (scripts.start ? 'start' : null);
        if (scriptName) {
          saveJson(tasksPath, {
            version: '2.0.0',
            tasks: [{ label: 'Auto Start Dev Server', type: 'shell', command: 'npm run ' + scriptName, isBackground: true, problemMatcher: [], runOptions: { runOn: 'folderOpen' } }]
          }, backup);
        }
      } catch {}
    }
  }
  if (!isFile(plan.entry)) throw new Error('Entry file is not a file: ' + plan.entry);

  const skip = (Array.isArray(settings['terminal.integrated.commandsToSkipShell']) ? settings['terminal.integrated.commandsToSkipShell'] : [])
    .filter(item => item && !['-vibe.toggleTerminal', '-vibe.restoreLayout'].includes(item));
  settings['terminal.integrated.commandsToSkipShell'] = [...new Set([...skip, ...VIBE_COMMANDS])];
  Object.assign(settings, {
    'workbench.panel.opensMaximized': 'never',
    'workbench.panel.defaultLocation': 'right',
    'terminal.integrated.enablePersistentSessions': true,
    'terminal.integrated.tabs.enabled': false,
    'terminal.integrated.copyOnSelection': true,
    'livePreview.openPreviewTarget': 'Embedded Preview',
    'livePreview.debugOnExternalPreview': true,
    'livePreview.autoRefreshPreview': 'On All Changes in Editor',
    'workbench.startupEditor': 'none',
    // A new isolated profile counts as a first-time user; skip the Copilot sign-in onboarding overlay.
    'workbench.welcomePage.experimentalOnboarding': false,
    'locale': 'ko',
    'files.autoSave': 'afterDelay',
    'files.autoSaveDelay': 500,
    'vibe.enabled': true,
    'vibe.codexPath': plan.codex,
    'vibe.dataRoot': plan.root,
    'vibe.codePath': plan.code,
    'vibe.entryFile': plan.entryFile,
    'vibe.previewUrl': plan.previewUrl,
    'chat.commandCenter.enabled': false,
    'task.allowAutomaticTasks': 'on',
    'chat.agentHost.codexAgent.enabled': true,
    'chat.agentHost.enabled': true,
    'chat.agentHost.allowSignedOutWhenUsable': true,
    'chat.agentSessions.showExternal': 'recent',
    'remote.tunnels.access.preventSleep': true
  });

  const wsSettings = workspace.settings && typeof workspace.settings === 'object' && !Array.isArray(workspace.settings) ? workspace.settings : {};
  Object.assign(wsSettings, {
    'vibe.enabled': true,
    'vibe.codexPath': plan.codex,
    'vibe.dataRoot': plan.root,
    'vibe.codePath': plan.code,
    'vibe.entryFile': plan.entryFile,
    'vibe.previewUrl': plan.previewUrl,
    'task.allowAutomaticTasks': 'on',
    'chat.agentHost.codexAgent.enabled': true,
    'chat.agentHost.allowSignedOutWhenUsable': true,
    'chat.agentSessions.showExternal': 'recent'
  });
  if (opts.codexArgs) wsSettings['vibe.codexArgs'] = opts.codexArgs;
  if (plan.previewUrl) {
    const port = new URL(plan.previewUrl).port;
    if (port) {
      for (const scope of [settings, wsSettings]) {
        const attributes = scope['remote.portsAttributes'] && typeof scope['remote.portsAttributes'] === 'object' && !Array.isArray(scope['remote.portsAttributes']) ? scope['remote.portsAttributes'] : {};
        const existing = attributes[port] && typeof attributes[port] === 'object' ? attributes[port] : {};
        attributes[port] = { label: 'Vibe Dev Server', onAutoForward: 'notify', ...existing };
        scope['remote.portsAttributes'] = attributes;
      }
    }
  }
  wsSettings['window.title'] = 'Vibe Coding - ' + '$' + '{activeEditorShort}' + '$' + '{separator}' + '$' + '{rootName}';
  saveJson(settingsPath, settings, backup);
  argv.locale = 'ko';
  saveJson(argvPath, argv, backup);
  const otherFolders = (Array.isArray(workspace.folders) ? workspace.folders : []).filter(folder => folder && folder.path !== plan.project);
  workspace.folders = [{ path: plan.project }, ...otherFolders];
  workspace.settings = wsSettings;
  saveJson(plan.workspace, workspace, backup);

  saveJson(remotePath, { ...remote,
    version: 1, entryFile: plan.entryFile, previewUrl: plan.previewUrl, codexPath: plan.codex, codePath: plan.code, dataRoot: plan.root
  }, backup);

  const packageSource = path.join(skillRoot, 'assets', 'workspace-extension');
  const manifest = JSON.parse(fs.readFileSync(path.join(packageSource, 'extension', 'package.json'), 'utf8'));
  const installedLayout = path.join(extensionsDir, manifest.publisher + '.' + manifest.name + '-' + manifest.version);
  const packagePath = path.join(backup, 'vibe-workspace-' + manifest.version + '.vsix');
  createZip(packageSource, packagePath);
  fs.copyFileSync(packagePath, path.join(plan.root, 'vibe-workspace.vsix'));
  const code = (...args) => deps.run(plan.codeCli, ['--user-data-dir', userDir, '--extensions-dir', extensionsDir, ...args], { timeout: 600000 });
  const installed = code('--list-extensions', '--show-versions').split('\n').map(line => line.trim().toLowerCase()).filter(Boolean);
  for (const id of REQUIRED_EXTENSIONS) {
    if (!installed.some(line => line.startsWith(id.toLowerCase() + '@'))) code('--install-extension', id, '--force');
  }
  const layoutId = (manifest.publisher + '.' + manifest.name + '@' + manifest.version).toLowerCase();
  const sourceExtension = path.join(packageSource, 'extension');
  if (!(installed.includes(layoutId) && extensionMatches(sourceExtension, installedLayout))) code('--install-extension', packagePath, '--force');
  if (!extensionMatches(sourceExtension, installedLayout)) {
    throw new Error('Installed layout extension differs from the skill source. Preserve the existing installation and inspect the VS Code CLI result before creating a launcher. Backup: ' + backup);
  }
  const languagePacksWritten = writeLanguagePacks(userDir, extensionsDir);

  const previousLauncher = createLauncher(plan, { backup, userDir, extensionsDir }, deps);
  if (opts.launch) deps.run('/usr/bin/open', [plan.shortcut]);
  let codeVersion = null;
  try { codeVersion = code('--version').split('\n')[0].trim(); } catch {}
  return {
    ...plan,
    applied: true,
    backup,
    previousLauncher,
    languagePacksWritten,
    codexVersion,
    codeVersion,
    uiVerification: 'PENDING: agent must open the launcher and complete references/verification.md and references/macos.md'
  };
}

function run(file, args, options = {}) {
  try {
    return childProcess.execFileSync(file, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
      timeout: options.timeout || 300000,
      env: options.env || process.env
    });
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message || '').trim().split('\n').slice(-3).join(' ');
    throw new Error(path.basename(file) + ' failed' + (typeof error.status === 'number' ? ' (exit ' + error.status + ')' : '') + (detail ? ': ' + detail : ''));
  }
}

function defaultDeps() {
  return {
    platform: process.platform,
    home: os.homedir(),
    env: process.env,
    run,
    now: () => new Date(),
    skillRoot: path.resolve(__dirname, '..'),
    stdout: text => process.stdout.write(text)
  };
}

function main(argv, deps = defaultDeps()) {
  const opts = parseArgs(argv);
  if (opts.help) { deps.stdout(USAGE + '\n'); return 0; }
  const plan = buildPlan(opts, deps);
  const result = opts.apply ? applySetup(plan, opts, deps) : plan;
  result.runtime = process.versions.electron ? 'electron ' + process.versions.electron : 'node ' + process.versions.node;
  deps.stdout(JSON.stringify(result, null, 2) + '\n');
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('setup-macos: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { applySetup, buildPlan, createZip, crc32, extensionMatches, launcherSource, main, parseArgs, writeLanguagePacks };
