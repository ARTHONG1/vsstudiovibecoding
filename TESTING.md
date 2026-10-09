# Testing and Verification Guide

This document outlines the testing architecture, automated regression suites, and acceptance criteria for the **Vibe Coding** environment on Windows and macOS.

## 1. Core Testing Philosophy

* **Evidence over assertions:** Merely verifying process existence (e.g. `Code.exe` running) does not prove user-visible layout success. Real UI elements, status bar items, and responsive viewports must be verified.
* **Non-destructive preservation:** Tests and setups must never tamper with the user's personal `settings.json`, keybindings, or unrelated projects.
* **Clean-machine portability:** Verification must pass on pristine Windows and macOS machines without manual prerequisites.

---

## 2. Automated Test Suites

### A. Repository & Package Consistency Check
Run the static validator to ensure all required documentation, license files, version numbers, and syntax rules match:

```bash
npm run check
# or: node scripts/check.cjs
```

**What it checks:**
1. Presence of all essential files (`LICENSE`, `README.md`, `SKILL.md`, `setup.ps1`, `extension.js`).
2. Version alignment between root `package.json`, extension `package.json`, and documentation download links.
3. JavaScript syntax validation across extension and build scripts.
4. Documentation link and anchor integrity.

### B. Extension Layout & State Machine Tests
Run the Node.js built-in test runner to verify extension lifecycle and command logic:

```bash
npm test
# or: node --test
```

**What it checks:**
1. **Startup & Restoration:** Verifies that `vibe.restoreLayout` configures the 50:50 editor split, positions the Agent (Codex) panel to the right, and prevents duplicate terminal creation.
2. **Title Independence:** Confirms preview tab discovery does not break even if the document title changes dynamically.
3. **State Machine Integrity:** Tests 3-mode transitions (`split` ↔ `terminal` ↔ `preview`) and ensures clean recovery without tab pollution.

---

## 3. Acceptance Verification (Manual & Agent-Operated)

Follow the 7-step checklist defined in `vibe-coding/references/verification.md`:

1. **Physical Configuration:** Ensure isolated directories (`%LOCALAPPDATA%\VibeCoding`), workspaces, and shortcuts resolve to physical native paths. Verify agent CLI (`codex --version`).
2. **Desktop Launch:** Launch the generated `.lnk` shortcut in the interactive desktop context. Confirm Preview (1열), Code (2열), and Agent (Codex, 3열) are visible.
3. **Usability & Localization:** Confirm Korean UI localization (`locale: ko`), automatic 500ms auto-save without manual `Ctrl+S`, and UTF-8 encoding in PowerShell.
4. **Interactive Preview:** Click the "미리보기 작동 확인" button on the sample page and verify the counter increments.
5. **3-Mode & DevTools Round Trip:**
   - Click `[ 🗖 터미널 전체 ]` ➔ Agent terminal expands to 100%. Click `[ ⊞ 3열 복원 ]` ➔ returns to 3 columns.
   - Click `[ 🌐 미리보기 전체 ]` ➔ Web preview expands to 100% without editor noise. Click `[ ⊞ 3열 복원 ]` ➔ returns to 3 columns with even editor widths.
   - Click `[ ↗ 외부 브라우저 ]` on editor toolbar ➔ System browser (Chrome/Edge) launches with full F12 DevTools (Network, Application/Cookie).
   - Press `F12` inside code editor ➔ Native "Go to Definition" functions normally without terminal interception.
6. **Recovery & Repeated Use:** Re-triggering layout restoration must never duplicate editor tabs, terminals, or overwrite user files.
7. **Clean Restart:** Close the window and relaunch from desktop shortcut or Explorer context menu ("Vibe Coding으로 열기"). Layout and session state must persist.

---

## 4. Environment Matrix (Empirically Verified)

| Environment | Verified Version | Status |
|---|---|---|
| **OS** | Windows 11 x64 (Build 22631+) | PASS |
| **VS Code** | 1.138.0+ | PASS |
| **Codex CLI** | Official OpenAI Codex CLI | PASS |
| **Live Preview** | 0.4.20 | PASS |
| **Node.js** | 20.x, 22.x, 24.x | PASS |

## v2.6.3 Mobile Remote change validation

- Automated tests cover the script-free official Remote guide, escaped project paths, reuse of the guide panel, and absence of clipboard reads, tunnel commands or terminal creation when opening it.
- A desktop-origin read-only continuation of an existing CLI task was observed in the same local project, with matching index.html SHA256 and an HTTP 200 preview response. This is not proof of a phone-origin test.
- The user reported successful use of the Remote workflow. New button visual acceptance remains assigned to the user; it is not claimed as automated E2E coverage.
- To accept the new UI: reload the VS Code window, open [모바일], confirm the actual project path and official Remote instructions, then continue the intended existing task from the phone. No tunnel activation or pairing status should be displayed as automatically verified.

## v2.6.4 Agent-owned Visual Feedback & Port Forwarding validation

- Automated tests cover official Remote webview guidance updates, verifying explanations for both Chat Vision Loop (markdown screenshot report) and VS Code Dev Tunnels.
- Workspace configuration testing verifies automatic injection of `remote.portsAttributes` when a dev server port is present, ensuring zero-config preparation in VS Code's Ports view.
- Native Windows Edge headless capture (`msedge --headless=new --disable-gpu --screenshot="..." --window-size=412,915 --virtual-time-budget=1500`) verified locally on Windows 11 without third-party dependencies.

## v2.6.5 Time Machine Git GC Protection & Staging Isolation validation

- Automated tests cover `refs/vibe/checkpoints/<id>` ref verification via `git rev-parse` and old ref pruning on same-turn updates.
- Verified genuine working tree rollback while preserving user staging area (`git add`) completely intact using `GIT_INDEX_FILE` shadow index.
- Monorepo safety verified via `git rev-parse --git-dir` in `initGit`, preventing nested `.git` creation.

## v2.6.6 Git Command Security & Monorepo Pathspec Isolation validation

- Converted all critical Git commands from shell string interpolation to safe argument arrays (`execFileSync`), preventing shell injection from user prompts containing `%`, `&`, `|`, and quotes.
- Removed automated `git rm -rf --cached .vibe` from `initGit`, fully preserving user staging area without implicit index mutation.
- Added `-- .` pathspec to `git status --porcelain`, ensuring monorepo sibling directory changes do not trigger unintended project snapshots.
- Removed unused legacy `qrcode.js` asset and relaxed marketing claims to accurately state Git-tracked and untracked file restoration boundaries.

## v2.7.0 Direct Dev Tunnel QR & Mobile 2-Button UX validation

- Automated tests in `tests/tunnel.test.cjs` verify official `vscode.dev` tunnel URL extraction, stream chunk buffering, and offline SVG QR code generation.
- Verified `extensionKind: ["workspace"]` in package.json to ensure execution within Remote Extension Host on the host PC.
- Added `.vibe/remote-config.json` generation in `setup.ps1` to preserve entryFile, previewUrl, and codexPath when opening individual project folders via tunnel.
- Integrated `vscode.env.asExternalUri` for remote preview rendering, and simplified mobile status bar to 2 prominent buttons in web/remote environments.

## v2.8.0 skill guidance: default AI development tools (2026-09-25)

- Full setup now instructs the agent to prepare Playwright CLI + official Skill, Context7 MCP and Chrome DevTools MCP, merge contextual project instructions, and separate installation, target-client discovery and real calls. The VS Code extension and setup.ps1 do not install these tools themselves.
- Local trial before this documentation update: Windows / Node 24.18.0, Playwright CLI 0.1.21, Context7 MCP 4.1.1, Chrome DevTools MCP 1.10.1. Playwright opened/snapshotted/captured the existing music project. Direct MCP SDK calls resolved and queried OpenSheetMusicDisplay docs and read the correct application's console/network via DevTools. A favicon 404 was observed; application code was not changed. Exact library-version document coverage was not established.
- Codex CLI configuration discovery succeeded for the existing music project. The new independent music2 project did not list its project MCP entries at the final check; the cause was not conclusively established. Trust/client loading and new-session tool calls remain pending. Do not interpret the successful standalone calls as successful calls through that CLI session.
- Fresh-agent instruction scenarios are reviewed separately from real installation/GUI E2E. This update is not evidence that future agents always use tools appropriately, that every Windows environment works, or that tool availability is identical across client versions.
- Read-only agent scenario review covered blank independent projects, existing-tool reuse, delegated AGENTS.md/AGENT.md and repeated setup, missing project MCP discovery, standalone versus client calls, and task-dependent tool use. This was a document exercise, not a live autonomous coding test.
- Release verification (2026-09-28): npm run check and all 42 tests passed and exited. Mode tests mock the tunnel manager rather than launching a real tunnel. Regression coverage includes Codex argument arrays, HTTP 404/500 rejection, safety-ref failure preventing restore/clean, failed checkpoint notification, and byte-identical user index after restore. Earlier standalone tool probes and unverified client/E2E layers above remain explicitly separate.

## v2.9.0 macOS support (beta), QR encoder and release ZIP (2026-10-09)

- **macOS setup.** `setup-macos.sh` runs `setup-macos.cjs` on Node.js 18+ or on the JavaScript runtime inside VS Code. `tests/setup-macos.test.cjs` runs plan and apply on every host with injected commands. It checks settings merge and preservation, the absence of Windows-only keys, unchanged keybindings, the workspace and remote config, VSIX packaging, AppleScript quoting, a second apply without reinstalling, and the launcher backup.
- **macOS end-to-end.** `.github/workflows/macos-e2e.yml` runs in CI and before every release on a clean `macos-latest` runner (Apple silicon). It installs the official VS Code archive and `@openai/codex`, plans with the VS Code runtime while Node is removed from PATH, then applies and re-applies the setup to a sample project. It verifies the extension list, a single layout extension version, the launcher bundle, the decompiled AppleScript and `codesign --verify --deep --strict`. It then opens the launcher and waits for `layout-ready` (split mode, intended folder, Codex terminal, no extension errors), a running Codex process and a time machine checkpoint. It saves a PNG from the clipboard through osascript, rejects a text clipboard, resolves `Contents/Resources/app/bin/code-tunnel` and reads `tunnel status`. First run: VS Code 1.141.0, Codex CLI 0.162.0, VS Code runtime electron 43.7.7.
- **First-run overlay.** The first run's screenshot showed the Vibe layout under VS Code's new Copilot sign-in onboarding, which appears for every new profile. Setup now sets `workbench.welcomePage.experimentalOnboarding` to false and launchers pass `--skip-welcome` on both platforms.
- **First-launch language.** The same screenshot showed an English UI although the Korean language pack was installed and the launcher passed `--locale ko`. VS Code chooses the display language from `<user-data-dir>/languagepacks.json` before the first window opens, and it writes that file only after a window has started; installing the pack through the CLI does not create it (reproduced on Windows with a fresh profile). Every new isolated profile therefore opened in English once, on both platforms. Setup now writes the file right after installing the pack, with VS Code's format and hash (md5 of each pack's gallery id and version) and existing entries preserved. `tests/setup-macos.test.cjs` and `tests/setup-files.test.cjs` compare the hash with the value VS Code 1.141 wrote for the same pack. The macOS job asserts the registered pack after apply and that the extension's `activated` event reports `vscode.env.language` `ko` in the profile's first window.
- **CI-only trust.** Workspace trust is disabled only inside the CI job's disposable profile so the extension can run unattended. Real setups never change trust.
- **QR encoder.** The bundled JavaScript encoder used level-M block tables while writing level-L format bits, and it omitted version information for versions 7 and above. zxing-cpp 3.1.1 decoded none of 16 sample lengths (60–271 bytes). After the fix all 16 decode, and the SVG output decodes for Windows and macOS link shapes. The Python/reportlab path, which existed only on the maintainer's PC, was removed. `tests/qrcode.test.cjs` checks format bits, level-L capacity boundaries and both version information blocks.
- **Release ZIP.** Windows PowerShell's `CreateFromDirectory` stored backslashes in entry names. Entries now use forward slashes under `vibe-coding/`, and the build checks names and the LF endings of `setup-macos.sh`.
- **Not verified yet:** a real user's Mac (Files and Folders prompts, the Command Line Tools installer, Gatekeeper prompts, Korean folder names created in Finder), phone access through a tunnel hosted on a Mac, and Intel Macs.

## v2.8.1 Time machine without a Git identity (2026-09-30)

- Reported failure: `체크포인트 저장 실패: Command failed: git commit-tree ...` in a project on a PC with no Git `user.name`/`user.email`. `git commit-tree` refuses to create the checkpoint commit without an author identity.
- Fix: checkpoint and safety-backup commits receive a dedicated author/committer identity through the environment of the `commit-tree` child process only. `initGit` no longer writes `user.name`/`user.email` into a newly initialized repository.
- `tests/timemachine-identity.test.cjs` isolates Git configuration (`GIT_CONFIG_GLOBAL` with `user.useConfigOnly`, `GIT_CONFIG_NOSYSTEM`, cleared identity variables), confirms that a plain `commit-tree` fails, then checks that the checkpoint is saved, that `refs/vibe/checkpoints/<id>` points to the recorded commit, and that repository and global Git config are unchanged. `useConfigOnly` keeps this precondition independent of the host name, so CI reproduces the same state. The test fails against the v2.8.0 extension and passes with the fix.
- Reporting PC (no Git identity configured): after the fix, an existing Next.js project recorded new checkpoints whose hidden refs carry the `Vibe Coding Time Machine` author. A rollback through the UI was not repeated for this release.
- Release verification: npm run check and all 43 tests passed locally before tagging.

## v2.7.1 Mobile connection target & phone-first mode switching validation

- `tests/tunnel.test.cjs` verifies that the connection URL is rebuilt from the tunnel name plus a pure-ASCII target: an existing `.code-workspace` file is preferred, an ASCII project path is accepted, a missing workspace file is rejected, and the emitted URL never contains percent escapes or falls back to the tunnel root. This reproduces the reported failure where `vscode.dev` displayed `%EA%B3%BC%EC%A0%84%EA%B0%95` as a literal folder and reported a missing workspace.
- `tests/modes.test.cjs` verifies phone-first startup and switching: on a web client the extension opens the maximized Codex terminal without applying the desktop split layout, places the two mode buttons on the left of the status bar with short labels, hides the time machine and mobile buttons, resolves the preview through `vscode.env.asExternalUri`, and does not toggle back to a split view when the active mode button is pressed again.
- Verified on the reporting machine that the remote tunnel server keeps its own extension directory. The desktop extension alone left the phone without Vibe buttons; installing the packaged VSIX into the tunnel server and matching `extension.js` hashes across desktop, skill source and remote server resolved it.
- Preview tab discovery now matches `simpleBrowser.view` directly, because a Korean VS Code UI labels the tab `간단한 브라우저` and the previous English-only title match left the first column empty.
- The auto-start dev server task received a `reveal: never` presentation block after a failed task covered the Codex prompt on the phone. Dev server reachability was confirmed separately over HTTP; a failed task and an unreachable server remain distinct findings.
- Phone-side acceptance of the two buttons and the forwarded preview remains assigned to the user and is not claimed as automated end-to-end coverage.
# 2026-10-02 로컬 모바일 미리보기 보완

- 포트 전달 프로세스의 Private 요청, URL 경로·쿼리 보존, 시간 초과 정리, 종료 후 재연결 및 웹 버튼의 포트 전달 폴백을 회귀 테스트로 확인했습니다.
- 이 PC의 공식 `code-tunnel.exe tunnel forward-internal`에서 3012 포트 HTTPS 주소 발급과 인증 전 HTTP 302 응답을 확인했습니다. 앱 화면이 아니라 인증 경로까지의 확인입니다.
- Android/iOS에서 인증 후 내부 미리보기 렌더링과 터미널 왕복은 사용자 검증 대기입니다. CLI 내부 프로토콜은 버전에 따라 달라질 수 있습니다.

2026-10-02 추가 검증: 빈 workspace previewUrl의 프로젝트 remote-config 복구와 setup 재실행의 저장 주소 유지 회귀 테스트를 추가했다. npm run check 및 53개 테스트 통과. 실제 사용자 WMI 컨텍스트에서 음악2 workspace/remote-config를 http://127.0.0.1:8080/로 맞추고 VSIX를 desktop/remote에 설치하여 확장 파일 4곳의 SHA256 일치를 확인했다. 로컬 음악2 응답 HTTP 200 확인. 휴대폰의 Private 로그인 및 iframe 렌더링은 검증 대기.

2026-10-02 포토부스 추가 진단: 실제 HTTP 200 응답이 3.9~4.4초 걸려 기존 600ms 검사에서 실패했다. 제한을 15초로 늘리고 900ms 응답 회귀 테스트를 추가했다. Private devtunnels URL은 iframe 대신 매번 외부 브라우저로 요청하여 기존 터미널을 유지한다. openExternal 반환값은 화면 렌더링 완료 증거가 아니다.
