'use strict';
// The macOS setup is exercised on every host with injected commands; the real
// VS Code, osacompile and launcher run in the macOS CI job.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const setup = require('../vibe-coding/scripts/setup-macos.cjs');

const SKILL_ROOT = path.resolve(__dirname, '../vibe-coding');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, 'assets/workspace-extension/extension/package.json'), 'utf8'));
const LAYOUT_ID = MANIFEST.publisher + '.' + MANIFEST.name;

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-mac-'));
  const home = path.join(base, 'home');
  const app = path.join(base, 'Applications', 'Visual Studio Code.app');
  fs.mkdirSync(path.join(app, 'Contents', 'Resources', 'app', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(app, 'Contents', 'Resources', 'app', 'bin', 'code'), '#!/bin/sh\n');
  fs.writeFileSync(path.join(app, 'Contents', 'Resources', 'Code.icns'), 'vscode-icon');
  const codex = path.join(base, 'bin', 'codex');
  fs.mkdirSync(path.dirname(codex), { recursive: true });
  fs.writeFileSync(codex, '#!/bin/sh\n');
  const desktop = path.join(home, 'Desktop');
  fs.mkdirSync(desktop, { recursive: true });
  return { base, home, app, codex, desktop };
}

// Simulates the macOS commands the setup calls and records them.
function fakeDeps(f) {
  const deps = {
    platform: 'darwin',
    home: f.home,
    env: { PATH: '' },
    now: () => new Date(2026, 9, 9, 10, 0, 0, 0),
    skillRoot: SKILL_ROOT,
    stdout: () => {},
    installed: [],
    calls: [],
    run(file, args) {
      deps.calls.push({ file, args });
      const name = path.basename(file);
      if (file === f.codex) return 'codex-cli 9.9.9\n';
      if (name === 'xcode-select') return '/Library/Developer/CommandLineTools\n';
      if (name === 'mdfind' || name === 'codesign' || name === 'open') return '';
      if (name === 'code') {
        if (args.includes('--list-extensions')) return deps.installed.join('\n');
        if (args.includes('--version')) return '1.200.0\ncommit\narm64\n';
        const target = args[args.indexOf('--install-extension') + 1];
        if (target.endsWith('.vsix')) {
          const extensionsDir = args[args.indexOf('--extensions-dir') + 1];
          const dest = path.join(extensionsDir, LAYOUT_ID + '-' + MANIFEST.version);
          fs.cpSync(path.join(SKILL_ROOT, 'assets/workspace-extension/extension'), dest, { recursive: true });
          fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify({ ...MANIFEST, __metadata: { installedTimestamp: 1 } }));
          deps.installed.push(LAYOUT_ID + '@' + MANIFEST.version);
        } else {
          deps.installed.push(target.toLowerCase() + '@1.0.0');
        }
        return '';
      }
      if (name === 'osacompile') {
        const out = args[args.indexOf('-o') + 1];
        fs.mkdirSync(path.join(out, 'Contents', 'Resources', 'Scripts'), { recursive: true });
        fs.writeFileSync(path.join(out, 'Contents', 'Resources', 'applet.icns'), 'applet-icon');
        fs.copyFileSync(args[args.length - 1], path.join(out, 'Contents', 'Resources', 'Scripts', 'main.applescript'));
        return '';
      }
      throw new Error('unexpected command ' + file);
    }
  };
  return deps;
}

function baseArgs(f) {
  return ['--create-sample', '--code-app', f.app, '--codex', f.codex, '--desktop', f.desktop];
}

test('macOS plan uses ~/Library/VibeCoding and a desktop .app launcher without writing files', () => {
  const f = fixture();
  const plan = setup.buildPlan(setup.parseArgs(baseArgs(f)), fakeDeps(f));
  assert.equal(plan.platform, 'darwin');
  assert.equal(plan.root, path.join(f.home, 'Library', 'VibeCoding'));
  assert.equal(plan.project, path.join(plan.root, 'SampleProject'));
  assert.equal(plan.codeCli, path.join(f.app, 'Contents', 'Resources', 'app', 'bin', 'code'));
  assert.match(path.basename(plan.shortcut), /^Vibe Coding - SampleProject-[0-9a-f]{10}\.app$/);
  assert.match(path.basename(plan.workspace), /^vibe-[0-9a-f]{10}\.code-workspace$/);
  assert.deepEqual(plan.missing, []);
  assert.equal(fs.existsSync(plan.root), false, 'planning must not create files');
});

test('macOS setup refuses other operating systems and unsafe inputs', () => {
  const f = fixture();
  assert.throws(() => setup.buildPlan(setup.parseArgs(baseArgs(f)), { ...fakeDeps(f), platform: 'win32' }), /macOS only/);
  assert.throws(() => setup.buildPlan(setup.parseArgs([...baseArgs(f), '--root', path.join(f.base, 'with space')]), fakeDeps(f)), /without spaces/);
  const project = path.join(f.base, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'index.html'), '<h1>keep</h1>');
  const args = ['--project', project, '--code-app', f.app, '--codex', f.codex, '--desktop', f.desktop];
  assert.throws(() => setup.buildPlan(setup.parseArgs([...args, '--entry', '../outside.html']), fakeDeps(f)), /within the project/);
  assert.throws(() => setup.buildPlan(setup.parseArgs([...args, '--preview-url', 'http://example.com:3000']), fakeDeps(f)), /localhost/);
  assert.throws(() => setup.parseArgs(['--unknown']), /Unknown option/);
});

test('missing VS Code and Codex are reported instead of applied', () => {
  const f = fixture();
  const plan = setup.buildPlan(setup.parseArgs(['--create-sample', '--code-app', path.join(f.base, 'none.app'), '--codex', path.join(f.base, 'none'), '--desktop', f.desktop]), fakeDeps(f));
  assert.equal(plan.missing.length, 2);
  assert.throws(() => setup.applySetup(plan, {}, fakeDeps(f)), /prerequisites/);
});

test('apply merges isolated settings, installs the packaged extension and creates the launcher', () => {
  const f = fixture();
  const deps = fakeDeps(f);
  const root = path.join(f.home, 'Library', 'VibeCoding');
  const settingsPath = path.join(root, 'VSCodeUserData', 'User', 'settings.json');
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify({ 'editor.fontSize': 18, 'terminal.integrated.commandsToSkipShell': ['-vibe.toggleTerminal', 'custom.command'] }));
  const opts = setup.parseArgs([...baseArgs(f), '--apply', '--codex-arg', '--no-daemon']);
  const result = setup.applySetup(setup.buildPlan(opts, deps), opts, deps);

  assert.equal(result.applied, true);
  assert.equal(result.codexVersion, 'codex-cli 9.9.9');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(settings['editor.fontSize'], 18, 'unrelated settings stay');
  assert.equal(settings['vibe.codexPath'], f.codex);
  assert.ok(settings['terminal.integrated.commandsToSkipShell'].includes('custom.command'));
  assert.ok(settings['terminal.integrated.commandsToSkipShell'].includes('vibe.pasteImage'));
  assert.ok(!settings['terminal.integrated.commandsToSkipShell'].includes('-vibe.toggleTerminal'));
  assert.equal(settings['terminal.integrated.profiles.windows'], undefined);
  assert.equal(fs.existsSync(path.join(root, 'VSCodeUserData', 'User', 'keybindings.json')), false, 'macOS keeps native Cmd+C / Cmd+V');
  assert.ok(fs.readdirSync(result.backup).some(name => name.endsWith('-settings.json')), 'previous settings are backed up');

  const workspace = JSON.parse(fs.readFileSync(result.workspace, 'utf8'));
  assert.deepEqual(workspace.folders, [{ path: result.project }]);
  assert.deepEqual(workspace.settings['vibe.codexArgs'], ['--no-daemon']);
  assert.equal(workspace.settings['window.title'], 'Vibe Coding - ' + '$' + '{activeEditorShort}' + '$' + '{separator}' + '$' + '{rootName}');
  assert.ok(fs.existsSync(path.join(result.project, 'index.html')), 'sample entry file is created');
  const remote = JSON.parse(fs.readFileSync(path.join(result.project, '.vibe', 'remote-config.json'), 'utf8'));
  assert.equal(remote.codexPath, f.codex);
  assert.equal(fs.readFileSync(path.join(root, 'vibe-workspace.vsix')).subarray(0, 2).toString(), 'PK');

  const script = fs.readFileSync(path.join(result.shortcut, 'Contents', 'Resources', 'Scripts', 'main.applescript'), 'utf8');
  assert.match(script, /\/usr\/bin\/open -n -a /);
  assert.ok(script.includes('quoted form of ' + JSON.stringify(result.workspace)));
  assert.ok(script.includes('quoted form of ' + JSON.stringify(f.app)));
  assert.equal(fs.readFileSync(path.join(result.shortcut, 'Contents', 'Resources', 'applet.icns'), 'utf8'), 'vscode-icon');
  assert.ok(deps.calls.some(call => path.basename(call.file) === 'codesign'));

  // Running again reuses the verified installation and keeps the old launcher in the backup.
  deps.calls.length = 0;
  const again = setup.applySetup(setup.buildPlan(opts, deps), opts, deps);
  assert.ok(!deps.calls.some(call => call.args.includes('--install-extension')), 'no reinstall when content matches');
  assert.ok(again.previousLauncher && fs.existsSync(again.previousLauncher));
  assert.ok(fs.existsSync(again.shortcut));
});

test('launcher source escapes AppleScript strings', () => {
  const source = setup.launcherSource({ appPath: '/Apps/My "VS" Code.app', userDir: '/u', extensionsDir: '/e', workspacePath: '/w/vibe.code-workspace' });
  assert.ok(source.includes('quoted form of "/Apps/My \\"VS\\" Code.app"'));
  assert.ok(source.includes('quoted form of "--user-data-dir" & " " & quoted form of "/u"'));
});

test('createZip stores every file under a forward-slash name with its exact bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-zip-src-'));
  fs.mkdirSync(path.join(dir, 'extension'));
  fs.writeFileSync(path.join(dir, '[Content_Types].xml'), '<Types/>');
  fs.writeFileSync(path.join(dir, 'extension', 'extension.js'), 'console.log("한글");\n');
  const zipPath = path.join(dir, '..', path.basename(dir) + '.vsix');
  assert.equal(setup.createZip(dir, zipPath), 2);
  const zip = fs.readFileSync(zipPath);
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const entries = {};
  for (let i = 0; i < count; i++) {
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    entries[name] = zip.subarray(localOffset + 30 + localNameLength, localOffset + 30 + localNameLength + size).toString('utf8');
    offset += 46 + nameLength;
  }
  assert.deepEqual(Object.keys(entries).sort(), ['[Content_Types].xml', 'extension/extension.js']);
  assert.equal(entries['extension/extension.js'], 'console.log("한글");\n');
});
