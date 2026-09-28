# Default AI development tools

Read this during every full Vibe Coding environment setup. The setup agent owns the work below; do not move tool installation, credentials, or task-by-task tool routing into the VS Code layout extension. **Playwright CLI + official Skill, Context7 MCP, and Chrome DevTools MCP are all default setup targets**, including fresh projects with no chosen framework. Explicit user exclusions take precedence. Existing installations may be reused after verification; a browser substitute requires a documented reason rather than silently omitting a requested tool.

## Inspect before writing

1. Resolve the real project and native user paths. Separate new projects from renamed launchers for existing projects. Tools may share installed binaries, but projects must have their own files, configuration scope and browser sessions.
2. Identify the actual client/host: the Codex executable launched by this workspace, its working directory and configuration scope. A tool exposed to the setup agent or installed in VS Code Chat is not necessarily available to Codex CLI.
3. Read the project's instruction chain, including parent AGENTS.md files and any delegated AGENT.md. Inspect existing MCP names, executable versions and enabled state without printing credentials or full global configuration. Do not replace models/providers, authentication, approvals or unrelated tools.
4. Back up files outside skill discovery paths before merging. Repeated setup should update one managed block and reuse compatible packages, not append duplicate instructions, MCP entries or skills.

## Install and connect all three

Follow [playwright.md](playwright.md), [context7.md](context7.md), and [chrome-devtools.md](chrome-devtools.md). Check current official documentation and installed command help before choosing versions/options. Record concrete installed versions; avoid a startup command that downloads `@latest` on every session.

Use an installation directory outside the user's application dependencies, for example the native user's `%LOCALAPPDATA%/VibeCoding/AgentTools/<tool>/<version>`. Do not hardcode a particular user's name, project, port or Codex executable version. Reuse the same compatible binary installation across projects; do not upgrade a shared version in place and break another project. Install the required Node/browser prerequisites within authorization. Do not alter application package.json merely to add agent tools.

Prefer project-scoped `.codex/config.toml` for Codex MCP settings. Merge named server tables with a TOML-aware method; preserve comments and unrelated keys. If a same-named server differs, inspect and reuse or give the managed entry a distinct name instead of overwriting it. Never duplicate or export secrets into project files. VS Code `.vscode/mcp.json` alone does not configure the terminal's Codex CLI. Consult [Codex MCP documentation](https://developers.openai.com/codex/mcp) for the installed client.

On Windows, use a discovered absolute `node.exe` and the installed package's actual JS entrypoint with an argument array where supported. Resolve entrypoints from package.json rather than assuming them forever. Avoid shell-concatenated command strings with spaces/Korean paths. Make Playwright invocable from the target terminal through a narrowly merged workspace PATH or an explicit project wrapper, and document the working command. Preserve existing environment variables/PATH and provide a wrapper fallback for other clients.

Codex loads project configuration only when the project is trusted. VS Code trust does not establish Codex trust. If settings are absent from the target client, check project path, host/user, configuration scope and trust before retrying installation. Present the client's normal trust/authentication flow when required, preserve running/unsaved work, and explain any needed new session. Do not silently set trust, disable safeguards, or copy browser/account credentials. A bounded failed retry is a pending tool, not a reason to reinstall everything.

## Leave usable project instructions

Create a short project-specific tool guide (for example `docs/AGENT-TOOLS.md`) with resolved commands, server names, actual preview startup/discovery, package versions, scope, and verification status. Do not treat an ephemeral smoke-test port as the persistent preview URL. For a blank/non-web project state that there is no application URL yet; test browser capability on a benign temporary local page and record that limit.

Use [agent-tool-guidance.md](../assets/agent-tool-guidance.md) as a template, not a file to copy blindly. Replace every placeholder. Merge one marked section into the effective agent instructions. If AGENTS.md delegates to AGENT.md, preserve that delegation and add the section to the delegated file. If no instruction file exists, create AGENTS.md. Other clients must use their documented instruction discovery mechanism; an unreferenced AGENT.md is not sufficient. For multi-root workspaces, verify which project/instruction/config layer the terminal actually uses.

The instructions must direct future agents to verify relevant UI changes, consult applicable library documentation, and diagnose browser faults with evidence. They must not force all three tools on every prompt, impose a new planning/TDD methodology, or weaken the project's existing requirements. Tool installation provides capability; written guidance is not proof of future compliance.

## Acceptance and handoff

Record each layer independently:

| Layer | Evidence |
|---|---|
| Installed/reused | Exact package/version, reachable executable; Playwright official Skill is discoverable |
| Target-client discovery | From the intended project and user, Codex lists both MCP entries enabled; a new session discovers the Skill |
| Real capability | Playwright opens/snapshots/captures a local page; Context7 resolves and retrieves documentation; DevTools opens the correct page ID and reads its console/network |
| Client call | A call through the actual coding client; if it cannot be observed/authorized, mark pending and do not claim full tool readiness. Standalone SDK calls alone do not prove this layer |
| Future usage | Instruction link resolves, generated commands work; fresh-agent behavior trial only when model execution is authorized |

`codex mcp list` is configuration evidence, not a successful handshake or call. Likewise `--help`, tool listing, screenshot file existence, or an SDK process alone does not prove the whole workflow. Check MCP `isError` and result content. Context7 quota/auth failure remains pending; identify missing version coverage instead of claiming a version match. For DevTools, use the page identifier returned by the tool, never assume page 1 or an empty tab.

When direct calls are available, perform bounded smoke checks without editing application code or sending model prompts. Close only the test sessions/server processes you started. Preserve unrelated tabs and terminals. If a client/session/authentication action remains, report exactly which layer is pending. Keep the base VS Code environment usable, but do not label the full three-tool setup complete until its required checks pass.
