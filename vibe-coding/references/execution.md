# Execution context and setup

## Resolve real paths before changing files

An agent's `$env:LOCALAPPDATA`, desktop shortcut resolution, and even apparently absolute paths may be virtualized by a packaged Windows app (MSIX). Elevating a shell outside its sandbox does not necessarily escape that app's filesystem virtualization. Typical symptom: the agent sees index.html, but a user-launched VS Code opens an empty unsaved tab bearing that filename. A terminal path containing `Packages/.../LocalCache/Local/...` is another clue.

Compare the same project file and isolated settings from the agent context and the interactive user's native context. Use supported host shell/process tools; discover capabilities rather than hardcode a package ID, user name, or computer name. Record a small read-only probe (file exists, length/hash, resolved user paths) to a shared task directory. Do not copy credentials or print environment secrets.

If the host lacks a direct native-context process tool, Windows `Win32_Process.Create` is one possible fallback, subject to the tool permission model. It can run a hidden PowerShell helper with explicit arguments and write results to a shared workspace. Verify the process belongs to the intended user and the probe actually sees the physical files. The WMI method returning 0 is only dispatch success: poll a bounded result file and inspect errors. Do not assume WMI is available or that it always produces the desired session. Do not alter execution policy, UAC, or filesystem security. Prefer ordinary tool escalation where required; never use another mechanism to bypass a rejected action.

Run setup and launch from the verified native context. If virtualized artifacts already exist, back up and migrate only the VibeCoding configuration/assets needed, explicitly preserve existing physical files, and verify from both contexts. Do not copy an entire user profile, tokens, or extension storage.

## Inputs and agent usage

Run from the skill's directory or use an absolute script path. Discover real values; these are examples, not paths to copy:

```powershell
# Plan for an existing static site (no mutation).
& <skill>/scripts/setup.ps1 -ProjectPath <actual-project> -EntryFile index.html
# Apply the reviewed plan and create a project-specific shortcut.
& <skill>/scripts/setup.ps1 -ProjectPath <actual-project> -EntryFile index.html -Apply
# A running framework server (agent starts/verifies the server separately).
& <skill>/scripts/setup.ps1 -ProjectPath <actual-project> -EntryFile src/App.tsx -PreviewUrl http://127.0.0.1:5173 -Apply
# No existing project: isolated demo.
& <skill>/scripts/setup.ps1 -CreateSample -Apply
```

Optional `-Root`, `-CodePath`, `-OpenCodePath`, `-DesktopPath` override discovered physical paths. `-SkillRoot` supports scriptblock invocation when PSScriptRoot is unavailable. If local policy blocks script files, use a supported shell invocation of the inspected script text only when that is allowed by policy; do not change the machine's execution policy or evade organizational restrictions.

Existing settings must be parseable JSON for the bundled merger. If JSONC/comments are present, preserve the original and use a JSONC-aware parser or targeted edit before continuing; do not overwrite settings with defaults. Existing user keybindings are preserved except the two commands owned by this skill. The appended F12/Ctrl+Alt+V bindings take precedence only when vibe.enabled is true. They use panelMaximized context so manual panel controls do not invert the F12 state. Verify this context against the installed VS Code version.

For framework previews, PreviewUrl alone does not manage a server. Before claiming restart support, the agent must configure and test the project's existing server task/start mechanism, preserving existing tasks and observing its readiness on relaunch. If that cannot be done, explicitly report the external-server dependency and do not claim a self-starting setup. The bundled sample/static preview is the fully automated default; arbitrary framework startup is project-specific agent work.

Verify software availability using current official sources when installation is needed: VS Code at https://code.visualstudio.com/ and OpenCode at https://opencode.ai/. Prefer supported user-scope installers; do not assume administrator rights, winget, Node.js, npm, or a fixed executable location. The setup helper does not install the OpenCode CLI or a framework's dependencies automatically.

## Known failure distinctions

| Observation | Action |
|---|---|
| keybindings starts with `{` | Back up; normalize to an array and merge managed bindings. |
| terminal starts with a syntax error | Use the bundled UTF-8 startup command; parse before running. |
| F12 enters fullscreen but cannot return | Ensure both Vibe commands are in `terminal.integrated.commandsToSkipShell`. |
| default Chat panel appears | It is not OpenCode. Verify the local layout extension is enabled and activated. |
| preview appears late/in the wrong group | Wait for the actual tab; arrange after readiness, not merely after command dispatch. |
| no CLI found in agent PATH | Check the native user's installation before concluding it is missing. |
| blank files in user launch but files exist for agent | Investigate virtualization, not repeated reinstalling or trust disabling. |
| existing instance retains stale state | Save/preserve buffers and close/reopen the affected isolated workspace through UI. Do not kill all Code processes. |

The original demo/HTML workflow is the empirically tested baseline. Server-URL support and different VS Code versions still require the same on-machine visual acceptance checks.

## npm CLI discovery and repeated previews

The setup script accepts a native `opencode.exe`, not a `.cmd`, `.bat`, or `.ps1` wrapper as the terminal shell. For npm installations, it searches the native package under the real user's `AppData/Roaming/npm/node_modules/opencode-ai` and beside a discovered `opencode.cmd`. A custom npm prefix may need an explicit `-OpenCodePath`. Verify the actual EXE with `--version`; a working wrapper does not establish terminal-shell compatibility. Do not reinstall a working CLI just because it is absent from PATH.

Live Preview's tab label can change from its localhost URL to the page title. Version 1.2.0 retains the actual tab identity during the window lifetime so repeated restoration works after a title change. If the tab was closed, discovery runs again; inspect the resulting tabs before retrying. Do not rely only on a mutable label or accumulate replacement previews on timeout.

Before restarting an existing project window, inspect dirty editors. Do not save or discard user edits implicitly. Keep the window open if a verified preservation route is unavailable, and record the restart check as pending. A sample you created and have not edited can be closed normally.
