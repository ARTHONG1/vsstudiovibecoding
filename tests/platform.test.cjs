'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const platform = require('../vibe-coding/assets/workspace-extension/extension/platform');

test('data root: LocalAppData on Windows, a space-free Library folder on macOS', () => {
  assert.equal(platform.vibeRoot({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' } }), 'C:\\Users\\u\\AppData\\Local\\VibeCoding');
  assert.equal(platform.vibeRoot({ platform: 'darwin', home: '/Users/me', env: {} }), '/Users/me/Library/VibeCoding');
});

test('configured macOS data root and VS Code app are used by remote modules', () => {
  const root='/Volumes/작업 폴더/Vibe';
  assert.equal(platform.vibeRoot({platform:'darwin',home:'/Users/me',dataRoot:root}),root);
  const options={platform:'darwin',home:'/Users/me',env:{PATH:''},appRoot:'/Users/me/.vscode/cli/servers/Stable/server',codeApp:'/Volumes/Apps/VS Code.app'};
  assert.ok(platform.codeTunnelCandidates(options).includes('/Volumes/Apps/VS Code.app/Contents/Resources/app/bin/code-tunnel'));
});

test('macOS code-tunnel is resolved inside the VS Code app bundle', () => {
  const list = platform.codeTunnelCandidates({ platform: 'darwin', home: '/Users/me', env: { PATH: '' }, appRoot: '/Applications/Visual Studio Code.app/Contents/Resources/app' });
  assert.equal(list[0], '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code-tunnel');
  assert.ok(list.includes('/Users/me/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code-tunnel'));
  const windows = platform.codeTunnelCandidates({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\L', PATH: '' }, appRoot: null });
  assert.equal(windows[0], 'C:\\L\\Programs\\Microsoft VS Code\\bin\\code-tunnel.exe');
});

test('Windows PATH lookup uses PATHEXT and skips extensionless npm shims', () => {
  const files = new Set(['C:\\npm\\codex', 'C:\\npm\\codex.cmd']);
  const found = platform.findOnPath(['codex'], { platform: 'win32', env: { PATH: 'C:\\npm', PATHEXT: '.EXE;.CMD' }, exists: file => files.has(file) });
  assert.equal(found, 'C:\\npm\\codex.cmd');
});

test('macOS Codex discovery checks PATH before Homebrew and npm folders', () => {
  const files = new Set(['/opt/homebrew/bin/codex', '/custom/bin/codex']);
  const options = { platform: 'darwin', home: '/Users/me', env: { PATH: '/custom/bin:/usr/bin' }, exists: file => files.has(file) };
  assert.equal(platform.findCodexExecutable(options), '/custom/bin/codex');
  assert.equal(platform.findCodexExecutable({ ...options, env: { PATH: '/usr/bin' } }), '/opt/homebrew/bin/codex');
});

test('Codex terminal keeps the inherited PATH order and appends only missing folders', () => {
  const env = platform.codexTerminalEnv('/Users/me/.npm-global/bin/codex', { platform: 'darwin', env: { PATH: '/usr/local/bin:/usr/bin' } });
  const parts = env.PATH.split(':');
  assert.deepEqual(parts.slice(0, 2), ['/usr/local/bin', '/usr/bin']);
  assert.ok(parts.includes('/Users/me/.npm-global/bin'));
  assert.equal(new Set(parts).size, parts.length);
  assert.equal(env.CODEX_CALLER, 'vscode');
  assert.equal(platform.codexTerminalEnv('C:\\codex.exe', { platform: 'win32', env: { PATH: 'C:\\x' } }).PATH, undefined);
});

test('Korean folder names compare equal across Unicode normalization forms', () => {
  const decomposed = '/Users/me/Documents/과전강'.normalize('NFD');
  assert.notEqual(decomposed, '/Users/me/Documents/과전강');
  assert.equal(platform.comparablePath(decomposed, { platform: 'darwin' }), platform.comparablePath('/Users/me/Documents/과전강/', { platform: 'darwin' }));
  assert.notEqual(platform.comparablePath('/Projects/Music', {platform:'darwin'}),platform.comparablePath('/Projects/music',{platform:'darwin'}));
});

test('missing Command Line Tools is detected without running the git stub', () => {
  const calls = [];
  const reason = platform.gitUnavailableReason({
    platform: 'darwin',
    env: { PATH: '/usr/bin' },
    exists: file => file === '/usr/bin/git',
    execFileSync: file => { calls.push(file); throw new Error('no developer directory'); }
  });
  assert.equal(reason, 'command-line-tools');
  assert.deepEqual(calls, ['/usr/bin/xcode-select']);
  assert.equal(platform.gitUnavailableReason({ platform: 'win32' }), null);
});

test('macOS clipboard images are saved by osascript with the path passed as an argument', () => {
  let call;
  const target = '/Users/me/프로젝트 1/.vibe/images/clip.png';
  const saved = platform.saveClipboardImage(target, { platform: 'darwin', execFileSync: (file, args) => { call = { file, args }; return 'OK\n'; } });
  assert.equal(saved, true);
  assert.equal(call.file, '/usr/bin/osascript');
  assert.equal(call.args[call.args.length - 1], target);
  assert.ok(call.args.some(arg => arg.includes('\u00abclass PNGf\u00bb')));
  assert.equal(platform.saveClipboardImage(target, { platform: 'darwin', execFileSync: () => 'EMPTY\n' }), false);
});
