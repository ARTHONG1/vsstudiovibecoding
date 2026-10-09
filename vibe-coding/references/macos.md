# macOS setup

Read this when the user's computer is a Mac. The workflow in SKILL.md, the default tools in [agent-tools.md](agent-tools.md) and the evidence in [verification.md](verification.md) stay the same; this file replaces the Windows-only parts of [execution.md](execution.md) (MSIX, WMI, PowerShell policy, .lnk shortcuts).

## Prerequisites

Check each item and reuse working installations. Install only within the user's authorization, from official sources.

| Item | Check | When missing |
| --- | --- | --- |
| Command Line Tools | `xcode-select -p` | Run `xcode-select --install`. The user clicks Install in the macOS dialog and waits for it to finish. Git (time machine) and many npm packages need it. |
| VS Code (Stable) | `/Applications/Visual Studio Code.app` or `~/Applications/...` | Download the official archive (`https://update.code.visualstudio.com/latest/darwin-universal/stable`) with curl and extract it with `ditto -x -k` into /Applications, or ~/Applications when /Applications is not writable. Do not run it from Downloads; a translocated copy breaks launchers and updates. |
| Node.js 18+ | `node --version` | Use the official installer or the user's existing manager (Homebrew, nvm). The installer asks for the user's password. |
| OpenAI Codex CLI | `codex --version` | Follow the current official Codex CLI instructions (npm or Homebrew). |

Prefer a disposable or unprotected project folder for first tests. Record the macOS version, chip (Apple silicon or Intel), VS Code and Codex versions in the report.

## Permissions only the user can grant

- **Client approval.** Setup writes `~/Library/VibeCoding`, the Desktop and, when installing VS Code, /Applications. A sandboxed coding client needs its normal approval for those paths. Never work around a denied approval.
- **Files and Folders.** macOS asks before the coding client or VS Code reads Desktop, Documents, Downloads or iCloud Drive. Tell the user which app asks and that they should click Allow. Do not change privacy settings yourself.
- **Screen verification.** Computer Use or other screen tools need Screen Recording and Accessibility in System Settings → Privacy & Security. If they are not granted, finish setup and report UI verification as pending.
- **Downloaded app check.** When VS Code was downloaded in a browser, macOS asks once whether to open an app from the internet; the user clicks Open. Never disable Gatekeeper or remove quarantine attributes from apps you did not download yourself.
- **Workspace trust and Codex trust** are separate decisions, exactly as on Windows.

## Run setup

Always start the script with `sh`; a ZIP extracted elsewhere may lose the execute bit.

```sh
sh "<skill>/scripts/setup-macos.sh" --project "<project>"                  # plan only, changes nothing
sh "<skill>/scripts/setup-macos.sh" --project "<project>" --apply
sh "<skill>/scripts/setup-macos.sh" --project "<project>" --entry src/App.tsx --preview-url http://127.0.0.1:5173 --apply
sh "<skill>/scripts/setup-macos.sh" --create-sample --apply
```

Options mirror setup.ps1: `--entry`, `--preview-url`, `--codex`, `--codex-arg` (repeatable), `--code-app`, `--root`, `--desktop`, `--launch`. The wrapper runs `setup-macos.cjs` with Node.js 18+ or, when Node is absent, with the JavaScript runtime inside VS Code. Output is JSON. Resolve every `missing` item before applying and report each `warnings` item.

Setup writes:

- isolated VS Code user data and extensions in `~/Library/VibeCoding`, or the selected `--root`. Korean names and spaces are supported in the home, project, app and data paths;
- the project workspace `<root>/Workspaces/vibe-<id>.code-workspace`. When that path cannot be used directly in a phone URL, setup puts only the workspace in a private user-owned `/Users/Shared/VibeCoding-<user-id>-<path-hash>/Workspaces` directory. The project and data stay in their original locations. Setup rejects a shared alias owned by another user or a symlink;
- `.vibe/remote-config.json` in the project. Workspace settings and this file record `vibe.dataRoot` / `dataRoot` and the selected VS Code app so remote modules find the correct VSIX and CLI;
- `.vscode/tasks.json` for an npm dev server only when the file does not exist;
- the launcher `~/Desktop/Vibe Coding - <project>-<id>.app`.

Changed files are backed up to `<root>/Backups/setup-<time>`, including the project remote config. Existing JSONC settings, runtime arguments and workspace comments are preserved; malformed configuration fails before any managed file is changed. User and workspace port settings are merged separately. The replacement launcher is compiled and signed in a temporary Desktop directory before moving the old launcher to backup. A failed compile keeps the working launcher. Keybindings are not changed: macOS keeps ⌘C / ⌘V in the terminal. The time machine uses ⌥Z and image paste uses ⌥V.

## The launcher

The launcher is an AppleScript applet built with `osacompile`. It runs `open -n -a "<VS Code.app>" --args --user-data-dir … <workspace>`. Starting through `open` lets VS Code load the login shell environment, so `node` and `codex` installed by Homebrew or nvm are found. Do not replace it with a script that calls the `code` command: VS Code skips shell environment resolution when it is started from its CLI. The applet carries the VS Code icon and is signed ad hoc after the icon change; Finder may show the new icon after a moment.

Open the launcher from Finder or with `open "<launcher>.app"` and verify the window as described in verification.md. Use Finder where verification.md mentions Explorer.

## Differences to check

- **Codex terminal.** The extension starts the Codex path from the workspace settings. If Codex is an npm script, its folder is appended to the terminal PATH so it finds `node`. If the terminal still exits, rerun setup with `--codex <absolute path>` after checking the path in a login shell.
- **Korean folder names.** Finder may store Korean names in decomposed Unicode (NFD) while text you type is composed (NFC). Both open the same folder. Compare normalized paths; never rename the user's folder to fix a mismatch.
- **Time machine.** Git comes from the Command Line Tools. Without them the extension shows one warning instead of opening the installer dialog on every save.
- **Default tools.** Install shared tool versions under `~/Library/VibeCoding/AgentTools/<tool>/<version>` and use the absolute `node` path in MCP configuration, because GUI apps do not always inherit the shell PATH. Chrome DevTools MCP needs Google Chrome or the browser it installs.
- **Phone screenshots.** Use the Playwright CLI screenshot from agent-tools.md, or Chrome headless: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot="<project>/.vibe/previews/preview.png" --window-size=412,915 <url>`.

## Phone access from a Mac

- The tunnel CLI is `Visual Studio Code.app/Contents/Resources/app/bin/code-tunnel`.
- A new tunnel started by the Mobile button passes `--install-extension <resolved-data-root>/vibe-workspace.vsix` so the phone gets the Vibe buttons. Custom roots and custom VS Code app locations are used in desktop and remote hosts. When a server already exists, the extension installs the same package through that server's `node out/server-main.js --install-extension`.
- Private forwarding preserves HTTP or HTTPS upstream protocol and the route. HTTPS still requires a certificate trusted by the actual host; do not disable TLS validation to hide a server error. Open private preview links in the phone's external browser, then return to vscode.dev for terminal work.
- The Mac must stay awake and online. `--no-sleep` prevents idle sleep while the tunnel runs; closing a MacBook lid still puts it to sleep unless the Mac is set up for closed-lid use.
- Verify sign-in, remote execution and the rendered preview separately, as in [mobile-remote.md](mobile-remote.md).

## Troubleshooting

| Symptom | Action |
| --- | --- |
| A dialog asks to install developer tools when Git runs | Command Line Tools are missing. Run `xcode-select --install` and let the user finish the installer. |
| The launcher opens VS Code but the Codex terminal reports a missing executable | Check `vibe.codexPath` in the workspace, run `codex --version` in a login shell, rerun setup with `--codex`. |
| VS Code asks for access to Documents or Desktop | Expected for projects there. The user clicks Allow. |
| macOS says the app was downloaded from the internet | The user confirms Open once. Do not disable Gatekeeper. |
| The phone opens VS Code without Vibe buttons | The remote server lacks the extension. Press Mobile again after the first connection, or install the VSIX with the server's node as described above. |
| Setup reports a translocated VS Code | Move Visual Studio Code.app to /Applications and rerun setup. |
