---
name: vibe-coding
description: Use when a user asks an AI agent to set up, open, or repair an isolated Windows VS Code workspace with Preview, Code, Codex, and a 3-mode viewport toggle (Split / Terminal Full / Preview Full), including an existing project.
metadata:
  short-description: AI가 직접 설치·조작·검증하는 Windows 바이브 코딩 환경
---

# Agent-operated Vibe Coding

Deliver a working Windows VS Code window: **Preview | Code | Codex**, with **[3열 분할] ↔ [터미널 전체] ↔ [미리보기 전체]**. Use status bar/editor buttons and preserve the user's F12 binding. **Every full environment setup includes Playwright CLI + official Skill, Context7 MCP, and Chrome DevTools MCP by default**, plus project instructions for using them during development. Reuse working installations; do not make these three an opt-in menu. The setup agent installs, connects and verifies them in the actual coding agent, following [agent-tools.md](references/agent-tools.md). The layout extension/setup.ps1 alone does not install these tools or prove their availability. Codex authentication and native desktop Computer Use remain separate capabilities. The AI agent inspects the project, chooses the setup, repairs failures and verifies the result. Scripts support that work; do not replace it with a manual checklist for the user.

### Core Delegation Principle
The primary objective of this skill is **autonomous initial setup of the VS Code Vibe Coding environment on behalf of the user**. Beginners find manual IDE configuration, panel arrangement, dev server matching, terminal UTF-8, and extension wiring complex. The AI agent acts as the autonomous setup engineer: it analyzes the project, configures auto-start in `.vscode/tasks.json`, installs the isolated layout extension, creates a one-click desktop shortcut, launches and verifies the screen, and leaves the user in an immediately usable coding state.
진짜 브라우저 검수(DevTools, 쿠키, 결제 연동)가 필요한 경우 에디터 상단 툴바의 [ ↗ 외부 브라우저 ]를 통해 1클릭으로 시스템 Chrome/Edge와 연동됩니다.
AI가 코드를 수정할 때마다 대화/작업 단위로 그림자 스냅샷이 쌓이며, 에디터 상단 툴바 [ ⏪ ] 또는 상태바 [ $(history) 타임머신 ](단축키 Alt+Z)에서 원하는 과거 대화 시점으로 작업 파일을 되돌릴 수 있습니다. 스냅샷은 `refs/vibe` 아래에 보관되어 사용자의 브랜치 커밋 기록에는 나타나지 않고, 복원 시 별도 인덱스를 사용하므로 `git add`로 올려둔 상태도 그대로 유지됩니다.

## Scope and preservation

- Windows is the supported platform. Other operating systems require adaptation, not an untested success claim.
- Keep VS Code user data and extensions isolated under the real interactive user's LocalAppData/VibeCoding. Keep existing projects in their original locations. Never replace their index.html with a demo.
- Preserve unrelated VS Code settings, installed extensions, project files, unsaved buffers, model selections, and credentials. Back up each file before changing it; merge managed keys.
- Do not change OS security policy or disable workspace trust to get the task working. Follow the available tools' permission/authentication rules. Agent ownership does not authorize bypassing denied actions.
- Skill paths: The primary recommended user skill location is `$HOME/.agents/skills/vibe-coding` (or repository `.agents/skills/vibe-coding`), with legacy `$HOME/.codex/skills/vibe-coding` supported for backward compatibility.
- Beginner-ready baseline: Ensure Korean language pack (locale: ko), autoSave (afterDelay, 500ms), and terminal UTF-8 encoding are configured automatically without burdening the user with technical setup questions.

## Workflow

1. **Inspect.** Resolve the user's project from the request/current workspace. A new project must have its own folder and files, not merely a renamed shortcut to an old project. Confirm the shortcut and workspace point at the intended folder. Discover Windows user, VS Code executable, Codex executable, and available desktop automation tools. Read [execution.md](references/execution.md) before installation. Read the available Computer Use tool/skill documentation before UI actions; do not assume a specific provider is installed.
2. **Choose preview and ensure autonomous auto-start.**
   - **Static HTML:** Select its actual entry file (e.g. `index.html`). Client-side preview is served natively by VS Code Live Preview without external processes.
   - **Frameworks & Backends (Node, Python, Go, Rust, etc.):**
     1. *Inspect dependencies:* Examine `package.json`, `requirements.txt`, `pyproject.toml`, etc., and verify the runtime environment/virtualenv exists.
     2. *Determine startup command:* Identify the project's local server command (e.g., `npm run dev`, `streamlit run app.py`, `python -m uvicorn main:app --reload`).
     3. *Configure persistent auto-start (`.vscode/tasks.json`):* For any project requiring a dev server, generate or merge a background task in the project's `.vscode/tasks.json` with `"runOptions": { "runOn": "folderOpen" }` and `"isBackground": true`. The setup script automatically enables `task.allowAutomaticTasks: "on"` in settings, allowing a folder-open startup attempt. Verify actual startup, port ownership and application response; task configuration alone cannot guarantee success.
     4. *Verify listening port:* Probe-run the command or inspect the server output to capture the exact localhost URL (e.g., `http://localhost:5173`, `http://localhost:8501`), then pass `-PreviewUrl <observed-url>` and `-EntryFile` to `setup.ps1`.
   - **Named new project:** Create a separate requested folder. For a new web workspace, a minimal labelled index.html starter can provide a preview; do not copy an old application's code or choose a framework without grounds. If the user requires a truly empty/non-web folder, preserve it and report the entry-dependent layout/preview as pending rather than fabricating a runnable app; tool capability probes can still run separately.
   - **No project requested:** Create a separate isolated sample through `-CreateSample`.
3. **Prepare.** Run `scripts/setup.ps1` without `-Apply` to obtain the concrete plan. Missing VS Code/Codex: install through verified official instructions within authorization. Verify OpenAI Codex CLI is discovered and run `codex --version`, then follow [codex-startup.md](references/codex-startup.md) to verify interactive startup and recovery.
4. **Apply.** Execute the bundled setup with `-Apply` in the actual user's filesystem context. It merges isolated configuration, builds/installs the bundled layout extension, and creates a project-specific workspace and shortcut. Use [execution.md](references/execution.md) to verify the physical path when MSIX/agent virtualization is present. A zero exit code proves only configuration, not UI success.
   Setup compares file hashes with a same-user native Windows process before configuration and before shortcut creation. A `Native filesystem mismatch` is a failed installation: stage the skill in a shared Documents directory and run the inspected setup in the verified native context. Do not retry in the same redirected shell, delete VS Code backups/locks, or disable hot exit. Never claim a desktop shortcut works from an agent-context launch alone.
5. **Prepare the default agent tools.** Follow [agent-tools.md](references/agent-tools.md) and its three tool references. Install or reuse all three, connect them to the Codex CLI that runs in this workspace, and merge contextual usage guidance into the project's actual instruction chain (normally AGENTS.md). Back up and preserve existing instructions. A narrowly requested layout repair does not authorize reinstalling tools; a full setup includes them unless the user explicitly excludes them. Record blocked tools without preventing the usable base environment from opening.
6. **Operate.** Launch the generated shortcut in the user's real desktop context. Observe the target VS Code window. Wait for preview, code, and the Codex prompt. Adjust widths with the available UI tools so all three are usable. If first-run trust/authentication requires user action under tool rules, complete unaffected work and clearly identify the exact remaining action. VS Code workspace trust and Codex project trust are separate; do not disable either or silently change trust policy. Do not operate credential dialogs.
7. **Verify and repair.** Follow [verification.md](references/verification.md), including tool discovery in the target client and real tool calls. Reproduce failures, change their cause, and retest. Do not ask the user to perform actions available to the agent. If UI automation is unavailable, finish authorized setup and report UI verification as pending; never substitute process existence for screen evidence.
8. **Deliver.** Leave the verified window open. Report the shortcut, project path, F12 behavior, and separate results for each tool: installed/reused, client discovery, real call, and any restart/authentication needed. Include where the future-agent usage instructions were merged. Distinguish Codex startup from an authenticated AI response. Do not send a model request just to test setup unless requested; direct CLI/MCP smoke checks are permitted. Unverified client calls remain pending even if a standalone smoke check succeeds.

## Optional mobile task setup — VS Code remote tunnel

When the user requests phone-based work, read [mobile-remote.md](references/mobile-remote.md). The status bar **[📱 모바일]** button starts Microsoft's official `code tunnel` for the current project and shows a scannable QR code. The agent owns environment discovery, tunnel target selection, remote extension installation and verification; the official tunnel service owns transport and GitHub authentication. Ordinary VS Code setup does not start a tunnel; only this button or an explicit request does.

Point the connection URL at the isolated `.code-workspace` file when its path is pure ASCII, because `vscode.dev` treats percent-encoded path segments as literal folder names and fails to open Korean or spaced project paths. The workspace file carries the project folder, preview URL and Codex path, so the phone receives the same configuration. Install the packaged extension into the remote server as well; without it the phone shows no Vibe buttons.

On a phone the layout is two buttons, **[ 터미널 ]** and **[ 미리보기 ]**, placed on the left of the status bar so a narrow screen never hides them. They switch directly between the Codex terminal and the forwarded preview without passing through the desktop 3-column layout. Preserve the existing desktop layout, terminals, model/provider choices and project files. Report tunnel readiness, phone sign-in, remote execution and preview reflection separately; a rendered QR code alone is not proof that the phone opened the project.

### Agent-owned visual feedback and port forwarding
When working on phone/remote requests that touch UI or when requested by the user:
1. **Chat vision loop (primary):** After completing UI modifications, verify that the local dev server is responding, capture the rendered page using Windows native Edge headless:
   `& "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --screenshot="$projectPath\.vibe\previews\preview.png" --window-size=412,915 --virtual-time-budget=1500 "http://localhost:$port"`
   Embed the markdown image `![Preview](<absolute-path-to-preview.png>)` in the completion response only if the active client supports local image attachments. File creation or a Markdown path is not proof of mobile delivery; verify the receiving client or report delivery pending.
2. **Interactive touch (optional):** The workspace preconfigures `remote.portsAttributes` for the project dev server port. When the user wishes to interact with the live page on their mobile browser, guide them to the VS Code built-in Ports view (Dev Tunnels) to open the forwarded HTTPS URL, keeping Private visibility by default; explain and obtain authorization before making a port public.

## Bundled implementation

- `scripts/setup.ps1`: plan/apply, discovery, configuration merge, backup, extension packaging/install, project workspace and shortcut. `Get-Help`/script parameters show inputs. PowerShell 5.1 compatible; does not alter system-wide execution policies permanently.
- `assets/workspace-extension/`: local VS Code extension source; owns startup arrangement, preview readiness, terminal lifecycle and status bar toggle button. Use this tested implementation rather than recreating loose toggle commands.
- `assets/sample.html`: only for explicit sample creation.

Repeat invocation reuses the isolated installation and project workspace. Never reinstall everything simply because the user opens a second project. Setup backups stay under the isolated VibeCoding root; native verification reports stay in Documents/VibeCodingDiagnostics so both contexts can read them. If a version-dependent command fails, inspect installed extension/VS Code commands and update the implementation; do not invent command IDs.
