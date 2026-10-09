# Vibe Coding

**Delegate VS Code setup on Windows or macOS to an AI agent.**

[한국어](README.md) · [Watch the demo](https://arthong1.github.io/vsstudiovibecoding/#intro-video) · [Download](https://github.com/ARTHONG1/vsstudiovibecoding/releases/latest) · [Agent overview](https://arthong1.github.io/vsstudiovibecoding/llms.txt)

https://github.com/user-attachments/assets/05ad2995-62e7-4ae0-baa9-389ecaa69941

An agent inspects your project, identifies its startup command and preview URL, and prepares an isolated VS Code workspace with Preview, Code, and Codex. A desktop shortcut (a launcher app on macOS) reopens that workspace. This is an MIT-licensed environment setup skill, not a model or a hosted coding service.

## What it prepares

- Preview / Code / Codex layout and full-screen terminal and preview modes.
- Project-scoped setup that preserves existing files and configuration.
- Playwright CLI and its skill, Context7 MCP, and Chrome DevTools MCP, with project guidance on when to use them. The agent verifies installation, recognition and actual calls separately.
- Git-backed checkpoints under hidden refs and a time machine menu.
- Optional mobile work through Microsoft's official tunnel. Private previews open in a separate browser tab; return to vscode.dev for terminal work.

## Start with an agent

Use a local agent with filesystem and shell access. Paste:

```text
Install the vibe-coding folder from https://github.com/ARTHONG1/vsstudiovibecoding
into my agent's skills directory and read its SKILL.md.
Set up a separate sample VS Code workspace on this computer (Windows or macOS)
with Preview, Code and Codex, a desktop launcher, and Playwright, Context7 and Chrome DevTools.
Preserve my files and existing settings. Verify the preview, tools and mode switches.
Tell me exactly which login or trust prompts I must complete myself.
```

For manual installation, download the release ZIP, extract the complete folder with SKILL.md, scripts, assets and references into your client's skill directory, then start a new session. For Codex, use ~/.agents/skills/ or the existing ~/.codex/skills/ location (%USERPROFILE%\.agents\skills\ on Windows); avoid duplicate installations.

## macOS (beta)

On a Mac the agent runs `sh vibe-coding/scripts/setup-macos.sh`, which keeps VS Code data in `~/Library/VibeCoding` and creates a `Vibe Coding - <project>-<id>.app` launcher on the Desktop. The user approves the Command Line Tools installer (needed for Git and the time machine), password prompts for VS Code or Node.js, Files and Folders access for projects in Documents or Desktop, and Screen Recording / Accessibility for screen verification. Shortcuts follow macOS: ⌘C/⌘V, ⌥Z for the time machine, ⌥V for image paste.

Every change runs an end-to-end job on a clean GitHub macOS runner (Apple silicon): it installs the official VS Code and Codex CLI, applies and re-applies the setup, opens the launcher, and checks that the first window already uses the Korean UI, the three-column layout, the Codex process, a time machine checkpoint, clipboard image saving and the bundled tunnel CLI. A check on a real user's Mac and phone access from a Mac are still pending; please report problems through the issue forms.

## Boundaries and evidence

Windows and macOS (beta). Windows desktop use was verified on Windows 11 x64; macOS is verified on a clean CI runner, not yet on a user's Mac. Linux is not supported. Local setup does not provide a paid AI subscription. Account login, project trust, network policies and service limits can require user action. The PC and development server must remain online for mobile work. Checkpoint rollback is not a substitute for independent backups.

See [TESTING.md](TESTING.md) for checks and limitations. Automated tests and HTTPS address issuance do not prove authenticated phone rendering. The CLI forwarding protocol can change between versions.

## Help others find it

Star the repository if it helps, share the [demo page](https://arthong1.github.io/vsstudiovibecoding/), or use the [copy-ready descriptions](SHARING.md). Report a reproducible problem or a real setup experience through [issue forms](https://github.com/ARTHONG1/vsstudiovibecoding/issues/new/choose). Please remove secrets and private paths.

Created by **AI찬우쌤 (Hong Chanwoo)** · [클래스똑딱 / classddok.com](https://classddok.com/) · [YouTube](https://www.youtube.com/channel/UCnmcRReKbadpjJmueG1nzvw)
