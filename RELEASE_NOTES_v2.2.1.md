## Vibe Coding v2.2.1 - Native Filesystem Verification & Virtualization Safety

Hardened installation and verification: native Windows filesystem SHA-256 and user SID checks, stale same-version detection, and non-destructive VS Code lifecycle management.

### What's New in v2.2.1
- **Native Filesystem Verification (native-files.ps1):** Defends against MSIX/sandbox AppData redirection by verifying file presence, SHA-256 hashes, and Windows user SID via a native Windows process before claiming setup success.
- **Stale Same-Version Detection (setup-files.ps1):** Performs recursive file content comparison between skill source and installed extension folders (ignoring VS Code installation metadata) to guarantee code updates are deployed.
- **Collision-Safe Backups (Backup-VibeFile):** Backs up configuration and workspace files with deterministic path hashes to prevent silent overwrite of initial backups.
- **Non-Destructive Lifecycle:** Safely removed routines that deleted VS Code code.lock or unsaved Backups folders, and preserves user hotExit and workspace trust preferences.
- **Resilient CLI Execution (Invoke-VibeCode):** Prevents PowerShell terminating error triggers on harmless VS Code CLI stderr warnings by relying on process exit code.
- **Specification & Documentation Alignment:** Updated SKILL.md, execution.md, and verification.md to reflect verified native launches and accurate Codex CLI workflows.
