'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const { getMobileTunnelWebviewHtml } = require('./mobile-tunnel');
const { generateQRCodeSVG } = require('./qrcode');

function checkPortReachable(urlStr) {
  return new Promise(resolve => {
    try {
      const u = new URL(urlStr);
      const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
      const client = u.protocol === 'https:' ? https : http;
      const host = (u.hostname === 'localhost') ? '127.0.0.1' : (u.hostname || '127.0.0.1');
      const req = client.get({ hostname: host, port, path: u.pathname || '/', timeout: 600 }, res => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (host === '127.0.0.1') {
          const fb = client.get({ hostname: 'localhost', port, path: u.pathname || '/', timeout: 400 }, res => {
            res.resume();
            resolve(true);
          });
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
  if (vscode.workspace.getConfiguration('vibe').get('enabled') === false) return;
  const output = vscode.window.createOutputChannel('Vibe Coding');
  context.subscriptions.push(output);
  let terminal;
  let previewTabRef;
  let currentMode = context.workspaceState?.get?.('vibeMode', 'split') || 'split'; // 'split' | 'terminal' | 'preview'
 let busy = false;
  let mobileWebviewPanel;
  const exec = (command, ...args) => vscode.commands.executeCommand(command, ...args);

  const terminalBtn = vscode.window.createStatusBarItem('vibe.terminalToggle', vscode.StatusBarAlignment.Right, 1001);
  terminalBtn.name = 'Vibe Coding Terminal Toggle';
  terminalBtn.command = 'vibe.toggleTerminal';
  context.subscriptions.push(terminalBtn);

  const previewBtn = vscode.window.createStatusBarItem('vibe.previewToggle', vscode.StatusBarAlignment.Right, 1000);
  previewBtn.name = 'Vibe Coding Preview Toggle';
  previewBtn.command = 'vibe.togglePreview';
  context.subscriptions.push(previewBtn);

  const timeMachineBtn = vscode.window.createStatusBarItem('vibe.timeMachine', vscode.StatusBarAlignment.Right, 999);
  timeMachineBtn.name = 'Vibe Coding Time Machine';
  timeMachineBtn.text = '$(history) 타임머신';
  timeMachineBtn.tooltip = '원하는 과거 대화/작업 시점으로 롤백합니다 (Vibe 타임머신)';
  timeMachineBtn.command = 'vibe.restoreCheckpoint';
  context.subscriptions.push(timeMachineBtn);

  const mobileBtn = vscode.window.createStatusBarItem('vibe.mobileRemoteToggle', vscode.StatusBarAlignment.Right, 998);
  mobileBtn.name = 'Vibe Coding Mobile Remote';
  mobileBtn.text = '$(device-mobile) 모바일';
  mobileBtn.tooltip = '스마트폰으로 AI 원격 제어 및 모바일 화면 미리보기 (Vibe Coding)';
  mobileBtn.command = 'vibe.openMobileRemote';
  context.subscriptions.push(mobileBtn);

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
    timeMachineBtn.show();
    mobileBtn.show();
  }
  updateStatusBars();

  const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (projectRoot && typeof vscode.workspace.createFileSystemWatcher === 'function') {
    setTimeout(() => {
      const existing = getCheckpoints(projectRoot);
      if (!existing || existing.length === 0) {
        createShadowCheckpoint(projectRoot, '🚀 프로젝트 시작 시점');
      }
    }, 1500);
    let debounceTimer = null;
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    const onFileChanged = (uri) => {
      const p = uri.fsPath;
      if (p.includes('.git') || p.includes('.vibe') || p.includes('node_modules') || p.includes('.vscode')) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        createShadowCheckpoint(projectRoot);
      }, 2000);
    };
    watcher.onDidChange(onFileChanged);
    watcher.onDidCreate(onFileChanged);
    watcher.onDidDelete(onFileChanged);
    context.subscriptions.push(watcher);
  }

  function record(event, detail = {}) {
    const data = { time: new Date().toISOString(), event, ...detail };
    output.appendLine(JSON.stringify(data));
    fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
    fs.appendFileSync(path.join(context.globalStorageUri.fsPath, 'status.jsonl'), JSON.stringify(data) + '\n');
  }
  function ensureTerminal() {
    const config = vscode.workspace.getConfiguration('vibe');
    const executable = config.get('codexPath');
    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    if (!terminal || terminal.exitStatus !== undefined || terminal.creationOptions?.shellPath !== executable) {
      terminal = vscode.window.terminals.find(t => t.creationOptions?.env?.VIBE_PROJECT === projectPath && t.creationOptions?.shellPath === executable && t.exitStatus === undefined);
      if (!terminal) {
        if (!executable || !fs.existsSync(executable)) throw new Error('OpenAI Codex CLI executable was not found: ' + executable);
        terminal = vscode.window.createTerminal({
          name: 'Codex',
          shellPath: executable,
          shellArgs: [],
          cwd: vscode.workspace.workspaceFolders[0].uri.fsPath,
          location: vscode.TerminalLocation.Panel,
          env: {
            CODEX_CALLER: 'vscode',
            VIBE_PROJECT: projectPath,
            LANG: 'ko_KR.UTF-8',
            PYTHONIOENCODING: 'utf-8'
          }
        });
        record('terminal-created', { agent: 'Codex' });
      }
    }
    try {
      for (const t of vscode.window.terminals) {
        if (t !== terminal && t.creationOptions?.env?.VIBE_PROJECT === projectPath) {
          t.dispose();
        }
      }
    } catch {}
    terminal.show(false);
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

    const config = vscode.workspace.getConfiguration('vibe');
    const entryFileName = path.basename(config.get('entryFile', 'index.html'));

    try {
      for (const g of vscode.window.tabGroups.all) {
        for (const t of [...g.tabs]) {
          const isFailed = t.label === 'Failed to Load Page' || t.label.includes('ERR_');
          const isSimpleBrowser = t.input?.viewType === 'simpleBrowser.view';
          const isLivePreview = typeof t.input?.viewType === 'string' && t.input.viewType.includes('preview');
          const isLocalhostLabel = /127\.0\.0\.1|localhost|Simple Browser|Live Preview/i.test(t.label);
          const isStaleBrowser = (isSimpleBrowser || isLivePreview || isLocalhostLabel);
          const isWrongColumnEntry = g.viewColumn === vscode.ViewColumn.One && t.input?.uri && t.input.uri.fsPath.endsWith(entryFileName) && !t.isDirty;
          if (isFailed || (isStaleBrowser && t !== previewTabRef) || isWrongColumnEntry) {
            vscode.window.tabGroups.close(t);
          }
        }
      }
    } catch {}

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
            for (let i = 0; i < 40; i++) {
              await new Promise(r => setTimeout(r, 250));
              reachable = await checkPortReachable(previewUrl);
              if (reachable) break;
            }
          }
          try {
            for (const g of vscode.window.tabGroups.all) {
              for (const t of [...g.tabs]) {
                if (t.label === 'Failed to Load Page' || t.label.includes('ERR_')) {
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

  function initGit(p) {
    const gitDir = path.join(p, '.git');
    if (!fs.existsSync(gitDir)) {
      try {
        execSync('git init', { cwd: p, stdio: 'ignore' });
        execSync('git config user.name "Vibe Coding"', { cwd: p, stdio: 'ignore' });
        execSync('git config user.email "vibe@local"', { cwd: p, stdio: 'ignore' });
      } catch {}
    }
    try {
      const excludeFile = path.join(gitDir, 'info', 'exclude');
      let excludeContent = fs.existsSync(excludeFile) ? fs.readFileSync(excludeFile, 'utf8') : '';
      if (!excludeContent.includes('.vibe')) {
        excludeContent += '\n.vibe\n.vibe/*\n';
        fs.writeFileSync(excludeFile, excludeContent, 'utf8');
        try { execSync('git rm -rf --cached .vibe', { cwd: p, stdio: 'ignore' }); } catch {}
      }
    } catch {}
  }

  function getRecentPrompt(p) {
    try {
      const userHome = process.env.USERPROFILE || process.env.HOME;
      const sessionsDir = path.join(userHome, '.codex', 'sessions');
      if (!fs.existsSync(sessionsDir)) return null;
      const normProj = path.normalize(p).toLowerCase();
      const isApproval = /^(응|어|네|예|진행|진행해|해줘|확인|ㅇㅇ|ㅇㅋ|yes|y|ok|okay|sure|go|proceed|do it|1|2)\s*$/i;

      const candidateFiles = [];
      const now = new Date();
      for (let d = 0; d < 2; d++) {
        const dt = new Date(now.getTime() - d * 86400000);
        const dir = path.join(sessionsDir, String(dt.getFullYear()), String(dt.getMonth() + 1).padStart(2, '0'), String(dt.getDate()).padStart(2, '0'));
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            if (f.endsWith('.jsonl')) {
              candidateFiles.push({ path: path.join(dir, f), time: fs.statSync(path.join(dir, f)).mtimeMs });
            }
          }
        }
      }
      candidateFiles.sort((a, b) => b.time - a.time);

      for (const cf of candidateFiles) {
        const content = fs.readFileSync(cf.path, 'utf8');
        if (!content.toLowerCase().includes(path.basename(p).toLowerCase())) continue;

        const lines = content.split('\n');
        let matchingCwd = false;
        const userMessages = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const item = JSON.parse(line);
            if (item.type === 'session_meta' && item.payload?.cwd) {
              if (path.normalize(item.payload.cwd).toLowerCase() === normProj) matchingCwd = true;
            }
            if (matchingCwd) {
              let text = null;
              let turnId = null;
              if (item.type === 'event_msg' && item.payload?.item?.type === 'UserMessage') {
                const tEl = item.payload.item.content?.find(c => c.type === 'text');
                if (tEl?.text) text = tEl.text;
                turnId = item.payload.turn_id;
              } else if (item.type === 'response_item' && item.payload?.role === 'user') {
                const tEl = item.payload.content?.find(c => c.type === 'input_text');
                if (tEl?.text && !tEl.text.startsWith('<environment_context>')) text = tEl.text;
                turnId = item.internal_chat_message_metadata_passthrough?.turn_id;
              }
              if (text) {
                const clean = text.replace(/<image[^>]*>/gi, '').replace(/\[Image\s*#[0-9]+\]/gi, '').replace(/<\/image>/gi, '').replace(/^[a-zA-Z]\[Image[^\]]*\]/gi, '').trim();
                if (clean && !clean.startsWith('<')) {
                  userMessages.push({ text: clean, turnId });
                }
              }
            }
          } catch {}
        }
        if (userMessages.length > 0) {
          let chosen = null;
          for (let i = userMessages.length - 1; i >= 0; i--) {
            if (!isApproval.test(userMessages[i].text)) {
              chosen = userMessages[i];
              break;
            }
          }
          if (!chosen) chosen = userMessages[userMessages.length - 1];
          return { prompt: chosen.text.slice(0, 50), turnId: chosen.turnId };
        }
      }
    } catch {}
    return null;
  }

  function getCheckpoints(p) {
    const f = path.join(p, '.vibe', 'checkpoints.json');
    try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
    return [];
  }

  function saveCheckpoints(p, list) {
    const dir = path.join(p, '.vibe');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    fs.writeFileSync(path.join(dir, 'checkpoints.json'), JSON.stringify(list.slice(0, 50), null, 2), 'utf8');
  }

  function createShadowCheckpoint(p, customLabel) {
    try {
      initGit(p);
      const vibeDir = path.join(p, '.vibe');
      try { fs.mkdirSync(vibeDir, { recursive: true }); } catch {}
      const shadowIndex = path.join(vibeDir, 'shadow_index');
      const gitEnv = { ...process.env, GIT_INDEX_FILE: shadowIndex };
      const status = execSync('git status --porcelain', { cwd: p, encoding: 'utf8' }).trim();
      if (!status && !customLabel) return null;
      execSync('git add -A', { cwd: p, env: gitEnv, stdio: 'ignore' });
      const treeSha = execSync('git write-tree', { cwd: p, env: gitEnv, encoding: 'utf8' }).trim();
      const list = getCheckpoints(p);
      if (list.length > 0 && list[0].treeSha === treeSha && !customLabel) return null;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const promptInfo = customLabel ? { prompt: customLabel, turnId: null } : getRecentPrompt(p);
      const prompt = promptInfo?.prompt;
      const turnId = promptInfo?.turnId;
      const changedFiles = status ? status.split('\n').filter(Boolean).map(l => l.slice(3).trim()).filter(f => !f.startsWith('.vibe')) : [];
      const fileSummary = changedFiles.length > 0 ? (changedFiles[0] + (changedFiles.length > 1 ? (' 외 ' + (changedFiles.length - 1) + '개') : '')) : '현재 상태';
      const title = prompt ? (prompt.startsWith('"') ? prompt : ('"' + prompt + '"')) : (fileSummary + ' 완료');

      // ONE CHECKPOINT PER CONVERSATION TURN:
      // If the latest checkpoint in the list belongs to the SAME turn, update it with the final state!
      if (list.length > 0 && !customLabel) {
        const isSameTurn = (turnId && list[0].turnId === turnId) || (list[0].title === title);
        if (isSameTurn) {
          const commitMsg = 'Vibe Checkpoint: ' + title + ' (' + timeStr + ')';
          const commitSha = execSync('git commit-tree ' + treeSha + ' -m "' + commitMsg.replace(/"/g, '\\"') + '"', { cwd: p, encoding: 'utf8' }).trim();
          list[0].id = commitSha.slice(0, 7);
          list[0].commitSha = commitSha;
          list[0].treeSha = treeSha;
          list[0].timeStr = timeStr;
          list[0].timestamp = now.toISOString();
          list[0].fileSummary = fileSummary;
          list[0].changedCount = changedFiles.length;
          saveCheckpoints(p, list);
          return list[0];
        }
      }

      const commitMsg = 'Vibe Checkpoint: ' + title + ' (' + timeStr + ')';
      const commitSha = execSync('git commit-tree ' + treeSha + ' -m "' + commitMsg.replace(/"/g, '\\"') + '"', { cwd: p, encoding: 'utf8' }).trim();
      const record = { id: commitSha.slice(0, 7), commitSha, treeSha, title, turnId: turnId || null, fileSummary, changedCount: changedFiles.length, timestamp: now.toISOString(), timeStr };
      list.unshift(record);
      saveCheckpoints(p, list);
      return record;
    } catch (e) { return null; }
  }

  async function restoreShadowCheckpoint(p, targetSha, targetTitle) {
    try {
      initGit(p);
      const vibeDir = path.join(p, '.vibe');
      try { fs.mkdirSync(vibeDir, { recursive: true }); } catch {}
      const shadowIndex = path.join(vibeDir, 'shadow_index');
      const gitEnv = { ...process.env, GIT_INDEX_FILE: shadowIndex };
      try {
        execSync('git add -A', { cwd: p, env: gitEnv, stdio: 'ignore' });
        const treeSha = execSync('git write-tree', { cwd: p, env: gitEnv, encoding: 'utf8' }).trim();
        const commitSha = execSync('git commit-tree ' + treeSha + ' -m "Vibe Safety Backup"', { cwd: p, encoding: 'utf8' }).trim();
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        const safetyFile = path.join(p, '.vibe', 'safety.json');
        fs.writeFileSync(safetyFile, JSON.stringify({ sha: commitSha, title: '롤백 직전 코드 (취소/Redo용)', timeStr }), 'utf8');
      } catch {}

      execSync('git checkout ' + targetSha + ' -- .', { cwd: p, stdio: 'ignore' });
      execSync('git clean -fd -e .vibe', { cwd: p, stdio: 'ignore' });
      if (vscode.window.activeTextEditor && !vscode.window.activeTextEditor.document.isUntitled) {
        await vscode.commands.executeCommand('workbench.action.files.revert');
      }
      const entry = vscode.workspace.getConfiguration('vibe').get('entryFile', 'index.html');
      const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, entry);
      try { await vscode.commands.executeCommand('livePreview.start.internalPreview.atFile', uri); } catch {}
      vscode.window.showInformationMessage('Vibe 타임머신: [' + targetTitle + '] 시점으로 안전하게 복원되었습니다.');
      return true;
    } catch (e) {
      vscode.window.showErrorMessage('Vibe 타임머신 복원 실패: ' + e.message);
      return false;
    }
  }

  async function showTimeMachinePicker(p) {
    initGit(p);
    const list = getCheckpoints(p).filter(cp => !cp.title.includes('롤백 직전 자동 백업') && !cp.title.includes('checkpoints.json'));
    let safety = null;
    const safetyFile = path.join(p, '.vibe', 'safety.json');
    try { if (fs.existsSync(safetyFile)) safety = JSON.parse(fs.readFileSync(safetyFile, 'utf8')); } catch {}

    if (!list || list.length === 0) {
      const act = await vscode.window.showInformationMessage('저장된 대화 시점이 없습니다. 현재 상태를 스냅샷으로 저장하시겠습니까?', '스냅샷 저장');
      if (act === '스냅샷 저장') {
        createShadowCheckpoint(p, '최초 수동 스냅샷');
        vscode.window.showInformationMessage('현재 시점의 스냅샷이 저장되었습니다.');
      }
      return;
    }
    const items = [];
    if (safety && safety.sha) {
      items.push({
        label: '$(discard) 방금 실행한 롤백 취소 (원래대로 되돌리기)',
        description: safety.timeStr,
        detail: '방금 롤백하기 직전 상태로 즉시 재복원합니다',
        sha: safety.sha,
        title: safety.title
      });
      items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
    }

    items.push({
      label: '$(zap) 직전 대화 시점으로 즉시 롤백: ' + list[0].title,
      description: list[0].title,
      detail: list[0].timeStr + ' (' + list[0].fileSummary + ')',
      sha: list[0].commitSha,
      title: list[0].title
    });
    items.push({
      label: '$(add) 현재 상태를 새 체크포인트로 저장...',
      isCreate: true
    });
    items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
    for (const cp of list) {
      items.push({
        label: '$(history) [' + cp.timeStr + '] ' + cp.title,
        description: cp.id,
        detail: '파일: ' + cp.fileSummary + ' (커밋 ' + cp.id + ')',
        sha: cp.commitSha,
        title: cp.title
      });
    }
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '되돌아갈 대화/작업 시점을 선택하세요 (Vibe 타임머신)'
    });
    if (!selected) return;
    if (selected.isCreate) {
      const input = await vscode.window.showInputBox({ prompt: '스냅샷 이름을 입력하세요', placeHolder: '예: 메인 레이아웃 완성 시점' });
      if (input) {
        createShadowCheckpoint(p, input);
        vscode.window.showInformationMessage('스냅샷 [' + input + '] 저장 완료');
      }
      return;
    }
    if (selected.sha) {
      await restoreShadowCheckpoint(p, selected.sha, selected.title);
    }
  }

  async function openMobileRemote() {
    const tunnelUrl = 'https://vscode.dev/agents';
    const qrSvg = generateQRCodeSVG(tunnelUrl, { size: 240, margin: 2 });
    if (mobileWebviewPanel) {
      mobileWebviewPanel.reveal(vscode.ViewColumn.One);
    } else {
      mobileWebviewPanel = vscode.window.createWebviewPanel(
        'vibeMobileRemote',
        '📱 Vibe Coding 모바일 원격 AI 에이전트',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      mobileWebviewPanel.onDidDispose(() => {
        mobileWebviewPanel = null;
      });
      mobileWebviewPanel.webview.onDidReceiveMessage(async message => {
        if (message.command === 'turnOnTunnel') {
          await exec('workbench.action.remoteTunnel.turnOn');
        } else if (message.command === 'openUrl' && message.url) {
          await vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
      });
    }
    mobileWebviewPanel.webview.html = getMobileTunnelWebviewHtml({ tunnelUrl, qrSvg });
    record('mobile-remote-opened', { url: tunnelUrl });
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
    vscode.commands.registerCommand('vibe.openMobileRemote', () => guarded(() => openMobileRemote())),
    vscode.commands.registerCommand('vibe.restoreCheckpoint', () => guarded(() => showTimeMachinePicker(vscode.workspace.workspaceFolders[0].uri.fsPath))),
    vscode.commands.registerCommand('vibe.createCheckpoint', () => guarded(async () => {
      const p = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const input = await vscode.window.showInputBox({ prompt: '스냅샷 이름을 입력하세요', placeHolder: '예: 결제창 수정 전' });
      if (input) {
        createShadowCheckpoint(p, input);
        vscode.window.showInformationMessage('스냅샷 [' + input + '] 저장 완료');
      }
    })),
    vscode.window.onDidCloseTerminal(t => { if (t === terminal) terminal = undefined; }),
  );
  record('activated');
  return guarded(restore);
}
module.exports = { activate };
