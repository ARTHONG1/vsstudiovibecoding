'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');

test('distinct turns remain distinct and dirty buffers prevent restore', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-safety-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  const source = fs.readFileSync(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension/extension.js'), 'utf8');
  const code = source.slice(source.indexOf('  function initGit('), source.indexOf('  function getRecentPrompt(')) +
    source.slice(source.indexOf('  function getCheckpoints('), source.indexOf('  async function showTimeMachinePicker('));
  let info = {prompt:'same title', turnId:'turn-1'};
  const errors = [], commands = [];
  const vscode = {
    workspace: {textDocuments:[], workspaceFolders:[{uri:{fsPath:dir}}], getConfiguration:()=>({get:()=> 'index.html'})},
    window: {showErrorMessage:m=>errors.push(m), showInformationMessage(){}, activeTextEditor:{document:{isUntitled:false}}},
    commands: {executeCommand:async c=>commands.push(c)},
    Uri: {joinPath:()=>({})}
  };
  const ctx = {fs,path,process,execSync:cp.execSync,execFileSync:cp.execFileSync,gitReady:()=>true,getRecentPrompt:()=>info,vscode};
  vm.createContext(ctx);
  vm.runInContext(code,ctx);
  fs.writeFileSync(path.join(dir,'index.html'),'first');
  const first=ctx.createShadowCheckpoint(dir);
  info={prompt:'same title',turnId:'turn-2'};
  fs.writeFileSync(path.join(dir,'index.html'),'second');
  ctx.createShadowCheckpoint(dir);
  assert.equal(ctx.getCheckpoints(dir).length,2);
  vscode.workspace.textDocuments=[{isDirty:true}];
  assert.equal(await ctx.restoreShadowCheckpoint(dir,first.commitSha,'first'),false);
  assert.equal(fs.readFileSync(path.join(dir,'index.html'),'utf8'),'second');
  assert.equal(commands.includes('workbench.action.files.revert'),false);
  assert.ok(errors.some(message=>message.includes('저장되지 않은')));
});
