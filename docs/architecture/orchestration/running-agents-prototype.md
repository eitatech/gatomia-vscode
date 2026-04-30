---
type: analysis
title: Running Agents Prototype
created: 2026-04-30
tags:
  - orchestration
  - architecture
  - prototype
related:
  - '[[Running-Agents-Model]]'
  - '[[Orchestration-UI-Contract]]'
---

# Running Agents Prototype

See also: [[Running-Agents-Model]], [[Orchestration-UI-Contract]]

## Baseline Mapping

The current orchestration surface already exists in pieces, and the prototype should compose those pieces instead of starting a parallel stack.

- `src/providers/running-agents-tree-provider.ts` already groups local agent-chat sessions into `Active`, `Recent`, and `Orphaned worktrees`, listens to both store and registry change events, and routes session clicks into `gatomia.agentChat.openForSession`.
- `src/providers/agent-chat-view-provider.ts` is already the canonical in-extension detail surface for local and restored agent-chat sessions, pushes session lists to the webview, and reuses the shared page registry plus `getWebviewContent()` bootstrap path.
- `src/providers/cloud-agent-progress-provider.ts` already projects stored cloud sessions into a provider-aware tree, including status icons, task children, PR links, and provider context keys.
- `src/panels/agent-chat-panel.ts` already handles one session-bound editor panel for agent chat, but its transport and hydration patterns are narrower than the sidebar view provider and should not become a second orchestration root.
- `src/panels/cloud-agent-progress-panel.ts` already serializes cloud session progress into a webview payload and supports refresh plus external-link actions.
- `ui/src/components/cloud-agents/cloud-agent-progress-view.tsx` already defines the empty, loading, error, and populated rendering states the orchestration prototype can mirror instead of inventing a separate state vocabulary.

## Smallest Viable Prototype

The smallest viable prototype is one normalized read model and one orchestration webview that sit on top of existing stores, registries, and page wiring.

- Reuse `AgentChatSessionStore` plus `AgentChatRegistry` as the local-session authority.
- Reuse `AgentSessionStorage` plus `ProviderRegistry` as the cloud-session authority.
- Reuse existing change emitters from those services to refresh both the tree surfaces and the orchestration surface from the same underlying state changes.
- Reuse the shared page registry and `getWebviewContent()` instead of introducing a second routing system or standalone webview bootstrap path.
- Reuse existing open-session commands so orchestration cards navigate back to `agent-chat` or the cloud-provider surface rather than replacing them.

## Reused Modules

- `src/providers/running-agents-tree-provider.ts`
- `src/providers/agent-chat-view-provider.ts`
- `src/providers/cloud-agent-progress-provider.ts`
- `src/panels/agent-chat-panel.ts`
- `src/panels/cloud-agent-progress-panel.ts`
- `src/features/agent-chat/agent-chat-session-store.ts`
- `src/features/agent-chat/agent-chat-registry.ts`
- `src/features/cloud-agents/agent-session-storage.ts`
- `src/features/cloud-agents/provider-registry.ts`
- `ui/src/components/cloud-agents/cloud-agent-progress-view.tsx`
- `ui/src/page-registry.tsx`
- `src/utils/get-webview-content.ts`

## New Modules

- `src/features/orchestration/orchestration-read-model.ts` for the merged projection only.
- `src/providers/orchestration-view-provider.ts` for the orchestration webview binding and command bridge.
- `ui/src/features/orchestration/index.tsx` for the orchestration dashboard surface.

## Target Slice

- Merge local agent-chat sessions and cloud-agent sessions into one projection with shared lifecycle buckets.
- Render four visible groups: `Active`, `Waiting`, `Completed`, and `Failed`.
- Surface current metadata that already exists or is trivially derivable now: session id, source, title, agent name, state, timestamps, worktree status, last visible activity, and blocking status.
- Keep the existing Running Agents and Cloud Agents trees intact while the orchestration view becomes an aggregated read-only overview.
- Route actions back into existing session-opening and refresh flows instead of creating orchestration-specific mutations.

## Constraints

- No second orchestration state store.
- No new routing layer.
- No duplicate session lifecycle model.
- No orchestration-owned mutation path beyond delegating to existing commands.
- Cloud sessions should continue to open in their current best surface, including external URLs where that is the only richer detail view today.
