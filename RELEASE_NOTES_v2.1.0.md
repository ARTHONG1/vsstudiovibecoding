## Vibe Coding v2.1.0 - Terminal Copy/Paste & Clipboard Image Paste

Enhanced terminal UX: native **Ctrl+C / Ctrl+V** support, mouse **copyOnSelection**, and instant **Alt+V** clipboard image paste into the Codex terminal.

### What's New in v2.1.0
- **Native Terminal Ctrl+V & Ctrl+C:** Bound `Ctrl+V` to paste directly into the terminal without raw control code drops, and `Ctrl+C` to copy selection.
- **Copy on Selection:** Enabled `terminal.integrated.copyOnSelection` so selecting text in the terminal automatically copies it to the clipboard.
- **Instant Clipboard Image Paste (Alt+V):** Added `vibe.pasteImage` command and `Alt+V` shortcut (and toolbar 📷 icon). Pressing `Alt+V` automatically saves any screenshot in the Windows clipboard as a local PNG and pastes the file path into the Codex terminal stdin for immediate Vision analysis.
- **Preview | Code | Codex v2.1.0:** Synchronized all documentation, tests, and release packages.
