# Mobile task setup through the VS Code remote tunnel

## Outcome and boundary

Let the user instruct Codex from a phone and see the resulting page, using the same project folder that is open in VS Code on the PC. The status bar mobile button starts the official Microsoft `code tunnel` for that project and renders a QR code for the resulting `vscode.dev` address. Transport, GitHub authentication and device trust stay with the official tunnel service. This is initial environment setup performed by the agent, not a custom web server, relay or home-grown pairing protocol.

Start a tunnel only when phone-based work is requested or the user presses the mobile button. A request to update the skill itself does not authorize starting a tunnel on the user project. Keep the existing VS Code setup, shortcuts, terminals, backups, credentials and model/provider selections intact. Do not rerun the whole installer merely to add mobile access.

Official reference, checked 2026-09-24: https://code.visualstudio.com/docs/remote/tunnels

## Agent-owned setup

### 1. Discover the environment

Resolve the VS Code workspace actual project directory, the isolated `.code-workspace` file, the Codex executable and the installed VS Code tunnel binary. Prefer `code-tunnel.exe` from the installed VS Code `bin` directory and launch it without a shell, passing arguments as an array. An installation path containing a space breaks at that space when run through a shell, which surfaces as an immediate exit code 1.

Register the server install directory once with `version use stable --install-dir <VS Code install folder>`. Without it the phone reports that the VS Code gateway is not running. A CLI help command succeeding does not prove the tunnel works; treat unverified state as unverified rather than guessing.

### 2. Choose the connection target

`vscode.dev` keeps percent-encoded path segments literally, so a URL ending in an encoded Korean folder name opens an explorer entry with that literal name and reports a missing workspace. Build the URL from the tunnel name plus a pure-ASCII target:

1. Use the isolated `.code-workspace` file when its full path contains no Korean characters, spaces, percent signs or query characters. It resolves the real project folder server-side and carries `vibe.previewUrl`, `vibe.entryFile` and `vibe.codexPath`.
2. Otherwise use the project path when it is itself pure ASCII.
3. Otherwise report the constraint instead of emitting an encoded URL that will fail.

Never fall back to the tunnel root. A bare `https://vscode.dev/tunnel/<name>/` opens the drive root and exposes unrelated system folders.

### 3. Install the extension on the remote server

The tunnel runs a separate VS Code server with its own extension directory under the user profile `.vscode-server` folder. Installing the extension only into the desktop environment leaves the phone with no Vibe buttons and no layout. Install the packaged VSIX into the remote server as well, then confirm the extension id appears in that server extension list and that its `extension.js` matches the desktop copy by hash.

### 4. Shape the phone layout

A phone screen truncates the right side of the status bar, so place the two mode buttons on the left with a high priority and label them simply Terminal and Preview. Hide the time machine and mobile buttons on the web client; they belong to the desktop window.

On startup in a web client, close the side bars, move the panel to the bottom and open the Codex terminal maximized. Do not apply the desktop 3-column layout: two half-width editors are unusable on a phone. Each button switches directly to its own mode, and pressing the active button again does not toggle back into a split view.

Resolve the preview address through `vscode.env.asExternalUri` so the forwarded URL works over mobile networks, and open it in the Simple Browser in the first editor column.

### 5. Keep background tasks out of the way

A `folderOpen` dev-server task claims the terminal panel and can cover the Codex prompt, especially when the server fails and prints a stack trace. Give that task a `presentation` block with `reveal: never`, `focus: false` and a dedicated panel so the phone opens on the Codex prompt. Verify the development server answers over HTTP before claiming the preview works; a failed task and a reachable server are separate facts.

### 6. Visual feedback in chat

When the user asks for UI changes from the phone, perform the edits, confirm the dev server responds, then capture a mobile-viewport screenshot with Windows native Edge headless at a 412x915 window size, writing the PNG under the project `.vibe/previews` directory. Embed that image in the completion response so the result is visible without switching applications.

## Verification and completion

Track each fact separately rather than collapsing them into one success flag.

| Check | Sufficient evidence | Not sufficient |
| --- | --- | --- |
| Tunnel started | The CLI printed a `vscode.dev` URL and the process is alive | A rendered QR code or a fabricated URL after a timeout |
| Target correct | The URL path is pure ASCII and points at the workspace file or project folder | A URL containing percent escapes, or the tunnel root |
| Remote extension ready | The extension id is listed in the tunnel server extension directory and matches the desktop file hash | A successful desktop installation |
| Phone opened the project | The phone shows the intended project files | A reachable `vscode.dev` page |
| Mode buttons work | Terminal shows the Codex prompt and Preview renders the forwarded page on the phone | Passing unit tests alone |

Never fabricate a connection URL when the CLI has not printed one. On timeout, stop the child process and report the failure with the captured output. Distinguish authentication failures, which justify a sign-in prompt, from executable-path or network failures, which do not. Mask tokens and authorization codes in any surfaced output.

The host must stay awake and online; the `--no-sleep` flag covers sleep during an active tunnel. Do not edit the same files from the phone and the PC at the same time. If phone verification is unavailable, finish the local preparation and report the exact pending step, for example: tunnel started confirmed, remote extension confirmed, phone connection pending, preview reflection unverified.

## Review scenarios for future updates

- Korean or spaced project path: target the ASCII workspace file; never emit the encoded path or the tunnel root.
- Buttons missing on the phone: check the tunnel server extension directory before changing layout code.
- Tunnel exits immediately with code 1: check for a shell-quoted executable path before suspecting sign-in.
- Gateway not running: register the server install directory, then retry.
- Failed dev-server task covering the prompt: fix the task presentation; do not kill the user terminals.
- Desktop window: keep the 3-column layout, time machine and mobile buttons unchanged.

