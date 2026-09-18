const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { execSync } = require('node:child_process');

test('ensureTerminal preserves user personal terminals and disposes only stale project Vibe terminals', async () => {
  const commands = new Map(), events = [];
  let userTerminalDisposed = false;
  let staleVibeTerminalDisposed = false;

  const userTerminal = {
    name: 'User PowerShell',
    creationOptions: { shellPath: 'powershell.exe', env: {} },
    show() {},
    dispose() { userTerminalDisposed = true; }
  };

  const staleVibeTerminal = {
    name: 'Codex (old)',
    creationOptions: {
      shellPath: 'C:/tools/old-codex.exe',
      env: { VIBE_PROJECT: 'C:/project' }
    },
    show() {},
    dispose() { staleVibeTerminalDisposed = true; }
  };

  const terminals = [userTerminal, staleVibeTerminal];
  const config = { enabled: true, entryFile: 'index.html', codexPath: 'C:/tools/codex.exe' };

  const vscode = {
    workspace: {
      getConfiguration: () => ({ get: (k, d) => config[k] ?? d }),
      workspaceFolders: [{ uri: { fsPath: 'C:/project' } }]
    },
    window: {
      createOutputChannel: () => ({ appendLine: line => events.push(JSON.parse(line)) }),
      tabGroups: { all: [] },
      terminals,
      showTextDocument: async () => {},
      showErrorMessage: () => {},
      createStatusBarItem: () => ({ show() {}, dispose() {} }),
      createTerminal: opts => {
        const t = { creationOptions: opts, show() {} };
        terminals.push(t);
        return t;
      },
      onDidCloseTerminal: () => ({ dispose() {} })
    },
    commands: { executeCommand: async () => {}, registerCommand: (name, fn) => { commands.set(name, fn); return { dispose() {} }; } },
    Uri: { joinPath: () => ({ fsPath: 'C:/project/index.html' }), parse: () => ({}) },
    ViewColumn: { One: 1, Two: 2 },
    TerminalLocation: { Panel: 1 },
    StatusBarAlignment: { Left: 1, Right: 2 },
    env: { openExternal: async () => true }
  };

  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension/extension.js'), 'utf8'), {
    module, exports: module.exports,
    require: name => name === 'vscode' ? vscode : name === 'fs' ? { existsSync: () => true, mkdirSync() {}, appendFileSync() {} } : name.startsWith('.') ? require(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension', name)) : require(name),
    setTimeout: fn => fn(), URL
  });

  await module.exports.activate({ subscriptions: [], globalStorageUri: { fsPath: 'C:/test' } });
  await commands.get('vibe.restoreLayout')({ maximized: false });

  assert.equal(userTerminalDisposed, false, 'User personal terminal MUST NOT be disposed');
  assert.equal(staleVibeTerminalDisposed, true, 'Stale project Vibe terminal MUST be disposed');
});

test('restore preserves non-browser clean tabs (Settings, Welcome, etc.)', async () => {
  const commands = new Map(), events = [], closedTabs = [];

  const settingsTab = {
    label: 'Settings',
    input: { viewType: 'workbench.settings' },
    isDirty: false
  };

  const stalePreviewTab = {
    label: 'Simple Browser',
    input: { viewType: 'simpleBrowser.view' },
    isDirty: false
  };

  const group1 = { viewColumn: 1, tabs: [settingsTab, stalePreviewTab] };
  const config = { enabled: true, entryFile: 'index.html', codexPath: 'C:/tools/codex.exe' };

  const vscode = {
    workspace: {
      getConfiguration: () => ({ get: (k, d) => config[k] ?? d }),
      workspaceFolders: [{ uri: { fsPath: 'C:/project' } }]
    },
    window: {
      createOutputChannel: () => ({ appendLine: line => events.push(JSON.parse(line)) }),
      tabGroups: {
        all: [group1],
        close: t => closedTabs.push(t)
      },
      terminals: [],
      showTextDocument: async () => {},
      showErrorMessage: () => {},
      createStatusBarItem: () => ({ show() {}, dispose() {} }),
      createTerminal: opts => ({ creationOptions: opts, show() {} }),
      onDidCloseTerminal: () => ({ dispose() {} })
    },
    commands: { executeCommand: async () => {}, registerCommand: (name, fn) => { commands.set(name, fn); return { dispose() {} }; } },
    Uri: { joinPath: () => ({ fsPath: 'C:/project/index.html' }), parse: () => ({}) },
    ViewColumn: { One: 1, Two: 2 },
    TerminalLocation: { Panel: 1 },
    StatusBarAlignment: { Left: 1, Right: 2 },
    env: { openExternal: async () => true }
  };

  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension/extension.js'), 'utf8'), {
    module, exports: module.exports,
    require: name => name === 'vscode' ? vscode : name === 'fs' ? { existsSync: () => true, mkdirSync() {}, appendFileSync() {} } : name.startsWith('.') ? require(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension', name)) : require(name),
    setTimeout: fn => fn(), URL
  });

  await module.exports.activate({ subscriptions: [], globalStorageUri: { fsPath: 'C:/test' } });
  await commands.get('vibe.restoreLayout')({ maximized: false });

  assert.equal(closedTabs.includes(settingsTab), false, 'Settings tab must be preserved');
  assert.equal(closedTabs.includes(stalePreviewTab), true, 'Stale preview tab must be closed');
});

test('setup.ps1 dry-run enforces pure Codex agent in plan', () => {
  const ROOT = path.resolve(__dirname, '..');
  const SETUP_SCRIPT = path.join(ROOT, 'vibe-coding/scripts/setup.ps1');
  const cmd = 'powershell -ExecutionPolicy Bypass -NoProfile -File "' + SETUP_SCRIPT + '" -CreateSample';
  const output = execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
  const plan = JSON.parse(output);

  assert.equal(plan.agent, 'Codex');
  assert.equal(plan.openCode, undefined, 'openCode must not exist in plan');
});
