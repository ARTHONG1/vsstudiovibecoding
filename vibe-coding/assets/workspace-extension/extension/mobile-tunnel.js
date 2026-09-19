'use strict';
// Filename/export retained for compatibility with existing skill packages.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function getMobileSetupPrompt(projectPath) {
  return '$vibe-coding 현재 VS Code 프로젝트 ' + JSON.stringify(projectPath) + '를 공식 Codex Remote로 휴대폰에서 이어서 작업하도록 초기 설정해줘. 기존 연결과 작업을 우선 재사용하고 실제 PC와 작업 폴더가 같은지 확인해줘. 기존 레이아웃·터미널·모델·백업 설정은 보존해줘. 필요한 로그인·QR 스캔·기기 승인만 나에게 안내하고, 연결과 원격 실행을 구분해서 검증해줘. 확인하지 못한 단계는 미검증으로 보고해줘.';
}
function getMobileTunnelWebviewHtml({ projectPath = '' } = {}) {
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
module.exports = { getMobileTunnelWebviewHtml, getMobileSetupPrompt };
