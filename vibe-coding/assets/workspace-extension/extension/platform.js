'use strict';
// Operating-system details shared by the Vibe Coding extension modules.
// This file must not require 'vscode' so it stays testable outside VS Code.
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

let appRootHint = null;
let dataRootHint = null;
let codeAppHint = null;

function setWorkspacePaths(dataRoot, codeApp) {
  dataRootHint = typeof dataRoot === 'string' && path.isAbsolute(dataRoot) ? dataRoot : null;
  codeAppHint = typeof codeApp === 'string' && codeApp ? codeApp : null;
}

function currentPlatform(options = {}) {
  return options.platform || process.platform;
}

function pathFor(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function homeDir(options = {}) {
  return options.home || os.homedir();
}

function isFile(candidate) {
  try { return !!candidate && fs.statSync(candidate).isFile(); } catch { return false; }
}
function isExecutable(candidate) {
  try { fs.accessSync(candidate, fs.constants.X_OK); return isFile(candidate); } catch { return false; }
}

// VS Code reports its bundled application folder (vscode.env.appRoot).
// Bundled CLI tools are located relative to it on every platform.
function setAppRoot(root) {
  appRootHint = typeof root === 'string' && root ? root : null;
}

function vibeRoot(options = {}) {
  const platform = currentPlatform(options);
  const env = options.env || process.env;
  const home = homeDir(options);
  const p = pathFor(platform);
  const configured = options.dataRoot || (options.env ? null : dataRootHint);
  if (typeof configured === 'string' && p.isAbsolute(configured)) return p.normalize(configured);
  if (platform === 'win32') return p.join(env.LOCALAPPDATA || p.join(home, 'AppData', 'Local'), 'VibeCoding');
  // No spaces: tunnel URLs and launcher arguments embed this path.
  if (platform === 'darwin') return p.join(home, 'Library', 'VibeCoding');
  return p.join(env.XDG_DATA_HOME || p.join(home, '.local', 'share'), 'VibeCoding');
}

// Searches PATH without starting a shell. On Windows only PATHEXT
// extensions are considered, because extensionless npm shims are not
// executable there.
function findOnPath(names, options = {}) {
  const platform = currentPlatform(options);
  const env = options.env || process.env;
  const exists = options.exists || (platform === 'win32' ? isFile : isExecutable);
  const p = pathFor(platform);
  const dirs = String(env.PATH || env.Path || '').split(platform === 'win32' ? ';' : ':').map(d => d.trim().replace(/^"|"$/g, '')).filter(Boolean);
  const extensions = platform === 'win32'
    ? String(env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').map(e => e.trim().toLowerCase()).filter(Boolean)
    : [''];
  for (const dir of dirs) {
    for (const name of [].concat(names)) {
      const hasExtension = platform === 'win32' && /\.[a-z0-9]+$/i.test(name);
      for (const ext of hasExtension ? [''] : extensions) {
        const candidate = p.join(dir, name + ext);
        if (exists(candidate)) return candidate;
      }
    }
  }
  return null;
}

function macVsCodeApps(options = {}) {
  const home = homeDir(options);
  const apps = [];
  const configured = options.codeApp || (options.env ? null : codeAppHint);
  if (configured) apps.push(configured);
  const shellCommand = findOnPath(['code'], { ...options, platform: 'darwin' });
  if (shellCommand) {
    try {
      const real = (options.realpath || fs.realpathSync)(shellCommand);
      const match = String(real).match(/^(.*?\.app)\/Contents\/Resources\/app\/bin\/code$/);
      if (match) apps.push(match[1]);
    } catch {}
  }
  apps.push('/Applications/Visual Studio Code.app', path.posix.join(home, 'Applications', 'Visual Studio Code.app'));
  return [...new Set(apps)];
}

function codeTunnelCandidates(options = {}) {
  const platform = currentPlatform(options);
  const env = options.env || process.env;
  const appRoot = options.appRoot !== undefined ? options.appRoot : appRootHint;
  const list = [];
  if (platform === 'win32') {
    const p = path.win32;
    const localAppData = env.LOCALAPPDATA || '';
    const programFiles = env.ProgramFiles || '';
    const programFilesX86 = env['ProgramFiles(x86)'] || '';
    if (localAppData) list.push(p.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code-tunnel.exe'));
    if (programFiles) list.push(p.join(programFiles, 'Microsoft VS Code', 'bin', 'code-tunnel.exe'));
    if (programFilesX86) list.push(p.join(programFilesX86, 'Microsoft VS Code', 'bin', 'code-tunnel.exe'));
    if (localAppData) list.push(p.join(localAppData, 'Programs', 'Microsoft VS Code', 'code-tunnel.exe'));
    if (programFiles) list.push(p.join(programFiles, 'Microsoft VS Code', 'code-tunnel.exe'));
    if (appRoot) list.push(p.join(appRoot, '..', '..', 'bin', 'code-tunnel.exe'));
  } else if (platform === 'darwin') {
    if (appRoot) list.push(path.posix.join(appRoot, 'bin', 'code-tunnel'));
    for (const app of macVsCodeApps(options)) list.push(path.posix.join(app, 'Contents', 'Resources', 'app', 'bin', 'code-tunnel'));
  } else {
    if (appRoot) list.push(path.posix.join(appRoot, 'bin', 'code-tunnel'));
    list.push('/usr/share/code/bin/code-tunnel');
  }
  const onPath = findOnPath(['code-tunnel'], options);
  if (onPath) list.push(onPath);
  return [...new Set(list)];
}

function findCodeTunnelExecutable(options = {}) {
  const exists = options.exists || (currentPlatform(options) === 'win32' ? isFile : isExecutable);
  return codeTunnelCandidates(options).find(candidate => exists(candidate)) || null;
}

function codeCliCandidates(options = {}) {
  const platform = currentPlatform(options);
  const env = options.env || process.env;
  if (platform === 'win32') {
    const p = path.win32;
    return [
      env.LOCALAPPDATA && p.join(env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
      env.ProgramFiles && p.join(env.ProgramFiles, 'Microsoft VS Code', 'bin', 'code.cmd')
    ].filter(Boolean);
  }
  if (platform === 'darwin') return macVsCodeApps(options).map(app => path.posix.join(app, 'Contents', 'Resources', 'app', 'bin', 'code'));
  return ['/usr/share/code/bin/code'];
}

function codexCandidates(options = {}) {
  const platform = currentPlatform(options);
  const env = options.env || process.env;
  const home = homeDir(options);
  const list = [];
  const onPath = findOnPath(['codex'], options);
  if (onPath) list.push(onPath);
  if (platform === 'win32') {
    const p = path.win32;
    const localAppData = env.LOCALAPPDATA || p.join(home, 'AppData', 'Local');
    const binDir = p.join(localAppData, 'OpenAI', 'Codex', 'bin');
    try { for (const dir of fs.readdirSync(binDir)) list.push(p.join(binDir, dir, 'codex.exe')); } catch {}
    list.push(p.join(env.APPDATA || p.join(home, 'AppData', 'Roaming'), 'npm', 'codex.cmd'));
    return list;
  }
  const p = path.posix;
  list.push('/opt/homebrew/bin/codex', '/usr/local/bin/codex', p.join(home, '.local', 'bin', 'codex'), p.join(home, '.npm-global', 'bin', 'codex'), p.join(home, '.volta', 'bin', 'codex'), p.join(home, '.bun', 'bin', 'codex'));
  const nvmRoot = p.join(home, '.nvm', 'versions', 'node');
  try {
    const versions = fs.readdirSync(nvmRoot).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) list.push(p.join(nvmRoot, version, 'bin', 'codex'));
  } catch {}
  return [...new Set(list)];
}

function findCodexExecutable(options = {}) {
  const exists = options.exists || (currentPlatform(options) === 'win32' ? isFile : isExecutable);
  return codexCandidates(options).find(candidate => exists(candidate)) || null;
}

// Codex can be an npm script that needs node from the same folder. VS Code
// usually inherits the login shell PATH on macOS; add missing fallbacks only.
function codexTerminalEnv(executable, options = {}) {
  const platform = currentPlatform(options);
  const env = options.env || process.env;
  const result = { CODEX_CALLER: 'vscode', LANG: 'ko_KR.UTF-8', PYTHONIOENCODING: 'utf-8' };
  if (platform !== 'win32') {
    const current = String(env.PATH || '').split(':').filter(Boolean);
    const extra = [executable ? path.posix.dirname(executable) : null, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].filter(Boolean);
    result.PATH = [...new Set([...current, ...extra])].join(':');
  }
  return result;
}

function remoteServerNode(serverDir, options = {}) {
  const platform = currentPlatform(options);
  return pathFor(platform).join(serverDir, platform === 'win32' ? 'node.exe' : 'node');
}

const MAC_CLIPBOARD_SCRIPT = [
  'on run argv',
  'set outPath to item 1 of argv',
  'try',
  'set pngData to the clipboard as \u00abclass PNGf\u00bb',
  'on error',
  'return "EMPTY"',
  'end try',
  'set fileRef to open for access (POSIX file outPath) with write permission',
  'try',
  'set eof fileRef to 0',
  'write pngData to fileRef',
  'close access fileRef',
  'on error errText',
  'try',
  'close access fileRef',
  'end try',
  'error errText',
  'end try',
  'return "OK"',
  'end run'
];

// Saves the clipboard image as PNG. Returns false when the clipboard holds no image.
function saveClipboardImage(destPath, options = {}) {
  const platform = currentPlatform(options);
  const run = options.execFileSync || childProcess.execFileSync;
  if (platform === 'win32') {
    const script = "Add-Type -AssemblyName System.Windows.Forms; $img = [System.Windows.Forms.Clipboard]::GetImage(); if ($img) { $img.Save('" + destPath.replace(/'/g, "''") + "', [System.Drawing.Imaging.ImageFormat]::Png); Write-Output 'OK' } else { Write-Output 'EMPTY' }";
    return String(run('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { encoding: 'utf8', timeout: 5000, windowsHide: true })).includes('OK');
  }
  if (platform === 'darwin') {
    const args = [];
    for (const line of MAC_CLIPBOARD_SCRIPT) args.push('-e', line);
    args.push(destPath);
    return String(run('/usr/bin/osascript', args, { encoding: 'utf8', timeout: 5000 })).trim() === 'OK';
  }
  return false;
}

// On macOS /usr/bin/git is a stub that opens an installer dialog when the
// Command Line Tools are missing. Check first so a background checkpoint
// does not trigger that dialog repeatedly.
function gitUnavailableReason(options = {}) {
  const platform = currentPlatform(options);
  if (platform !== 'darwin') return null;
  const gitPath = findOnPath(['git'], options);
  if (!gitPath) return 'missing';
  if (gitPath !== '/usr/bin/git') return null;
  const run = options.execFileSync || childProcess.execFileSync;
  try {
    run('/usr/bin/xcode-select', ['-p'], { stdio: 'ignore', timeout: 5000 });
    return null;
  } catch {
    return 'command-line-tools';
  }
}

// Paths from VS Code, Codex logs and Finder may differ in Unicode form
// (macOS often stores Korean names decomposed) and in letter case.
function comparablePath(value, options = {}) {
  const platform = currentPlatform(options);
  let result = pathFor(platform).normalize(String(value || '')).normalize('NFC').replace(/[\\/]+$/, '');
  if (platform === 'win32') result = result.toLowerCase();
  return result;
}

module.exports = {
  codeCliCandidates,
  codeTunnelCandidates,
  codexCandidates,
  codexTerminalEnv,
  comparablePath,
  currentPlatform,
  findCodeTunnelExecutable,
  findCodexExecutable,
  findOnPath,
  gitUnavailableReason,
  macVsCodeApps,
  remoteServerNode,
  saveClipboardImage,
  setAppRoot,
  setWorkspacePaths,
  vibeRoot
};
