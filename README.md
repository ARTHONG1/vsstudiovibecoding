# Vibe Coding

[![Version](https://img.shields.io/badge/version-2.7.1-blue.svg)](https://github.com/ARTHONG1/vsstudiovibecoding/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6.svg?logo=windows)](https://github.com/ARTHONG1/vsstudiovibecoding)
[![CI](https://github.com/ARTHONG1/vsstudiovibecoding/actions/workflows/ci.yml/badge.svg)](https://github.com/ARTHONG1/vsstudiovibecoding/actions)

**VS Code 세팅을 AI 에이전트에게 통째로 맡기는 Windows용 바이브 코딩 스킬.**

> Let an AI agent set up your whole Windows VS Code vibe-coding workspace: preview, code, and Codex side by side, plus one-tap mobile access.

바이브 코딩을 시작할 때 진짜 어려운 건 코드가 아니라 **환경**입니다. 어떤 확장을 깔아야 하는지, 개발 서버 포트는 몇 번인지, 미리보기를 어디에 붙여야 하는지, 터미널 한글은 왜 깨지는지. 이 스킬은 그 과정을 사람이 배우게 하지 않고 **AI 에이전트에게 위임합니다.**

한 문장만 던지면 에이전트가 프로젝트를 열어 구조를 읽고, 실행 명령과 미리보기 주소를 직접 찾아내고, 기존 VS Code를 건드리지 않는 전용 작업 환경을 만들고, 바탕화면 바로가기까지 만든 뒤 화면이 실제로 뜨는지 확인합니다. 사용자가 할 일은 아이콘을 누르는 것뿐입니다.

열리는 화면은 왼쪽 **미리보기**, 가운데 **코드**, 오른쪽 **Codex** 세 칸입니다. 상태바 버튼으로 [3열 분할] ↔ [터미널 전체] ↔ [미리보기 전체]를 오가고, [📱 모바일]로 휴대폰에서 같은 프로젝트를 이어서 작업합니다. 작업 중에는 대화 단위로 스냅샷이 쌓여 원하는 과거 시점으로 되돌릴 수 있습니다. 에디터의 `F12`는 VS Code 기본 동작(정의로 이동) 그대로 둡니다.

**[친절한 시작 안내 →](https://arthong1.github.io/vsstudiovibecoding/)** · **[스킬 ZIP 다운로드](https://github.com/ARTHONG1/vsstudiovibecoding/releases/download/v2.7.1/vibe-coding-2.7.1.zip)** · [문제 신고](https://github.com/ARTHONG1/vsstudiovibecoding/issues)

## 가장 쉬운 시작

로컬 파일과 프로그램을 다룰 수 있는 AI 에이전트에 아래 문장을 붙여 넣으세요. 일반 웹 채팅만으로는 PC 설정을 변경할 수 없습니다.

```text
https://github.com/ARTHONG1/vsstudiovibecoding 의 vibe-coding 폴더를
내 AI 도구의 스킬 폴더에 설치하고 SKILL.md를 읽어 실행해줘.
Windows에서 별도 샘플 프로젝트를 만들고 VS Code, Codex CLI,
필수 확장, 미리보기 | 코드 | Codex 3열 화면과 상태바 토글 버튼까지 설정해줘.
기존 설정과 파일은 보존하고 실제 화면, 버튼, 3대 모드 전환,
바로가기 재실행을 검증해줘. 보안 승인과 로그인이 필요하면
정확히 어떤 버튼을 내가 눌러야 하는지 알려줘.
```

에이전트가 스킬을 새로 인식하려면 새 대화나 앱 재시작이 필요할 수 있습니다. 설치 후에는 `$vibe-coding 환경 처음부터 끝까지 세팅해줘`라고 요청하세요. 도구마다 스킬 지원 방식이 다릅니다.

### ZIP으로 직접 설치할 때

1. 위 스킬 ZIP을 받아 압축을 풉니다. 안에 `vibe-coding/SKILL.md`가 있어야 합니다.
2. Codex의 경우 `vibe-coding` 폴더 전체를 `%USERPROFILE%\.agents\skills\` (또는 기존 `%USERPROFILE%\.codex\skills\`) 아래에 둡니다. 동명의 스킬이 있으면 기존 폴더를 먼저 백업하세요.
3. 새 대화를 열고 `$vibe-coding 환경 처음부터 끝까지 세팅해줘`를 입력합니다.

`SKILL.md` 하나만 복사하면 안 됩니다. `scripts`, `assets`, `references`가 함께 필요합니다. 스킬을 설치하는 단계와 PC 개발 환경을 설정하는 단계는 별개입니다.

## 준비물과 지원 범위

| 항목 | 안내 |
|---|---|
| PC | Windows. Windows 11 x64에서 실제 검증. macOS/Linux는 이 패키지의 지원 대상이 아닙니다. |
| AI 도구 | 로컬 파일·셸 실행 권한. 화면 검증에는 Windows 화면 제어 도구도 필요합니다. |
| 인터넷 | VS Code 및 확장 다운로드, Codex CLI 사용에 필요합니다. 학교·회사 네트워크 정책에 따라 차단될 수 있습니다. |
| Codex | OpenAI 공식 Codex CLI(`codex.exe` / `codex.cmd`)를 3열 에이전트 터미널로 구동합니다. |
| AI 사용 | 선택한 제공자의 로그인/API 키가 필요할 수 있고 요금·사용 한도가 다릅니다. 환경 설정이 AI 이용권을 제공하지 않습니다. |
| 프로젝트 | 처음에는 샘플 권장. 기존 HTML·React/Vite 등은 원래 파일과 개발 서버를 유지합니다. |

## 내가 직접 할 수밖에 없는 단계

- **작업 공간 신뢰:** 직접 만든 샘플이나 출처를 아는 프로젝트인지 확인하고 VS Code의 `Trust Workspace & Continue`를 선택합니다. 모든 폴더를 일괄 신뢰하거나 보안을 끄지 마세요.
- **도구의 앱 제어 승인:** 에이전트가 VS Code를 볼 수 있도록 도구가 요청하는 승인을 확인합니다.
- **AI 로그인:** Codex CLI 실행 시 인증 요구사항을 확인합니다. 계정·비밀번호·키는 공개 이슈나 채팅에 붙여 넣지 마세요.

보안·로그인 화면은 자동화 도구의 규칙에 따라 사용자가 직접 처리해야 합니다. 완료 후 “진행해”라고 말하면 나머지는 에이전트가 이어갑니다.

## 정상 완료의 기준

1. 왼쪽은 작동하는 미리보기, 가운데는 실제 소스, 오른쪽은 Codex 입력창입니다.
2. 샘플의 **미리보기 작동 확인** 버튼을 누르면 클릭 횟수가 증가합니다.
3. 화면 우측 하단 상태바의 **[ 🗖 터미널 전체 ]** 클릭 시 Codex 터미널 100% 확대, **[ ⊞ 3열 복원 ]** 클릭 시 원래대로 복귀함을 확인합니다.
4. **[ 🌐 미리보기 전체 ]** 클릭 시 웹 미리보기 100% 확대(Computer Use / 1:1 검수용), **[ ⊞ 3열 복원 ]** 클릭 시 50:50 분할 복귀를 확인합니다.
5. 에디터에서 `F12`를 눌렀을 때 터미널이 가로채지 않고 순정 **[함수/변수 정의로 이동]**이 정상 작동함을 확인합니다.
6. 생성된 **Vibe Coding - 프로젝트명-식별자** 바탕화면 바로가기 또는 윈도우 탐색기 폴더 우클릭 **[ Vibe Coding으로 열기 ]**로 다시 열어도 완벽히 복원돼야 합니다.
7. 코드 에디터 우측 상단 툴바의 **[ ↗ 외부 브라우저에서 열기 ]** 클릭 시 시스템 기본 브라우저(Chrome/Edge)가 뜨며 순정 F12 개발자 도구(Network, Application/쿠키) 및 실시간 디버깅이 연결됨을 확인합니다.
8. 터미널에서 `Ctrl+V`로 클립보드 텍스트가 즉시 붙여넣어지고 마우스 선택 시 자동 복사되며, `Alt+V`(또는 상단 📷 아이콘)로 클립보드 캡처 이미지가 파일로 자동 저장되어 터미널에 경로가 즉시 입력됨을 확인합니다.

설치 성공 로그만으로 완료로 판단하지 않습니다. 화면 도구가 없으면 화면 검증은 미완료로 표시합니다. Codex 입력창 표시와 실제 인증된 AI 응답도 구분합니다.

## 막혔을 때

| 증상 | 확인할 것 / 에이전트에게 할 요청 |
|---|---|
| 빈 화면, 기본 Chat만 보임 | 시작 안내를 완료했는지와 상단 `Restricted Mode`를 먼저 확인. “현재 화면과 확장 활성화 로그를 확인해줘.” |
| 제한 모드 | 출처를 확인한 프로젝트만 신뢰. 에이전트가 대신 승인할 수 없는 경우 직접 선택 후 “진행해”. |
| Codex를 찾지 못함 | 공식 Codex CLI 설치 확인 또는 npm fallback 확인. “codex.exe의 경로와 --version을 확인해줘.” |
| 오른쪽이 너무 좁음 | 패널 경계선을 왼쪽으로 이동. “Codex 입력창이 잘 보이도록 너비를 조정해줘.” |
| 상태바 버튼이 안 보임 | 화면 우측 하단(포트 번호 바로 왼쪽) 확인. 창 다시 로드(`Ctrl+Shift+P` → `Reload Window`) 실행. |
| 미리보기 복원 시간 초과 | 개발 서버가 실제로 응답하는지 먼저 확인. "업데이트 후 저장하지 않은 파일을 보존하고 전용 창을 다시 열어 검증해줘." |
| 휴대폰에서 폴더가 열리지 않음 | 한글·공백 경로는 주소에 그대로 담기지 않습니다. [📱 모바일] QR은 영문 경로의 `.code-workspace`를 대상으로 해야 합니다. |
| 휴대폰에 버튼이 안 보임 | 원격 서버에도 Vibe 확장이 설치돼야 합니다. 페이지를 새로고침한 뒤 상태바 왼쪽의 [터미널] · [미리보기]를 확인하세요. |
| 실행 정책/조직 정책 오류 | 정책을 끄거나 우회하지 않음. 에이전트가 허용된 실행 경로를 확인; 관리 조직 정책이면 관리자 문의. |
| 빈 index.html 또는 경로 불일치 | 앱 가상화 가능성. “실제 Windows 사용자와 에이전트의 파일 해시·경로를 비교해줘.” |
| React/Vite 미리보기 연결 실패 | 기존 개발 서버가 실행 중인지와 실제 localhost URL 확인. HTML 샘플로 덮어쓰지 않음. |
| AI 응답이 없음 | Codex CLI의 로그인/인증 상태·한도·네트워크 확인. |

문제 신고에는 OS, 버전, 기대/실제 동작, 민감정보를 가린 오류만 포함하세요. 전체 로그나 사용자 경로·API 키를 그대로 게시하지 마세요.

## ⏪ Vibe 타임머신 (대화 단위 되돌리기)

AI가 코드를 고치다 멀쩡하던 기능을 망가뜨렸을 때, 대화 턴 단위로 과거 시점을 골라 작업 파일을 되돌립니다. 초보자가 Git 명령을 배우지 않아도 "아까 그 상태로"가 가능하도록 만든 장치입니다.

- **브랜치 기록을 건드리지 않음**: `git commit`이나 `git stash` 대신 저수준 명령(`commit-tree`)으로 별도 스냅샷을 만들고 `refs/vibe` 아래에 보관합니다. main 브랜치 커밋 로그에는 아무것도 추가되지 않습니다. 스냅샷 객체 자체는 프로젝트의 `.git` 안에 저장됩니다.
- **Staging 보존**: 복원할 때 별도 인덱스를 사용하므로, 사용자가 `git add`로 올려둔 상태는 그대로 남습니다.
- **대화 제목으로 기록**: "응", "진행해" 같은 단답은 걸러내고 실제 지시 내용(예: *"점수판 텍스트를 한글로 바꿔줘"*)을 스냅샷 이름으로 대화당 하나씩 남깁니다.
- **되돌리기와 취소**: 에디터 툴바의 **[ ⏪ ]** 또는 상태바 **[ 타임머신 ]**(`Alt+Z`)으로 복원 메뉴를 열고, 방금 한 롤백을 다시 취소할 수 있습니다.

## 저장 위치·업데이트·되돌리기

전용 환경은 `%LOCALAPPDATA%\VibeCoding` 아래의 `VSCodeUserData`, `VSCodeExtensions`, `Workspaces`, `Backups`에 저장됩니다. 샘플은 `SampleProject`입니다. 기존 프로젝트는 이동하지 않습니다.

업데이트할 때 기존 스킬을 백업하고 새 폴더로 바꾼 뒤 에이전트에게 재설정을 요청합니다. 전용 설정의 관리 키만 병합하고 기존 파일을 보존합니다. 사용자의 개인 터미널이나 에디터 탭은 절대 종료하지 않습니다.

## 하이브리드 브라우저 & AI 디버깅 파이프라인

- **가벼운 실시간 코딩:** VS Code 3열 내장 뷰포트로 리소스 낭비 없이 실시간 핫리로드 반영
- **AI 시각 검수 (Computer Use):** `[ 🌐 미리보기 전체 ]` 모드로 에디터 요소를 걷어낸 1:1 뷰포트 확보
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

설치 스크립트는 공식 OpenAI Codex CLI를 탐색하여 3열 터미널을 구성합니다. 프레임워크 개발 서버는 `.vscode/tasks.json` 백그라운드 태스크로 자동 실행을 소유하여 포트 충돌 없이 구동됩니다.

 `npm test`로 회귀 테스트, `npm run check`로 패키지·문서 링크 검사, Windows의 `powershell -File scripts/build-release.ps1`로 배포 ZIP을 만듭니다.

## 검증 기록

2026-09-18, Windows 11 x64 / VS Code 1.138.0 / Codex CLI / Live Preview 0.4.20에서 샘플 3열·한글·버튼·F12 왕복·정상 종료/재실행과 미리보기 제목 변경 수정 후 복원을 실제 화면 및 로그로 확인했습니다. 다른 PC와 모든 프레임워크에서 성공을 보장하는 결과는 아닙니다. [검증 범위](TESTING.md)를 확인하세요.

## 휴대폰에서 원격으로 작업하기 (v2.7.1)

상태바 **[📱 모바일]** 버튼을 누르면 마이크로소프트 공식 `code tunnel` 엔진이 백그라운드에서 프로젝트 전용 `vscode.dev` 주소를 만들고, **스마트폰 카메라로 바로 스캔할 수 있는 QR 코드**를 띄웁니다. 휴대폰에서 최초 1회 PC와 같은 GitHub 계정으로 로그인하면 내 PC의 프로젝트가 그대로 열립니다.

휴대폰 화면에서는 상태바 왼쪽에 **[ 터미널 ]** 과 **[ 미리보기 ]** 두 버튼만 크게 노출됩니다. [터미널]은 Codex 입력 화면으로, [미리보기]는 개발 서버가 그리는 실제 결과 화면으로 한 번에 전환합니다. 좁은 화면에서 3열을 거치지 않으므로 이동 중에도 바로 지시하고 결과를 확인할 수 있습니다.

연결 주소는 한글·공백이 없는 `.code-workspace` 파일을 가리킵니다. `vscode.dev`가 주소에 담긴 한글을 그대로 폴더 이름으로 취급해 프로젝트가 열리지 않던 문제를 피하기 위해서입니다. 워크스페이스 파일이 프로젝트 폴더와 미리보기 주소를 함께 담고 있어 휴대폰에서도 같은 설정이 적용됩니다.

PC가 켜져 있고 온라인이어야 하며, `--no-sleep` 플래그로 터널 동작 중 절전이 방지됩니다. 원격 창에도 Vibe 확장이 설치돼야 두 버튼이 보입니다. 휴대폰과 PC에서 같은 파일을 동시에 편집하지 마세요.

[AI의 모바일 설정 절차](vibe-coding/references/mobile-remote.md) · [VS Code 원격 터널 공식 문서](https://code.visualstudio.com/docs/remote/tunnels)

## 만든 사람

**AI찬우쌤**이 교실에서 쓰려고 만들었습니다. 수업 자료를 직접 만들다 보면 코드보다 환경 설정에서 먼저 막히는데, 그 벽을 학생과 선생님 대신 AI가 넘어주게 하자는 생각에서 출발했습니다.

- **클래스똑딱** — [classddok.com](https://classddok.com/) · 교사를 위한 에듀테크 연구회이자 수업 도구 모음입니다. AI 받아쓰기, 워드서치, 퀴즈·게임, OMR 채점, AI 실시간 토론 게시판 등을 바로 쓸 수 있고 [교원 연수](https://classddok.com/trainings)도 운영합니다.
- **AI찬우쌤 유튜브** — [채널 바로가기](https://www.youtube.com/channel/UCnmcRReKbadpjJmueG1nzvw) · AI 도구를 수업에 실제로 적용하는 과정을 다룹니다.

교실이든 개인 프로젝트든, 환경 설정 때문에 시작을 미루는 사람이 줄어들면 좋겠습니다. 써보고 막히는 지점이 있으면 [이슈](https://github.com/ARTHONG1/vsstudiovibecoding/issues)로 알려주세요.
