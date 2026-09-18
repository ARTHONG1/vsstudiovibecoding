# v2.6.0 — VS Code 공식 Remote Agent Host & Dev Tunnel 연동 (모바일 원격 대개편)

이번 릴리스는 보안 취약점과 방화벽 경고를 유발하던 사설 로컬 HTTP 서버 방식을 전면 폐기하고, **VS Code 1.138+ 공식 Remote Agent Host 및 Microsoft Dev Tunnel 기반의 네이티브 모바일 원격 연동**으로 대개편했습니다.

## 주요 변경 사항

### 1. 레거시 사설 서버(`mobile-server.js`) 100% 완전 삭제
- 로컬 포트(4100)를 개방하고 토큰을 관리하던 400여 줄의 취약한 사설 HTTP 서버 코드를 완전히 삭제했습니다.
- 이제 Vibe Coding 실행 시 로컬 네트워크에 열리는 비인가 포트가 **0개**이며, Windows Defender 방화벽 경고 팝업이 발생하지 않습니다.

### 2. VS Code 공식 Remote Agent Host & Dev Tunnel 1클릭 연동
- VS Code 상태바/툴바의 **[📱 모바일]** 버튼을 누르면 순수 로컬 Webview 창이 열립니다.
- **[🚀 VS Code 공식 원격 터널 켜기]** 원클릭 액션을 통해 Microsoft 순정 `workbench.action.remoteTunnel.turnOn` 명령이 실행됩니다.
- 스마트폰 카메라로 QR 코드를 스캔하면 `https://vscode.dev/agents`로 즉시 연결되어, 외부(LTE/5G)에서도 내 PC 프로젝트의 Codex 에이전트 작업 내역과 Diff를 실시간으로 보며 프롬프트를 전송할 수 있습니다.

### 3. 초기 환경 설정(`setup.ps1`) 자동화
- 초보자가 복잡한 최신 Agent Host 설정을 수동으로 찾을 필요 없이, `setup.ps1`이 아래 설정을 VS Code 격리 환경에 자동 주입합니다:
  - `chat.agentHost.codexAgent.enabled: true`
  - `chat.agentHost.enabled: true`
  - `remote.tunnels.access.preventSleep: true`

## 검증 결과
- 전체 자동화 테스트 전원 통과 (`npm test`)
- 패키지 무결성 및 버전 링크 일치 검증 100% 통과 (`npm run check`)
