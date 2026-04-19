# Contract: plugins

## Purpose

Public extension API for third-party additions to OpenDesk. Exposes a safe surface for hooks (on-save, on-export, on-share, on-KB-update), toolbar buttons, sidebar panels, and custom workflow actions. Execution reuses the Wasm sandbox already built for `workflow` (Extism/Wasmtime), so plugins inherit memory, CPU, and capability limits.

This module exposes the API; it does not implement the sandbox (that lives in `workflow`). Think of `plugins` as the discovery, registration, and host-binding layer; `workflow` is the execution engine.

## Inputs

- `PluginManifest` JSON — declares name, version, entry module (Wasm or ES module for UI plugins), hook subscriptions, toolbar contributions, sidebar panels, required capabilities
- Host events (hook dispatches) from other modules via `events`
- User actions: install, uninstall, enable, disable, configure

## Outputs

- `InstalledPlugin` records persisted to Postgres
- Hook dispatches to registered plugins (fan-out on matching events)
- Rendered toolbar buttons and sidebar panels in the app shell
- `PluginInstalled`, `PluginExecuted`, `PluginFailed` events

## Side Effects

- Loads Wasm modules via the `workflow` sandbox at hook-dispatch time
- Loads UI plugin ES modules dynamically (code-split) in the browser — origin-pinned to the workspace's plugin CDN or same-origin
- Writes to `audit` on install, uninstall, and every hook invocation (invocation audit is sampled above N/minute to avoid log flood)

## Invariants

1. **Capability-based permissions.** Every hook and every host API call requires a declared capability in the manifest. The server verifies declared capabilities match the actual calls; undeclared calls are refused.
2. **Wasm sandboxing for server-side plugins.** Server hooks run in the `workflow` Wasm sandbox with per-plugin memory and CPU caps. No network, filesystem, or process access except through host-granted APIs.
3. **Signed manifests.** Published plugins carry an Ed25519 signature over the manifest by the workspace's trusted publisher set. Unsigned plugins are allowed only in "developer mode", gated by workspace policy.
4. **UI plugin origin pinning.** Browser ES modules for UI plugins are loaded only from the workspace's configured plugin origin (default: same origin). Cross-origin sources are refused.
5. **Isolation across workspaces.** A plugin installed in workspace A cannot observe events or state in workspace B. The host API scopes every query and event subscription by workspace_id.
6. **Timeouts are mandatory.** Hook invocations have a per-plugin timeout (default 2s). Plugins that exceed it are force-terminated and the hook proceeds as if the plugin did not participate.
7. **Non-blocking failure mode.** Plugin failures MUST NOT block the host operation. A failing on-save hook does not prevent save; the failure is audited and surfaced in the admin UI.
8. **Versioned host API.** The host API exposed to plugins is versioned (`@opendesk/host@1`). Breaking changes require a new major version; the host supports the last two majors concurrently.
9. **Capability scope for KB.** KB-touching plugins must declare `kb.read` and/or `kb.write` with corpus restrictions (`knowledge | operational | reference`). Writes honor jurisdiction isolation.
10. **No privileged escalation via workflows.** A plugin cannot register a workflow action that exceeds its declared capabilities; the workflow registrar enforces capability intersection.

## Dependencies

- `core`
- `workflow` — Wasm execution engine (required at runtime)
- `events` — hook dispatch
- `audit` — install and invocation audit
- `storage` — manifest and installed-plugin records
- `app-admin/policy` — developer mode, trusted publishers, plugin origin
- `kb` — when plugins declare KB capabilities, read/write is brokered via `kb`'s public API

## Boundary Rules

### MUST

- Validate `PluginManifest` against a pinned Zod schema before install
- Verify Ed25519 signature against the workspace trust store (unless developer mode explicitly allows unsigned)
- Register the plugin's declared capabilities as a capability set attached to every hook invocation
- Enforce per-plugin timeouts, memory caps, and CPU caps on every invocation
- Emit `PluginExecuted` / `PluginFailed` events for every invocation (sampled above threshold)
- Rate-limit install/uninstall actions per workspace (anti-thrash)

### MUST NOT

- Expose raw database, filesystem, or process APIs to plugins
- Allow plugin code to read environment variables or secrets
- Forward plugin network requests without a host-side allowlist
- Run UI plugins from cross-origin sources without explicit policy approval
- Persist plugin-provided code inside Postgres blobs — use `storage` (S3) with content-hash integrity

## Verification

1. **Capability enforcement** — plugin declares only `document.read`, attempts `document.write`, assert refused.
2. **Wasm sandbox limits** — plugin allocates beyond memory cap, assert terminated with `OOM`.
3. **Unsigned refusal** — install unsigned plugin with developer mode off, assert refused.
4. **Signed accept** — install plugin signed by trusted publisher, assert installed.
5. **Origin pinning** — attempt to load UI plugin from cross-origin URL, assert refused.
6. **Workspace isolation** — plugin installed in A subscribes to document events, create event in B, assert plugin does not see B.
7. **Timeout enforcement** — plugin loops indefinitely on hook, assert terminated after default timeout.
8. **Non-blocking failure** — plugin throws on on-save hook, assert save still completes.
9. **Audit coverage** — install, invoke, uninstall plugin, assert every step audited with principal.
10. **Host API version** — plugin declares host API v1, host runs v2, assert compatibility shim engaged and deprecation warning logged.

## MVP Scope

Implemented (targeted):
- [ ] `PluginManifest` Zod schema
- [ ] Install/uninstall/enable/disable lifecycle
- [ ] Ed25519 signature verification against a workspace trust store
- [ ] Hook dispatch via `events` → `workflow` Wasm sandbox
- [ ] Toolbar-button and sidebar-panel contribution points (UI)
- [ ] Capability enforcement
- [ ] Invocation audit

Post-MVP (deferred):
- [ ] Plugin marketplace / discovery UI
- [ ] Paid plugin licensing
- [ ] Plugin update auto-rollout with canary
- [ ] Cross-plugin messaging (bus between plugins)
- [ ] Cryptographic plugin isolation beyond Wasm (gVisor-style second layer)
