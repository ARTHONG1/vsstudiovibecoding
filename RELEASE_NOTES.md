# Vibe Coding v2.8.0

AI 에이전트가 VS Code 환경을 세팅할 때 Playwright CLI + 공식 Skill, Context7 MCP, Chrome DevTools MCP까지 기본 준비하도록 확장했습니다. 설치뿐 아니라 실제 Codex의 도구 인식·호출 확인과 프로젝트 AGENTS.md 사용 지침 병합을 포함합니다.

- Codex 실행 인수를 프로젝트별로 지원합니다. 실행 경로 변경, 불완전한 CLI 패키지, 백그라운드 서버 실패의 진단·복구 절차를 추가했습니다. --no-daemon은 확인된 장애에만 선택하며 기본 강제하지 않습니다.
- 타임머신의 보호 ref 생성과 SHA 확인을 필수로 바꿨습니다. 안전 백업 보호에 실패하면 파일 복원·정리를 중단하고, 체크포인트 저장 실패를 성공으로 표시하지 않습니다.
- 미리보기 준비 확인에서 HTTP 404/500을 정상으로 취급하지 않습니다. 대상 앱의 내용 확인은 설치 에이전트가 별도로 수행합니다.
- 모바일 이미지 전달과 서버 자동 시작의 보장 표현을 수정하고, 포트 전달은 Private 기본을 유지하도록 안내합니다.
- 선택형 탐색기 우클릭 실행에서 실행 정책 우회를 제거하고, VSIX 매니페스트 버전을 배포 버전과 맞췄습니다.
- 모드 테스트에서 실제 터널을 시작하던 문제를 격리했습니다.

검증: Windows 로컬 npm run check 및 42개 자동 테스트 통과. 실제 신규 에이전트의 전체 설치·세 도구 호출, 휴대폰 화면 확인은 이번 자동 테스트의 범위가 아니며 완료로 주장하지 않습니다.

스킬을 읽은 AI 에이전트가 세팅을 수행합니다. setup.ps1이나 VS Code 확장만 실행해서 세 도구가 설치되는 방식은 아닙니다. 모델·인증·권한 설정을 변경하지 않습니다.

---

## Vibe Coding v2.6.2 - Mobile Direct Tunnel Detection & 'No Host' Bug Fix

Resolved the mobile remote 'No Host' waiting issue by dynamically detecting machine-specific VS Code Dev Tunnel URLs and rendering real-time direct QR codes.

### What's New in v2.6.2
- **Dynamic Host Tunnel URI Detection:** Replaced the static generic URL (`vscode.dev/agents`) with active detection of the direct host tunnel URI (`vscode.dev/tunnel/<host>/...`) via `workbench.action.remoteTunnel.copyBrowserUrl`.
- **Dynamic QR Code Generation:** Real-time QR code rendering of the direct tunnel link, allowing smartphones to connect straight to the local PC workspace without manual host selection or 'No Host' hangs.
- **3-Phase Mobile Webview State Machine:** Provides explicit waiting (⚪), login in-progress, and active direct connected (🟢) UI badges with manual [🔄 연결 상태 새로고침] capability.
- **Resource Leak Prevention:** Strictly capped tunnel activation polling and wired timer cleanup to panel disposal and extension deactivation lifecycle.

## Vibe Coding v2.2.1 - Native Filesystem Verification & Virtualization Safety

Hardened installation and verification: native Windows filesystem SHA-256 and user SID checks, stale same-version detection, and non-destructive VS Code lifecycle management.

### What's New in v2.2.1
- **Tab Cleanup ReferenceError Fix:** Resolved unhandled entryFileName ReferenceError during first-column tab deduplication in extension.js, adding a regression test in tests/layout.test.cjs.
- **README Download URL & Strict CI Validation:** Corrected release download tag path in README.md and enhanced scripts/check.cjs to strictly validate full asset URL paths against package version.
- **Zero Project Modification Guarantee:** Removed creation/modification of <Project>\.vscode\settings.json. All Vibe Coding configurations now reside purely within the isolated .code-workspace and User profile.
- **Unified Agent Nomenclature:** Standardized UI and internal plan property references to Preview | Code | Agent and agentVersion with multi-agent fallback support (Codex CLI / OpenCode).
- **Clean Terminal Profile Security:** Removed unnecessary -ExecutionPolicy Bypass from the default Vibe PowerShell profile for cleaner compliance in enterprise and educational environments.
- **Native Filesystem Verification (native-files.ps1):** Defends against MSIX/sandbox AppData redirection by verifying file presence, SHA-256 hashes, and Windows user SID via a native Windows process before claiming setup success.
- **Stale Same-Version Detection (setup-files.ps1):** Performs recursive file content comparison between skill source and installed extension folders (ignoring VS Code installation metadata) to guarantee code updates are deployed.
- **Collision-Safe Backups (Backup-VibeFile):** Backs up configuration and workspace files with deterministic path hashes to prevent silent overwrite of initial backups.
- **Non-Destructive Lifecycle:** Safely removed routines that deleted VS Code code.lock or unsaved Backups folders, and preserves user hotExit and workspace trust preferences.
- **Resilient CLI Execution (Invoke-VibeCode):** Prevents PowerShell terminating error triggers on harmless VS Code CLI stderr warnings by relying on process exit code.
- **Specification & Documentation Alignment:** Updated SKILL.md, execution.md, and verification.md to reflect verified native launches and accurate Codex CLI workflows.

## Vibe Coding v2.0.0 - Preview | Code | Codex

Major architectural upgrade: **Preview | Code | Codex**. Powered directly by OpenAI's official Codex CLI and OpenCodex multi-model proxy.

### What's New in v2.0.0
- **Official Codex CLI Integration:** The 3rd column now runs OpenAI's official Codex CLI directly inside VS Code's terminal.
- **OpenCodex Proxy Synergy:** Automatically connects with local OpenCodex (http://127.0.0.1:10100) to provide real-time switching between Gemini 3.8 Flash, Claude 3.7 Sonnet, Solar-Pro 4, and xAI inside the workspace.
- **True Computer Use:** Full support for autonomous visual UI inspection and mouse/keyboard interaction via Codex's native Computer Use runtime.
- **3-Mode Viewport Engine:** One-click toggle between [3-Column Split] ↔ [Full Terminal (Codex)] ↔ [Full Preview] via status bar and editor title toolbar buttons.
- **Native F12 Definition Preservation:** Restored VS Code default Go to Definition functionality without key hijacking.
- **Real Browser DevTools Integration:** One-click "Open in External Browser" button launches Chrome/Edge with genuine DevTools (Network, Application, Cookies, Payment APIs) and automatic VS Code debugger synchronization.
- **Zero-Config Project Detection:** Automatically detects project entry files (index.html, src/App.tsx, etc.) and development server ports (Vite 5173, Next.js 3000, Astro 4321).
- **Windows Explorer Context Menu:** Right-click any folder in Windows Explorer and select 'Vibe Coding으로 열기' to open the 3-column workspace immediately (optional via -RegisterContextMenu).
- **Automated CI & Test Suite:** Added GitHub Actions CI, 8-part automated regression tests, package integrity checks, and full verification documentation.
- **MIT License & Official Branding:** Added official MIT license, release packaging, and updated onboarding templates.
