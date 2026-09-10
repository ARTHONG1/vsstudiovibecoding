'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function activate(context) {
  if (!vscode.workspace.getConfiguration('vibe').get('enabled')) return;
  const output = vscode.window.createOutputChannel('Vibe Coding');
  context.subscriptions.push(output);
  let terminal;
  let full = false;
  let busy = false;
  const exec = (command, ...args) => vscode.commands.executeCommand(command, ...args);
  function record(event, detail = {}) {
    const data = { time: new Date().toISOString(), event, ...detail };
    output.appendLine(JSON.stringify(data));
    fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
    fs.appendFileSync(path.join(context.globalStorageUri.fsPath, 'status.jsonl'), JSON.stringify(data) + '\n');
  }
  function ensureTerminal() {
    if (!terminal || terminal.exitStatus !== undefined) {
      const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      terminal = vscode.window.terminals.find(t => t.creationOptions.env?.VIBE_PROJECT === projectPath && t.exitStatus === undefined);
      if (!terminal) {
        const executable = vscode.workspace.getConfiguration('vibe').get('opencodePath');
        if (!executable || !fs.existsSync(executable)) throw new Error('OpenCode executable was not found: ' + executable);
        terminal = vscode.window.createTerminal({
          name: 'OpenCode', shellPath: executable, shellArgs: [],
          cwd: vscode.workspace.workspaceFolders[0].uri.fsPath,
          location: vscode.TerminalLocation.Panel,
          env: { OPENCODE_CALLER: 'vscode', VIBE_PROJECT: projectPath, LANG: 'ko_KR.UTF-8', PYTHONIOENCODING: 'utf-8' }
        });
        record('terminal-created');
      }
    }
    return terminal;
  }
  async function restore(options) {
    if (typeof options?.maximized === 'boolean') full = options.maximized;
    if (full) {
      await exec('workbench.action.toggleMaximizedPanel');
      full = false;
    }
    await exec('workbench.action.closeSidebar');
    await exec('workbench.action.closeAuxiliaryBar');
    await exec('workbench.action.positionPanelRight');
    await exec('vscode.setEditorLayout', { orientation: 0, groups: [{ size: 0.5 }, { size: 0.5 }] });
    const config = vscode.workspace.getConfiguration('vibe');
    const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, config.get('entryFile', 'index.html'));
    await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Two, preview: false });

    const previewUrl = config.get('previewUrl', '');
    if (previewUrl) {
      const parsed = new URL(previewUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new Error('Preview URL must be a local development server.');
      await exec('simpleBrowser.show', previewUrl);
    } else {
      await exec('livePreview.start.internalPreview.atFile', uri);
    }
    // The built-in browser opens asynchronously after Live Preview's command returns.
    let previewGroup, previewTab;
    for (let attempt = 0; attempt < 100; attempt++) {
      previewGroup = vscode.window.tabGroups.all.find(g => {
        previewTab = g.tabs.find(t => /127\.0\.0\.1|localhost/.test(t.label) || (previewUrl && t.label === 'Simple Browser'));
        return !!previewTab;
      });
      if (previewGroup) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!previewGroup) throw new Error('Live Preview did not open a browser tab within 10 seconds.');
    const focusName = ['First', 'Second', 'Third', 'Fourth'][previewGroup.viewColumn - 1];
    if (!focusName) throw new Error('Preview opened outside supported editor groups; restore layout and retry.');
    await exec('workbench.action.focus' + focusName + 'EditorGroup');
    for (let i = 0; i < previewGroup.tabs.length && !previewTab.isActive; i++) await exec('workbench.action.nextEditorInGroup');
    if (!previewTab.isActive) throw new Error('Could not activate the preview tab; layout was not changed.');
    await exec('moveActiveEditor', { to: 'first', by: 'group' });
    await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Two, preview: false });
    await exec('vscode.setEditorLayout', { orientation: 0, groups: [{ size: 0.5 }, { size: 0.5 }] });
    ensureTerminal().show(true);
    await exec('workbench.action.evenEditorWidths');
    record('layout-ready', {
      folders: vscode.workspace.workspaceFolders.map(f => f.uri.fsPath),
      groups: vscode.window.tabGroups.all.map(g => ({ column: g.viewColumn, tabs: g.tabs.map(t => t.label) }))
    });
  }
  async function toggle(options) {
    if (typeof options?.maximized === 'boolean') full = options.maximized;
    ensureTerminal().show();
    if (!full) {
      await exec('workbench.action.positionPanelBottom');
      await exec('workbench.action.toggleMaximizedPanel');
      full = true;
    } else {
      await exec('workbench.action.toggleMaximizedPanel');
      await exec('workbench.action.positionPanelRight');
      full = false;
    }
    record(full ? 'terminal-full' : 'terminal-restored');
  }
  async function guarded(action) {
    if (busy) return;
    busy = true;
    try { await action(); }
    catch (error) { record('error', { message: String(error) }); vscode.window.showErrorMessage('Vibe Coding: ' + error.message); }
    finally { busy = false; }
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('vibe.restoreLayout', options => guarded(() => restore(options))),
    vscode.commands.registerCommand('vibe.toggleTerminal', options => guarded(() => toggle(options))),
    vscode.window.onDidCloseTerminal(t => { if (t === terminal) terminal = undefined; })
  );
  record('activated');
  return guarded(restore);
}
module.exports = { activate };
