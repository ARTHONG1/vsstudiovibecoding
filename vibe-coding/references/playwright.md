# Playwright CLI and official Skill

Default target: Microsoft's [Playwright CLI + Skills](https://github.com/microsoft/playwright-cli). Use the official package `@playwright/cli`; verify current runtime requirements and installed help. Do not download similarly named unofficial packages.

1. Check whether the target coding agent already has a working Playwright installation and official Skill. Reuse a compatible setup; if the user already relies on Playwright MCP, preserve it and document which interface to use, avoiding two competing browser workflows.
2. Resolve a concrete package version and install outside application dependencies, e.g. `npm install --prefix <tool-version-directory> --save-exact @playwright/cli@<verified-version>`. This is a template: fill real paths/version and use proper shell argument handling.
3. Inspect `playwright-cli install --help`; where supported, run `playwright-cli install --skills=agents` from the target project. This installs the official Skill into the project's discoverable skill folder. Back up existing Skill/.gitignore/config files first, inspect installer changes, and retain license/reference files. Do not replace an unrelated custom Skill.
4. Make the CLI reachable from the actual VS Code Codex terminal. With a versioned external install, use the actual package entrypoint via node or a small quoted wrapper. Record its exact command in the project guide. Installing a Skill does not automatically add the CLI to PATH.
5. Use a separate project-named session. Open the verified local preview, inspect a snapshot and save a screenshot. Use a harmless interaction where available. Do not grant microphone/camera or reuse the user's personal browser profile to make a smoke test pass. For projects needing real hardware, record those checks separately.

The official Skill may show POSIX command examples. Adapt to the actual shell (PowerShell on Windows, zsh on macOS) and tested wrapper without rewriting the entire upstream Skill. Existing Edge/Chrome can be used if supported; otherwise install a supported browser within scope. Browser installation failure must be reported separately from the npm package installation.

Persist the correct startup/preview discovery procedure, not a transient test-server URL. Close only the project test session. Screenshots may demonstrate UI, but do not prove audio, backend, login or real-device correctness.
