const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function createMockVSCode(config = {}) {
  const commands = new Map(), events = [], terminals = [], tunnelCalls = [];
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
      require: name => (name === 'vscode' ? vscode : name === './jsonc' ? {readObject: () => ({previewUrl: config.savedPreviewUrl})} : name === './preview-forwarding' ? {createPreviewForwarder:()=>({resolve:async()=>{if(config.forwardedUrl)return config.forwardedUrl;throw new Error('포트 전달 실패');},dispose(){}})} : name === './tunnel-manager' ? {
        getOrStartTunnel: async (project, options) => {
          tunnelCalls.push({ project, options });
          return { url: 'https://vscode.dev/tunnel/test/C:/project', tunnelName: 'test' };
        }
      } : name === 'fs' ? { existsSync: () => true, readFileSync: () => JSON.stringify({previewUrl: config.savedPreviewUrl}), mkdirSync() {}, appendFileSync() {} } : name.startsWith('.') ? require(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension', name)) : require(name)),
      setTimeout: fn => fn(),
      clearTimeout: () => {},
      setInterval: () => 1,
      clearInterval: () => {},
      URL
    }
  );

  return { vscode, commands, events, terminals, tunnelCalls, getOpenedUrl: () => openedUrl, module };
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
    assert.equal(env.tunnelCalls.length, 2);
    assert.equal(env.tunnelCalls[0].project, 'C:/project');
    assert.ok(panel.webview.html.includes('https://vscode.dev/tunnel/test/C:/project'));
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

test('web controls stay compact and switch directly without desktop restore', async t => {
 const server=require('http').createServer((req,res)=>res.end('preview'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const env=createMockVSCode({previewUrl:'http://127.0.0.1:'+server.address().port});
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
 assert.equal(count,3,'startup maximizes, preview restores size, terminal maximizes again');
 await env.commands.get('vibe.toggleTerminal')();
 assert.equal(calls.filter(c=>c[0]==='workbench.action.toggleMaximizedPanel').length,count);
 const layouts=calls.filter(c=>c[0]==='vscode.setEditorLayout');
 assert.equal(layouts.length,1);
 assert.equal(layouts[0][1].groups.length,1);
});

test('Codex startup arguments retain spaces and do not change defaults', async () => {
  for (const args of [[], ['--no-daemon', '--config', 'example="한글 공백"']]) {
    const env = createMockVSCode({codexArgs: args});
    await env.module.exports.activate({subscriptions:[],globalStorageUri:{fsPath:'C:/test'}});
    assert.deepEqual(Array.from(env.terminals[0].creationOptions.shellArgs), args);
    assert.equal(env.terminals[0].creationOptions.shellPath, 'C:/tools/codex.exe');
  }
});

test('web preview failure preserves terminal and reports server failure', async () => {
  const env = createMockVSCode({previewUrl:'http://127.0.0.1:1'});
  env.vscode.UIKind={Web:2}; env.vscode.env.uiKind=2;
  env.vscode.window.createStatusBarItem=()=>({show(){},hide(){}});
  env.vscode.env.asExternalUri=async()=>({toString:()=> 'https://forwarded.example/'});
  const errors=[], calls=[];
  env.vscode.window.showErrorMessage=message=>errors.push(message);
  env.vscode.commands.executeCommand=async(...args)=>calls.push(args);
  await env.module.exports.activate({subscriptions:[],globalStorageUri:{fsPath:'C:/test'}});
  calls.length=0;
  await env.commands.get('vibe.togglePreview')();
  assert.ok(errors.some(message=>message.includes('응답')));
  assert.ok(!calls.some(c=>c[0]==='workbench.action.closePanel'));
  assert.ok(!calls.some(c=>c[0]==='simpleBrowser.show'));
});

test('web preview rejects an unresolved loopback address instead of showing a blank phone frame', async t => {
  const server=require('http').createServer((req,res)=>res.end('preview'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port;
  const env=createMockVSCode({previewUrl:url});
  env.vscode.UIKind={Web:2};env.vscode.env.uiKind=2;
  env.vscode.window.createStatusBarItem=()=>({show(){},hide(){}});
  env.vscode.env.asExternalUri=async()=>({toString:()=>url});
  const errors=[],calls=[];
  env.vscode.window.showErrorMessage=message=>errors.push(message);
  env.vscode.commands.executeCommand=async(...args)=>calls.push(args);
  await env.module.exports.activate({subscriptions:[],globalStorageUri:{fsPath:'C:/test'}});
  calls.length=0;
  await env.commands.get('vibe.togglePreview')();
  assert.ok(errors.some(message=>message.includes('포트 전달')));
  assert.ok(!calls.some(c=>c[0]==='simpleBrowser.show'));
  assert.ok(!calls.some(c=>c[0]==='workbench.action.closePanel'));
});

test('web preview creates private forwarding when native address remains loopback', async t => {
  const server=require('http').createServer((req,res)=>res.end('preview'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port+'/studio';
  const env=createMockVSCode({previewUrl:url,forwardedUrl:'https://test-3012.jpe1.devtunnels.ms/studio'});
  env.vscode.UIKind={Web:2};env.vscode.env.uiKind=2;
  env.vscode.window.createStatusBarItem=()=>({show(){},hide(){}});
  env.vscode.env.asExternalUri=async()=>({toString:()=>url});
  const calls=[];env.vscode.commands.executeCommand=async(...args)=>calls.push(args);
  await env.module.exports.activate({subscriptions:[],globalStorageUri:{fsPath:'C:/test'}});
  await env.commands.get('vibe.togglePreview')();
  assert.equal(env.getOpenedUrl(),'https://test-3012.jpe1.devtunnels.ms/studio');
  assert.ok(!calls.some(c=>c[0]==='simpleBrowser.show' || c[0]==='workbench.action.closePanel'));
});

test('web preview recovers saved project URL when workspace URL is blank', async t => {
  const server=require('http').createServer((req,res)=>res.end('preview'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port+'/studio';
  const env=createMockVSCode({previewUrl:'',savedPreviewUrl:url,forwardedUrl:'https://test-3012.jpe1.devtunnels.ms/studio'});
  env.vscode.UIKind={Web:2};env.vscode.env.uiKind=2;
  env.vscode.window.createStatusBarItem=()=>({show(){},hide(){}});
  env.vscode.env.asExternalUri=async()=>({toString:()=>url});
  const calls=[];env.vscode.commands.executeCommand=async(...args)=>calls.push(args);
  await env.module.exports.activate({subscriptions:[],globalStorageUri:{fsPath:'C:/test'}});
  await env.commands.get('vibe.togglePreview')();
  assert.equal(env.getOpenedUrl(),'https://test-3012.jpe1.devtunnels.ms/studio');
});
