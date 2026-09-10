---
name: vibe-coding
description: Use when a user asks an AI agent to set up, open, or repair an isolated Windows VS Code workspace with Preview, Code, OpenCode, and an F12 terminal toggle, including an existing project.
metadata:
  short-description: AI가 직접 설치·조작·검증하는 Windows 바이브 코딩 환경
---

# Agent-operated Vibe Coding

Deliver a working Windows VS Code window: **Preview | Code | OpenCode**, with **F12 → full terminal → F12 → three columns**. The agent performs setup and UI verification; do not give the user a manual installation checklist. Scripts are agent tools, not the deliverable the user must execute.

## Scope and preservation

- Windows is the supported platform. Other operating systems require adaptation, not an untested success claim.
- Keep VS Code user data and extensions isolated under the real interactive user's LocalAppData/VibeCoding. Keep existing projects in their original locations. Never replace their index.html with a demo.
- Preserve unrelated VS Code settings, installed extensions, project files, unsaved buffers, model selections, and credentials. Back up each file before changing it; merge managed keys.
- Do not change OS security policy or disable workspace trust to get the task working. Follow the available tools' permission/authentication rules. Agent ownership does not authorize bypassing denied actions.

## Workflow

1. **Inspect.** Resolve the user's project from the request/current workspace. Discover Windows user, VS Code executable, OpenCode executable, and available desktop automation tools. Read [execution.md](references/execution.md) before installation. Read the available Computer Use tool/skill documentation before UI actions; do not assume a specific provider is installed.
   Search deferred tools before declaring desktop automation unavailable, including `node_repl` with the installed Computer Use runtime. Recheck on a later turn because available tools can change. An app-approval timeout is a permission/connection state, not proof that the tool does not exist.
2. **Choose preview.** Existing static HTML: select its actual entry file. Existing framework: inspect its scripts and reuse/start its local development server through a shell tool, then use the observed localhost URL. Do not convert framework projects to static demos. No project requested: create a separate sample through `-CreateSample`.
3. **Prepare.** Run `scripts/setup.ps1` without `-Apply` to obtain the concrete plan. Missing VS Code or OpenCode: install through currently verified official instructions within authorization, then rerun discovery. The OpenCode VS Code extension alone does not install or prove the CLI. Run the discovered CLI's `--version`.
4. **Apply.** Execute the bundled setup with `-Apply` in the actual user's filesystem context. It merges isolated configuration, builds/installs the bundled layout extension, and creates a project-specific workspace and shortcut. Use [execution.md](references/execution.md) to verify the physical path when MSIX/agent virtualization is present. A zero exit code proves only configuration, not UI success.
5. **Operate.** Launch the generated shortcut in the user's real desktop context. Observe the target VS Code window. Wait for preview, code, and the OpenCode prompt. Adjust widths with the available UI tools so all three are usable. If first-run trust/authentication requires user action under tool rules, complete unaffected work and clearly identify the exact remaining action. Do not operate credential dialogs.
   Finish ordinary welcome/theme onboarding. If the observed window says Restricted Mode, diagnose workspace trust before reinstalling: Live Preview and the layout extension cannot run there. Follow the active tool's security-prompt rules; never edit the trust database or disable trust. OpenCode provider connection is separate from VS Code/GitHub login.
6. **Verify and repair.** Follow [verification.md](references/verification.md). Reproduce failures, change their cause, and retest. Do not ask the user to perform actions available to the agent. If UI automation is unavailable, finish authorized setup and report UI verification as pending; never substitute process existence for screen evidence.
7. **Deliver.** Leave the verified window open. State the shortcut, F12 behavior, and only what was actually tested. Distinguish OpenCode startup from an authenticated AI response. Do not send an AI request just to test setup unless requested.

## Bundled implementation

- `scripts/setup.ps1`: plan/apply, discovery, configuration merge, backup, extension packaging/install, project workspace and shortcut. `Get-Help`/script parameters show inputs. PowerShell 5.1 compatible; no policy changes.
- `assets/workspace-extension/`: local VS Code extension source; owns startup arrangement, preview readiness, terminal lifecycle and F12. Use this tested implementation rather than recreating loose toggle commands.
- `assets/sample.html`: only for explicit sample creation.

Repeat invocation reuses the isolated installation and project workspace. Never reinstall everything simply because the user opens a second project. Diagnostics and backups stay under the isolated VibeCoding root. If a version-dependent command fails, inspect installed extension/VS Code commands and update the implementation; do not invent command IDs.
