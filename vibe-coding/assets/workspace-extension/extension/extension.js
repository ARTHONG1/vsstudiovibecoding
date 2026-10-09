'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execSync, execFileSync } = require('child_process');
const { getMobileTunnelWebviewHtml } = require('./mobile-tunnel');
const { getOrStartTunnel, getTunnelStatus } = require('./tunnel-manager');
const { createPreviewForwarder } = require('./preview-forwarding');
const platform = require('./platform');
const { readObject } = require('./jsonc');

function checkPortReachable(urlStr) {
  return new Promise(resolve => {
    try {
      const u = new URL(urlStr);
      const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
      const client = u.protocol === 'https:' ? https : http;
      const host = (u.hostname === 'localhost') ? '127.0.0.1' : (u.hostname || '127.0.0.1');
      const req = client.get({ hostname: host, port, path: (u.pathname || '/') + u.search, timeout: 15000 }, res => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => {
        if (host === '127.0.0.1') {
          const fb = client.get({ hostname: 'localhost', port, path: (u.pathname || '/') + u.search, timeout: 15000 }, res => {
            res.resume();
            resolve(res.statusCode >= 200 && res.statusCode < 400);
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
  try { platform.setAppRoot(vscode.env && vscode.env.appRoot); } catch {}
  let savedPaths = {};
  try { savedPaths = readObject(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.vibe', 'remote-config.json')); } catch {}
  const pathConfig = vscode.workspace.getConfiguration('vibe');
  platform.setWorkspacePaths(pathConfig.get('dataRoot') || savedPaths.dataRoot, pathConfig.get('codePath') || savedPaths.codePath);
  const output = vscode.window.createOutputChannel('Vibe Coding');
  context.subscriptions.push(output);
  let terminal;
  let previewTabRef;
  let currentMode = context.workspaceState?.get?.('vibeMode', 'split') || 'split'; // 'split' | 'terminal' | 'preview'
 let busy = false;
  let mobileWebviewPanel;
  let mobileStatusTimer;
  const previewForwarder = createPreviewForwarder();
  context.subscriptions.push(previewForwarder);
  const exec = (command, ...args) => vscode.commands.executeCommand(command, ...args);

  const isWebClient = !!(vscode.UIKind && vscode.env.uiKind === vscode.UIKind.Web);
  const modeAlignment = isWebClient ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;
  const modePriority = isWebClient ? 1000000 : 1001;
  const terminalBtn = vscode.window.createStatusBarItem('vibe.terminalToggle', modeAlignment, modePriority);
  terminalBtn.name = 'Vibe Coding Terminal Toggle';
  terminalBtn.command = 'vibe.toggleTerminal';
  context.subscriptions.push(terminalBtn);

  const previewBtn = vscode.window.createStatusBarItem('vibe.previewToggle', modeAlignment, modePriority - 1);
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
  mobileBtn.tooltip = '공식 Codex Remote로 휴대폰에서 작업 이어가기 · 초기 설정 안내';
  mobileBtn.command = 'vibe.openMobileRemote';
  context.subscriptions.push(mobileBtn);

  function setMode(mode) {
    currentMode = mode;
    try { context.workspaceState?.update?.('vibeMode', mode); } catch {}
    updateStatusBars();
  }

  function updateStatusBars() {
    const isRemoteWeb = (vscode.UIKind && vscode.env.uiKind === vscode.UIKind.Web) || !!vscode.env.remoteName;
    if (isRemoteWeb) {
      timeMachineBtn.hide();
      mobileBtn.hide();
    } else {
      timeMachineBtn.show();
      mobileBtn.show();
    }
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
    if (isWebClient) {
      terminalBtn.text = '$(terminal) 터미널';
      previewBtn.text = '$(browser) 미리보기';
      terminalBtn.tooltip = 'Codex 터미널로 전환';
      previewBtn.tooltip = '프로젝트 미리보기로 전환';
    }
    terminalBtn.show();
    previewBtn.show();
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
  // macOS ships /usr/bin/git as an installer stub. Warn once instead of
  // letting every background checkpoint open the Command Line Tools dialog.
  let gitWarningShown = false;
  function gitReady(userInitiated) {
    let reason = null;
    try { reason = platform.gitUnavailableReason(); } catch {}
    if (!reason) return true;
    if (userInitiated || !gitWarningShown) {
      gitWarningShown = true;
      const message = reason === 'command-line-tools'
        ? 'Vibe 타임머신에는 macOS 개발자 도구(Command Line Tools)가 필요합니다. AI에게 설치를 요청하거나 터미널에서 xcode-select --install 을 실행한 뒤 다시 시도해주세요.'
        : 'Vibe 타임머신에는 Git이 필요합니다. AI에게 Git 설치를 요청한 뒤 다시 시도해주세요.';
      if (vscode.window.showWarningMessage) vscode.window.showWarningMessage(message);
      else vscode.window.showErrorMessage(message);
      record('git-unavailable', { reason });
    }
    return false;
  }
  function resolveCodexExecutable(projectPath) {
    const config = vscode.workspace.getConfiguration('vibe');
    let executable = config.get('codexPath');
    if (executable && fs.existsSync(executable)) return executable;
    try {
      const rcPath = path.join(projectPath, '.vibe', 'remote-config.json');
      if (fs.existsSync(rcPath)) {
        const rc = readObject(rcPath);
        if (rc && rc.codexPath && fs.existsSync(rc.codexPath)) return rc.codexPath;
      }
    } catch {}
    try {
      const discovered = platform.findCodexExecutable();
      if (discovered) return discovered;
    } catch {}
    return executable || '';
  }
  function ensureTerminal() {
    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const executable = resolveCodexExecutable(projectPath);
    if (!terminal || terminal.exitStatus !== undefined || terminal.creationOptions?.shellPath !== executable) {
      terminal = vscode.window.terminals.find(t => t.creationOptions?.env?.VIBE_PROJECT === projectPath && t.creationOptions?.shellPath === executable && t.exitStatus === undefined);
      if (!terminal) {
        if (!executable || !fs.existsSync(executable)) throw new Error('OpenAI Codex CLI executable was not found: ' + executable);
        terminal = vscode.window.createTerminal({
          name: 'Codex',
          shellPath: executable,
          shellArgs: vscode.workspace.getConfiguration('vibe').get('codexArgs', []),
          cwd: vscode.workspace.workspaceFolders[0].uri.fsPath,
          location: vscode.TerminalLocation.Panel,
          env: { ...platform.codexTerminalEnv(executable), VIBE_PROJECT: projectPath }
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
           let targetUrl = previewUrl;
           if ((vscode.UIKind && vscode.env.uiKind === vscode.UIKind.Web) || !!vscode.env.remoteName) {
              try {
                const ext = await vscode.env.asExternalUri(vscode.Uri.parse(previewUrl));
                targetUrl = ext.toString();
              } catch {}
            }
            await exec('simpleBrowser.show', targetUrl);
          } else {
            await exec('livePreview.start.internalPreview.atFile', uri);
          }
        } else {
          await exec('livePreview.start.internalPreview.atFile', uri);
        }
        for (let attempt = 0; attempt < 50; attempt++) {
          previewGroup = vscode.window.tabGroups.all.find(g => {
            previewTab = g.tabs.find(t => t.input?.viewType === 'simpleBrowser.view' || /127\.0\.0\.1|localhost/.test(t.label) || (previewUrl && ['Simple Browser', '간단한 브라우저'].includes(t.label)));
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
    if (isWebClient) {
      await exec('workbench.action.closeSidebar');
      await exec('workbench.action.closeAuxiliaryBar');
      await exec('workbench.action.positionPanelBottom');
      ensureTerminal().show(false);
      await exec('workbench.action.terminal.focus');
      if (currentMode !== 'terminal') await exec('workbench.action.toggleMaximizedPanel');
      setMode('terminal');
      record('terminal-full', { mode: currentMode });
      return;
    }
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
  function resolvePreviewUrl() {
    const configured = vscode.workspace.getConfiguration('vibe').get('previewUrl', '');
    if (configured && configured.trim()) return configured.trim();
    try {
      const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const saved = readObject(path.join(projectPath, '.vibe', 'remote-config.json')).previewUrl;
      const parsed = new URL(saved);
      if (['http:', 'https:'].includes(parsed.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) return parsed.toString();
    } catch {}
    return '';
  }
  async function togglePreview() {
    if (isWebClient) {
      const url = resolvePreviewUrl();
      if (!url) throw new Error('이 프로젝트의 미리보기 서버 주소가 설정되지 않았습니다. AI에게 현재 프로젝트의 서버를 확인하고 Vibe Coding 모바일 미리보기를 설정해달라고 요청해주세요. 터미널 화면을 유지합니다.');
      if (!(await checkPortReachable(url))) {
        throw new Error('개발 서버가 응답하지 않습니다: ' + url + '. PC에서 미리보기 서버 작업을 확인해주세요. 터미널 화면을 유지합니다.');
      }
      const external = await vscode.env.asExternalUri(vscode.Uri.parse(url));
      let forwardedUrl = external.toString();
      let forwarded = new URL(forwardedUrl);
      if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(forwarded.hostname)) {
        forwardedUrl = await previewForwarder.resolve(url);
        forwarded = new URL(forwardedUrl);
      }
      if (!['https:', 'http:'].includes(forwarded.protocol) || ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(forwarded.hostname)) {
        throw new Error('공식 포트 전달 주소가 아직 준비되지 않았습니다. 휴대폰에서 127.0.0.1은 PC 주소가 아닙니다. VS Code 포트(Ports)에서 ' + new URL(url).port + ' 포트를 Private으로 전달한 뒤 미리보기를 다시 눌러주세요.');
      }
      // Private tunnel authentication may refuse iframe embedding or third-party
      // cookies. Use a top-level browser page and leave the Codex terminal intact.
      if (forwarded.hostname.endsWith('.devtunnels.ms')) {
        const opened = await vscode.env.openExternal(vscode.Uri.parse(forwardedUrl));
        if (!opened) throw new Error('미리보기 브라우저를 열지 못했습니다. 외부 연결 확인 창에서 주소를 확인하고 허용해주세요.');
        record('preview-external-requested', { serverResponding: true, mobileRenderingVerified: false });
        return;
      }
      // Closing a maximized panel keeps its maximized state in VS Code.
      // Restore its size first, otherwise the next terminal button shrinks it.
      if (currentMode === 'terminal') await exec('workbench.action.toggleMaximizedPanel');
      await exec('workbench.action.closeSidebar');
      await exec('workbench.action.closeAuxiliaryBar');
      await exec('workbench.action.closePanel');
      await exec('vscode.setEditorLayout', { orientation: 0, groups: [{}] });
      await exec('simpleBrowser.show', forwardedUrl, { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
      setMode('preview');
      record('preview-open-requested', { mode: currentMode, serverResponding: true, mobileRenderingVerified: false });
      return;
    }
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
    try {
      if (platform.saveClipboardImage(destPath)) {
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
    let gitDir;
    try {
      const gitDirRaw = execSync('git rev-parse --git-dir', { cwd: p, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      gitDir = path.resolve(p, gitDirRaw);
    } catch {
      try {
        execSync('git init', { cwd: p, stdio: 'ignore' });
        gitDir = path.join(p, '.git');
      } catch {}
    }
    if (gitDir) {
      try {
        const excludeFile = path.join(gitDir, 'info', 'exclude');
        let excludeContent = fs.existsSync(excludeFile) ? fs.readFileSync(excludeFile, 'utf8') : '';
        if (!excludeContent.includes('.vibe')) {
          excludeContent += '\n.vibe\n.vibe/*\n';
          fs.writeFileSync(excludeFile, excludeContent, 'utf8');
        }
      } catch {}
    }
  }

  function getRecentPrompt(p) {
    try {
      const userHome = process.env.USERPROFILE || process.env.HOME;
      const sessionsDir = path.join(userHome, '.codex', 'sessions');
      if (!fs.existsSync(sessionsDir)) return null;
      const normProj = platform.comparablePath(p);
      const projectName = path.basename(p).normalize('NFC').toLowerCase();
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
        if (!content.normalize('NFC').toLowerCase().includes(projectName)) continue;

        const lines = content.split('\n');
        let matchingCwd = false;
        const userMessages = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const item = JSON.parse(line);
            if (item.type === 'session_meta' && item.payload?.cwd) {
              if (platform.comparablePath(item.payload.cwd) === normProj) matchingCwd = true;
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
    if (list.length > 50) {
      const pruned = list.slice(50);
      for (const old of pruned) {
        try { execSync('git update-ref -d refs/vibe/checkpoints/' + old.id, { cwd: p, stdio: 'ignore' }); } catch {}
      }
    }
    fs.writeFileSync(path.join(dir, 'checkpoints.json'), JSON.stringify(list.slice(0, 50), null, 2), 'utf8');
  }

  function protectCheckpoint(p, ref, sha) {
    execFileSync('git', ['update-ref', ref, sha], { cwd: p, stdio: 'ignore' });
    const actual = execFileSync('git', ['rev-parse', '--verify', ref], { cwd: p, encoding: 'utf8' }).trim();
    if (actual !== sha) throw new Error('Checkpoint protection verification failed: ' + ref);
  }
  // Checkpoint snapshots are internal objects. Supply their author identity only
  // to this process so commit-tree works without a user.name/user.email setting
  // and without writing anything to the user's Git config.
  const CHECKPOINT_IDENTITY = {
    GIT_AUTHOR_NAME: 'Vibe Coding Time Machine',
    GIT_AUTHOR_EMAIL: 'timemachine@vibe-coding.invalid',
    GIT_COMMITTER_NAME: 'Vibe Coding Time Machine',
    GIT_COMMITTER_EMAIL: 'timemachine@vibe-coding.invalid'
  };
  function commitCheckpointTree(p, treeSha, message) {
    return execFileSync('git', ['commit-tree', treeSha, '-m', message], {
      cwd: p,
      encoding: 'utf8',
      env: { ...process.env, ...CHECKPOINT_IDENTITY }
    }).trim();
  }
  function createShadowCheckpoint(p, customLabel) {
    try {
      if (!gitReady(false)) return null;
      initGit(p);
      const vibeDir = path.join(p, '.vibe');
      try { fs.mkdirSync(vibeDir, { recursive: true }); } catch {}
      const shadowIndex = path.join(vibeDir, 'shadow_index');
      const gitEnv = { ...process.env, GIT_INDEX_FILE: shadowIndex };
      const status = execFileSync('git', ['status', '--porcelain', '--', '.'], { cwd: p, encoding: 'utf8' }).trim();
      if (!status && !customLabel) return null;
      execSync('git add -A -- .', { cwd: p, env: gitEnv, stdio: 'ignore' });
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
        const oldId = list[0].id;
        const isSameTurn = (turnId && list[0].turnId === turnId) || (list[0].title === title);
        if (isSameTurn) {
          const commitMsg = 'Vibe Checkpoint: ' + title + ' (' + timeStr + ')';
          const commitSha = commitCheckpointTree(p, treeSha, commitMsg);
          list[0].id = commitSha.slice(0, 7);
          list[0].commitSha = commitSha;
          list[0].treeSha = treeSha;
          list[0].timeStr = timeStr;
          list[0].timestamp = now.toISOString();
          list[0].fileSummary = fileSummary;
          list[0].changedCount = changedFiles.length;
          protectCheckpoint(p, 'refs/vibe/checkpoints/' + list[0].id, commitSha);
          try {
            if (oldId && oldId !== list[0].id) {
              execFileSync('git', ['update-ref', '-d', 'refs/vibe/checkpoints/' + oldId], { cwd: p, stdio: 'ignore' });
            }
          } catch {}
          saveCheckpoints(p, list);
          return list[0];
        }
      }

      const commitMsg = 'Vibe Checkpoint: ' + title + ' (' + timeStr + ')';
      const commitSha = commitCheckpointTree(p, treeSha, commitMsg);
      const record = { id: commitSha.slice(0, 7), commitSha, treeSha, title, turnId: turnId || null, fileSummary, changedCount: changedFiles.length, timestamp: now.toISOString(), timeStr };
      list.unshift(record);
      protectCheckpoint(p, 'refs/vibe/checkpoints/' + record.id, commitSha);
      saveCheckpoints(p, list);
      return record;
    } catch (e) { vscode.window.showErrorMessage('체크포인트 저장 실패: ' + e.message); return null; }
  }

  async function restoreShadowCheckpoint(p, targetSha, targetTitle) {
    try {
      initGit(p);
      const vibeDir = path.join(p, '.vibe');
      try { fs.mkdirSync(vibeDir, { recursive: true }); } catch {}
      const shadowIndex = path.join(vibeDir, 'shadow_index');
      const gitEnv = { ...process.env, GIT_INDEX_FILE: shadowIndex };
      let commitSha = null;
      try {
        execSync('git add -A -- .', { cwd: p, env: gitEnv, stdio: 'ignore' });
        const treeSha = execSync('git write-tree', { cwd: p, env: gitEnv, encoding: 'utf8' }).trim();
        commitSha = commitCheckpointTree(p, treeSha, 'Vibe Safety Backup');
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        protectCheckpoint(p, 'refs/vibe/safety', commitSha);
        const safetyFile = path.join(p, '.vibe', 'safety.json');
        fs.writeFileSync(safetyFile, JSON.stringify({ sha: commitSha, title: '롤백 직전 코드 (취소/Redo용)', timeStr }), 'utf8');
      } catch (err) {
        throw new Error('롤백 직전 안전 백업 생성에 실패하여 작업을 중단했습니다: ' + err.message);
      }

      if (!commitSha) {
        throw new Error('안전 백업 해시가 생성되지 않아 파일 보호를 위해 롤백을 중단합니다.');
      }

      try { fs.rmSync(shadowIndex, { force: true }); } catch {}
      execSync('git read-tree ' + targetSha, { cwd: p, env: gitEnv, stdio: 'ignore' });
      execSync('git checkout-index -a -f', { cwd: p, env: gitEnv, stdio: 'ignore' });
      execSync('git clean -fd -e .vibe', { cwd: p, env: gitEnv, stdio: 'ignore' });
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
    if (!gitReady(true)) return;
    initGit(p);
    const list = getCheckpoints(p).filter(cp => !cp.title.includes('롤백 직전 자동 백업') && !cp.title.includes('checkpoints.json'));
    let safety = null;
    const safetyFile = path.join(p, '.vibe', 'safety.json');
    try { if (fs.existsSync(safetyFile)) safety = JSON.parse(fs.readFileSync(safetyFile, 'utf8')); } catch {}

    if (!list || list.length === 0) {
      const act = await vscode.window.showInformationMessage('저장된 대화 시점이 없습니다. 현재 상태를 스냅샷으로 저장하시겠습니까?', '스냅샷 저장');
      if (act === '스냅샷 저장') {
        if (createShadowCheckpoint(p, '최초 수동 스냅샷')) vscode.window.showInformationMessage('현재 시점의 스냅샷이 저장되었습니다.');
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
        if (createShadowCheckpoint(p, input)) vscode.window.showInformationMessage('스냅샷 [' + input + '] 저장 완료');
      }
      return;
    }
    if (selected.sha) {
      await restoreShadowCheckpoint(p, selected.sha, selected.title);
    }
  }

  async function openMobileRemote() {
    const folders = vscode.workspace.workspaceFolders || [];
    let folder = folders[0];
    if (folders.length > 1) {
      folder = await vscode.window.showWorkspaceFolderPick({ placeHolder: '휴대폰에서 이어서 작업할 프로젝트를 선택하세요' });
      if (!folder) return;
    }
    const p = folder ? folder.uri.fsPath : '';
    if (mobileWebviewPanel) {
      mobileWebviewPanel.reveal(vscode.ViewColumn.One);
    } else {
      mobileWebviewPanel = vscode.window.createWebviewPanel(
        'vibeMobileRemote', '📱 Vibe Coding 모바일 원격 작업',
        vscode.ViewColumn.One, { enableScripts: true, localResourceRoots: [] }
      );
      mobileWebviewPanel.onDidDispose(() => { mobileWebviewPanel = null; clearInterval(mobileStatusTimer); });
      mobileWebviewPanel.webview.onDidReceiveMessage(async message => {
        if (message && message.command === 'copy') {
          await vscode.env.clipboard.writeText(message.text || '');
          vscode.window.showInformationMessage('모바일 원격 접속 주소가 클립보드에 복사되었습니다.');
        }
      });
      context.subscriptions.push(mobileWebviewPanel);
    }
    mobileWebviewPanel.webview.html = getMobileTunnelWebviewHtml({ projectPath: p, loading: true });
    try {
      const tunnelInfo = await getOrStartTunnel(p, { workspaceFile: vscode.workspace.workspaceFile?.fsPath });
      if (mobileWebviewPanel) {
        mobileWebviewPanel.webview.html = getMobileTunnelWebviewHtml({ projectPath: p, tunnelUrl: tunnelInfo.url, tunnelName: tunnelInfo.tunnelName });
      }
      record('mobile-remote-tunnel-ready', { url: tunnelInfo.url });
      if (mobileStatusTimer) clearInterval(mobileStatusTimer);
      let checking = false;
      mobileStatusTimer = setInterval(async () => {
        if (checking || !mobileWebviewPanel) return;
        checking = true;
        try {
          const status = await getTunnelStatus();
          if (!status.tunnel || status.tunnel.tunnel !== 'Connected' || !status.tunnel.has_editor_link) {
            mobileWebviewPanel.webview.html = getMobileTunnelWebviewHtml({ error: '터널 연결이 끊겼거나 원격 서버 연결을 준비 중입니다. PC의 모바일 버튼을 다시 눌러 상태를 확인해주세요.' });
            clearInterval(mobileStatusTimer);
          }
        } catch (error) {
          if (mobileWebviewPanel) mobileWebviewPanel.webview.html = getMobileTunnelWebviewHtml({ error: error.message });
          clearInterval(mobileStatusTimer);
        } finally { checking = false; }
      }, 10000);
      context.subscriptions.push({ dispose() { clearInterval(mobileStatusTimer); } });
    } catch (err) {
      if (mobileWebviewPanel) {
        mobileWebviewPanel.webview.html = getMobileTunnelWebviewHtml({ projectPath: p, error: err.message });
      }
      record('mobile-remote-tunnel-error', { error: err.message });
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
    vscode.commands.registerCommand('vibe.openMobileRemote', () => guarded(() => openMobileRemote())),
    vscode.commands.registerCommand('vibe.restoreCheckpoint', () => guarded(() => showTimeMachinePicker(vscode.workspace.workspaceFolders[0].uri.fsPath))),
    vscode.commands.registerCommand('vibe.createCheckpoint', () => guarded(async () => {
      const p = vscode.workspace.workspaceFolders[0].uri.fsPath;
      if (!gitReady(true)) return;
      const input = await vscode.window.showInputBox({ prompt: '스냅샷 이름을 입력하세요', placeHolder: '예: 결제창 수정 전' });
      if (input) {
        if (createShadowCheckpoint(p, input)) vscode.window.showInformationMessage('스냅샷 [' + input + '] 저장 완료');
      }
    })),
    vscode.window.onDidCloseTerminal(t => { if (t === terminal) terminal = undefined; }),
  );
  updateStatusBars();
  record('activated', { language: vscode.env && vscode.env.language });
  return guarded(async () => {
    if (vscode.UIKind && vscode.env.uiKind === vscode.UIKind.Web) {
      await exec('workbench.action.closeSidebar');
      await exec('workbench.action.closeAuxiliaryBar');
      await exec('workbench.action.positionPanelBottom');
      currentMode = 'split';
      await toggle();
    } else {
      await restore();
    }
  });
}
module.exports = { activate };
