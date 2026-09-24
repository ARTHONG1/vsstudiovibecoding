## Vibe Coding v2.7.1 - Mobile Connection Target Fix & Phone-First Mode Switching

Fixes the mobile remote connection so a phone actually opens the intended project, and replaces the desktop 3-column layout with two phone-sized mode buttons.

### Fixed

- **Korean and spaced project paths now open on the phone.** The connection URL is rebuilt from the tunnel name plus a pure-ASCII target, preferring the isolated `.code-workspace` file. Previously the CLI URL carried a percent-encoded folder name and `vscode.dev` showed it as a literal folder, reporting that no workspace existed. The tunnel root is never used as a fallback, so the drive root is no longer exposed.
- **Vibe buttons appear in the remote window.** The packaged extension is installed into the tunnel server extension directory as well as the desktop environment. Installing only on the desktop left the phone with no buttons and no layout.
- **Preview tab detection works on a Korean UI.** Discovery matches the `simpleBrowser.view` type instead of the English tab title, which had left the first column empty when VS Code labelled the tab as the Korean equivalent.
- **A failed dev-server task no longer covers the Codex prompt.** The `folderOpen` task is given a `reveal: never` presentation block so the phone opens on the prompt.

### Changed

- **Phone-first layout.** On a web client the extension opens the maximized Codex terminal instead of the desktop split, and shows two left-aligned status bar buttons labelled Terminal and Preview. The time machine and mobile buttons are hidden there; they belong to the desktop window.
- **Direct mode switching.** Each button switches straight to its mode, and pressing the active button again no longer drops the phone into an unusable two-column split. The preview opens through `vscode.env.asExternalUri` so the forwarded address works over mobile networks.

### Documentation

- `mobile-remote.md` was rewritten around the tunnel workflow it now implements; the previous text still described the earlier guide-only flow and forbade the tunnel that ships today.
- README and the GitHub Pages site drop the contradicting claim that the button starts no tunnel and no QR code, and document the ASCII workspace target, the two phone buttons and the remote extension requirement.

### Verification

Automated coverage for the connection target and phone-first switching lives in `tests/tunnel.test.cjs` and `tests/modes.test.cjs`. Phone-side acceptance of the two buttons and the forwarded preview remains a user check and is not claimed as automated end-to-end coverage.

