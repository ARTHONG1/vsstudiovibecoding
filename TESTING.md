# Testing and Verification Guide

This document outlines the testing architecture, automated regression suites, and acceptance criteria for the **Vibe Coding** Windows environment.

## 1. Core Testing Philosophy

* **Evidence over assertions:** Merely verifying process existence (e.g. `Code.exe` running) does not prove user-visible layout success. Real UI elements, status bar items, and responsive viewports must be verified.
* **Non-destructive preservation:** Tests and setups must never tamper with the user's personal `settings.json`, keybindings, or unrelated projects.
* **Clean-machine portability:** Verification must pass on pristine Windows machines without manual prerequisites.

---

## 2. Automated Test Suites

### A. Repository & Package Consistency Check
Run the static validator to ensure all required documentation, license files, version numbers, and syntax rules match:

```bash
npm run check
# or: node scripts/check.cjs
```

**What it checks:**
1. Presence of all essential files (`LICENSE`, `README.md`, `SKILL.md`, `setup.ps1`, `extension.js`).
2. Version alignment between root `package.json`, extension `package.json`, and documentation download links.
3. JavaScript syntax validation across extension and build scripts.
4. Documentation link and anchor integrity.

### B. Extension Layout & State Machine Tests
Run the Node.js built-in test runner to verify extension lifecycle and command logic:

```bash
npm test
# or: node --test
```

**What it checks:**
1. **Startup & Restoration:** Verifies that `vibe.restoreLayout` configures the 50:50 editor split, positions the Agent (Codex / OpenCode) panel to the right, and prevents duplicate terminal creation.
2. **Title Independence:** Confirms preview tab discovery does not break even if the document title changes dynamically.
3. **State Machine Integrity:** Tests 3-mode transitions (`split` ↔ `terminal` ↔ `preview`) and ensures clean recovery without tab pollution.

---

## 3. Acceptance Verification (Manual & Agent-Operated)

Follow the 7-step checklist defined in `vibe-coding/references/verification.md`:

1. **Physical Configuration:** Ensure isolated directories (`%LOCALAPPDATA%\VibeCoding`), workspaces, and shortcuts resolve to physical native paths. Verify agent CLI (`codex --version` or `opencode --version`).
2. **Desktop Launch:** Launch the generated `.lnk` shortcut in the interactive desktop context. Confirm Preview (1열), Code (2열), and Agent (Codex / OpenCode, 3열) are visible.
3. **Usability & Localization:** Confirm Korean UI localization (`locale: ko`), automatic 500ms auto-save without manual `Ctrl+S`, and UTF-8 encoding in PowerShell.
4. **Interactive Preview:** Click the "미리보기 작동 확인" button on the sample page and verify the counter increments.
5. **3-Mode & DevTools Round Trip:**
   - Click `[ 🗖 터미널 전체 ]` ➔ Agent terminal expands to 100%. Click `[ ⊞ 3열 복원 ]` ➔ returns to 3 columns.
   - Click `[ 🌐 미리보기 전체 ]` ➔ Web preview expands to 100% without editor noise. Click `[ ⊞ 3열 복원 ]` ➔ returns to 3 columns with even editor widths.
   - Click `[ ↗ 외부 브라우저 ]` on editor toolbar ➔ System browser (Chrome/Edge) launches with full F12 DevTools (Network, Application/Cookie).
   - Press `F12` inside code editor ➔ Native "Go to Definition" functions normally without terminal interception.
6. **Recovery & Repeated Use:** Re-triggering layout restoration must never duplicate editor tabs, terminals, or overwrite user files.
7. **Clean Restart:** Close the window and relaunch from desktop shortcut or Explorer context menu ("Vibe Coding으로 열기"). Layout and session state must persist.

---

## 4. Environment Matrix (Empirically Verified)

| Environment | Verified Version | Status |
|---|---|---|
| **OS** | Windows 11 x64 (Build 22631+) | PASS |
| **VS Code** | 1.94.0 - 1.137.0+ | PASS |
| **Codex CLI** | Official / OpenCodex | PASS |
| **OpenCode CLI** | 1.18.30 | PASS |
| **Live Preview** | 0.4.20 | PASS |
| **Node.js** | 20.x, 22.x, 24.x | PASS |
