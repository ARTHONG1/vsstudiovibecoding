'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let activeTunnel = null;
let startingPromise = null;

function extractTunnelUrl(text) {
  if (!text) return null;
  const match = text.match(/https:\/\/vscode\.dev\/tunnel\/[^\s"'<>]+/i);
  return match ? match[0].trim() : null;
}

// vscode.dev may preserve percent-encoded path segments literally. Prefer the
// existing ASCII workspace file so its folders and settings are loaded together.
function buildProjectTunnelUrl(detectedUrl, projectPath, workspaceFile) {
  const match = String(detectedUrl).match(/^https:\/\/vscode\.dev\/tunnel\/([a-z0-9-]+)(?:\/|$)/i);
  if (!match) throw new Error('Invalid VS Code tunnel URL');
  const safe = value => typeof value === 'string' && /^[a-z]:[\\/][a-z0-9_./:\\-]+$/i.test(value);
  let target = projectPath;
  if (workspaceFile && safe(workspaceFile) && fs.existsSync(workspaceFile) && /\.code-workspace$/i.test(workspaceFile)) {
    target = workspaceFile;
  }
  if (!safe(target)) throw new Error('모바일 연결에는 공백·한글이 없는 경로의 .code-workspace 파일이 필요합니다. Vibe Coding 작업 영역으로 열어주세요.');
  return 'https://vscode.dev/tunnel/' + match[1] + '/' + target.replace(/\\/g, '/');
}

function sanitizeErrorText(text) {
  if (!text) return '';
  return String(text)
    .replace(/(token|secret|password|bearer|auth[_-]?code)[=:\s]+[A-Za-z0-9_\-\.]{8,}/gi, '$1=***');
}

function findCodeTunnelCli() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || '';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || '';
  const candidates = [
    path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code-tunnel.exe'),
    path.join(programFiles, 'Microsoft VS Code', 'bin', 'code-tunnel.exe'),
    path.join(programFilesX86, 'Microsoft VS Code', 'bin', 'code-tunnel.exe'),
    path.join(localAppData, 'Programs', 'Microsoft VS Code', 'code-tunnel.exe'),
    path.join(programFiles, 'Microsoft VS Code', 'code-tunnel.exe'),
    'code-tunnel.exe',
    'code-tunnel'
  ];

  for (const c of candidates) {
    if (!c) continue;
    if (c.includes(path.sep)) {
      if (fs.existsSync(c)) return c;
    } else {
      try {
        const checkCmd = process.platform === 'win32' ? 'where.exe' : 'which';
        const out = execSync(checkCmd + ' ' + c, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
        if (out) {
          const first = out.split(/\r?\n/)[0].trim();
          if (first && fs.existsSync(first)) return first;
        }
      } catch {}
    }
  }
  return null;
}

function findCodeCli() {
  const tunnelCli = findCodeTunnelCli();
  if (tunnelCli) return tunnelCli;

  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || '';
  const candidates = [
    path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(programFiles, 'Microsoft VS Code', 'bin', 'code.cmd'),
    'code.cmd'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'code-tunnel.exe';
}

function findVsixPath() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidate = path.join(localAppData, 'VibeCoding', 'vibe-workspace.vsix');
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

async function getOrStartTunnel(projectPath, options = {}) {
  if (activeTunnel && activeTunnel.url) {
    return { ...activeTunnel, url: buildProjectTunnelUrl(activeTunnel.url, projectPath, options.workspaceFile) };
  }
  if (startingPromise) {
    return startingPromise.then(info => ({ ...info, url: buildProjectTunnelUrl(info.url, projectPath, options.workspaceFile) }));
  }

  startingPromise = (async () => {
    try {
      const result = await startTunnelProcess(projectPath, options);
      return result;
    } finally {
      startingPromise = null;
    }
  })();

  return startingPromise;
}


function ensureCliInstallDir(codeCli) {
  try {
    const installDir = path.dirname(path.dirname(codeCli));
    if (fs.existsSync(path.join(installDir, 'Code.exe'))) {
      const { execFileSync } = require('child_process');
      execFileSync(codeCli, ['version', 'use', 'stable', '--install-dir', installDir], {
        stdio: 'ignore',
        windowsHide: true,
        timeout: 5000
      });
    }
  } catch {}
}

function startTunnelProcess(projectPath, options = {}) {
  const vibeDir = path.join(projectPath, '.vibe');
  const cacheFile = path.join(vibeDir, 'tunnel.json');
  try { fs.mkdirSync(vibeDir, { recursive: true }); } catch {}

  const findCliFn = options.findCli || findCodeTunnelCli;
  const codeCli = findCliFn();
  if (!codeCli) {
    return Promise.reject(new Error('VS Code 터널 실행 파일(code-tunnel.exe)을 찾을 수 없습니다. VS Code가 정상적으로 설치되어 있는지 확인해주세요.'));
  }

  if (!options.skipInstallDirConfig) {
    ensureCliInstallDir(codeCli);
  }


  const vsixPathFn = options.findVsix || findVsixPath;
  const vsixPath = vsixPathFn();
  const cleanHost = (os.hostname() || 'pc').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
  const tunnelName = 'vibe-' + (cleanHost || 'pc');

  const args = [
    'tunnel',
    '--name', tunnelName,
    '--accept-server-license-terms',
    '--no-sleep'
  ];
  if (vsixPath) {
    args.push('--install-extension', vsixPath);
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
  stopTunnel,
  resetTunnelState,
  extractTunnelUrl,
  findCodeTunnelCli,
  findCodeCli,
  findVsixPath,
  sanitizeErrorText
};
