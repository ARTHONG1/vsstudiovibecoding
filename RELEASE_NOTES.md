## Vibe Coding v2.0.0 - Preview | Code | Codex

Major architectural upgrade: **Preview | Code | Codex**. Powered directly by OpenAI's official Codex CLI and OpenCodex multi-model proxy.

### What's New in v2.0.0
- **Official Codex CLI Integration:** The 3rd column now runs OpenAI's official Codex CLI directly inside VS Code's terminal.
- **OpenCodex Proxy Synergy:** Automatically connects with local OpenCodex (http://127.0.0.1:10100) to provide real-time switching between Gemini 3.8 Flash, Claude 3.7 Sonnet, Solar-Pro 4, and xAI inside the workspace.
- **True Computer Use:** Full support for autonomous visual UI inspection and mouse/keyboard interaction via Codex's native Computer Use runtime.
- **3-Mode Viewport Engine:** One-click toggle between [3-Column Split] ↔ [Full Terminal (Codex)] ↔ [Full Preview] via status bar and editor title toolbar buttons.
- **Native F12 Definition Preservation:** Restored VS Code default Go to Definition functionality without key hijacking.
- **Real Browser DevTools Integration:** One-click "Open in External Browser" button launches Chrome/Edge with genuine DevTools (Network, Application, Cookies, Payment APIs) and automatic VS Code debugger synchronization.
- **Zero-Config Project Detection:** Automatically detects project entry files (index.html, src/App.tsx, etc.) and development server ports (Vite 5173, Next.js 3000, Astro 4321).
- **Windows Explorer Context Menu:** Right-click any folder in Windows Explorer and select 'Vibe Coding으로 열기' to open the 3-column workspace immediately (optional via -RegisterContextMenu).
- **Automated CI & Test Suite:** Added GitHub Actions CI, 8-part automated regression tests, package integrity checks, and full verification documentation.
- **MIT License & Official Branding:** Added official MIT license, release packaging, and updated onboarding templates.
