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
1. **Startup & Restoration:** Verifies that `vibe.restoreLayout` configures the 50:50 editor split, positions the Agent (Codex) panel to the right, and prevents duplicate terminal creation.
2. **Title Independence:** Confirms preview tab discovery does not break even if the document title changes dynamically.
3. **State Machine Integrity:** Tests 3-mode transitions (`split` ↔ `terminal` ↔ `preview`) and ensures clean recovery without tab pollution.

---

## 3. Acceptance Verification (Manual & Agent-Operated)

Follow the 7-step checklist defined in `vibe-coding/references/verification.md`:

1. **Physical Configuration:** Ensure isolated directories (`%LOCALAPPDATA%\VibeCoding`), workspaces, and shortcuts resolve to physical native paths. Verify agent CLI (`codex --version`).
2. **Desktop Launch:** Launch the generated `.lnk` shortcut in the interactive desktop context. Confirm Preview (1열), Code (2열), and Agent (Codex, 3열) are visible.
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
| **VS Code** | 1.138.0+ | PASS |
| **Codex CLI** | Official OpenAI Codex CLI | PASS |
| **Live Preview** | 0.4.20 | PASS |
| **Node.js** | 20.x, 22.x, 24.x | PASS |

## v2.6.3 Mobile Remote change validation

- Automated tests cover the script-free official Remote guide, escaped project paths, reuse of the guide panel, and absence of clipboard reads, tunnel commands or terminal creation when opening it.
- A desktop-origin read-only continuation of an existing CLI task was observed in the same local project, with matching index.html SHA256 and an HTTP 200 preview response. This is not proof of a phone-origin test.
- The user reported successful use of the Remote workflow. New button visual acceptance remains assigned to the user; it is not claimed as automated E2E coverage.
- To accept the new UI: reload the VS Code window, open [모바일], confirm the actual project path and official Remote instructions, then continue the intended existing task from the phone. No tunnel activation or pairing status should be displayed as automatically verified.

## v2.6.4 Agent-owned Visual Feedback & Port Forwarding validation

- Automated tests cover official Remote webview guidance updates, verifying explanations for both Chat Vision Loop (markdown screenshot report) and VS Code Dev Tunnels.
- Workspace configuration testing verifies automatic injection of `remote.portsAttributes` when a dev server port is present, ensuring zero-config preparation in VS Code's Ports view.
- Native Windows Edge headless capture (`msedge --headless=new --disable-gpu --screenshot="..." --window-size=412,915 --virtual-time-budget=1500`) verified locally on Windows 11 without third-party dependencies.

## v2.6.5 Time Machine Git GC Protection & Staging Isolation validation

- Automated tests cover `refs/vibe/checkpoints/<id>` ref verification via `git rev-parse` and old ref pruning on same-turn updates.
- Verified genuine working tree rollback while preserving user staging area (`git add`) completely intact using `GIT_INDEX_FILE` shadow index.
- Monorepo safety verified via `git rev-parse --git-dir` in `initGit`, preventing nested `.git` creation.

## v2.6.6 Git Command Security & Monorepo Pathspec Isolation validation

- Converted all critical Git commands from shell string interpolation to safe argument arrays (`execFileSync`), preventing shell injection from user prompts containing `%`, `&`, `|`, and quotes.
- Removed automated `git rm -rf --cached .vibe` from `initGit`, fully preserving user staging area without implicit index mutation.
- Added `-- .` pathspec to `git status --porcelain`, ensuring monorepo sibling directory changes do not trigger unintended project snapshots.
- Removed unused legacy `qrcode.js` asset and relaxed marketing claims to accurately state Git-tracked and untracked file restoration boundaries.
