# Mobile task setup through official Codex Remote

## Outcome and boundary

Set up the user's phone to send AI instructions to the connected PC's actual project folder. VS Code displays that folder's files, and its running development server can reflect saved changes. This is initial environment setup performed by the agent, not a new mobile server or a skill that must intercept every conversation. Remote authentication, transport, task execution and approvals remain owned by the official product.

Activate this procedure only when phone-based work is requested. A request to update the skill itself does not authorize pairing devices or starting remote work on the user's project. Keep the existing VS Code setup, shortcuts, terminals, backups, credentials and model/provider selections intact. Do not run the whole installer again merely to add Remote guidance.

Official references, checked 2026-09-19:
- https://learn.chatgpt.com/docs/remote
- https://learn.chatgpt.com/docs/remote-connections
- https://learn.chatgpt.com/docs/codex/cli

Recheck current official guidance and the installed app before operating version-dependent controls. Product naming and menu locations can change. The documented setup at the checked date starts in the desktop app under Settings > Connections > Control this Mac or PC; it requires a compatible account/workspace and phone pairing. Do not fabricate command IDs, settings keys, pairing URLs or task deep links.

## Agent-owned setup

### 1. Discover the existing environment

Resolve the VS Code workspace's actual project directory, selected folder in a multi-folder workspace, Codex executable/version and available desktop app. Inspect whether the intended PC is already paired and reachable using supported app UI or available read-only tools. A process existing or CLI help succeeding does not establish Remote readiness. If a tool cannot report connection state, record it as unverified rather than guessing.

Distinguish desktop-app history visibility from phone Remote access: shared local history can explain why a CLI conversation appears in the app. Do not call that automatic cloud synchronization or evidence of a shared live terminal session. Preserve OpenCodex/custom provider choices; their compatibility with Remote must be checked separately. Do not silently switch providers, accounts or models to make a check pass.

### 2. Match the work location

Resolve the candidate task's host and working directory using supported task metadata or app UI. Compare canonical absolute paths with the actual VS Code project path, accounting for Windows path case and junctions where relevant. Matching task titles or repository names is insufficient. A cloud task or a separate Git worktree will not update the same local files directly.

Reuse an existing suitable task when the user's request calls for it and it is accessible through Remote. Otherwise explain the mismatch and offer a local task in the original project directory. Create a task only when the user has requested it or the available tool's creation rules permit it. Do not relocate an existing task, transfer Git state or merge another checkout merely to make paths match. If the path cannot be verified, leave execution validation pending.

### 3. Establish official access

If the intended PC is already paired and reachable, reuse it without regenerating pairing or restarting the agent. Otherwise operate the supported desktop Remote setup with available tools. Leave account login, QR scanning and device approval to the user where required. Ask only for that necessary user action; complete independent local checks yourself. Do not put a pairing code or credential in project files, committed docs, logs or public screenshots.

Do not make experimental CLI `remote-control` commands the default bootstrap merely because installed help lists them. They can be investigated separately when requested and supported by current documentation. Do not enable public listeners, a custom relay, firewall rules, developer-server LAN binding, or VS Code Tunnel as an automatic fallback.

The Vibe Coding mobile button opens a script-free official Codex Remote setup guide showing the selected workspace folder and a request the user can copy to their AI agent. It does not enable remote access, read the clipboard, generate pairing codes, or report connection status. Older v2.6.2 installations may still show the former VS Code Tunnel flow until the updated extension is loaded. A Tunnel QR is not Codex pairing. If the user explicitly wants the full VS Code interface remotely, treat that as a different workflow.

### 4. Prepare the existing preview for local changes

Confirm the existing server URL belongs to the selected project, and that the preview is reachable. Reuse the configured server rather than spawning duplicates. Remote AI instructions do not require exposing the preview server to the phone: the preview still runs on the PC. Viewing the preview on the phone is a separate feature and must not be promised here.

The host must remain awake and online, with the required app/service available. Explain those conditions; do not silently change global power policies. Do not start simultaneous CLI and mobile edits to the same files. Finish or pause the relevant existing task through supported controls before switching execution clients; preserve unrelated terminals and unsaved editors.

## Verification and completion

Track evidence independently; do not compress it into a single connected/success boolean:

| Check | Sufficient evidence | Not sufficient |
| --- | --- | --- |
| Local setup ready | Actual project path, selected task host/cwd, app availability and preview response checked | CLI installed or process running |
| Phone paired | Official Remote shows the intended PC reachable on the user's phone or equivalent supported connection evidence | QR rendered or desktop history visible |
| Remote execution verified | A phone-origin request completes on that PC and reports the intended working directory | A local agent request or generic chat response |
| File/preview reflection verified | An authorized phone-origin edit changes the intended local file and its result is observed in VS Code/preview | Same repository name or successful server start |

For a requested connection test, start with a read-only phone prompt such as: “Report your actual working directory and confirm whether this is the project folder open in VS Code. Do not modify files.” The agent should gather the resulting task metadata/output rather than ask the user to manually inspect paths. Do not send paid AI requests solely to test setup without a user request authorizing that test.

Verify file/preview reflection during the first authorized real edit, or through a specifically requested reversible test. Do not edit application content just to mark onboarding complete. A read-only test can establish remote execution while file/preview reflection remains untested. Existing CLI conversation continuation and live transcript display in the CLI are separate capabilities: claim either only after observing it with the actual task and installed versions.

If phone interaction or UI inspection is unavailable, finish the local preparation and report the exact pending step. Suggested user-facing format: “로컬 준비: 확인 / 휴대폰 연결: 대기 / 원격 실행: 미검증 / 미리보기 반영: 미검증”. Report only the relevant unresolved items, not a long manual checklist. Do not label a guide-only result as a working remote connection.

After setup, instruct the user to select the connected PC and the verified project/task in the official mobile Remote interface. They do not need to invoke this skill for subsequent work. Re-run only the relevant discovery/verification steps if the PC, project location or connection changes.

## Review scenarios for future updates

- Already paired + matching local task: reuse; no installer rerun or duplicate task.
- CLI task appears in desktop history but phone access is unknown: execution remains unverified.
- Same repository in a cloud environment/worktree: reject the path match; preserve both workspaces.
- Phone unavailable: finish local checks and report pairing/execution pending.
- Host offline or sleeping: explain the availability condition; do not claim a setup bug is fixed.
- Custom provider selected: preserve it and verify compatibility; no implicit switch to OpenAI models.
- Normal VS Code setup without mobile request: do not enable Remote.
- Existing Tunnel button clicked: identify the separate workflow; do not accept its QR as Codex pairing.
