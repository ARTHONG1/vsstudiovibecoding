'use strict';

const http = require('http');
const os = require('os');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { generateQRCodeSVG } = require('./qrcode');

function getLocalIpAddress() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function getMobileHtml(options) {
  const { token, projectName, agentName, previewUrl, localIp, port } = options;
  const mobilePreviewUrl = previewUrl ? previewUrl.replace(/(127\.0\.0\.1|localhost)/, localIp) : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#0d1117">
  <title>Vibe Coding Remote</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif; }
    body { background: #0d1117; color: #e6edf3; padding: 16px; min-height: 100vh; display: flex; flex-direction: column; gap: 16px; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; padding-bottom: 12px; }
    .brand { font-size: 18px; font-weight: 700; color: #58a6ff; display: flex; align-items: center; gap: 8px; }
    .badge { font-size: 12px; background: #238636; color: #fff; padding: 3px 8px; border-radius: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .card-title { font-size: 14px; font-weight: 600; color: #8b949e; display: flex; justify-content: space-between; align-items: center; }
    .btn-group { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    button { background: #21262d; color: #c9d1d9; border: 1px solid #363b42; border-radius: 8px; padding: 12px 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 6px; }
    button:active { transform: scale(0.97); background: #30363d; }
    button.primary { background: #238636; border-color: #2ea043; color: #fff; font-size: 15px; padding: 14px; }
    button.primary:active { background: #29903b; }
    button.mic-btn { background: #30363d; width: 44px; height: 44px; border-radius: 50%; padding: 0; }
    button.mic-btn.listening { background: #da3633; border-color: #f85149; animation: pulse 1.2s infinite; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(248,81,73,0.7); } 70% { box-shadow: 0 0 0 10px rgba(248,81,73,0); } 100% { box-shadow: 0 0 0 0 rgba(248,81,73,0); } }
    textarea { width: 100%; min-height: 100px; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 12px; color: #fff; font-size: 15px; resize: vertical; outline: none; }
    textarea:focus { border-color: #58a6ff; }
    .log-box { background: #000; border-radius: 8px; padding: 10px; font-family: Consolas, monospace; font-size: 12px; color: #7ee787; max-height: 140px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
    .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #1f6feb; color: #fff; padding: 10px 18px; border-radius: 20px; font-size: 13px; font-weight: 600; opacity: 0; pointer-events: none; transition: opacity 0.3s; z-index: 999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
    .toast.show { opacity: 1; }
    a.preview-link { display: flex; align-items: center; justify-content: center; gap: 6px; background: #1f6feb; color: #fff; text-decoration: none; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600; text-align: center; }
    a.preview-link:active { background: #388bfd; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>📱 Vibe Remote</span>
    </div>
    <div class="badge ${agentName.toLowerCase()}">
      ● ${agentName} (${projectName})
    </div>
  </header>

  <div class="card">
    <div class="card-title">
      <span>🖥️ VS Code 화면 전환</span>
      <span id="currentModeLabel" style="font-size: 12px; color: #58a6ff;">3열 분할 중</span>
    </div>
    <div class="btn-group">
      <button onclick="sendCommand('restore')">📐 3열 복원</button>
      <button onclick="sendCommand('preview')">🌐 미리보기</button>
      <button onclick="sendCommand('terminal')">💻 터미널</button>
    </div>
  </div>

  <div class="card">
    <div class="card-title">
      <span>💬 AI 작업 지시</span>
      <button id="micBtn" class="mic-btn" onclick="toggleVoiceInput()" title="음성 입력">🎙️</button>
    </div>
    <textarea id="promptInput" placeholder="스마트폰에서 AI에게 작업 명령을 지시하세요... (예: 버튼 색상을 파란색으로 바꾸고 애니메이션 추가해줘)"></textarea>
    <button class="primary" onclick="sendPrompt()">🚀 AI에게 전송</button>
  </div>

  ${mobilePreviewUrl ? `
  <div class="card">
    <div class="card-title">
      <span>📱 실시간 모바일 웹 테스트</span>
    </div>
    <a class="preview-link" href="${mobilePreviewUrl}" target="_blank">🌐 모바일 브라우저로 웹앱 열기</a>
  </div>` : ''}

  <div class="card">
    <div class="card-title">
      <span>📋 실시간 상태 로그</span>
      <span id="lastUpdated" style="font-size: 11px; color: #6e7681;">방금 전</span>
    </div>
    <div class="log-box" id="logBox">연결 대기 중...</div>
  </div>

  <div id="toast" class="toast">메시지</div>

  <script>
    const TOKEN = "${token}";
    let recognition = null;
    let isListening = false;

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.classList.add('show');
      if (navigator.vibrate) navigator.vibrate(40);
      setTimeout(() => t.classList.remove('show'), 2500);
    }

    async function sendCommand(cmd) {
      try {
        const res = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-vibe-token': TOKEN },
          body: JSON.stringify({ command: cmd, token: TOKEN })
        });
        const data = await res.json();
        if (data.ok) showToast('화면 전환 완료: ' + cmd);
        else showToast('실패: ' + (data.error || '오류'));
      } catch (e) {
        showToast('네트워크 오류: ' + e.message);
      }
      refreshStatus();
    }

    async function sendPrompt() {
      const input = document.getElementById('promptInput');
      const prompt = input.value.trim();
      if (!prompt) return showToast('프롬프트를 입력하세요.');

      try {
        const res = await fetch('/api/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-vibe-token': TOKEN },
          body: JSON.stringify({ prompt, token: TOKEN })
        });
        const data = await res.json();
        if (data.ok) {
          showToast('✅ AI 터미널로 프롬프트가 전송되었습니다!');
          input.value = '';
        } else {
          showToast('전송 실패: ' + (data.error || '오류'));
        }
      } catch (e) {
        showToast('네트워크 오류: ' + e.message);
      }
      refreshStatus();
    }

    function toggleVoiceInput() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        return alert('이 브라우저는 음성 입력을 지원하지 않습니다. Chrome 또는 Safari를 사용하세요.');
      }
      const btn = document.getElementById('micBtn');
      if (isListening) {
        if (recognition) recognition.stop();
        isListening = false;
        btn.classList.remove('listening');
        return;
      }
      recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.interimResults = false;
      recognition.onstart = () => {
        isListening = true;
        btn.classList.add('listening');
        showToast('🎙️ 말씀하세요...');
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const input = document.getElementById('promptInput');
        input.value = (input.value ? input.value + ' ' : '') + transcript;
        showToast('인식 완료: ' + transcript);
      };
      recognition.onerror = (e) => {
        showToast('음성 인식 오류: ' + e.error);
        btn.classList.remove('listening');
        isListening = false;
      };
      recognition.onend = () => {
        btn.classList.remove('listening');
        isListening = false;
      };
      recognition.start();
    }

    async function refreshStatus() {
      try {
        const res = await fetch('/api/status?token=' + encodeURIComponent(TOKEN));
        const data = await res.json();
        if (data.mode) {
          const modeMap = { split: '3열 분할 중', preview: '미리보기 전체', terminal: '터미널 전체' };
          document.getElementById('currentModeLabel').innerText = modeMap[data.mode] || data.mode;
        }
        if (data.logs && Array.isArray(data.logs)) {
          const box = document.getElementById('logBox');
          box.innerText = data.logs.slice(-10).join('\n') || '로그 없음';
          box.scrollTop = box.scrollHeight;
        }
        document.getElementById('lastUpdated').innerText = new Date().toLocaleTimeString();
      } catch {}
    }

    setInterval(refreshStatus, 2500);
    refreshStatus();
  </script>
</body>
</html>`;
}

class MobileServer {
  constructor(options = {}) {
    this.options = options;
    this.token = crypto.randomBytes(16).toString('hex');
    this.server = null;
    this.port = options.port || 4100;
    this.localIp = getLocalIpAddress();
    this.logs = [];
    this.statusGetter = options.getStatus || (() => ({}));
    this.promptHandler = options.onPrompt || (() => Promise.resolve());
    this.commandHandler = options.onCommand || (() => Promise.resolve());
  }

  log(msg) {
    const time = new Date().toLocaleTimeString();
    this.logs.push(`[${time}] ${msg}`);
    if (this.logs.length > 50) this.logs.shift();
  }

  getUrl() {
    return `http://${this.localIp}:${this.port}/?token=${this.token}`;
  }

  getQrSvg() {
    return generateQRCodeSVG(this.getUrl(), { size: 240, margin: 2 });
  }

  start() {
    return new Promise((resolve, reject) => {
      if (this.server) return resolve(this.getUrl());

      const app = http.createServer(async (req, res) => {
        const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const qToken = reqUrl.searchParams.get('token') || req.headers['x-vibe-token'];

        res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-vibe-token');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const verifyToken = (bodyToken) => {
          return (qToken && qToken === this.token) || (bodyToken && bodyToken === this.token);
        };

        if (reqUrl.pathname === '/' && req.method === 'GET') {
          if (!verifyToken()) {
            res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>403 Forbidden</title></head><body style="background:#0d1117;color:#f85149;font-family:sans-serif;padding:32px;text-align:center;"><h2>🔒 접근 제한</h2><p>VS Code 화면의 QR 코드를 직접 스캔하여 접속하세요. (인증 토큰 누락 또는 불일치)</p></body></html>');
            return;
          }
          const status = this.statusGetter();
          const html = getMobileHtml({
            token: this.token,
            projectName: status.project || 'Vibe Coding',
            agentName: status.agent || 'Codex',
            previewUrl: status.previewUrl || '',
            localIp: this.localIp,
            port: this.port
          });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }

        if (reqUrl.pathname === '/api/qr' && req.method === 'GET') {
          if (!verifyToken()) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
          }
          const svg = this.getQrSvg();
          res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
          res.end(svg);
          return;
        }

        if (reqUrl.pathname === '/api/status' && req.method === 'GET') {
          if (!verifyToken()) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '인증 토큰이 유효하지 않습니다.' }));
            return;
          }
          const status = this.statusGetter();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            mode: status.mode || 'split',
            agent: status.agent || 'Codex',
            project: status.project || 'Vibe Coding',
            previewUrl: status.previewUrl || '',
            logs: this.logs
          }));
          return;
        }

        if (reqUrl.pathname === '/api/prompt' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              if (!verifyToken(data.token)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '인증 토큰이 유효하지 않습니다.' }));
                return;
              }
              const prompt = (data.prompt || '').trim();
              if (!prompt) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '프롬프트가 비어있습니다.' }));
                return;
              }
              this.log(`모바일 프롬프트: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`);
              await this.promptHandler(prompt);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, message: 'AI 터미널로 전송되었습니다.' }));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (reqUrl.pathname === '/api/command' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              if (!verifyToken(data.token)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '인증 토큰이 유효하지 않습니다.' }));
                return;
              }
              this.log(`모바일 명령: ${data.command}`);
              await this.commandHandler(data.command);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      });

      const tryListen = (portToTry) => {
        app.listen(portToTry, '0.0.0.0', () => {
          this.port = portToTry;
          this.server = app;
          this.log(`원격 서버 시작됨: ${this.getUrl()}`);
          resolve(this.getUrl());
        });
        app.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            tryListen(portToTry + 1);
          } else {
            reject(err);
          }
        });
      };

      tryListen(this.port);
    });
  }

  stop() {
    if (this.server) {
      try { this.server.close(); } catch {}
      this.server = null;
    }
  }

  dispose() {
    this.stop();
  }
}

function getMobileWebviewHtml(remoteUrl, qrSvg) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; text-align: center; color: var(--vscode-foreground); background: var(--vscode-editor-background); line-height: 1.6; }
    .card { max-width: 480px; margin: 0 auto; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border, #30363d); border-radius: 12px; padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
    h2 { margin-bottom: 8px; font-size: 20px; color: var(--vscode-textLink-foreground); }
    p { margin-bottom: 16px; font-size: 14px; opacity: 0.85; }
    .qr-container { background: #ffffff; padding: 16px; border-radius: 12px; display: inline-block; margin: 12px 0 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .url-input-box { display: flex; gap: 8px; margin-bottom: 20px; }
    input[type="text"] { flex: 1; padding: 8px 12px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, #444); border-radius: 6px; font-size: 13px; font-family: monospace; outline: none; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .steps { text-align: left; background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.04)); padding: 14px 18px; border-radius: 8px; font-size: 13px; margin-top: 16px; border-left: 3px solid var(--vscode-textLink-foreground); }
    .steps ol { margin-left: 18px; }
    .steps li { margin-bottom: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>📱 Vibe Coding 모바일 원격 제어</h2>
    <p>스마트폰 카메라로 아래 QR 코드를 스캔하세요.</p>
    <div class="qr-container">${qrSvg}</div>
    <div class="url-input-box">
      <input type="text" readonly value="${remoteUrl}" id="urlInput">
      <button id="copyBtn">복사</button>
      <button id="openBtn">열기</button>
    </div>
    <div class="steps">
      <ol>
        <li>스마트폰과 PC가 <strong>동일한 Wi-Fi 네트워크</strong>에 연결되어 있어야 합니다.</li>
        <li>스마트폰 카메라로 QR 코드를 비추면 원격 제어 웹앱이 열립니다.</li>
        <li>스마트폰에서 음성 🎙️ 또는 텍스트로 작업 지시를 내리면 즉시 코딩이 진행됩니다!</li>
      </ol>
    </div>
  </div>
  <script>
    document.getElementById('copyBtn').onclick = () => {
      navigator.clipboard.writeText(document.getElementById('urlInput').value);
      alert('URL이 복사되었습니다.');
    };
    document.getElementById('openBtn').onclick = () => {
      window.open(document.getElementById('urlInput').value, '_blank');
    };
  </script>
</body>
</html>`;
}

module.exports = { MobileServer, getLocalIpAddress, getMobileWebviewHtml };
