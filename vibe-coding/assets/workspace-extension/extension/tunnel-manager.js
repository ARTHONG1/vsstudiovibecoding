'use strict';
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const platform = require('./platform');

let activeTunnel = null;
let startingPromise = null;

function tunnelBinaryName(options = {}) {
  return platform.currentPlatform(options) === 'win32' ? 'code-tunnel.exe' : 'code-tunnel';
}

function extractTunnelUrl(text) {
  if (!text) return null;
  const match = text.match(/https:\/\/vscode\.dev\/tunnel\/[^\s"'<>]+/i);
  return match ? match[0].trim() : null;
}

// vscode.dev may preserve percent-encoded path segments literally. Prefer the
// existing ASCII workspace file so its folders and settings are loaded together.
// Windows paths become /c:/..., POSIX paths keep their single leading slash.
function buildProjectTunnelUrl(detectedUrl, projectPath, workspaceFile) {
  const match = String(detectedUrl).match(/^https:\/\/vscode\.dev\/tunnel\/([a-z0-9-]+)(?:\/|$)/i);
  if (!match) throw new Error('Invalid VS Code tunnel URL');
  const safe = value => typeof value === 'string' && (/^[a-z]:[\\/][a-z0-9_./:\\-]+$/i.test(value) || (/^\/[a-z0-9_./-]+$/i.test(value) && !value.split('/').includes('..')));
  let target = projectPath;
  if (workspaceFile && safe(workspaceFile) && fs.existsSync(workspaceFile) && /\.code-workspace$/i.test(workspaceFile)) {
    target = workspaceFile;
  }
  if (!safe(target)) throw new Error('모바일 연결에는 공백·한글이 없는 경로의 .code-workspace 파일이 필요합니다. Vibe Coding 작업 영역으로 열어주세요.');
  return 'https://vscode.dev/tunnel/' + match[1] + '/' + target.replace(/\\/g, '/').replace(/^\/+/, '');
}

function sanitizeErrorText(text) {
  if (!text) return '';
  return String(text)
    .replace(/(token|secret|password|bearer|auth[_-]?code)[=:\s]+[A-Za-z0-9_\-\.]{8,}/gi, '$1=***');
}

// Windows: <VS Code>\bin\code-tunnel.exe
// macOS:   Visual Studio Code.app/Contents/Resources/app/bin/code-tunnel
function findCodeTunnelCli(options = {}) {
  return platform.findCodeTunnelExecutable(options);
}

function findCodeCli(options = {}) {
  const tunnelCli = findCodeTunnelCli(options);
  if (tunnelCli) return tunnelCli;
  for (const c of platform.codeCliCandidates(options)) {
    if (c && fs.existsSync(c)) return c;
  }
  return platform.currentPlatform(options) === 'win32' ? 'code-tunnel.exe' : 'code-tunnel';
}

function findVsixPath(options = {}) {
  const candidate = path.join(platform.vibeRoot(options), 'vibe-workspace.vsix');
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

async function getOrStartTunnel(projectPath, options = {}) {
  if (options.spawn && !options.getStatus && activeTunnel && activeTunnel.url) {
    return { ...activeTunnel, url: buildProjectTunnelUrl(activeTunnel.url, projectPath, options.workspaceFile) };
  }
  if (startingPromise) {
    return startingPromise.then(info => ({ ...info, url: buildProjectTunnelUrl(info.url, projectPath, options.workspaceFile) }));
  }

  startingPromise = (async () => {
    let releaseLock = () => {};
    try {
      const cli = (options.findCli || findCodeTunnelCli)(options);
      if (!cli) throw new Error('VS Code 터널 실행 파일(' + tunnelBinaryName(options) + ')을 찾을 수 없습니다.');
      if (!options.spawn) ensureRemoteExtension(options);
      // Injected children are isolated tests. Real windows share CLI state and
      // an exclusive startup lock, instead of launching one tunnel per host.
      const readStatus = options.getStatus || (options.spawn ? async () => ({}) : () => getTunnelStatus(cli));
      if (!options.spawn) releaseLock = await acquireStartupLock(options);
      const status = await readStatus();
      if (status.tunnel) {
        if (status.tunnel.tunnel !== 'Connected' || !status.tunnel.has_editor_link) {
          throw new Error('기존 터널의 연결이 준비되지 않았습니다. 잠시 후 모바일 버튼을 다시 눌러주세요. 다른 터널은 종료하지 않았습니다.');
        }
        return { url: buildProjectTunnelUrl('https://vscode.dev/tunnel/' + status.tunnel.name + '/', projectPath, options.workspaceFile), tunnelName: status.tunnel.name, reused: true };
      }
      activeTunnel = null;
      const result = await startTunnelProcess(projectPath, options);
      if (!options.spawn) {
        let connected = false;
        for (let attempt = 0; attempt < 20; attempt++) {
          const next = await readStatus();
          if (next.tunnel && next.tunnel.name === result.tunnelName && next.tunnel.tunnel === 'Connected' && next.tunnel.has_editor_link) {
            connected = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (!connected) {
          stopTunnel();
          throw new Error('터널 URL은 생성됐지만 연결 상태가 준비되지 않았습니다. .vibe/tunnel.log에서 원인을 확인해주세요.');
        }
      }
      return result;
    } finally {
      releaseLock();
      startingPromise = null;
    }
  })();

  return startingPromise;
}

function getTunnelStatus(cli = findCodeTunnelCli()) {
  return new Promise((resolve, reject) => {
    if (!cli) return reject(new Error('VS Code 터널 실행 파일(' + tunnelBinaryName() + ')을 찾을 수 없습니다.'));
    execFile(cli, ['tunnel', 'status'], { windowsHide: true, timeout: 8000, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) return reject(new Error('터널 상태 확인 실패: ' + sanitizeErrorText(stderr || error.message)));
      try { resolve(JSON.parse(stdout.trim())); }
      catch { reject(new Error('터널 상태 응답을 해석하지 못했습니다.')); }
    });
  });
}

// Returns true when the remote server already has the current Vibe files.
// On macOS a server that was never downloaded is not an error: the tunnel is
// then started with --install-extension, which the CLI runs through bash.
function ensureRemoteExtension(options = {}) {
  const home = options.home || os.homedir();
  const hostPlatform = platform.currentPlatform(options);
  const extensionRoot = path.join(home, '.vscode-server', 'extensions');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const installed = path.join(extensionRoot, manifest.publisher + '.' + manifest.name + '-' + manifest.version);
  const files = ['extension.js', 'tunnel-manager.js', 'mobile-tunnel.js', 'preview-forwarding.js', 'platform.js', 'qrcode.js', 'jsonc.js',
    ...['main.js', 'impl/edit.js', 'impl/format.js', 'impl/parser.js', 'impl/scanner.js', 'impl/string-intern.js'].map(file => 'vendor/jsonc-parser/lib/umd/' + file)];
  if (files.every(file => fs.existsSync(path.join(installed, file)) && fs.readFileSync(path.join(installed, file)).equals(fs.readFileSync(path.join(__dirname, file))))) return true;
  const servers = path.join(home, '.vscode', 'cli', 'servers');
  const candidates = fs.existsSync(servers) ? fs.readdirSync(servers).map(name => path.join(servers, name, 'server'))
    .filter(dir => fs.existsSync(platform.remoteServerNode(dir, options)) && fs.existsSync(path.join(dir, 'out', 'server-main.js')))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs) : [];
  const vsix = findVsixPath(options);
  if (!candidates.length && vsix && hostPlatform === 'darwin') return false;
  if (!candidates.length || !vsix) throw new Error('원격 서버용 Vibe 확장 설치가 필요합니다. AI에게 모바일 초기 설정을 요청해주세요. 연결 중 자동 설치는 Windows bash 오류 때문에 사용하지 않습니다.');
  const { execFileSync } = require('child_process');
  execFileSync(platform.remoteServerNode(candidates[0], options), [path.join(candidates[0], 'out', 'server-main.js'), '--extensions-dir', extensionRoot, '--install-extension', vsix, '--force'], { windowsHide: true, timeout: 30000, stdio: 'pipe' });
  return true;
}

async function acquireStartupLock(options = {}) {
  const dir = platform.vibeRoot(options);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'tunnel-start.lock');
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeFileSync(fd, String(process.pid));
      fs.closeSync(fd);
      return () => { try { if (fs.readFileSync(file, 'utf8') === String(process.pid)) fs.unlinkSync(file); } catch {} };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const owner = Number(fs.readFileSync(file, 'utf8'));
        if (owner > 0) {
          try { process.kill(owner, 0); }
          catch (probeError) { if (probeError.code === 'ESRCH') fs.unlinkSync(file); }
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error('다른 VS Code 창에서 터널을 준비 중입니다. 잠시 후 다시 시도해주세요.');
}


function ensureCliInstallDir(codeCli) {
  try {
    const installDir = path.dirname(path.dirname(codeCli));
    if (fs.existsSync(path.join(installDir, 'Code.exe'))) {
      const { execFileSync } = require('child_process');
      execFileSync(codeCli, ['version', 'use', 'stable', '--install-dir', installDir], {
        stdio: 'ignore',
        windowsHide: true,
        timeout: 15000
      });
    }
  } catch (error) { throw new Error('VS Code 터널 설치 경로 등록 실패: ' + sanitizeErrorText(error.message)); }
}

function startTunnelProcess(projectPath, options = {}) {
  const vibeDir = path.join(projectPath, '.vibe');
  const cacheFile = path.join(vibeDir, 'tunnel.json');
  try { fs.mkdirSync(vibeDir, { recursive: true }); } catch {}

  const findCliFn = options.findCli || findCodeTunnelCli;
  const codeCli = findCliFn(options);
  if (!codeCli) {
    return Promise.reject(new Error('VS Code 터널 실행 파일(' + tunnelBinaryName(options) + ')을 찾을 수 없습니다. VS Code가 정상적으로 설치되어 있는지 확인해주세요.'));
  }

  if (!options.skipInstallDirConfig) {
    ensureCliInstallDir(codeCli);
  }


  const cleanHost = (os.hostname() || 'pc').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
  const tunnelName = 'vibe-' + (cleanHost || 'pc');

  const args = [
    'tunnel',
    '--name', tunnelName,
    '--accept-server-license-terms',
    '--no-sleep'
  ];
  // Installing into an already-running server invokes bash in the CLI,
  // even on Windows. Windows installs explicitly beforehand. macOS has bash,
  // so a new tunnel asks the CLI to install the packaged Vibe extension.
  if (platform.currentPlatform(options) === 'darwin') {
    const vsix = (options.findVsix || findVsixPath)(options);
    if (vsix) args.push('--install-extension', vsix);
  }

  const spawnFn = options.spawn || spawn;
  const timeoutMs = options.timeoutMs || 30000;

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnFn(codeCli, args, {
        cwd: projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true
      });
    } catch (err) {
      return reject(new Error('VS Code 터널 프로세스를 실행하지 못했습니다: ' + err.message));
    }

    let stdoutBuffer = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        if (child && !child.killed) {
          try { child.kill(); } catch {}
        }
        activeTunnel = null;
        const snippet = sanitizeErrorText(stdoutBuffer.trim());
        const timeoutSec = Math.round(timeoutMs / 1000);
        reject(new Error('원격 터널 시작 대기 시간이 초과되었습니다 (' + timeoutSec + '초). CLI 출력에서 터널 연결 주소를 확인하지 못했습니다.' + (snippet ? '\n[CLI 출력]: ' + snippet.slice(-300) : '')));
      }
    }, timeoutMs);

    function onData(chunk) {
      stdoutBuffer += chunk.toString();
      if (!options.spawn) {
        try { fs.appendFileSync(path.join(vibeDir, 'tunnel.log'), sanitizeErrorText(chunk.toString()), 'utf8'); } catch {}
      }
      const rawUrl = extractTunnelUrl(stdoutBuffer);
      let detected;
      try {
        detected = rawUrl && buildProjectTunnelUrl(rawUrl, projectPath, options.workspaceFile);
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          try { child.kill(); } catch {}
          reject(err);
        }
        return;
      }
      if (detected && !settled) {
        settled = true;
        clearTimeout(timeout);
        activeTunnel = { url: detected, tunnelName, pid: child.pid, child };
        try {
          fs.writeFileSync(cacheFile, JSON.stringify({ url: detected, tunnelName, pid: child.pid, startedAt: new Date().toISOString() }, null, 2), 'utf8');
        } catch {}
        resolve(activeTunnel);
      }
    }

    if (child.stdout) child.stdout.on('data', onData);
    if (child.stderr) child.stderr.on('data', onData);

    child.on('error', err => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        activeTunnel = null;
        reject(new Error('터널 프로세스 오류: ' + err.message));
      }
    });

    child.on('exit', (code, signal) => {
      activeTunnel = null;
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        const snippet = sanitizeErrorText(stdoutBuffer.trim());
        const exitDetail = code !== null ? '코드 ' + code : '시그널 ' + signal;
        const exitMsg = '터널 프로세스가 비정상 종료되었습니다 (' + exitDetail + ').' + (snippet ? '\n[CLI 출력]: ' + snippet.slice(-400) : '');
        reject(new Error(exitMsg));
      }
    });
  });
}

function stopTunnel() {
  if (activeTunnel && activeTunnel.child) {
    try { activeTunnel.child.kill(); } catch {}
  }
  activeTunnel = null;
  startingPromise = null;
}

function resetTunnelState() {
  stopTunnel();
}

module.exports = {
  buildProjectTunnelUrl,
  ensureCliInstallDir,
  getOrStartTunnel,
  getTunnelStatus,
  stopTunnel,
  resetTunnelState,
  extractTunnelUrl,
  findCodeTunnelCli,
  findCodeCli,
  findVsixPath,
  sanitizeErrorText
};
