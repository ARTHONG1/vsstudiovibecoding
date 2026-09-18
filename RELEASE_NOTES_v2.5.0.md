# v2.5.0 — OpenAI Codex CLI 전용 단일화, 사용자 자원 보호 및 최신 규격 반영

이번 릴리스는 초보자가 복잡한 VS Code 개발 환경 설정을 AI 에이전트에게 전적으로 위임할 수 있도록 본질적인 워크플로우를 완성하고, 에이전트 단일화 및 사용자 기존 작업 보호를 강화했습니다.

## 주요 변경 사항

### 1. OpenAI Codex CLI 전용 단일화
- OpenCode 관련 코드, 파라미터, 설정 키 및 VS Code 확장(`sst-dev.opencode`) 설치 시도를 전면 제거했습니다.
- 시스템에 Codex CLI가 없을 경우 타 도구를 임의로 설치하던 동작을 제거하고 공식 Codex 설치 상태를 명확히 검증합니다.
- 3열 에이전트 터미널을 순수 OpenAI Codex CLI로 고정했습니다.

### 2. 사용자 기존 자원(터미널 / 탭) 완벽 보존
- **개인 터미널 보호**: 사용자가 띄워둔 개인 PowerShell, Git, Python 터미널을 종료하던 로직을 제거하고, 동일 프로젝트의 과거 Vibe 터미널만 선별 정리하도록 안전화했습니다.
- **에디터 탭 보호**: VS Code 설정(Settings), 환영 페이지, 타사 Webview 탭이 닫히지 않도록 Vibe Preview 전용 탭만 추적하여 닫도록 범위를 좁혔습니다.

### 3. 개발 서버 구동 라이프사이클 단일화
- 개발 서버 구동을 `.vscode/tasks.json`(`folderOpen`) 백그라운드 태스크로 단일화했습니다.
- VS Code 확장의 중복 `npm run dev` 실행을 제거하여 포트 충돌(`5173 → 5174`) 및 좀비 프로세스를 방지하고, 포트 오픈 대기(Health Check) 후 브라우저에 연결합니다.

### 4. 최신 OpenAI 에이전트 스킬 규격 반영
- `agents/openai.yaml` 매니페스트를 추가하여 최신 Codex 앱 연동 메타데이터를 제공합니다.
- 스킬 기본 경로를 `$HOME/.agents/skills/vibe-coding` 기준으로 안내하며, 기존 `.codex/skills` 경로와의 하위 호환성을 유지합니다.

## 검증 결과
- 전체 단위/통합/자원 격리 테스트 17개 전원 통과 (`npm test`)
- 패키지 무결성 및 버전 일치 검증 100% 통과 (`npm run check`)
