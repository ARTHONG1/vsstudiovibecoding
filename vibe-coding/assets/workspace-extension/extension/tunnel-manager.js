'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let activeTunnel = null;

function extractTunnelUrl(text) {
  if (!text) return null;
  const match = text.match(/https:\/\/vscode\.dev\/tunnel\/[^\s"'<>]+/i);
  return match ? match[0].trim() : null;
}

function findCodeCli() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || '';
  const candidates = [
    path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(programFiles, 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
    'code.cmd'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'code.cmd';
}

function findVsixPath() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidate = path.join(localAppData, 'VibeCoding', 'vibe-workspace.vsix');
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

async function getOrStartTunnel(projectPath) {
  if (activeTunnel && activeTunnel.url) {
    return activeTunnel;
  }

  const vibeDir = path.join(projectPath, '.vibe');
  const cacheFile = path.join(vibeDir, 'tunnel.json');
  try { fs.mkdirSync(vibeDir, { recursive: true }); } catch {}

  const codeCli = findCodeCli();
  const vsixPath = findVsixPath();
  const cleanHost = (os.hostname() || 'pc').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
  const tunnelName = 'vibe-' + cleanHost;

  const args = [
    'tunnel',
    '--name', tunnelName,
    '--accept-server-license-terms',
    '--no-sleep'
  ];
  if (vsixPath) {
    args.push('--install-extension', vsixPath);
  }

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(codeCli, args, {
        cwd: projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        windowsHide: true
      });
    } catch (err) {
      return reject(new Error('VS Code CLI 터널 프로세스를 실행하지 못했습니다: ' + err.message));
    }

    let stdoutBuffer = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        const fallbackUrl = 'https://vscode.dev/tunnel/' + encodeURIComponent(tunnelName) + '/' + encodeURIComponent(projectPath.replace(/\\/g, '/'));
        activeTunnel = { url: fallbackUrl, tunnelName, pid: child.pid, child };
        try {
          fs.writeFileSync(cacheFile, JSON.stringify({ url: fallbackUrl, tunnelName, pid: child.pid, startedAt: new Date().toISOString() }, null, 2), 'utf8');
        } catch {}
        resolve(activeTunnel);
      }
    }, 12000);

    function onData(chunk) {
      stdoutBuffer += chunk.toString();
      const detected = extractTunnelUrl(stdoutBuffer);
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

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    child.on('error', err => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    child.on('exit', code => {
      activeTunnel = null;
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('Tunnel process exited early with code ' + code));
      }
    });
  });
}

function stopTunnel() {
  if (activeTunnel && activeTunnel.child) {
    try { activeTunnel.child.kill(); } catch {}
    activeTunnel = null;
  }
}

module.exports = {
  getOrStartTunnel,
  stopTunnel,
  extractTunnelUrl,
  findCodeCli,
  findVsixPath
};

