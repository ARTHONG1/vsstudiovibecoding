# v2.5.1 — 런타임 안정성 강화, Git 섀도우 인덱스 격리 및 Tasks 자동 스캐폴딩

이번 패치 릴리스는 v2.5.0에서 개선된 Codex 단일화 아키텍처를 바탕으로, 확장 프로그램의 수명 주기 안정성을 확보하고 사용자의 실제 Git 작업 내역을 완벽히 보호하도록 핵심 엔진을 보강했습니다.

## 주요 개선 사항

### 1. 확장 프로그램 dispose 수명 주기 안전화
- 확장 프로그램 비활성화/창 종료 시 참조되던 미선언 변수(`devProcess`) dispose 훅을 완전히 삭제하여 잠재적인 `ReferenceError` 크래시를 원천 차단했습니다.
- 확장 수명 주기 dispose 검증 테스트를 추가했습니다.

### 2. `GIT_INDEX_FILE` 기반 섀도우 인덱스 격리 (진짜 Git 무오염 타임머신)
- 타임머신 스냅샷 생성 및 롤백 안전 백업 시, 사용자의 메인 `.git/index` 대신 `.vibe/shadow_index`를 사용하도록 환경변수를 격리했습니다.
- 사용자가 기존에 `git add` 해둔 Staged 파일 상태와 Unstaged 파일 상태가 스냅샷 생성 후에도 **1바이트도 변경되지 않고 100% 보존**됩니다.
- 롤백 시 `git clean -fd -e .vibe`를 적용하여 타임머신 메타데이터 디렉터리가 손상되지 않도록 보호했습니다.

### 3. 개발 서버 `.vscode/tasks.json` 자동 스캐폴딩 내재화
- 초보자가 개발 서버 자동 실행을 위해 별도로 설정 파일을 작성할 필요 없이, `package.json`에 `scripts.dev` 또는 `scripts.start`가 정의되어 있고 `-PreviewUrl`이 지정된 경우 `setup.ps1`이 프로젝트의 `.vscode/tasks.json`(`folderOpen`, `isBackground`)을 자동으로 스캐폴딩합니다.
- 사용자의 기존 `tasks.json`이 이미 있는 경우 덮어쓰지 않고 안전하게 보존합니다.

### 4. 명칭 및 브랜딩 정비
- `README.md` 상단의 모호한 `OpenCodex` 표현을 정리하고 순수 `OpenAI 공식 Codex CLI`로 일원화했습니다.

## 검증 결과
- 신규 타임머신 Git Index 무오염 검증 테스트 및 수명 주기 dispose 테스트 포함
- 전체 자동화 테스트 전원 통과 (`npm test`)
- 패키지 무결성 및 버전 링크 일치 검증 100% 통과 (`npm run check`)
