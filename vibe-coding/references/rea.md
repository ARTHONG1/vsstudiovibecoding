# REA (Reverse Engineer Anything) CLI, MCP, and Official Skill

Default target: [morluto/rea](https://github.com/morluto/rea), official npm package `rea-agents`. Use it to inspect and clone live websites/web bundles, JavaScript/Electron applications, Android APKs, and native binaries with evidence-backed reconstruction.

1. Check whether the target coding agent already has a working `rea` MCP server and the official `reverse-engineer-anything` Skill installed under `~/.agents/skills/reverse-engineer-anything` (or `~/.codex/skills/reverse-engineer-anything`). Reuse a compatible setup when `rea doctor --client codex` reports aligned skill and registration state.
2. Resolve a concrete package version (requiring Node.js `^22.23.4 || ^24.22.1 || >=26.12.1`) and install outside application dependencies, e.g. `~/Library/VibeCoding/AgentTools/rea/<version>` on macOS or `%LOCALAPPDATA%/VibeCoding/AgentTools/rea/<version>` on Windows.
3. Register REA MCP and its bundled skill (`reverse-engineer-anything`) via `<node-path> <rea-package>/scripts/rea.mjs setup --client codex --yes`, or merge `[mcp_servers.rea]` into the effective Codex `config.toml` using the absolute Node.js binary path (`>=24.22.1`) and `["<rea-package>/scripts/rea.mjs", "mcp"]` so GUI and VS Code sessions do not fail when the default shell `node` is older or missing from PATH.
4. Provide a project wrapper (`./tools/rea`) or user CLI wrapper (`~/.local/bin/rea`) pinned to the verified Node.js runtime so terminal commands work directly inside the VS Code Codex terminal.
5. Verify readiness with `rea doctor --client codex`. Note that static JavaScript/Electron and website bundle/CDP analysis work without Hopper/Ghidra/IDA/JADX; native or APK decompilation providers remain optional unless the user's target requires them.

Future-agent guidance: use REA when the user gives a reference URL, web app, Electron app, or binary to clone, benchmark, or extract features from. Capture structural/runtime evidence first (routes, DOM/styles, scripts, API surface, state flow) and rebuild clean project code matching the observed behavior.
