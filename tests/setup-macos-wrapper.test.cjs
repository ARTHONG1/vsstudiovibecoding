'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const WRAPPER = path.resolve(__dirname, '../vibe-coding/scripts/setup-macos.sh');

function fixture(t) {
  // This regression needs an actual Mac with neither default app available.
  // HOME is isolated below; leave a developer's system installation untouched.
  if (fs.existsSync('/Applications/Visual Studio Code.app')) {
    t.skip('Requires no VS Code app in /Applications');
    return null;
  }
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-wrapper-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const bin = path.join(base, 'bin');
  const home = path.join(base, 'home');
  fs.mkdirSync(bin);
  fs.mkdirSync(home);
  // Real macOS utilities, but no node anywhere on the wrapper's PATH.
  for (const name of ['dirname', 'uname']) fs.symlinkSync('/usr/bin/' + name, path.join(bin, name));
  return { base, env: { ...process.env, PATH: bin, HOME: home, VIBE_CODE_APP: '' } };
}

function fakeApp(base, name) {
  const app = path.join(base, name + '.app');
  const executable = path.join(app, 'Contents', 'MacOS', 'Fake Runtime');
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(path.join(app, 'Contents', 'Info.plist'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    '<key>CFBundleExecutable</key><string>Fake Runtime</string>',
    '</dict></plist>\n'
  ].join('\n'));
  fs.writeFileSync(executable, '#!/bin/sh\nprintf \'%s\\0\' "$ELECTRON_RUN_AS_NODE" "$0" "$@"\n', { mode: 0o755 });
  // Validate the fixture using the same real Mac command as the wrapper.
  assert.equal(execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleExecutable', path.join(app, 'Contents', 'Info.plist')], { encoding: 'utf8' }).trim(), 'Fake Runtime');
  return { app, executable };
}

function assertRuntime(args, env, executable) {
  const result = spawnSync('/bin/sh', [WRAPPER, ...args], { env, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.split('\0'), [
    '1', executable, path.join(path.dirname(WRAPPER), 'setup-macos.cjs'), ...args, ''
  ]);
}

test('without Node or default apps, --code-app selects its bundled runtime and preserves spaced arguments', { skip: process.platform !== 'darwin' }, t => {
  const f = fixture(t);
  if (!f) return;
  const selected = fakeApp(f.base, 'Custom Visual Studio Code');
  const args = ['--project', '/tmp/My project', '--code-app', selected.app, '--codex-arg', 'value with "quotes" and $literal', '--desktop', '/tmp/My Desktop'];
  assertRuntime(args, f.env, selected.executable);
});

test('explicit --code-app takes precedence over VIBE_CODE_APP without consuming startup arguments', { skip: process.platform !== 'darwin' }, t => {
  const f = fixture(t);
  if (!f) return;
  const environmentApp = fakeApp(f.base, 'Environment Code');
  const selected = fakeApp(f.base, 'Explicit Code');
  const args = ['--create-sample', '--code-app', selected.app, '--codex-arg', '--code-app'];
  assertRuntime(args, { ...f.env, VIBE_CODE_APP: environmentApp.app }, selected.executable);
});
