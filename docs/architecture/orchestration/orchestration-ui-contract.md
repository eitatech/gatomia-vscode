---
type: reference
title: Orchestration UI Contract
created: 2026-04-30
tags:
  - orchestration
  - ui-contract
  - phase-01
related:
  - '[[Running-Agents-Prototype]]'
---

# Orchestration UI Contract

See also: [[Running-Agents-Prototype]]

## Purpose

This contract defines the smallest bridge between the extension host and the phase 01 orchestration webview. It reuses the existing agent-chat telemetry helper, cloud-agent polling/runtime, and page-registry/webview patterns instead of creating a second orchestration stack.

## Inbound Messages

- `orchestration/ready`: ask the extension for the current normalized snapshot.
- `orchestration/refresh`: refresh cloud state through the existing cloud-agent command path, then republish the orchestration snapshot.
- `orchestration/open-session`: open the selected session in the best existing surface.
- `orchestration/open-existing-surface`: reveal the original Agent Chat or Cloud Agents experience for the requested source.
- `orchestration/open-external`: open an external provider URL for cloud sessions.

## Outbound Messages

- `orchestration/snapshot`: publish the normalized orchestration snapshot to the webview.

## Snapshot Shape

- `sessions[]`: normalized session cards with `id`, `source`, `sourceSessionId`, `title`, `agentName`, `state`, `bucket`, timestamps, blocking metadata, worktree metadata, and open-session routing hints.
- `cloudProviderRegistryAvailable`: indicates whether cloud-provider wiring is available inside the current workspace runtime.
- `cloudProviderCount`: indicates how many cloud providers are registered so the webview can distinguish setup gaps from normal empty states.
- `activeProvider`: current cloud provider metadata when present.
- `generatedAt`: snapshot creation timestamp used by the UI header.
- `degradedReasons[]`: user-facing degraded-state explanations for missing providers, unavailable storage, or failed status reads.

## Live Update Contract

- Agent-chat changes flow through the existing session-store manifest event and live registry event.
- Cloud session changes flow through `AgentSessionStorage.onDidChange`, which now fires after create, update, delete, and read-only transitions.
- Cloud provider changes flow through `ProviderRegistry.onDidChange`, which now fires after registration and active-provider changes.
- The orchestration read model subscribes to those existing surfaces so the tree views and orchestration view stay in sync without manual reload loops.

## Empty, Loading, and Degraded States

- Loading state appears until the first `orchestration/snapshot` arrives.
- Empty state explains there are no local or cloud sessions yet and offers a jump back to an existing surface.
- Missing-provider empty states explain whether no providers are registered, no provider is selected, or provider wiring is unavailable entirely.
- Degraded state explains when cloud storage is unavailable or when local/cloud status reads fail, and points the user toward refresh plus the output channel.
- Waiting sessions are surfaced as blocked work so they do not disappear inside the active lane.

## Reused vs New Modules

- Reused: [[Running-Agents-Prototype]], `src/features/agent-chat/telemetry.ts`, `src/features/cloud-agents/agent-polling-service.ts`, `src/providers/cloud-agent-progress-provider.ts`, and the shared webview page registry.
- New or narrowed for phase 01: `src/providers/orchestration-view-provider.ts`, `src/features/orchestration/orchestration-read-model.ts`, and the orchestration React view.
