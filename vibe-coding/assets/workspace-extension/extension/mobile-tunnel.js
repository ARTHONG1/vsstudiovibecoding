'use strict';
const { generateQRCodeSVG } = require('./qrcode');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function sanitizeErrorText(text) {
  if (!text) return '';
  return String(text)
    .replace(/(token|secret|password|bearer|auth[_-]?code)[=:\s]+[A-Za-z0-9_\-\.]{8,}/gi, '$1=***');
}

function isAuthError(errMsg) {
  if (!errMsg) return false;
  const lower = String(errMsg).toLowerCase();
  return lower.includes('login') ||
    lower.includes('not logged in') ||
    lower.includes('auth') ||
    lower.includes('unauthorized') ||
    lower.includes('credential') ||
    lower.includes('not authenticated');
}

function getMobileSetupPrompt(projectPath) {
  return '$vibe-coding 현재 VS Code 프로젝트 ' + JSON.stringify(projectPath) + '를 공식 Codex Remote로 휴대폰에서 이어서 작업하도록 초기 설정해줘. 기존 연결과 작업을 우선 재사용하고 실제 PC와 작업 폴더가 같은지 확인해줘. 기존 레이아웃·터미널·모델·백업 설정은 보존해줘. 필요한 로그인·QR 스캔·기기 승인만 나에게 안내하고, 연결과 원격 실행을 구분해서 검증해줘. 확인하지 못한 단계는 미검증으로 보고해줘.';
}

function getMobileTunnelWebviewHtml({ projectPath = '', tunnelUrl = '', tunnelName = '', loading = false, error = '' } = {}) {
  if (loading) {
    return '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>모바일 작업 준비 중</title><style>body{font-family:var(--vscode-font-family,sans-serif);color:var(--vscode-foreground);background:var(--vscode-editor-background);display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{text-align:center;padding:32px}.spinner{width:36px;height:36px;border:3px solid var(--vscode-focusBorder);border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="box"><div class="spinner"></div><h2>공식 원격 터널을 준비하고 있습니다...</h2><p>잠시만 기다려주세요 (약 3~5초 소요)</p></div></body></html>';
  }
  if (error) {
    const authError = isAuthError(error);
    const sanitized = sanitizeErrorText(error);
    const guideHtml = authError
      ? '<p>VS Code CLI에 GitHub 로그인이 되어 있는지 확인해주세요 (<code>code tunnel user login</code>).</p>'
      : '<p>터널 실행 경로 또는 네트워크 설정을 확인해주세요.</p>';
    return '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>모바일 터널 오류</title><style>body{font-family:var(--vscode-font-family,sans-serif);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px;line-height:1.7}.card{max-width:540px;margin:30px auto;border:1px solid var(--vscode-inputValidation-errorBorder,#e51400);padding:20px;border-radius:8px}pre{background:var(--vscode-textCodeBlock-background,rgba(128,128,128,0.1));padding:10px 14px;border-radius:6px;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}</style></head><body><div class="card"><h2>터널을 시작하지 못했습니다</h2><pre>' + escapeHtml(sanitized) + '</pre>' + guideHtml + '</div></body></html>';
  }
  if (tunnelUrl) {
    let qrSvgHtml = '';
    try {
      const qrSvg = generateQRCodeSVG(tunnelUrl, { size: 220 });
      qrSvgHtml = '<div class="qr-container">' + qrSvg + '</div>';
    } catch (qrErr) {
      qrSvgHtml = '<div class="guide-card" style="margin-bottom: 20px; text-align: center;"><p style="margin: 0; font-size: 13px; color: var(--vscode-descriptionForeground);">URL이 길어 QR 코드 대신 아래 [주소 복사] 버튼을 이용해 접속해주세요.</p></div>';
    }
    return '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>스마트폰에서 작업하기</title><style>body{font-family:var(--vscode-font-family,sans-serif);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px 16px;line-height:1.6;margin:0}main{max-width:520px;margin:auto;text-align:center}h1{font-size:22px;margin-bottom:8px}p.sub{color:var(--vscode-descriptionForeground);font-size:14px;margin-top:0;margin-bottom:24px}.qr-container{background:#ffffff;padding:16px;border-radius:12px;display:inline-block;box-shadow:0 4px 20px rgba(0,0,0,0.25);margin-bottom:20px}.url-box{display:flex;gap:8px;max-width:440px;margin:0 auto 24px}input{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);padding:8px 12px;border-radius:4px;font-size:13px}button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:600}button:hover{background:var(--vscode-button-hoverBackground)}.guide-card{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border,rgba(128,128,128,0.2));border-radius:8px;padding:16px 20px;text-align:left;font-size:13.5px}.guide-card ol{margin:8px 0 0;padding-left:20px}.guide-card li{margin-bottom:8px}.btn-badge{display:inline-block;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:2px 6px;border-radius:4px;font-size:12px}</style></head><body><main><h1>📱 스마트폰에서 작업하기</h1><p class="sub">침대나 외부에서 폰으로 Codex에게 명령하고 결과를 확인하세요.</p>' + qrSvgHtml + '<div class="url-box"><input type="text" readonly value="' + escapeHtml(tunnelUrl) + '" id="urlInput"><button id="copyBtn" type="button">주소 복사</button></div><div class="guide-card"><strong>💡 초간단 3초 사용법:</strong><ol><li>스마트폰 기본 카메라로 위 <strong>QR 코드</strong>를 스캔하세요.</li><li>처음 1회만 PC와 동일한 <strong>GitHub 계정</strong>으로 로그인하세요.</li><li>폰 화면 하단의 <span class="btn-badge">🗖 터미널 전체</span>로 AI에게 지시하고, <span class="btn-badge">🌐 미리보기 전체</span>로 내 사이트를 확인하세요!</li></ol></div></main><script>const vscode = acquireVsCodeApi(); document.getElementById("copyBtn").addEventListener("click", () => { const input = document.getElementById("urlInput"); vscode.postMessage({ command: "copy", text: input.value }); });</script></body></html>';
  }
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Codex Remote · 모바일 작업</title><style>
body{font-family:var(--vscode-font-family,sans-serif);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px;line-height:1.7}main{max-width:640px;margin:auto}h1{font-size:24px}h2{font-size:17px;margin-top:28px}code,pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--vscode-textCodeBlock-background);padding:10px;display:block}a{color:var(--vscode-textLink-foreground)}.note{border-left:3px solid var(--vscode-focusBorder);padding:10px 14px}li{margin-bottom:10px}
</style></head><body><main>
<h1>휴대폰에서도 이어서 작업하세요</h1>
<p>공식 <strong>Codex Remote</strong>로 휴대폰에서 요청하면 연결된 PC가 작업합니다. 같은 폴더를 열어 둔 VS Code에서 변경된 코드를 확인할 수 있습니다.</p>
<h2>이 창의 프로젝트</h2><code>${escapeHtml(projectPath || '프로젝트 폴더를 먼저 열어주세요.')}</code>
<p class="note">연결 상태는 이 화면에서 자동 확인하지 않습니다. 이 안내를 열었다고 원격 연결이 켜지는 것은 아닙니다.</p>
<h2>이미 휴대폰을 연결했다면</h2>
<p>휴대폰 ChatGPT 앱의 <strong>Remote → 이 PC → 기존 작업</strong>을 선택하세요. 작업 폴더가 위 경로와 같은지 확인하고 평소처럼 요청하면 됩니다. 스킬을 다시 호출할 필요는 없습니다.</p>
<h2>처음이라면 AI에게 설정을 맡기세요</h2>
<p>아래 요청을 복사해 PC의 AI에게 보내세요. 폴더와 기존 연결 확인은 AI가 진행하고, 필요한 인증만 안내합니다.</p>
<pre>${escapeHtml(getMobileSetupPrompt(projectPath))}</pre>
<h2>공식 연결 절차</h2><ol>
<li>PC의 Codex/ChatGPT 데스크톱 앱에서 <strong>설정 → Connections → Control this Mac or PC</strong>를 엽니다. 메뉴 이름은 앱 버전에 따라 다를 수 있습니다.</li>
<li>공식 앱이 표시하는 QR을 휴대폰으로 스캔하고 같은 계정·워크스페이스로 기기 연결을 승인합니다. 이미 연결했으면 생략하세요.</li>
<li>휴대폰 Remote에서 PC와 기존 작업을 선택합니다. 별도 클라우드나 다른 작업 폴더를 선택하면 이 VS Code에 변경이 바로 반영되지 않습니다.</li></ol>
<p><a href="https://learn.chatgpt.com/docs/remote-connections">공식 Remote 연결 안내 열기</a></p>
<h2>휴대폰에서 결과 확인하는 방법</h2><ol>
<li><strong>대화창 사진 확인 (기본):</strong> 휴대폰 Codex 앱으로 화면 수정을 요청하면, AI 에이전트가 작업을 마친 뒤 결과 화면 캡처본을 대화창에 직접 첨부하여 보고합니다. 별도 앱 전환 없이 사진으로 바로 확인할 수 있습니다.</li>
<li><strong>직접 터치 조작 (VS Code 공식 포트 전달):</strong> 실시간 조작이나 스크롤을 원하시면 VS Code 하단의 <strong>포트(Ports)</strong> 탭에서 개발 서버 포트(예: 5173)의 QR 코드를 휴대폰으로 스캔하세요. (GitHub 로그인 1회 시 외부 어디서나 접속 가능)</li></ol>
<h2>연결 확인 요청</h2><pre>모바일 연결 테스트야. 파일 수정하지 말고 현재 작업 폴더와 이 프로젝트의 미리보기 서버 응답 상태만 확인해줘.</pre>
<p>PC가 켜져 있고 온라인이어야 합니다. 미리보기 갱신에는 개발 서버가 실행 중이어야 합니다. 이 기능은 휴대폰에서 코딩 작업을 맡기는 방식이며 VS Code 화면 자체를 전송하지 않습니다. PC와 휴대폰에서 같은 파일을 동시에 수정하지 마세요.</p>
</main></body></html>`;
}

module.exports = { getMobileTunnelWebviewHtml, getMobileSetupPrompt, isAuthError, sanitizeErrorText };
