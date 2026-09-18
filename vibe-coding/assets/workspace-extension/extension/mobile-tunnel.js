'use strict';

function getMobileTunnelWebviewHtml(options = {}) {
  const { qrSvg, tunnelUrl = 'https://vscode.dev/agents' } = options;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 28px;
      text-align: center;
      color: var(--vscode-foreground, #cccccc);
      background: var(--vscode-editor-background, #1e1e1e);
      line-height: 1.6;
    }
    .card {
      max-width: 520px;
      margin: 0 auto;
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-widget-border, #30363d);
      border-radius: 12px;
      padding: 28px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    h2 {
      margin-bottom: 8px;
      font-size: 20px;
      font-weight: 700;
      color: var(--vscode-textLink-foreground, #3794ff);
    }
    p.desc {
      margin-bottom: 20px;
      font-size: 13px;
      opacity: 0.85;
    }
    .btn-action {
      background: #238636;
      color: #ffffff;
      border: 1px solid #2ea043;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
    }
    .btn-action:hover {
      background: #2ea043;
    }
    .qr-container {
      background: #ffffff;
      padding: 16px;
      border-radius: 12px;
      display: inline-block;
      margin: 8px 0 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .url-box {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    input[type="text"] {
      flex: 1;
      padding: 10px 12px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, #3b3b3b);
      border-radius: 6px;
      font-size: 13px;
      font-family: Consolas, monospace;
      outline: none;
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    .steps {
      text-align: left;
      background: var(--vscode-textBlockQuote-background, rgba(255,255,255,0.04));
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 13px;
      margin-top: 16px;
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
    }
    .steps ol {
      margin-left: 20px;
      padding: 0;
    }
    .steps li {
      margin-bottom: 8px;
    }
    .info-tip {
      font-size: 12px;
      color: #8b949e;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>📱 Vibe Coding 모바일 원격 AI 에이전트</h2>
    <p class="desc">VS Code 공식 Remote Agent Host & Dev Tunnel을 통해 스마트폰에서 실시간 작업 모니터링과 프롬프트 지시를 수행합니다.</p>
    <div>
      <button class="btn-action" onclick="turnOnTunnel()">🚀 VS Code 공식 원격 터널 켜기 / 관리</button>
    </div>
    <div class="qr-container">${qrSvg}</div>
    <div class="url-box">
      <input type="text" readonly value="${tunnelUrl}" id="urlInput">
      <button class="btn-secondary" onclick="copyUrl()">복사</button>
      <button class="btn-secondary" onclick="openUrl()">열기</button>
    </div>
    <div class="steps">
      <strong>📱 스마트폰 접속 3단계:</strong>
      <ol>
        <li>위 <strong>[원격 터널 켜기]</strong>를 눌러 GitHub/Microsoft 계정으로 로그인합니다 (최초 1회).</li>
        <li>스마트폰 카메라로 QR 코드를 스캔하여 <code>vscode.dev/agents</code>에 접속합니다.</li>
        <li>원격 장치에서 현재 PC를 선택하면 스마트폰 화면에 실시간 Codex 에이전트 작업창과 파일 변경 내역(Diff)이 나타납니다.</li>
      </ol>
      <div class="info-tip">🔒 Microsoft 공식 엔드투엔드 보안 터널로 암호화되며, 별도의 로컬 포트나 방화벽 개방이 필요 없습니다.</div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function turnOnTunnel() { vscode.postMessage({ command: 'turnOnTunnel' }); }
    function copyUrl() { const input = document.getElementById('urlInput'); input.select(); navigator.clipboard.writeText(input.value); }
    function openUrl() { vscode.postMessage({ command: 'openUrl', url: document.getElementById('urlInput').value }); }
  </script>
</body>
</html>`;
}

module.exports = { getMobileTunnelWebviewHtml };
