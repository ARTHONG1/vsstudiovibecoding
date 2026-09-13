# Acceptance evidence

The agent owns these checks. Record pass/fail/blocked and the actual observation, not a generic "all checks passed".

1. **Physical configuration:** the native user's context reads the generated workspace and entry file; paths point to the intended project, user data, and extensions. OpenCode `--version` succeeds. JSON and PowerShell startup parse.
2. **User launch:** launch the generated desktop shortcut from the real desktop context. Select the returned intended window by title/project. Observe actual preview, actual source file, and OpenCode prompt in left-to-right order. No empty untitled substitute files; no default Chat substituted for OpenCode.
3. **Usability:** adjust the panel width so the OpenCode prompt is readable. Confirm Korean UI localization (menus/popups), autoSave without manual Ctrl+S, and Korean/non-ASCII text integrity in the OpenCode terminal. Do not leave a narrow sliver and call the arrangement complete. Do not interact with unrelated apps or security popups.
4. **Preview:** on the sample, click the test button and observe the counter change. For an existing project, use a harmless existing interaction or a temporary reversible local change, then restore it. Never submit business forms as a test. Verify the dev server is reachable when used.
5. **3-Mode toggle round trip:** Test clicking `터미널 전체` to verify transition to full terminal and return to 3 columns. Test clicking `미리보기 전체` to verify transition to clean full preview (100% viewport for Computer Use / human QA) and return to 3 columns with even editor widths. Verify project local development server endpoint (Live Preview or detected Vite/Next.js/Astro port) remains reachable for Playwright and Browser-Use. Verify pressing F12 in code editor preserves native Go to Definition.
6. **Recovery and repeated use:** invoke layout restoration and ensure one usable preview and one OpenCode terminal. Repeated invocation must not accumulate tabs, terminals, shortcuts, or overwrite user code.
7. **Restart:** close the affected workspace normally and relaunch its shortcut. Observe three columns and working OpenCode again. Preserve unsaved buffers; do not discard changes or terminate unrelated Code windows.

If a tool reports user interruption, follow its stop rule. On a later user-authorized continuation, reobserve before input. If a desktop tool is unavailable or a mandatory user authentication action remains, mark that exact check pending. A background log saying `layout-ready` is supporting evidence, not visual proof.

## Skill release testing

Before claiming portability, test the packaged skill in a new agent context with no conversation history, using a disposable project. Include paths with spaces/non-ASCII, an existing index.html that must survive, an already configured machine, missing prerequisites, unavailable UI tools, and a packaged-app virtualization mismatch. Use plan-only evaluation for cases where real machine changes are not authorized.

Report the tested OS/VS Code/OpenCode versions and distinguish scenario review from actual execution on another computer. One machine's success is not a guarantee across all Windows environments.
