#!/usr/bin/env node
'use strict';
// End-to-end checks for the macOS CI job. Not shipped in the skill.
// Usage: node scripts/ci-macos-verify.cjs <plan|install|existing-project|launch|clipboard|tunnel> [result.json] [evidence.json]
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('node:http');
const { execFileSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const platform = require(path.join(ROOT, 'vibe-coding/assets/workspace-extension/extension/platform.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'vibe-coding/assets/workspace-extension/extension/package.json'), 'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
// Independent CI reader: keep quoted strings intact while removing JSONC
// comments and trailing commas. Preservation is also checked against raw text.
const readJsonc = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  .replace(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g, token => token.startsWith('"') ? token : token.replace(/[^\r\n]/g, ' '))
  .replace(/("(?:\\.|[^"\\])*")|,\s*(?=[}\]])/g, (token, quoted) => quoted || token.slice(1)));
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
  const settings = readJsonc(path.join(userDir, 'User', 'settings.json'));
  assert.equal(settings['vibe.enabled'], true);
  assert.equal(settings['vibe.codexPath'], result.codex);
  const workspace = readJsonc(result.workspace);
  assert.equal(workspace.folders[0].path, result.project);
  const listed = execFileSync(result.codeCli, ['--user-data-dir', userDir, '--extensions-dir', extensionsDir, '--list-extensions', '--show-versions'], { encoding: 'utf8' }).toLowerCase();
  for (const id of ['ms-ceintl.vscode-language-pack-ko@', 'ms-vscode.live-server@', (manifest.publisher + '.' + manifest.name + '@' + manifest.version).toLowerCase()]) {
    assert.ok(listed.includes(id), 'extension not installed: ' + id + '\n' + listed);
  }
  const installedDirs = fs.readdirSync(extensionsDir).filter(name => name.startsWith(manifest.publisher + '.' + manifest.name + '-'));
  assert.deepEqual(installedDirs, [manifest.publisher + '.' + manifest.name + '-' + manifest.version], 'exactly one layout extension version');
  // VS Code picks the display language before its first window opens, so the
  // setup must register the Korean pack itself (see writeLanguagePacks).
  const languagePacks = readJson(path.join(userDir, 'languagepacks.json'));
  const ko = languagePacks.ko || {};
  assert.match(String(ko.hash), /^[0-9a-f]{32}$/, 'Korean language pack registered before the first launch');
  assert.ok(ko.translations && ko.translations.vscode && fs.existsSync(ko.translations.vscode), 'Korean translation file exists: ' + JSON.stringify(ko.translations));
  log('languagepacks.json ko', ko.hash, result.languagePacksWritten ? '(written now)' : '(already up to date)');
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

function fixtureReady(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('fixture server did not report its port')), 30000);
    const onError = error => finish(error);
    const onExit = (code, signal) => finish(new Error('fixture server exited before ready: ' + code + '/' + signal));
    const onMessage = message => {
      if (message && Number.isInteger(message.port) && message.port > 0 && message.port <= 65535) finish(null, message);
    };
    function finish(error, message) {
      clearTimeout(timer);
      child.removeListener('error', onError);
      child.removeListener('exit', onExit);
      child.removeListener('message', onMessage);
      if (error) reject(error); else resolve(message);
    }
    child.once('error', onError);
    child.once('exit', onExit);
    child.on('message', onMessage);
  });
}

function getRoute(url) {
  return new Promise((resolve, reject) => {
    // Setup runs synchronous CLI commands for seconds; do not reuse a fixture
    // keep-alive socket that the server closed while this process was blocked.
    const request = http.get(url, { agent: false }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.setTimeout(10000, () => request.destroy(new Error('fixture HTTP request timed out')));
    request.on('error', reject);
  });
}

async function stopFixture(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('owned fixture process did not exit')), 15000);
    const force = setTimeout(() => child.kill('SIGKILL'), 10000);
    function finish(error) {
      clearTimeout(timeout);
      clearTimeout(force);
      child.removeListener('exit', onExit);
      if (error) reject(error); else resolve();
    }
    const onExit = () => finish();
    child.once('exit', onExit);
    child.kill('SIGTERM');
  });
}

function checkBackups(result, snapshots) {
  return Object.entries(snapshots).map(([file, contents]) => {
    const matches = fs.readdirSync(result.backup).filter(name => name.endsWith('-' + path.basename(file)));
    assert.equal(matches.length, 1, 'one backup of ' + file);
    const backup = path.join(result.backup, matches[0]);
    assert.equal(fs.readFileSync(backup, 'utf8'), contents, 'backup keeps exact pre-apply bytes: ' + file);
    return backup;
  });
}

async function existingProject(installed, evidenceFile) {
  const evidence = { stage: 'existing-project', platform: process.platform, passed: false, commands: [] };
  let child;
  try {
    assert.equal(process.platform, 'darwin', 'existing-project requires an actual macOS runner');
    assert.equal(installed.applied, true, 'use the official installation from the sample apply result');
    const setup = require(path.join(ROOT, 'vibe-coding/scripts/setup-macos.cjs'));
    const base = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'vibe-existing-'));
    const project = path.join(base, '기존 프로젝트');
    const dataRoot = path.join(base, '사용자 데이터');
    const desktop = path.join(base, '실행 앱');
    const settingsPath = path.join(dataRoot, 'VSCodeUserData', 'User', 'settings.json');
    const argvPath = path.join(dataRoot, 'VSCodeUserData', 'argv.json');
    const remotePath = path.join(project, '.vibe', 'remote-config.json');
    const marker = 'existing-project-' + path.basename(base);
    const html = '<!doctype html><meta charset="utf-8"><h1>기존 프로젝트 ' + marker + '</h1>\n';
    const pkg = JSON.stringify({ name: 'mac-ci-existing-project', private: true, scripts: { dev: 'node dev-server.cjs' } }, null, 2) + '\n';
    for (const dir of [project, desktop, path.dirname(settingsPath), path.dirname(remotePath)]) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(project, 'index.html'), html);
    fs.writeFileSync(path.join(project, 'package.json'), pkg);
    fs.writeFileSync(path.join(project, 'dev-server.cjs'), [
      "'use strict';",
      "const http = require('node:http');",
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const server = http.createServer((req, res) => {",
      "  if (req.url !== '/preview/index.html') { res.writeHead(404); res.end('missing'); return; }",
      "  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });",
      "  res.end(fs.readFileSync(path.join(__dirname, 'index.html')));",
      "});",
      "server.listen(0, '127.0.0.1', () => {",
      "  const port = server.address().port;",
      "  if (process.send) process.send({ port, pid: process.pid });",
      "  console.log('http://127.0.0.1:' + port + '/preview/index.html');",
      "});",
      "process.on('SIGTERM', () => server.close(() => process.exit(0)));",
      ''
    ].join('\n'));
    evidence.fixture = { base, project, root: dataRoot, desktop };
    child = spawn(process.execPath, ['dev-server.cjs'], { cwd: project, shell: false, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    evidence.serverOutput = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { evidence.serverOutput += chunk.toString(); });
    const ready = await fixtureReady(child);
    assert.equal(ready.pid, child.pid, 'ready message belongs to the owned Node process');
    const previewUrl = 'http://127.0.0.1:' + ready.port + '/preview/index.html';
    evidence.server = { pid: child.pid, previewUrl, stopped: false };
    const beforeSetup = await getRoute(previewUrl);
    assert.equal(beforeSetup.status, 200);
    assert.equal(beforeSetup.body, html, 'verify the localhost preview URL before supplying it to setup');
    evidence.httpBeforeSetup = { previewUrl, status: beforeSetup.status, marker };
    const userPort = String(ready.port === 8080 ? 8081 : 8080);
    const workspacePort = String(ready.port === 9000 ? 9001 : 9000);
    const userAttributes = {
      [userPort]: { label: '기존 API', protocol: 'https', onAutoForward: 'silent' },
      [ready.port]: { label: '사용자 미리보기', protocol: 'http', requireLocalPort: true, onAutoForward: 'silent' }
    };
    const workspaceAttributes = {
      [workspacePort]: { label: '작업 공간 API', protocol: 'https' },
      [ready.port]: { label: '작업 공간 미리보기', protocol: 'http', onAutoForward: 'openBrowser' }
    };
    const settingsText = '{\n // existing settings comment: 기존 설정\n "editor.fontSize": 19,\n "vibe.ciSentinel": "https://example.invalid/a//b/*keep*/",\n "remote.portsAttributes": ' + JSON.stringify(userAttributes) + ',\n}\n';
    const argvText = '{\n /* existing argv comment: 실행 설정 */\n "disable-hardware-acceleration": true,\n "locale": "en",\n}\n';
    const sentinel = { note: 'keep existing remote config', nested: ['한글', marker] };
    fs.writeFileSync(settingsPath, settingsText);
    fs.writeFileSync(argvPath, argvText);
    fs.writeFileSync(remotePath, JSON.stringify({ version: 1, previewUrl, ciSentinel: sentinel }, null, 2) + '\n');
    // No command doubles: VS Code, Codex, osacompile and codesign really execute.
    const deps = {
      platform: process.platform, home: os.homedir(), env: process.env,
      now: () => new Date(), skillRoot: path.join(ROOT, 'vibe-coding'),
      run(file, args, options = {}) {
        const command = { file, args };
        evidence.commands.push(command);
        try {
          const output = execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024, timeout: 300000, ...options });
          command.passed = true;
          return output;
        } catch (error) {
          command.passed = false;
          command.error = String(error.stderr || error.message);
          throw error;
        }
      }
    };
    const opts = setup.parseArgs(['--project', project, '--root', dataRoot, '--desktop', desktop,
      '--code-app', installed.code, '--codex', installed.codex, '--preview-url', previewUrl, '--apply']);
    const plan = setup.buildPlan(opts, deps);
    evidence.plan = plan;
    assert.equal(plan.root, dataRoot);
    assert.equal(plan.project, project);
    assert.equal(plan.previewUrl, previewUrl);
    assert.equal(plan.code, installed.code);
    assert.equal(plan.codex, installed.codex);
    assert.deepEqual(plan.missing, []);
    assert.equal(path.dirname(plan.workspace), path.join(plan.workspaceBase, 'Workspaces'));
    assert.match(plan.workspace, /^\/Users\/Shared\/VibeCoding-[A-Za-z0-9_-]+\/Workspaces\/vibe-[a-f0-9]+\.code-workspace$/);
    assert.match(plan.workspace, /^[\x21-\x7e]+$/, 'phone workspace path contains only ASCII and no spaces');
    assert.ok(!plan.workspace.startsWith(dataRoot + path.sep), 'workspace is separate from the selected data root');
    assert.equal(fs.existsSync(plan.workspace), false, 'planning does not create a workspace');
    fs.mkdirSync(path.dirname(plan.workspace), { recursive: true });
    fs.writeFileSync(plan.workspace, '{\n // existing workspace comment\n "settings": {"remote.portsAttributes": ' + JSON.stringify(workspaceAttributes) + '},\n}\n');
    const files = [settingsPath, argvPath, plan.workspace, remotePath];
    const snapshot = () => Object.fromEntries(files.map(file => [file, fs.readFileSync(file, 'utf8')]));
    const checkPreserved = result => {
      checkInstall(result);
      const settings = readJsonc(settingsPath);
      const argv = readJsonc(argvPath);
      const workspace = readJsonc(result.workspace);
      const remote = readJsonc(remotePath);
      assert.equal(settings['editor.fontSize'], 19);
      assert.equal(settings['vibe.ciSentinel'], 'https://example.invalid/a//b/*keep*/');
      assert.equal(settings['vibe.dataRoot'], result.root);
      assert.equal(settings['vibe.codePath'], installed.code);
      assert.equal(platform.vibeRoot({ platform: 'darwin', dataRoot: result.root }), result.root, 'extension discovers the selected data root');
      assert.equal(argv['disable-hardware-acceleration'], true);
      assert.equal(argv.locale, 'ko');
      assert.ok(fs.readFileSync(settingsPath, 'utf8').includes('// existing settings comment: 기존 설정'));
      assert.ok(fs.readFileSync(argvPath, 'utf8').includes('/* existing argv comment: 실행 설정 */'));
      assert.ok(fs.readFileSync(result.workspace, 'utf8').includes('// existing workspace comment'));
      assert.deepEqual(settings['remote.portsAttributes'], userAttributes, 'user port values and scope survive');
      assert.deepEqual(workspace.settings['remote.portsAttributes'], workspaceAttributes, 'workspace port values and scope survive');
      assert.equal(workspace.settings['vibe.previewUrl'], previewUrl);
      assert.deepEqual(remote.ciSentinel, sentinel);
      assert.equal(remote.previewUrl, previewUrl);
      assert.equal(remote.codexPath, installed.codex);
      assert.equal(remote.codePath, installed.code);
      assert.equal(remote.dataRoot, result.root);
      assert.equal(fs.readFileSync(path.join(project, 'index.html'), 'utf8'), html);
      assert.equal(fs.readFileSync(path.join(project, 'package.json'), 'utf8'), pkg);
      const tasks = readJsonc(path.join(project, '.vscode', 'tasks.json'));
      assert.ok(tasks.tasks.some(task => task.command === 'npm run dev' && task.runOptions.runOn === 'folderOpen'), 'existing dev script gets an automatic task');
    };
    const before = snapshot();
    evidence.before = before;
    const result = setup.applySetup(plan, opts, deps);
    evidence.apply = result;
    checkPreserved(result);
    evidence.firstBackups = checkBackups(result, before);
    const beforeReapply = snapshot();
    const again = setup.applySetup(setup.buildPlan(opts, deps), opts, deps);
    evidence.reapply = again;
    assert.equal(again.workspace, result.workspace);
    assert.notEqual(again.backup, result.backup, 'reapply gets a separate backup directory');
    checkPreserved(again);
    evidence.after = snapshot();
    evidence.reapplyBackups = checkBackups(again, beforeReapply);
    assert.ok(again.previousLauncher && fs.existsSync(again.previousLauncher), 'previous launcher is backed up');
    assert.ok(evidence.commands.every(command => command.passed === true), 'all real setup commands succeeded; see evidence.commands');
    const response = await getRoute(previewUrl);
    assert.equal(response.status, 200);
    assert.equal(response.body, html, 'HTTP route serves the existing entry file');
    const missing = await getRoute(new URL('/missing', previewUrl));
    assert.equal(missing.status, 404);
    assert.equal(child.exitCode, null, 'owned server stayed running through both real applies');
    assert.equal(child.signalCode, null);
    evidence.http = { previewUrl, status: response.status, marker, missingStatus: missing.status };
  } catch (error) {
    evidence.error = error.stack || String(error);
    throw error;
  } finally {
    try {
      // Only this ChildProcess is signalled; never kill by name or port.
      await stopFixture(child);
      if (evidence.server) {
        evidence.server.stopped = true;
        evidence.server.exitCode = child.exitCode;
        evidence.server.signal = child.signalCode;
      }
      evidence.passed = !evidence.error;
    } catch (error) {
      evidence.cleanupError = error.stack || String(error);
      throw error;
    } finally {
      fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2) + '\n');
      log('existing-project evidence:', evidenceFile);
    }
  }
  log('existing project apply, reapply, JSONC preservation, backups and local HTTP route ok');
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
  const languagePacksPath = path.join(userDir, 'languagepacks.json');
  const hashBefore = (readJson(languagePacksPath).ko || {}).hash;
  // The setup only used the VS Code CLI, so this is the profile's first window.
  log('first window of the isolated profile:', !fs.existsSync(path.join(userDir, 'clp')));
  execFileSync('/usr/bin/open', [result.shortcut]);
  const events = await waitFor(() => {
    if (!fs.existsSync(status)) return null;
    const lines = fs.readFileSync(status, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    return lines.some(event => event.event === 'layout-ready') ? lines : null;
  }, 240000, 'layout-ready in ' + status);
  for (const event of events) log('event', JSON.stringify(event));
  const activated = events.find(event => event.event === 'activated') || {};
  assert.equal(activated.language, 'ko', 'the first window shows the Korean UI');
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
  // Informational: VS Code rewrites this file later with its own hash. A
  // different value only renames VS Code's translation cache folder.
  log('ko language pack hash, setup / VS Code:', hashBefore, (readJson(languagePacksPath).ko || {}).hash);
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
  const help = execFileSync(cli, ['tunnel', '--help'], { encoding: 'utf8', timeout: 20000 });
  assert.match(help, /\bstatus\b/, 'bundled tunnel CLI exposes its status command');
  log('bundled tunnel CLI version/help ok; authentication and tunnel connectivity are not tested');
}

(async () => {
  const [stage, file, evidenceFile] = process.argv.slice(2);
  const data = file ? readJson(file) : null;
  if (stage === 'plan') checkPlan(data);
  else if (stage === 'install') checkInstall(data);
  else if (stage === 'existing-project') await existingProject(data, evidenceFile || path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'existing-project.json'));
  else if (stage === 'launch') await launch(data);
  else if (stage === 'clipboard') clipboard();
  else if (stage === 'tunnel') tunnel(data);
  else throw new Error('unknown stage ' + stage);
})().catch(error => { console.error(error); process.exit(1); });
