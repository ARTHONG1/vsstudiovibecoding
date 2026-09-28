# Chrome DevTools MCP

Default target: the Chrome DevTools team's [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp). Verify current Node/Chrome requirements, installed entrypoint and `--help` options before configuring.

1. Reuse a working server only if it is accessible to the target coding client and has an appropriate development-browser scope. Otherwise install a concrete package version outside the application dependencies.
2. Configure node + the installed MCP JS entrypoint with separate arguments. Prefer a dedicated isolated browser (`--isolated`) and `--headless` for unattended checks where supported. Do not automatically attach to the personal browser or expose a remote debugging port to the network.
3. Disable usage statistics and CrUX external lookups for the default setup using supported `--no-usage-statistics` and `--no-performance-crux` flags. Limit file access to the project using the supported workspace option; do not use unrestricted filesystem flags or disable the browser sandbox. Preserve a user's explicit alternative preference.
4. Verify real calls: open the actual preview URL, get the returned page ID, and inspect that page's console and network requests. An empty result from `about:blank` is not successful application verification. Report observed app errors without silently expanding an environment setup into app repair.

Future-agent guidance: use DevTools for console failures, failed requests and measured performance issues. Ordinary UI interaction verification can use Playwright; do not run duplicate browser checks without a reason. The tools use separate browser sessions, so login state and selected pages do not automatically carry over. Close only your own test pages/processes. A headless browser diagnosis is not a real-phone or microphone test.
