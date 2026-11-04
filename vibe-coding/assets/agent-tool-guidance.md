<!-- vibe-agent-tools:start -->
## AI development tools

Project-specific commands, preview startup/discovery, server names and current verification status: [AI tool guide](<REPLACE_WITH_RELATIVE_GUIDE_PATH>).

- When changing UI behavior, styling or layout, use the configured Playwright workflow for proportionate verification: exercise affected interactions and inspect the rendered appearance as appropriate before claiming it works. Capture images when visual comparison is useful. If verification is blocked, state what was not checked.
- When implementing unfamiliar or version-sensitive library APIs, or when usage is uncertain, consult Context7 using the installed dependency version. Verify version coverage; use official versioned documentation if unavailable. Do not send private code, credentials or user data in documentation queries.
- For browser errors, failed network requests or performance problems, use Chrome DevTools on the affected page and collect evidence before changing code. Verify the returned page ID and URL; do not inspect an empty tab by mistake.
- When relevant and discoverable, use the official Chrome DevTools Skills: `chrome-devtools` for browser debugging, `cookie-debugging` for authentication and cookies, `debug-optimize-lcp` for slow initial rendering, and `a11y-debugging` for accessibility. Use development sessions and keep credentials out of logs and reports. If a Skill is unavailable, report that limitation and use the available DevTools workflow.
- When the user provides a reference website URL, web app, Electron app, or binary to clone, benchmark, or extract features from, use REA (`rea` MCP tools and the `reverse-engineer-anything` skill) to inspect real structure, routes, scripts, and runtime behavior before reconstructing it.
- Use tools according to the task, not all four on every request. Preserve existing project requirements. Separate UI checks from backend, audio, hardware and real-device acceptance.
- Use the project's development browser sessions. Do not close unrelated sessions, change the user's model/authentication settings, or claim an unperformed check succeeded.
<!-- vibe-agent-tools:end -->
