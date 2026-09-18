'use strict';

function getMobileTunnelWebviewHtml(options = {}) {
  const { qrSvg = '', tunnelUrl = '', isTunnelActive = false } = options;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px 20px;
      text-align: center;
      color: var(--vscode-foreground, #cccccc);
      background: var(--vscode-editor-background, #1e1e1e);
      line-height: 1.6;
    }
    .card {
      max-width: 540px;
      margin: 0 auto;
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-widget-border, #30363d);
      border-radius: 12px;
      padding: 26px 24px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    h2 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 20px;
      font-weight: 700;
      color: var(--vscode-textLink-foreground, #3794ff);
    }
    p.desc {
      margin-bottom: 18px;
      font-size: 13px;
      opacity: 0.85;
    }
    .badge-container {
      margin-bottom: 18px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-badge.active {
      background: rgba(46, 160, 67, 0.15);
      border: 1px solid #2ea043;
      color: #3fb950;
    }
    .status-badge.inactive {
      background: rgba(210, 153, 34, 0.15);
      border: 1px solid #d29922;
      color: #e3b341;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }
    .btn-action {
      background: #238636;
      color: #ffffff;
      border: 1px solid #2ea043;
      padding: 11px 22px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-action:hover {
      background: #2ea043;
    }
    .btn-refresh {
      background: transparent;
      color: var(--vscode-foreground, #cccccc);
      border: 1px solid var(--vscode-widget-border, #3b3b3b);
      padding: 11px 18px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-refresh:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    .btn-row {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .qr-container {
      background: #ffffff;
      padding: 16px;
      border-radius: 12px;
      display: inline-block;
      margin: 6px 0 18px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      min-width: 240px;
      min-height: 240px;
    }
    .qr-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 240px;
      width: 240px;
      color: #555555;
      font-size: 13px;
      gap: 12px;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      border-top-color: #238636;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .url-box {
      display: flex;
      gap: 8px;
      margin-bottom: 18px;
    }
    input[type="text"] {
      flex: 1;
      padding: 9px 12px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, #3b3b3b);
      border-radius: 6px;
      font-size: 12px;
      font-family: Consolas, monospace;
      outline: none;
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
      border: none;
      padding: 9px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    .steps {
      text-align: left;
      background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.04));
      padding: 14px 18px;
      border-radius: 8px;
      font-size: 12.5px;
      margin-top: 14px;
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
    }
    .steps ol {
      margin: 8px 0 8px 20px;
      padding: 0;
    }
    .steps li {
      margin-bottom: 6px;
    }
    .info-tip {
      font-size: 11.5px;
      color: #8b949e;
      margin-top: 10px;
      line-height: 1.5;
    }
    .notice-box {
      background: rgba(56, 139, 253, 0.1);
      border: 1px solid rgba(56, 139, 253, 0.3);
      color: #79c0ff;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 12px;
      margin-bottom: 16px;
      text-align: left;
      display: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>📱 Vibe Coding 모바일 원격 AI 에이전트</h2>
    <p class="desc">VS Code 공식 Remote Agent Host & Dev Tunnel을 통해 스마트폰에서 실시간 작업 모니터링과 프롬프트 지시를 수행합니다.</p>
    
    <div class="badge-container">
      <span id="statusBadge" class="status-badge ${isTunnelActive ? 'active' : 'inactive'}">
        <span class="status-dot"></span>
        <span id="statusText">${isTunnelActive ? '🟢 내 PC 원격 터널 연결됨 (다이렉트 직행)' : '⚪ 원격 터널 대기 중 (PC에서 터널 켜기 필요)'}</span>
      </span>
    </div>

    <div class="notice-box" id="noticeBox">
      💡 <strong>진행 안내:</strong> VS Code 상단/하단에 뜬 로그인 팝업에서 GitHub 또는 Microsoft 계정으로 로그인해주세요. 완료되면 즉시 내 컴퓨터 직행 QR 코드가 생성됩니다.
    </div>

    <div class="btn-row">
      <button class="btn-action" onclick="turnOnTunnel()">🚀 원격 터널 켜기 / 활성화</button>
      <button class="btn-refresh" onclick="checkTunnel()">🔄 연결 상태 새로고침</button>
    </div>

    <div class="qr-container" id="qrContainer">
      ${qrSvg ? qrSvg : `<div class="qr-placeholder" id="qrPlaceholder">
        <div class="spinner"></div>
        <div>터널 주소를 감지하는 중...<br><span style="font-size:11px; color:#888;">[원격 터널 켜기]를 먼저 눌러주세요</span></div>
      </div>`}
    </div>

    <div class="url-box">
      <input type="text" readonly value="${tunnelUrl}" id="urlInput" placeholder="터널이 활성화되면 내 PC 전용 URL이 표시됩니다">
      <button class="btn-secondary" onclick="copyUrl()">복사</button>
      <button class="btn-secondary" onclick="openUrl()">열기</button>
    </div>

    <div class="steps">
      <strong>📱 스마트폰 접속 3단계:</strong>
      <ol>
        <li>위 <strong>[원격 터널 켜기]</strong>를 눌러 GitHub/Microsoft 계정으로 로그인합니다 (최초 1회).</li>
        <li>터널이 켜지면 생성되는 <strong>내 PC 전용 QR 코드</strong>를 스마트폰으로 스캔합니다.</li>
        <li>스마트폰 브라우저에서 <strong>PC와 동일한 계정</strong>으로 로그인하면 'No Host' 없이 내 작업 화면으로 즉시 연결됩니다.</li>
      </ol>
      <div class="info-tip">🔒 Microsoft 공식 엔드투엔드 보안 터널로 암호화되며, 별도의 사설 포트나 방화벽 개방 없이 어디서나 안전하게 접속됩니다.</div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function turnOnTunnel() {
      document.getElementById('noticeBox').style.display = 'block';
      vscode.postMessage({ command: 'turnOnTunnel' });
    }

    function checkTunnel() {
      vscode.postMessage({ command: 'checkTunnel' });
    }

    function copyUrl() {
      const input = document.getElementById('urlInput');
      if (!input.value) return;
      input.select();
      navigator.clipboard.writeText(input.value);
    }

    function openUrl() {
      const url = document.getElementById('urlInput').value;
      if (url) {
        vscode.postMessage({ command: 'openUrl', url });
      }
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'tunnelActive') {
        const badge = document.getElementById('statusBadge');
        badge.className = 'status-badge active';
        document.getElementById('statusText').innerText = '🟢 내 PC 원격 터널 연결됨 (다이렉트 직행)';
        document.getElementById('urlInput').value = msg.url;
        document.getElementById('qrContainer').innerHTML = msg.qrSvg;
        document.getElementById('noticeBox').style.display = 'none';
      } else if (msg.command === 'tunnelWaiting') {
        document.getElementById('noticeBox').style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
}

module.exports = { getMobileTunnelWebviewHtml };
