# v2.6.1 — 외부 Codex 세션 모바일 바인딩 및 타임머신 원자적 트랜잭션 안전 장치

이번 릴리스는 v2.6.0의 Dev Tunnel 모바일 아키텍처를 완성하고, 타임머신의 데이터 보존 안전성을 엄격히 강화한 안정화 패치입니다.

## 주요 개선 사항

### 1. 외부 Codex CLI 세션 모바일 자동 바인딩 (`chat.agentSessions.showExternal`)
- VS Code 1.138+의 외부 세션 탐색 기본값이 `none`이어서 모바일 접속 시 PC 터미널의 세션이 숨겨지던 문제를 해결했습니다.
- `setup.ps1` 격리 설정에 `"chat.agentSessions.showExternal": "recent"`를 자동 주입하여, 모바일 브라우저(`vscode.dev/agents`) 접속 즉시 PC의 Codex 세션과 실시간 파일 수정 Diff가 100% 자동 노출됩니다.

### 2. 타임머신 Safety Backup 원자적 트랜잭션 안전 장치 탑재
- 롤백 직전 안전 백업(Safety Backup) 생성 실패 시 예외를 무시하지 않고 즉시 롤백 프로세스를 중단(Abort)하도록 수정했습니다.
- 백업 성공이 검증되지 않은 상태에서는 `git checkout` 및 `git clean -fd`가 절대 실행되지 않으므로, 작업 중이던 코드가 영구 유실될 위험을 원천 차단했습니다.

### 3. VS Code 1.138.0+ 환경 정합성 및 검증 기록 최신화
- `setup.ps1` 플랜에 감지된 VS Code 실행 파일의 실제 버전(`codeVersion`)을 포함하도록 보강했습니다.
- 문서 및 패키지 검증 환경을 실제 테스트 환경인 `VS Code 1.138.0` 기준으로 갱신했습니다.

## 검증 결과
- 신규 타임머신 안전 중단 트랜잭션 검증 테스트 포함
- 전체 자동화 테스트 전원 통과 (`npm test`)
- 패키지 무결성 및 버전 링크 일치 검증 100% 통과 (`npm run check`)
