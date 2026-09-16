const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// The VS Code boundary is mocked; the shipped extension's real restore runs.
test('restore reuses a preview after its title becomes the page title', async () => {
  const commands = new Map(), events = [], terminals = [], statusIds = [];
  const tab = { label: '127.0.0.1:3000', isActive: true };
  const group = { viewColumn: 1, tabs: [tab] };
  const config = { enabled: true, entryFile: 'index.html', codexPath: 'C:/tools/codex.exe', opencodePath: 'C:/tools/opencode.exe' };
  const vscode = {
    workspace: { getConfiguration: () => ({get:(k,d)=>config[k] ?? d}), workspaceFolders: [{uri:{fsPath:'C:/project'}}] },
    window: { createOutputChannel:()=>({appendLine:line=>events.push(JSON.parse(line))}),
      tabGroups:{all:[group]}, terminals,
      showTextDocument:async()=>{}, showErrorMessage:()=>{},
      createStatusBarItem:(id)=>{statusIds.push(id);return {show(){},dispose(){}};},
      createTerminal:opts=>{const t={creationOptions:opts,show(){}};terminals.push(t);return t;},
      onDidCloseTerminal:()=>({dispose(){}}) },
    commands:{executeCommand:async()=>{},registerCommand:(name,fn)=>{commands.set(name,fn);return {dispose(){}};}},
    Uri:{joinPath:()=>({fsPath:'C:/project/index.html'}),parse:()=>({})},
    ViewColumn:{Two:2},TerminalLocation:{Panel:1},
    StatusBarAlignment:{Left:1,Right:2},
    env:{openExternal:async()=>true}
  };
  const module = {exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../vibe-coding/assets/workspace-extension/extension/extension.js'),'utf8'), {
    module, exports:module.exports, require:name=>name==='vscode'?vscode:name==='fs'?{existsSync:()=>true,mkdirSync(){},appendFileSync(){}}:require(name),
    setTimeout:fn=>{fn();},URL
  });
  await module.exports.activate({subscriptions:[],globalStorageUri:{fsPath:'C:/test'}});
  assert.deepEqual(statusIds, ['vibe.terminalToggle', 'vibe.previewToggle', 'vibe.timeMachine']);
  tab.label='나의 페이지';
  await commands.get('vibe.restoreLayout')({maximized:false});
  await commands.get('vibe.restoreLayout')({maximized:false});
  assert.equal(events.filter(e=>e.event==='error').length,0,JSON.stringify(events));
  assert.equal(events.filter(e=>e.event==='layout-ready').length,3);
  assert.equal(terminals.length,1);
  await commands.get('vibe.toggleTerminal')({maximized:false});
  await commands.get('vibe.toggleTerminal')({maximized:true});
  assert.deepEqual(events.slice(-2).map(e=>e.event),['terminal-full','layout-ready']);
});

test('restore cleans up misplaced entry file tab in column 1 without reference errors', async () => {
  const commands = new Map(), events = [], terminals = [], closedTabs = [];
  const misplacedTab = {
    label: 'index.html',
    input: { uri: { fsPath: 'C:/project/index.html' } },
    isDirty: false
  };
  const previewTab = { label: '127.0.0.1:3000', isActive: true };
  const group1 = { viewColumn: 1, tabs: [misplacedTab, previewTab] };
  const config = { enabled: true, entryFile: 'index.html', codexPath: 'C:/tools/codex.exe', opencodePath: 'C:/tools/opencode.exe' };
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
      terminals,
      showTextDocument: async () => {},
      showErrorMessage: () => {},
      createStatusBarItem: () => ({ show() {}, dispose() {} }),
      createTerminal: opts => { const t = { creationOptions: opts, show() {} }; terminals.push(t); return t; },
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
    module, exports: module.exports, require: name => name === 'vscode' ? vscode : name === 'fs' ? { existsSync: () => true, mkdirSync() {}, appendFileSync() {} } : require(name),
    setTimeout: fn => { fn(); }, URL
  });
  await module.exports.activate({ subscriptions: [], globalStorageUri: { fsPath: 'C:/test' } });
  await commands.get('vibe.restoreLayout')({ maximized: false });
  assert.equal(events.filter(e => e.event === 'error').length, 0, JSON.stringify(events));
  assert.ok(closedTabs.includes(misplacedTab), 'Misplaced entry tab in column 1 must be closed');
});
