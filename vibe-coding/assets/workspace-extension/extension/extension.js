'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

function checkPortReachable(urlStr) {
  return new Promise(resolve => {
    try {
      const u = new URL(urlStr);
      const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
      const host = (u.hostname === 'localhost') ? '127.0.0.1' : (u.hostname || '127.0.0.1');
      const req = http.get({ hostname: host, port, path: u.pathname || '/', timeout: 600 }, () => resolve(true));
      req.on('error', () => {
        if (host === '127.0.0.1') {
          const fb = http.get({ hostname: 'localhost', port, path: u.pathname || '/', timeout: 400 }, () => resolve(true));
          fb.on('error', () => resolve(false));
          fb.on('timeout', () => { fb.destroy(); resolve(false); });
        } else {
          resolve(false);
        }
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
    } catch {
      resolve(false);
    }
  });
}

function activate(context) {
  if (!vscode.workspace.getConfiguration('vibe').get('enabled')) return;
  const output = vscode.window.createOutputChannel('Vibe Coding');
  context.subscriptions.push(output);
 let terminal;
 let previewTabRef;
  let currentMode = context.workspaceState?.get?.('vibeMode', 'split') || 'split'; // 'split' | 'terminal' | 'preview'
 let busy = false;
  const exec = (command, ...args) => vscode.commands.executeCommand(command, ...args);

  const terminalBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1001);
  terminalBtn.name = 'Vibe Coding Terminal Toggle';
  terminalBtn.command = 'vibe.toggleTerminal';
  context.subscriptions.push(terminalBtn);

  const previewBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
  previewBtn.name = 'Vibe Coding Preview Toggle';
  previewBtn.command = 'vibe.togglePreview';
  context.subscriptions.push(previewBtn);

  function setMode(mode) {
    currentMode = mode;
    try { context.workspaceState?.update?.('vibeMode', mode); } catch {}
    updateStatusBars();
  }

  function updateStatusBars() {
    if (currentMode === 'terminal') {
      terminalBtn.text = '$(layout-sidebar-right) 3열 복원';
      terminalBtn.tooltip = '미리보기 | 코드 | 터미널 3열 화면으로 복원합니다 (Vibe Coding)';
      previewBtn.text = '$(browser) 미리보기 전체';
      previewBtn.tooltip = '웹앱 미리보기를 전체화면으로 전환합니다 (Vibe Coding)';
    } else if (currentMode === 'preview') {
      terminalBtn.text = '$(screen-full) 터미널 전체';
      terminalBtn.tooltip = 'Codex 터미널을 전체화면으로 전환합니다 (Vibe Coding)';
      previewBtn.text = '$(layout-sidebar-right) 3열 복원';
      previewBtn.tooltip = '미리보기 | 코드 | 터미널 3열 화면으로 복원합니다 (Vibe Coding)';
    } else {
      terminalBtn.text = '$(screen-full) 터미널 전체';
      terminalBtn.tooltip = 'Codex 터미널을 전체화면으로 전환합니다 (Vibe Coding)';
      previewBtn.text = '$(browser) 미리보기 전체';
      previewBtn.tooltip = '웹앱 미리보기를 전체화면으로 전환합니다 (Vibe Coding)';
    }
    terminalBtn.show();
    previewBtn.show();
  }
  updateStatusBars();

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
        const config = vscode.workspace.getConfiguration('vibe');
        const executable = config.get('codexPath') || config.get('opencodePath');
        if (!executable || !fs.existsSync(executable)) throw new Error('AI Agent (Codex) executable was not found: ' + executable);
        const isCodex = /codex/i.test(executable);
        const terminalName = isCodex ? 'Codex' : 'OpenCode';
        terminal = vscode.window.createTerminal({
          name: terminalName,
          shellPath: executable,
          shellArgs: [],
          cwd: vscode.workspace.workspaceFolders[0].uri.fsPath,
          location: vscode.TerminalLocation.Panel,
          env: {
            CODEX_CALLER: 'vscode',
            OPENCODE_CALLER: 'vscode',
            VIBE_PROJECT: projectPath,
            LANG: 'ko_KR.UTF-8',
            PYTHONIOENCODING: 'utf-8'
          }
        });
        record('terminal-created', { agent: terminalName });
      }
    }
    return terminal;
  }
 async function restore(options) {
   if (currentMode === 'terminal') {
      try { await exec('workbench.action.toggleMaximizedPanel'); } catch {}
      currentMode = 'split';
    }
    if (currentMode === 'preview') {
      try { await exec('workbench.action.toggleMaximizeEditorGroup'); } catch {}
      currentMode = 'split';
    }
    await exec('workbench.action.closeSidebar');
    await exec('workbench.action.closeAuxiliaryBar');
    await exec('workbench.action.focusPanel');
    await exec('workbench.action.positionPanelRight');
    ensureTerminal().show(false);
    try { await exec('workbench.action.terminal.focus'); } catch {}
    await exec('vscode.setEditorLayout', { orientation: 0, groups: [{ size: 0.5 }, { size: 0.5 }] });
    await exec('workbench.action.evenEditorWidths');

    try {
      for (const g of vscode.window.tabGroups.all) {
        for (const t of [...g.tabs]) {
          const isFailed = t.label === 'Failed to Load Page' || t.label.includes('ERR_');
          const isStaleBrowser = t.input?.viewType === 'simpleBrowser.view' ||
                                 t.input?.viewType?.includes('preview') ||
                                 /127\.0\.0\.1|localhost|Simple Browser/.test(t.label) ||
                                 (!t.input?.uri && !t.isDirty);
          if (isFailed || (isStaleBrowser && t !== previewTabRef)) {
            vscode.window.tabGroups.close(t);
          }
        }
      }
    } catch {}

    const config = vscode.workspace.getConfiguration('vibe');
    const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, config.get('entryFile', 'index.html'));
    await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Two, preview: false });

    const previewUrl = config.get('previewUrl', '');
    let previewTab = previewTabRef;
    let previewGroup = previewTab && vscode.window.tabGroups.all.find(g => g.tabs.includes(previewTab));
    if (!previewGroup) {
      try {
        if (previewUrl) {
          let reachable = await checkPortReachable(previewUrl);
          if (!reachable) {
            const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (projectPath) {
              const pkgPath = path.join(projectPath, 'package.json');
              if (fs.existsSync(pkgPath)) {
                try {
                  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                  const scriptName = pkg.scripts?.dev ? 'dev' : pkg.scripts?.start ? 'start' : null;
                  if (scriptName) {
                    let devTerm = vscode.window.terminals.find(t => t.name === 'Vibe Dev Server');
                    if (!devTerm) {
                      devTerm = vscode.window.createTerminal({
                        name: 'Vibe Dev Server',
                        cwd: projectPath,
                        location: vscode.TerminalLocation.Panel
                      });
                      devTerm.sendText('npm run ' + scriptName);
                    }
                    for (let i = 0; i < 50; i++) {
                      await new Promise(r => setTimeout(r, 250));
                      reachable = await checkPortReachable(previewUrl);
                      if (reachable) break;
                    }
                  }
                } catch (e) {
                  output.appendLine('Failed to auto-start dev server: ' + e.message);
                }
              }
            }
          }
          try {
            for (const g of vscode.window.tabGroups.all) {
              for (const t of [...g.tabs]) {
                if (t.label === 'Failed to Load Page' || (!t.input?.uri && !t.isDirty)) {
                  vscode.window.tabGroups.close(t);
                }
              }
            }
          } catch {}
          if (reachable) {
            await exec('simpleBrowser.show', previewUrl);
          } else {
            await exec('livePreview.start.internalPreview.atFile', uri);
          }
        } else {
          await exec('livePreview.start.internalPreview.atFile', uri);
        }
        for (let attempt = 0; attempt < 50; attempt++) {
          previewGroup = vscode.window.tabGroups.all.find(g => {
            previewTab = g.tabs.find(t => /127\.0\.0\.1|localhost/.test(t.label) || (previewUrl && t.label === 'Simple Browser'));
            return !!previewTab;
          });
          if (previewGroup) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (e) {
        output.appendLine('Preview start fallback: ' + e.message);
      }
    }
    if (previewGroup && previewTab) {
      previewTabRef = previewTab;
      const focusName = ['First', 'Second', 'Third', 'Fourth'][previewGroup.viewColumn - 1];
      if (focusName) {
        await exec('workbench.action.focus' + focusName + 'EditorGroup');
        for (let i = 0; i < previewGroup.tabs.length && !previewTab.isActive; i++) await exec('workbench.action.nextEditorInGroup');
        if (previewTab.isActive) {
          await exec('moveActiveEditor', { to: 'first', by: 'group' });
        }
      }
    }
    await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Two, preview: false });
    await exec('vscode.setEditorLayout', { orientation: 0, groups: [{ size: 0.5 }, { size: 0.5 }] });
    await exec('workbench.action.focusPanel');
    ensureTerminal().show(false);
    try { await exec('workbench.action.terminal.focus'); } catch {}
    await exec('workbench.action.evenEditorWidths');
    setMode('split');
    record('layout-ready', {
      mode: 'split',
      previewUrl: previewUrl || 'http://127.0.0.1:3000',
      folders: vscode.workspace.workspaceFolders.map(f => f.uri.fsPath),
      groups: vscode.window.tabGroups.all.map(g => ({ column: g.viewColumn, tabs: g.tabs.map(t => t.label) }))
    });
  }
  async function toggle(options) {
    if (currentMode === 'terminal') {
      return restore();
    }
    if (currentMode === 'preview') {
      try { await exec('workbench.action.toggleMaximizeEditorGroup'); } catch {}
    }
    await exec('workbench.action.focusPanel');
    ensureTerminal().show(false);
    try { await exec('workbench.action.terminal.focus'); } catch {}
    await exec('workbench.action.toggleMaximizedPanel');
    setMode('terminal');
    record('terminal-full', { mode: currentMode });
  }
  async function togglePreview() {
    if (currentMode === 'preview') {
      return restore();
    }
    if (currentMode === 'terminal') {
      try { await exec('workbench.action.toggleMaximizedPanel'); } catch {}
    }
    let isAlive = previewTabRef && vscode.window.tabGroups.all.some(g => g.tabs.includes(previewTabRef));
    if (!isAlive) {
      await restore();
    }
    await exec('workbench.action.closePanel');
    await exec('workbench.action.focusFirstEditorGroup');
    await exec('workbench.action.toggleMaximizeEditorGroup');
    setMode('preview');
    record(currentMode === 'preview' ? 'preview-full' : 'layout-ready', {
      mode: currentMode,
      previewUrl: vscode.workspace.getConfiguration('vibe').get('previewUrl', '') || 'http://127.0.0.1:3000'
    });
  }
  async function openExternalBrowser() {
    const config = vscode.workspace.getConfiguration('vibe');
    const previewUrl = config.get('previewUrl', '') || 'http://127.0.0.1:3000';
    await vscode.env.openExternal(vscode.Uri.parse(previewUrl));
    record('external-browser-opened', { url: previewUrl });
  }
  async function pasteImage() {
    const terminal = ensureTerminal();
    terminal.show();
    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const imgDir = path.join(projectPath, '.vibe', 'images');
    try { fs.mkdirSync(imgDir, { recursive: true }); } catch {}
    const filename = `clip_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    const destPath = path.join(imgDir, filename);
    const psScript = `Add-Type -AssemblyName System.Windows.Forms; \$img = [System.Windows.Forms.Clipboard]::GetImage(); if (\$img) { \$img.Save('${destPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png); Write-Output 'OK'; } else { Write-Output 'EMPTY'; }`;
    try {
      const res = execSync(`powershell -NoProfile -Command "${psScript}"`, { encoding: 'utf8', timeout: 3000 }).trim();
      if (res.includes('OK')) {
        terminal.sendText(`"${destPath}" `, false);
        record('image-pasted', { path: destPath });
        vscode.window.showInformationMessage(`클립보드 이미지가 터미널에 첨부되었습니다: ${filename}`);
      } else {
        await exec('workbench.action.terminal.paste');
      }
    } catch (err) {
      await exec('workbench.action.terminal.paste');
    }
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
    vscode.commands.registerCommand('vibe.togglePreview', () => guarded(() => togglePreview())),
    vscode.commands.registerCommand('vibe.openExternalBrowser', () => guarded(() => openExternalBrowser())),
    vscode.commands.registerCommand('vibe.pasteImage', () => guarded(() => pasteImage())),
    vscode.window.onDidCloseTerminal(t => { if (t === terminal) terminal = undefined; })
  );
  record('activated');
  return guarded(restore);
}
module.exports = { activate };
