#!/usr/bin/env node
'use strict';
// End-to-end checks for the macOS CI job. Not shipped in the skill.
// Usage: node scripts/ci-macos-verify.cjs <plan|install|launch|clipboard|tunnel> [result.json]
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const platform = require(path.join(ROOT, 'vibe-coding/assets/workspace-extension/extension/platform.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'vibe-coding/assets/workspace-extension/extension/package.json'), 'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const log = (...args) => console.log('[macos-e2e]', ...args);

function checkPlan(plan) {
  assert.equal(plan.platform, 'darwin');
  assert.deepEqual(plan.missing, []);
  assert.ok(plan.root.endsWith('/Library/VibeCoding'), plan.root);
  assert.ok(plan.shortcut.endsWith('.app'), plan.shortcut);
  assert.ok(String(plan.runtime).startsWith('electron'), 'plan step must run on the VS Code bundled runtime, got ' + plan.runtime);
  log('plan ok on', plan.runtime);
}

function checkInstall(result) {
  assert.equal(result.applied, true);
  const userDir = path.join(result.root, 'VSCodeUserData');
  const extensionsDir = path.join(result.root, 'VSCodeExtensions');
  const settings = readJson(path.join(userDir, 'User', 'settings.json'));
  assert.equal(settings['vibe.enabled'], true);
  assert.equal(settings['vibe.codexPath'], result.codex);
  const workspace = readJson(result.workspace);
  assert.equal(workspace.folders[0].path, result.project);
  const listed = execFileSync(result.codeCli, ['--user-data-dir', userDir, '--extensions-dir', extensionsDir, '--list-extensions', '--show-versions'], { encoding: 'utf8' }).toLowerCase();
  for (const id of ['ms-ceintl.vscode-language-pack-ko@', 'ms-vscode.live-server@', (manifest.publisher + '.' + manifest.name + '@' + manifest.version).toLowerCase()]) {
    assert.ok(listed.includes(id), 'extension not installed: ' + id + '\n' + listed);
  }
  const installedDirs = fs.readdirSync(extensionsDir).filter(name => name.startsWith(manifest.publisher + '.' + manifest.name + '-'));
  assert.deepEqual(installedDirs, [manifest.publisher + '.' + manifest.name + '-' + manifest.version], 'exactly one layout extension version');
  for (const file of ['Contents/Info.plist', 'Contents/MacOS/applet', 'Contents/Resources/Scripts/main.scpt']) {
    assert.ok(fs.existsSync(path.join(result.shortcut, file)), 'launcher is missing ' + file);
  }
  const source = execFileSync('/usr/bin/osadecompile', [path.join(result.shortcut, 'Contents/Resources/Scripts/main.scpt')], { encoding: 'utf8' });
  assert.ok(source.includes('/usr/bin/open -n -a'), source);
  assert.ok(source.includes(result.workspace), source);
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', result.shortcut], { stdio: 'inherit' });
  const desktop = fs.readdirSync(path.dirname(result.shortcut)).filter(name => name.endsWith('.app'));
  assert.equal(desktop.length, 1, 'one launcher on the desktop: ' + desktop.join(', '));
  log('install ok:', result.codeVersion, '/', result.codexVersion);
}

async function waitFor(check, timeoutMs, label) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const value = check();
    if (value) return value;
    await sleep(2000);
  }
  throw new Error('timed out waiting for ' + label);
}

async function launch(result) {
  const userDir = path.join(result.root, 'VSCodeUserData');
  const settingsPath = path.join(userDir, 'User', 'settings.json');
  // CI only: the disposable sample is trusted so the extension can run unattended.
  // Real setups never change workspace trust.
  const settings = readJson(settingsPath);
  settings['security.workspace.trust.enabled'] = false;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
  const status = path.join(userDir, 'User', 'globalStorage', manifest.publisher + '.' + manifest.name, 'status.jsonl');
  execFileSync('/usr/bin/open', [result.shortcut]);
  const events = await waitFor(() => {
    if (!fs.existsSync(status)) return null;
    const lines = fs.readFileSync(status, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    return lines.some(event => event.event === 'layout-ready') ? lines : null;
  }, 240000, 'layout-ready in ' + status);
  for (const event of events) log('event', JSON.stringify(event));
  const mainProcess = execFileSync('/bin/ps', ['-axo', 'command'], { encoding: 'utf8' }).split('\n').find(line => line.includes('/Contents/MacOS/') && line.includes(userDir) && !line.includes('Helper'));
  log('vscode main process', mainProcess);
  const languagePacks = path.join(userDir, 'languagepacks.json');
  log('language packs', fs.existsSync(languagePacks) ? Object.keys(readJson(languagePacks)).join(',') : 'missing');
  log('ui language', (events.find(event => event.event === 'activated') || {}).language);
  try {
    const pack = readJson(languagePacks).ko || {};
    const main = pack.translations && pack.translations.vscode;
    log('ko pack', JSON.stringify({ hash: pack.hash, label: pack.label, extensions: (pack.extensions || []).map(e => e.extensionIdentifier && e.extensionIdentifier.id + '@' + e.version), main, mainExists: !!main && fs.existsSync(main) }));
    const clp = path.join(userDir, 'clp');
    log('clp', fs.existsSync(clp) ? execFileSync('/usr/bin/find', [clp, '-maxdepth', '3'], { encoding: 'utf8' }) : 'missing');
    const mainLogs = execFileSync('/usr/bin/find', [path.join(userDir, 'logs'), '-name', 'main.log'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    for (const file of mainLogs) log('main.log', fs.readFileSync(file, 'utf8').split('\n').filter(line => /nls|language|locale|error|warn/i.test(line)).slice(0, 30).join('\n'));
  } catch (error) { log('language diagnostics failed', error.message); }
  const ready = events.find(event => event.event === 'layout-ready');
  assert.equal(ready.mode, 'split');
  assert.deepEqual(ready.folders, [result.project]);
  assert.ok(events.some(event => event.event === 'terminal-created'), 'Codex terminal was created');
  assert.ok(!events.some(event => event.event === 'error'), 'no extension errors');
  const processes = execFileSync('/bin/ps', ['-axo', 'pid,command'], { encoding: 'utf8' });
  assert.ok(processes.includes(userDir), 'VS Code runs with the isolated user data folder');
  await waitFor(() => /codex/i.test(execFileSync('/bin/ps', ['-axo', 'command'], { encoding: 'utf8' }).split('\n').filter(line => !line.includes('ci-macos-verify')).join('\n')), 60000, 'Codex process');
  const checkpoints = path.join(result.project, '.vibe', 'checkpoints.json');
  await waitFor(() => fs.existsSync(checkpoints), 60000, 'time machine checkpoint');
  log('checkpoints', fs.readFileSync(checkpoints, 'utf8').slice(0, 300));
  log('launch ok');
}

function clipboard() {
  const png = path.join(ROOT, 'images', 'og-image.png');
  execFileSync('/usr/bin/osascript', ['-e', 'on run argv', '-e', 'set the clipboard to (read (POSIX file (item 1 of argv)) as \u00abclass PNGf\u00bb)', '-e', 'end run', png]);
  const out = path.join(os.tmpdir(), 'vibe-clipboard-' + process.pid + '.png');
  assert.equal(platform.saveClipboardImage(out), true, 'clipboard image saved');
  assert.deepEqual([...fs.readFileSync(out).subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  execFileSync('/usr/bin/osascript', ['-e', 'set the clipboard to "plain text"']);
  assert.equal(platform.saveClipboardImage(out + '.txt'), false, 'text clipboard is not an image');
  log('clipboard ok');
}

function tunnel(result) {
  const appRoot = path.join(result.code, 'Contents', 'Resources', 'app');
  const cli = platform.findCodeTunnelExecutable({ appRoot });
  assert.equal(cli, path.join(appRoot, 'bin', 'code-tunnel'));
  log('code-tunnel', execFileSync(cli, ['--version'], { encoding: 'utf8' }).trim());
  try { log('tunnel status', execFileSync(cli, ['tunnel', 'status'], { encoding: 'utf8', timeout: 20000 }).trim()); }
  catch (error) { log('tunnel status unavailable without sign-in:', String(error.message).split('\n')[0]); }
  log('tunnel ok');
}

(async () => {
  const [stage, file] = process.argv.slice(2);
  const data = file ? readJson(file) : null;
  if (stage === 'plan') checkPlan(data);
  else if (stage === 'install') checkInstall(data);
  else if (stage === 'launch') await launch(data);
  else if (stage === 'clipboard') clipboard();
  else if (stage === 'tunnel') tunnel(data);
  else throw new Error('unknown stage ' + stage);
})().catch(error => { console.error(error); process.exit(1); });
