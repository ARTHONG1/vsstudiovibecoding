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

  test('mobile command reuses tunnel panel and configures secure copy webview options', async () => {
    const env = createMockVSCode();
    const calls = [];
    let created = 0, revealed = 0, panelOptions, panel;
    env.vscode.commands.executeCommand = async cmd => { calls.push(cmd); };
    env.vscode.env.clipboard = { readText() { throw new Error('Unexpected clipboard read'); } };
    env.vscode.window.createWebviewPanel = (id, title, column, options) => {
      created++;
      panelOptions = options;
      panel = { webview: { html: '', onDidReceiveMessage() {} }, reveal() { revealed++; }, onDidDispose() {}, dispose() {} };
      return panel;
    };
    await env.module.exports.activate({ subscriptions: [], globalStorageUri: { fsPath: 'C:/test' } });
    const terminalsBefore = env.terminals.length;
    calls.length = 0;
    await env.commands.get('vibe.openMobileRemote')();
    await env.commands.get('vibe.openMobileRemote')();
    assert.equal(created, 1);
    assert.equal(revealed, 1);
    assert.equal(panelOptions.enableScripts, true);
    assert.equal(env.terminals.length, terminalsBefore);
    assert.deepEqual(calls, []);
  });

test('remote web startup opens terminal without desktop split layout', async () => {
 const env=createMockVSCode();
 env.vscode.UIKind={Web:2};env.vscode.env.uiKind=2;
 env.vscode.window.createStatusBarItem=()=>({show(){},hide(){},dispose(){}});
 const calls=[];env.vscode.commands.executeCommand=async command=>calls.push(command);
 await env.module.exports.activate({subscriptions:[],globalStorageUri:{fsPath:'C:/test'}});
 assert.equal(env.terminals.length,1);
 assert.ok(calls.includes('workbench.action.positionPanelBottom'));
 assert.ok(calls.includes('workbench.action.toggleMaximizedPanel'));
 assert.ok(!calls.includes('vscode.setEditorLayout'));
 assert.ok(env.events.some(e=>e.event==='terminal-full'));
});

test('web controls stay compact and switch directly without desktop restore', async () => {
 const env=createMockVSCode({previewUrl:'http://localhost:5173'});
 env.vscode.UIKind={Web:2};env.vscode.env.uiKind=2;
 const items=[];env.vscode.window.createStatusBarItem=(id,alignment,priority)=>{const item={id,alignment,priority,show(){this.visible=true},hide(){this.visible=false},dispose(){}};items.push(item);return item;};
 env.vscode.env.asExternalUri=async()=>({toString:()=> 'https://forwarded.example/'});
 const calls=[];env.vscode.commands.executeCommand=async(...args)=>calls.push(args);
 await env.module.exports.activate({subscriptions:[],globalStorageUri:{fsPath:'C:/test'}});
 assert.equal(items[0].alignment,env.vscode.StatusBarAlignment.Left);
 assert.equal(items[0].text,'$(terminal) 터미널');
 assert.equal(items[1].text,'$(browser) 미리보기');
 assert.equal(items[2].visible,false);
 await env.commands.get('vibe.togglePreview')();
 assert.ok(calls.some(c=>c[0]==='simpleBrowser.show' && c[1]==='https://forwarded.example/'));
 await env.commands.get('vibe.toggleTerminal')();
 const count=calls.filter(c=>c[0]==='workbench.action.toggleMaximizedPanel').length;
 await env.commands.get('vibe.toggleTerminal')();
 assert.equal(calls.filter(c=>c[0]==='workbench.action.toggleMaximizedPanel').length,count);
 assert.ok(!calls.some(c=>c[0]==='vscode.setEditorLayout'));
});
