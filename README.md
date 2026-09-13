# Vibe Coding

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/ARTHONG1/vsstudiovibecoding/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6.svg?logo=windows)](https://github.com/ARTHONG1/vsstudiovibecoding)
[![CI](https://github.com/ARTHONG1/vsstudiovibecoding/actions/workflows/ci.yml/badge.svg)](https://github.com/ARTHONG1/vsstudiovibecoding/actions)

**AI에게 설치부터 화면 검증까지 맡기는 Windows용 바이브 코딩 스킬.**

VS Code를 **미리보기 | 코드 | OpenCode** 3열로 배치하며, 상태바와 에디터 툴바의 전용 버튼으로 **3대 뷰포트 모드 ([3열 분할] ↔ [터미널 전체] ↔ [미리보기 전체])**를 원클릭 전환합니다. VS Code 순정 `F12`(함수 정의로 이동)를 100% 온전히 보존하며, 초보자를 위한 제로 컨피그 자동 감지와 윈도우 우클릭 메뉴를 지원합니다.

**[친절한 시작 안내 →](https://arthong1.github.io/vsstudiovibecoding/)** · **[스킬 ZIP 다운로드](https://github.com/ARTHONG1/vsstudiovibecoding/releases/download/v1.3.0/vibe-coding-1.3.0.zip)** · [문제 신고](https://github.com/ARTHONG1/vsstudiovibecoding/issues)

## 가장 쉬운 시작

로컬 파일과 프로그램을 다룰 수 있는 AI 에이전트에 아래 문장을 붙여 넣으세요. 일반 웹 채팅만으로는 PC 설정을 변경할 수 없습니다.

```text
https://github.com/ARTHONG1/vsstudiovibecoding 의 vibe-coding 폴더를
내 AI 도구의 스킬 폴더에 설치하고 SKILL.md를 읽어 실행해줘.
Windows에서 별도 샘플 프로젝트를 만들고 VS Code, OpenCode CLI,
필수 확장, 미리보기 | 코드 | OpenCode 3열 화면과 상태바 토글 버튼까지 설정해줘.
기존 설정과 파일은 보존하고 실제 화면, 버튼, 3대 모드 전환,
바로가기 재실행을 검증해줘. 보안 승인과 로그인이 필요하면
정확히 어떤 버튼을 내가 눌러야 하는지 알려줘.
```

에이전트가 스킬을 새로 인식하려면 새 대화나 앱 재시작이 필요할 수 있습니다. 설치 후에는 `$vibe-coding 환경 처음부터 끝까지 세팅해줘`라고 요청하세요. 도구마다 스킬 지원 방식이 다릅니다.

### ZIP으로 직접 설치할 때

1. 위 스킬 ZIP을 받아 압축을 풉니다. 안에 `vibe-coding/SKILL.md`가 있어야 합니다.
2. Codex의 경우 `vibe-coding` 폴더 전체를 `%USERPROFILE%\.codex\skills\` 아래에 둡니다. 다른 도구는 해당 도구의 스킬 위치를 사용하세요. 동명의 스킬이 있으면 기존 폴더를 먼저 백업하세요.
3. 새 대화를 열고 `$vibe-coding 환경 처음부터 끝까지 세팅해줘`를 입력합니다.

`SKILL.md` 하나만 복사하면 안 됩니다. `scripts`, `assets`, `references`가 함께 필요합니다. 스킬을 설치하는 단계와 PC 개발 환경을 설정하는 단계는 별개입니다.

## 준비물과 지원 범위

| 항목 | 안내 |
|---|---|
| PC | Windows. Windows 11 x64에서 실제 검증. macOS/Linux는 이 패키지의 지원 대상이 아닙니다. |
| AI 도구 | 로컬 파일·셸 실행 권한. 화면 검증에는 Windows 화면 제어 도구도 필요합니다. |
| 인터넷 | VS Code, OpenCode, 확장 다운로드에 필요합니다. 학교·회사 네트워크 정책에 따라 차단될 수 있습니다. |
| OpenCode | CLI와 VS Code 확장은 별개입니다. 스킬은 실제 CLI 실행까지 확인합니다. |
| AI 사용 | 선택한 제공자의 로그인/API 키가 필요할 수 있고 요금·사용 한도가 다릅니다. 환경 설정이 AI 이용권을 제공하지 않습니다. |
| 프로젝트 | 처음에는 샘플 권장. 기존 HTML·React/Vite 등은 원래 파일과 개발 서버를 유지합니다. |

## 내가 직접 할 수밖에 없는 단계

- **작업 공간 신뢰:** 직접 만든 샘플이나 출처를 아는 프로젝트인지 확인하고 VS Code의 `Trust Workspace & Continue`를 선택합니다. 모든 폴더를 일괄 신뢰하거나 보안을 끄지 마세요.
- **도구의 앱 제어 승인:** 에이전트가 VS Code를 볼 수 있도록 도구가 요청하는 승인을 확인합니다.
- **AI 로그인:** OpenCode의 `/connect`에서 원하는 제공자를 연결합니다. 계정·비밀번호·키는 공개 이슈나 채팅에 붙여 넣지 마세요. VS Code의 GitHub 로그인은 OpenCode 연결과 다릅니다.

보안·로그인 화면은 자동화 도구의 규칙에 따라 사용자가 직접 처리해야 합니다. 완료 후 “진행해”라고 말하면 나머지는 에이전트가 이어갑니다.

## 정상 완료의 기준

1. 왼쪽은 작동하는 미리보기, 가운데는 실제 소스, 오른쪽은 OpenCode 입력창입니다.
2. 샘플의 **미리보기 작동 확인** 버튼을 누르면 클릭 횟수가 증가합니다.
3. 화면 우측 하단 상태바의 **[ 🗖 터미널 전체 ]** 클릭 시 터미널 100% 확대, **[ ⊞ 3열 복원 ]** 클릭 시 원래대로 복귀함을 확인합니다.
4. **[ 🌐 미리보기 전체 ]** 클릭 시 웹 미리보기 100% 확대(Computer Use / 1:1 검수용), **[ ⊞ 3열 복원 ]** 클릭 시 50:50 분할 복귀를 확인합니다.
5. 에디터에서 `F12`를 눌렀을 때 터미널이 가로채지 않고 순정 **[함수/변수 정의로 이동]**이 정상 작동함을 확인합니다.
6. 생성된 **Vibe Coding - 프로젝트명-식별자** 바탕화면 바로가기 또는 윈도우 탐색기 폴더 우클릭 **[ Vibe Coding으로 열기 ]**로 다시 열어도 완벽히 복원돼야 합니다.
7. 코드 에디터 우측 상단 툴바의 **[ ↗ 외부 브라우저에서 열기 ]** 클릭 시 시스템 기본 브라우저(Chrome/Edge)가 뜨며 순정 F12 개발자 도구(Network, Application/쿠키) 및 실시간 디버깅이 연결됨을 확인합니다.

설치 성공 로그만으로 완료로 판단하지 않습니다. 화면 도구가 없으면 화면 검증은 미완료로 표시합니다. OpenCode 입력창 표시와 실제 인증된 AI 응답도 구분합니다.

## 막혔을 때

| 증상 | 확인할 것 / 에이전트에게 할 요청 |
|---|---|
| 빈 화면, 기본 Chat만 보임 | 시작 안내를 완료했는지와 상단 `Restricted Mode`를 먼저 확인. “현재 화면과 확장 활성화 로그를 확인해줘.” |
| 제한 모드 | 출처를 확인한 프로젝트만 신뢰. 에이전트가 대신 승인할 수 없는 경우 직접 선택 후 “진행해”. |
| OpenCode를 찾지 못함 | npm 래퍼와 실제 EXE 위치를 구분. “native 사용자 설치 경로에서 opencode.exe와 --version을 확인해줘.” |
| 오른쪽이 너무 좁음 | 패널 경계선을 왼쪽으로 이동. “OpenCode 입력창이 잘 보이도록 너비를 조정해줘.” |
| 상태바 버튼이 안 보임 | 화면 우측 하단(포트 번호 바로 왼쪽) 확인. 창 다시 로드(`Ctrl+Shift+P` → `Reload Window`) 실행. |
| 미리보기 복원 시간 초과 | v1.3.0에는 3대 뷰포트 모드 및 상태바 토글 포함. “업데이트 후 저장하지 않은 파일을 보존하고 전용 창을 다시 열어 검증해줘.” |
| 실행 정책/조직 정책 오류 | 정책을 끄거나 우회하지 않음. 에이전트가 허용된 실행 경로를 확인; 관리 조직 정책이면 관리자 문의. |
| 빈 index.html 또는 경로 불일치 | 앱 가상화 가능성. “실제 Windows 사용자와 에이전트의 파일 해시·경로를 비교해줘.” |
| React/Vite 미리보기 연결 실패 | 기존 개발 서버가 실행 중인지와 실제 localhost URL 확인. HTML 샘플로 덮어쓰지 않음. |
| AI 응답이 없음 | OpenCode의 제공자 연결·한도·네트워크 확인. GitHub 로그인만으로 연결되지 않음. |

문제 신고에는 OS, 버전, 기대/실제 동작, 민감정보를 가린 오류만 포함하세요. 전체 로그나 사용자 경로·API 키를 그대로 게시하지 마세요.

## 저장 위치·업데이트·되돌리기

전용 환경은 `%LOCALAPPDATA%\VibeCoding` 아래의 `VSCodeUserData`, `VSCodeExtensions`, `Workspaces`, `Backups`에 저장됩니다. 샘플은 `SampleProject`입니다. 기존 프로젝트는 이동하지 않습니다.

업데이트할 때 기존 스킬을 백업하고 새 폴더로 바꾼 뒤 에이전트에게 재설정을 요청합니다. 전용 설정의 관리 키만 병합하고 기존 파일을 보존합니다. 삭제가 필요하면 먼저 샘플에서 만든 작업을 별도로 보관한 뒤, 전용 창과 해당 바로가기·폴더만 정리하세요. 공유해서 사용하는 VS Code와 OpenCode 프로그램은 자동으로 삭제하지 않습니다.

## 하이브리드 브라우저 & AI 디버깅 파이프라인

- **가벼운 실시간 코딩:** VS Code 3열 내장 뷰포트로 리소스 낭비 없이 실시간 핫리로드 반영
- **AI 시각 검수 (Computer Use):** `[ 🌐 미리보기 전체 ]` 모드로 에디터 노이즈를 100% 제거한 1:1 고해상도 뷰포트 확보
- **결제·쿠키·F12 심층 검수:** 코드 상단 툴바의 `[ ↗ 외부 브라우저 ]` 클릭 한 번으로 Chrome/Edge 호출
- **AI 초고속 DOM 검증:** 프로젝트의 실제 로컬 개발 서버(Live Preview 또는 Vite 5173, Next.js 3000 등) 엔드포인트를 상시 유지하여 Playwright/Browser-Use가 백그라운드 CDP로 결제창·모달·네트워크 무결성 테스트 병행

## 개발자 / 직접 실행

에이전트용 스크립트입니다. 일반 사용자는 위 요청문으로 시작하세요.

```powershell
# 계획만 확인 (파일을 변경하지 않음)
& .\vibe-coding\scripts\setup.ps1 -CreateSample
# 계획을 확인한 뒤 적용
& .\vibe-coding\scripts\setup.ps1 -CreateSample -Apply
# 기존 HTML 프로젝트
& .\vibe-coding\scripts\setup.ps1 -ProjectPath 'C:\Projects\My Site' -EntryFile index.html -Apply
```

설치 스크립트는 OpenCode CLI가 없을 경우 시스템의 `npm`을 확인하여 `npm install -g opencode-ai`로 자동 설치를 시도합니다. 시스템에 `npm`이 없거나 VS Code 자체가 없는 경우 에이전트가 공식 안내([VS Code](https://code.visualstudio.com/docs/setup/windows), [OpenCode](https://opencode.ai/docs/))에 따라 설치를 진행합니다. 프레임워크 서버 시작도 프로젝트별로 처리합니다.

 `npm test`로 회귀 테스트, `npm run check`로 패키지·문서 링크 검사, Windows의 `powershell -File scripts/build-release.ps1`로 배포 ZIP을 만듭니다.

## 검증 기록

2026-09-10, Windows 11 x64 / VS Code 1.137.0 / OpenCode 1.18.30 / Live Preview 0.4.20에서 샘플 3열·한글·버튼·F12 왕복·정상 종료/재실행과 미리보기 제목 변경 수정 후 복원을 실제 화면 및 로그로 확인했습니다. 다른 PC와 모든 프레임워크에서 성공을 보장하는 결과는 아닙니다. [검증 범위](TESTING.md)를 확인하세요.
