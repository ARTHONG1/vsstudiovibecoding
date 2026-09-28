<!-- vibe-agent-tools:start -->
## AI development tools

Project-specific commands, preview startup/discovery, server names and current verification status: [AI tool guide](<REPLACE_WITH_RELATIVE_GUIDE_PATH>).

- When changing UI behavior, styling or layout, use the configured Playwright workflow for proportionate verification: exercise affected interactions and inspect the rendered appearance as appropriate before claiming it works. Capture images when visual comparison is useful. If verification is blocked, state what was not checked.
- When implementing unfamiliar or version-sensitive library APIs, or when usage is uncertain, consult Context7 using the installed dependency version. Verify version coverage; use official versioned documentation if unavailable. Do not send private code, credentials or user data in documentation queries.
- For browser errors, failed network requests or performance problems, use Chrome DevTools on the affected page and collect evidence before changing code. Verify the returned page ID and URL; do not inspect an empty tab by mistake.
- Use tools according to the task, not all three on every request. Preserve existing project requirements. Separate UI checks from backend, audio, hardware and real-device acceptance.
- Use the project's development browser sessions. Do not close unrelated sessions, change the user's model/authentication settings, or claim an unperformed check succeeded.
<!-- vibe-agent-tools:end -->
