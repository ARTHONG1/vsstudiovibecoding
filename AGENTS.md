# AGENTS.md — vsstudiovibecoding

Windows·macOS용 Vibe Coding 스킬 저장소. 이 스킬의 목적은 VS Code 환경 구성을 사람이 배우게 하지 않고 AI 에이전트가 대신 수행하게 하는 것이다. 코드를 고치기 전에 이 파일을 먼저 읽어라.

## 구조

| 경로 | 역할 |
| --- | --- |
| `vibe-coding/SKILL.md` | 에이전트 지시문. 판단 기준을 담는다. |
| `vibe-coding/scripts/setup.ps1` | Windows 환경 구성 실행. 결정론적 작업만 담당한다. |
| `vibe-coding/scripts/setup-macos.sh`, `setup-macos.cjs` | macOS 환경 구성 실행. setup.ps1과 같은 입력·병합·백업 규칙을 따른다. |
| `vibe-coding/assets/workspace-extension/extension/` | VS Code 확장 본체. 레이아웃·미리보기·터미널·타임머신·터널. 운영체제별 경로와 명령은 `platform.js`에만 둔다. |
| `vibe-coding/references/` | 에이전트용 절차 문서. |
| `index.html` | GitHub Pages. |

판단은 SKILL.md, 반복 작업은 설치 스크립트(PowerShell, macOS는 Node), 화면 상태는 확장이 담당한다. 이 경계를 무너뜨리지 마라. 프레임워크 추론 같은 판단 로직을 `setup.ps1`에 밀어 넣지 않는다.

## 검증 명령

```powershell
npm run check   # 필수 파일, 버전 일치, JS 구문, 문서 링크
npm test        # node --test (약 80개)
```

맥 동작은 `.github/workflows/macos-e2e.yml`이 깨끗한 맥 러너에서 실제로 설치·실행해 확인한다. CI와 릴리스 모두 이 작업을 통과해야 한다. 증거(화면 캡처, status.jsonl, 설치 결과 JSON)는 `macos-evidence` 아티팩트에 남는다.

**샌드박스 주의.** 아래 내용은 Windows 기준이다. 샌드박스 안에서는 `tests/native-files.test.cjs`와 `tests/timemachine.test.cjs`가 실패한다. 원인은 코드가 아니라 `spawnSync git EPERM`과 `Invoke-CimMethod` 차단이다. 이 두 개가 실패하면 먼저 샌드박스 밖에서 다시 돌려 확인하고, 코드를 고치기 전에 원인을 구분하라. CI(windows-latest)에서는 통과한다.

## 버전 변경 규칙

버전은 네 곳이 동시에 일치해야 하며, 하나라도 어긋나면 `npm run check`가 실패한다.

1. `package.json`의 `version` (들여쓰기 2칸 유지)
2. `vibe-coding/assets/workspace-extension/extension/package.json`의 `version` (들여쓰기 4칸 유지)
3. README 상단 버전 배지
4. README의 릴리스 ZIP 다운로드 URL

JSON을 다시 쓸 때 들여쓰기 폭을 바꾸면 diff가 통째로 뒤집힌다. 원래 폭을 유지하라.

## 배포

`main` 푸시는 CI와 Pages를, `v*` 태그 푸시는 릴리스 워크플로(ZIP 생성)를 실행한다. README가 ZIP을 직접 링크하므로 태그를 올리지 않으면 다운로드 링크가 깨진다. 커밋 → 태그 → 두 번 푸시 순서를 지켜라.

## 로컬 반영 위치

확장 코드를 고쳤으면 저장소만 바꿔서는 실제로 아무것도 달라지지 않는다. 다음 네 곳을 함께 맞춰야 한다. 맥에서는 같은 순서로 `~/.agents/skills/vibe-coding`(또는 `~/.codex/skills/vibe-coding`), `~/Library/VibeCoding/VSCodeExtensions/`, `~/.vscode-server/extensions/`를 맞춘다.

1. 저장소 `vibe-coding/assets/workspace-extension/extension/`
2. 설치된 스킬 `%USERPROFILE%\.codex\skills\vibe-coding\assets\workspace-extension\extension\`
3. 데스크톱 확장 `%LOCALAPPDATA%\VibeCoding\VSCodeExtensions\local-vibe.vibe-workspace-<버전>\`
4. 원격 터널 서버 `%USERPROFILE%\.vscode-server\extensions\local-vibe.vibe-workspace-<버전>\`

VSIX는 `setup-macos.cjs`의 `createZip`(슬래시 경로)으로 다시 묶는다. Windows PowerShell 5.1의 `Compress-Archive`와 `CreateFromDirectory`는 항목 이름에 역슬래시를 넣을 수 있다. 반영 후 `Get-FileHash`로 네 곳이 같은지 확인하라. 4번을 빠뜨리면 휴대폰에 버튼이 보이지 않는다.

## 자주 재발한 실수

- **한글 경로**: `vscode.dev`는 URL의 퍼센트 인코딩을 디코딩하지 않는다. 터널 주소는 순수 ASCII `.code-workspace`를 가리켜야 한다. 터널 루트로 폴백하면 드라이브 최상위가 노출된다.
- **한국어 UI**: 탭을 영문 제목으로 찾지 마라. `간단한 브라우저`가 실제 라벨이다. `viewType`으로 판별하라.
- **공백 경로**: `code-tunnel.exe`를 셸로 실행하면 `Microsoft VS Code`의 공백에서 끊겨 종료 코드 1이 난다. `shell: false`에 인수 배열로 넘겨라.
- **문서-코드 불일치**: 기능을 바꾸면 README, `index.html`, `SKILL.md`, `references/`를 같은 커밋에서 고쳐라. 과거에 문서가 구현과 정반대를 말한 적이 있다.
- **사용자 터미널**: Vibe가 만들지 않은 터미널을 `dispose()`하지 마라.
- **맥 실행 앱**: 바탕화면 앱은 `open -n -a`로 VS Code를 띄운다. `code` 명령으로 띄우면 VS Code가 로그인 셸 PATH를 읽지 않아 Homebrew·nvm의 `node`, `codex`를 찾지 못한다.
- **맥 데이터 폴더**: `~/Library/VibeCoding`은 공백이 없어야 한다. 휴대폰 링크와 실행 앱 인수에 경로가 그대로 들어간다.
- **QR 생성기**: 내장 생성기를 고치면 실제 디코더(zxing-cpp 등)로 여러 길이를 읽어 확인하라. 이전 버전은 형식 정보와 블록 구조가 어긋나 어떤 길이도 읽히지 않았다.
- **릴리스 ZIP**: 항목 이름은 `vibe-coding/`로 시작하는 슬래시 경로여야 하고 `.sh`는 LF여야 한다. `scripts/build-release.ps1`이 확인한다.

## 문서 표현 기준

"100% 보존", "무결점", "0.1초" 같은 단정은 쓰지 않는다. 실제 동작과 경계를 적는다. 검증하지 않은 것은 검증하지 않았다고 쓴다. 자동 테스트 통과와 실제 화면 확인은 구분해서 보고한다.

## 사용자

주 사용자는 교사와 초보자다. 기술 용어보다 무엇을 눌러야 하는지가 먼저 읽혀야 한다.

