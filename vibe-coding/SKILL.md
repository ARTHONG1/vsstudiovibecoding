---
name: vibe-coding
description: Use when a user asks an AI agent to set up, open, or repair an isolated Windows VS Code workspace with Preview, Code, Codex, and a 3-mode viewport toggle (Split / Terminal Full / Preview Full), including an existing project.
metadata:
  short-description: AI가 직접 설치·조작·검증하는 Windows 바이브 코딩 환경
---

# Agent-operated Vibe Coding

Deliver a working Windows VS Code window: **Preview | Code | Codex**, with **[3열 분할] ↔ [터미널 전체] ↔ [미리보기 전체]**. Use status bar/editor buttons and preserve the user's F12 binding. Keep the project's real local server URL available for browser testing. Codex authentication and Computer Use/Playwright tools depend on the installed agent environment; the layout does not install or prove these capabilities. The AI agent inspects the project, chooses the setup, repairs failures and verifies the result. Scripts support that work; do not replace it with a manual checklist for the user.

### Core Delegation Principle
The primary objective of this skill is **autonomous initial setup of the VS Code Vibe Coding environment on behalf of the user**. Beginners find manual IDE configuration, panel arrangement, dev server matching, terminal UTF-8, and extension wiring complex. The AI agent acts as the autonomous setup engineer: it analyzes the project, configures auto-start in `.vscode/tasks.json`, installs the isolated layout extension, creates a one-click desktop shortcut, launches and verifies the screen, and leaves the user in an immediately usable coding state.
진짜 브라우저 검수(DevTools, 쿠키, 결제 연동)가 필요한 경우 에디터 상단 툴바의 [ ↗ 외부 브라우저 ]를 통해 1클릭으로 시스템 Chrome/Edge와 연동됩니다.
AI가 코드를 수정할 때마다 대화/작업 단위로 그림자 스냅샷이 자동 적립되며, 에디터 상단 툴바 [ ⏪ ] 또는 상태바 [ $(history) 타임머신 ](단축키 Alt+Z)을 통해 원하는 과거 대화 시점으로 프로젝트 전체를 0.1초 만에 무결점 롤백할 수 있습니다. (기존 Git 커밋 히스토리를 전혀 더럽히지 않음)

## Scope and preservation

- Windows is the supported platform. Other operating systems require adaptation, not an untested success claim.
- Keep VS Code user data and extensions isolated under the real interactive user's LocalAppData/VibeCoding. Keep existing projects in their original locations. Never replace their index.html with a demo.
- Preserve unrelated VS Code settings, installed extensions, project files, unsaved buffers, model selections, and credentials. Back up each file before changing it; merge managed keys.
- Do not change OS security policy or disable workspace trust to get the task working. Follow the available tools' permission/authentication rules. Agent ownership does not authorize bypassing denied actions.
- Skill paths: The primary recommended user skill location is `$HOME/.agents/skills/vibe-coding` (or repository `.agents/skills/vibe-coding`), with legacy `$HOME/.codex/skills/vibe-coding` supported for backward compatibility.
- Beginner-ready baseline: Ensure Korean language pack (locale: ko), autoSave (afterDelay, 500ms), and terminal UTF-8 encoding are configured automatically without burdening the user with technical setup questions.

## Workflow

1. **Inspect.** Resolve the user's project from the request/current workspace. Discover Windows user, VS Code executable, Codex executable, and available desktop automation tools. Read [execution.md](references/execution.md) before installation. Read the available Computer Use tool/skill documentation before UI actions; do not assume a specific provider is installed.
2. **Choose preview and ensure autonomous auto-start.**
   - **Static HTML:** Select its actual entry file (e.g. `index.html`). Client-side preview is served natively by VS Code Live Preview without external processes.
   - **Frameworks & Backends (Node, Python, Go, Rust, etc.):**
     1. *Inspect dependencies:* Examine `package.json`, `requirements.txt`, `pyproject.toml`, etc., and verify the runtime environment/virtualenv exists.
     2. *Determine startup command:* Identify the project's local server command (e.g., `npm run dev`, `streamlit run app.py`, `python -m uvicorn main:app --reload`).
     3. *Configure persistent auto-start (`.vscode/tasks.json`):* For any project requiring a dev server, generate or merge a background task in the project's `.vscode/tasks.json` with `"runOptions": { "runOn": "folderOpen" }` and `"isBackground": true`. The setup script automatically enables `task.allowAutomaticTasks: "on"` in settings, guaranteeing that whenever the user opens the desktop shortcut in the future, the local development server starts in the background without requiring manual CLI commands or agent presence.
     4. *Verify listening port:* Probe-run the command or inspect the server output to capture the exact localhost URL (e.g., `http://localhost:5173`, `http://localhost:8501`), then pass `-PreviewUrl <observed-url>` and `-EntryFile` to `setup.ps1`.
   - **No project requested:** Create a separate isolated sample through `-CreateSample`.
3. **Prepare.** Run `scripts/setup.ps1` without `-Apply` to obtain the concrete plan. Missing VS Code/Codex: install through verified official instructions within authorization. Verify OpenAI Codex CLI is discovered and run `codex --version`.
4. **Apply.** Execute the bundled setup with `-Apply` in the actual user's filesystem context. It merges isolated configuration, builds/installs the bundled layout extension, and creates a project-specific workspace and shortcut. Use [execution.md](references/execution.md) to verify the physical path when MSIX/agent virtualization is present. A zero exit code proves only configuration, not UI success.
   Setup compares file hashes with a same-user native Windows process before configuration and before shortcut creation. A `Native filesystem mismatch` is a failed installation: stage the skill in a shared Documents directory and run the inspected setup in the verified native context. Do not retry in the same redirected shell, delete VS Code backups/locks, or disable hot exit. Never claim a desktop shortcut works from an agent-context launch alone.
5. **Operate.** Launch the generated shortcut in the user's real desktop context. Observe the target VS Code window. Wait for preview, code, and the Codex prompt. Adjust widths with the available UI tools so all three are usable. If first-run trust/authentication requires user action under tool rules, complete unaffected work and clearly identify the exact remaining action. Do not operate credential dialogs.
6. **Verify and repair.** Follow [verification.md](references/verification.md). Reproduce failures, change their cause, and retest. Do not ask the user to perform actions available to the agent. If UI automation is unavailable, finish authorized setup and report UI verification as pending; never substitute process existence for screen evidence.
7. **Deliver.** Leave the verified window open. State the shortcut, F12 behavior, and only what was actually tested. Distinguish Codex startup from an authenticated AI response. Do not send an AI request just to test setup unless requested.

## Bundled implementation

- `scripts/setup.ps1`: plan/apply, discovery, configuration merge, backup, extension packaging/install, project workspace and shortcut. `Get-Help`/script parameters show inputs. PowerShell 5.1 compatible; no policy changes.
- `assets/workspace-extension/`: local VS Code extension source; owns startup arrangement, preview readiness, terminal lifecycle and status bar toggle button. Use this tested implementation rather than recreating loose toggle commands.
- `assets/sample.html`: only for explicit sample creation.

Repeat invocation reuses the isolated installation and project workspace. Never reinstall everything simply because the user opens a second project. Setup backups stay under the isolated VibeCoding root; native verification reports stay in Documents/VibeCodingDiagnostics so both contexts can read them. If a version-dependent command fails, inspect installed extension/VS Code commands and update the implementation; do not invent command IDs.
