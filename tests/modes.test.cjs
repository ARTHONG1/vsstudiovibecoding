const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function createMockVSCode(config = {}) {
  const commands = new Map(), events = [], terminals = [];
  let openedUrl = null;
  const tab = { label: '127.0.0.1:3000', isActive: true };
  const group = { viewColumn: 1, tabs: [tab] };
  const fullConfig = { enabled: true, entryFile: 'index.html', codexPath: 'C:/tools/codex.exe', ...config };

  const vscode = {
    workspace: {
      getConfiguration: () => ({ get: (k, d) => fullConfig[k] ?? d }),
      workspaceFolders: [{ uri: { fsPath: 'C:/project' } }]
    },
    window: {
      createOutputChannel: () => ({ appendLine: line => events.push(JSON.parse(line)) }),
      createStatusBarItem: () => ({ show() {}, dispose() {} }),
      tabGroups: { all: [group] },
      terminals,
      showTextDocument: async () => {},
      showErrorMessage: () => {},
      createTerminal: opts => {
        const t = { creationOptions: opts, show() {} };
        terminals.push(t);
        return t;
      },
      onDidCloseTerminal: () => ({ dispose() {} })
    },
    commands: {
      executeCommand: async () => {},
      registerCommand: (name, fn) => {
        commands.set(name, fn);
        return { dispose() {} };
      }
    },
    Uri: {
      joinPath: () => ({ fsPath: 'C:/project/index.html' }),
      parse: str => {
        openedUrl = str;
        return { fsPath: str, toString: () => str };
      }
    },
    ViewColumn: { Two: 2 },
    TerminalLocation: { Panel: 1 },
    StatusBarAlignment: { Left: 1, Right: 2 },
    env: {
      openExternal: async uri => {
        openedUrl = uri?.toString?.() || uri;
        return true;
      }
    }
  };

  const module = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension/extension.js'),
      'utf8'
    ),
    {
      module,
      exports: module.exports,
      require: name => (name === 'vscode' ? vscode : name === 'fs' ? { existsSync: () => true, mkdirSync() {}, appendFileSync() {} } : name.startsWith('.') ? require(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension', name)) : require(name)),
      setTimeout: fn => fn(),
      clearTimeout: () => {},
      URL
    }
  );

  return { vscode, commands, events, terminals, getOpenedUrl: () => openedUrl, module };
}

test('3-mode viewport: togglePreview and toggleTerminal transitions', async () => {
  const env = createMockVSCode();
  await env.module.exports.activate({ subscriptions: [], globalStorageUri: { fsPath: 'C:/test' } });

  // 1. Initial startup layout-ready
  assert.equal(env.events.filter(e => e.event === 'layout-ready').length, 1);

  // 2. Toggle to preview-full
  await env.commands.get('vibe.togglePreview')();
  const lastEvent1 = env.events[env.events.length - 1];
  assert.equal(lastEvent1.event, 'preview-full');
  assert.equal(lastEvent1.mode, 'preview');

  // 3. Restore to 3-column split from preview
  await env.commands.get('vibe.togglePreview')();
  const lastEvent2 = env.events[env.events.length - 1];
  assert.equal(lastEvent2.event, 'layout-ready');
  assert.equal(lastEvent2.mode, 'split');

  // 4. Toggle to terminal-full
  await env.commands.get('vibe.toggleTerminal')();
  const lastEvent3 = env.events[env.events.length - 1];
  assert.equal(lastEvent3.event, 'terminal-full');
  assert.equal(lastEvent3.mode, 'terminal');

  // 5. Direct switch: terminal-full -> preview-full
  await env.commands.get('vibe.togglePreview')();
  const lastEvent4 = env.events[env.events.length - 1];
  assert.equal(lastEvent4.event, 'preview-full');
  assert.equal(lastEvent4.mode, 'preview');

  // 6. Return back to 3-column split
  await env.commands.get('vibe.togglePreview')();
  const lastEvent5 = env.events[env.events.length - 1];
  assert.equal(lastEvent5.event, 'layout-ready');
  assert.equal(lastEvent5.mode, 'split');
});

test('openExternalBrowser opens system default browser with dev server URL', async () => {
  const env = createMockVSCode({ previewUrl: 'http://localhost:5173' });
  await env.module.exports.activate({ subscriptions: [], globalStorageUri: { fsPath: 'C:/test' } });

  await env.commands.get('vibe.openExternalBrowser')();
  assert.equal(env.getOpenedUrl(), 'http://localhost:5173');

  const lastEvent = env.events[env.events.length - 1];
  assert.equal(lastEvent.event, 'external-browser-opened');
  assert.equal(lastEvent.url, 'http://localhost:5173');
});
