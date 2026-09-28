# Context7 MCP

Default target: Upstash's [Context7](https://github.com/upstash/context7), package `@upstash/context7-mcp` or its documented remote endpoint. Select one supported transport for the actual client; do not register both as duplicates.

1. Check existing Context7 configuration and whether the target client can call it. Otherwise install a verified concrete version in the external tool directory and configure its actual JS entrypoint through node, or use the official HTTP endpoint according to current docs.
2. Merge the project-scoped Codex server entry. Keep credentials out of committed files and reports; use supported environment/credential storage if authentication is required. Check current anonymous access, limits and authentication rather than promising permanent free access. If no key is needed for the smoke call, do not create an account unnecessarily.
3. Resolve a public library actually used by the project, then query its documentation. Inspect current tool schemas (normally `resolve-library-id` and `query-docs`). Check tool errors and useful returned content, not only tool availability.
4. Compare documentation coverage with the project's installed version. If exact version coverage is unavailable, say so and verify against that version's official sources. For a fresh project without dependencies, use a clearly labelled public-library connectivity probe; do not add that library to the project.

Future-agent guidance: consult Context7 when implementing unfamiliar/version-sensitive library APIs or when usage is uncertain, not for every cosmetic/text change. Send only necessary public technical questions; do not include credentials, private source code or student/user data. If the service is unavailable, disclose the limitation and consult official documentation rather than inventing an API. Keep its setup status pending if authentication or quota prevents verification.
