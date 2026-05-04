# Contract: Agent Capabilities Discovery

**Feature**: `018-agent-chat-panel`
**Status**: Frozen for v1
**Consumers**: `src/features/agent-chat/agent-capabilities-service.ts`, `src/features/agent-chat/agent-capabilities-catalog.ts`
**References**: spec FR-011a, FR-011b, FR-013; research.md §R1

This contract defines how an ACP agent's supported modes, models, and follow-up behavior are resolved. The resolver is a pure function of (agentId, agent-reported initialize capabilities, catalog snapshot) and has no side effects other than telemetry.

---

## 1. Input sources

### 1.1 Agent-reported (`ReportedByAgent`)

Read from the ACP `initialize` response of a spawned `AcpClient`. The ACP SDK surfaces these fields under the agent's `AgentCapabilities`. For v1 we consume three optional fields:

```ts
interface AgentInitializeCapabilities {
  modes?: Array<{
    id: string;
    displayName?: string;
    promptPrefix?: string;
  }>;
  models?: Array<{
    id: string;
    displayName?: string;
    invocation?: "initial-prompt" | "cli-flag";
    invocationTemplate?: string;
  }>;
  acceptsFollowUp?: boolean;
}
```

All three are optional. An agent MAY provide any subset. Missing fields are treated as unknown (not empty).

### 1.2 Catalog (`CatalogFallback`)

Extends the existing `KNOWN_AGENTS` catalog (see `src/providers/hook-view-provider.ts` and `src/services/acp/providers/`) with a new optional `capabilities` descriptor per entry:

```ts
interface KnownAgentCapabilities {
  modes: ModeDescriptor[];      // empty array = "mode selector hidden for this agent"
  models: ModelDescriptor[];    // empty array = "model selector hidden for this agent"
  acceptsFollowUp: boolean;     // default: true
}
```

A catalog entry MAY omit `capabilities` entirely — that entry resolves to `{ source: "none" }` when the agent doesn't report anything either.

### 1.3 Protocol constants

```ts
/** Version of this contract. Bumped on breaking changes. */
const CAPABILITIES_CONTRACT_VERSION = 1;

/** Default follow-up acceptance when neither agent nor catalog specifies. */
const DEFAULT_ACCEPTS_FOLLOW_UP = true;
```

---

## 2. Resolver algorithm

```text
resolve(agentId: string): ResolvedCapabilities

1. reported := AcpClient.getInitializeCapabilities(agentId)  // may be undefined
2. cataloged := AgentCapabilitiesCatalog.lookup(agentId)     // may be undefined

3. if reported AND (reported.modes?.length OR reported.models?.length OR reported.acceptsFollowUp !== undefined):
     // Agent provided at least one signal → agent wins (FR-011b)
     return {
       source: "agent",
       modes: normalizeModes(reported.modes ?? []),
       models: normalizeModels(reported.models ?? []),
       acceptsFollowUp: reported.acceptsFollowUp ?? cataloged?.capabilities?.acceptsFollowUp ?? DEFAULT_ACCEPTS_FOLLOW_UP,
     };

4. if cataloged AND cataloged.capabilities:
     return {
       source: "catalog",
       modes: cataloged.capabilities.modes,
       models: cataloged.capabilities.models,
       acceptsFollowUp: cataloged.capabilities.acceptsFollowUp,
     };

5. return { source: "none" };
```

**Key rules**:

- The agent-reported source **wins** when it is non-empty; the catalog is never used to override a populated agent-reported result (FR-011b).
- When the agent reports modes but not models (or vice versa), the populated one is taken from the agent and the other one falls back to the catalog. Mixed sources are tagged `source: "agent"` for simplicity — the UI treats this uniformly.
- `DEFAULT_ACCEPTS_FOLLOW_UP = true` keeps backwards compatibility with existing ACP agents that currently run end-to-end and happily accept follow-ups via `session/prompt`.
- `source: "none"` MUST cause both mode and model selectors to be hidden (FR-011a).

---

## 3. Normalization

```ts
function normalizeModes(raw: NonNullable<AgentInitializeCapabilities["modes"]>): ModeDescriptor[] {
  return raw
    .filter(m => typeof m.id === "string" && m.id.length > 0)
    .map(m => ({
      id: m.id,
      displayName: m.displayName ?? humanize(m.id),
      promptPrefix: m.promptPrefix,
    }));
}

function normalizeModels(raw: NonNullable<AgentInitializeCapabilities["models"]>): ModelDescriptor[] {
  return raw
    .filter(m => typeof m.id === "string" && m.id.length > 0)
    .map(m => ({
      id: m.id,
      displayName: m.displayName ?? humanize(m.id),
      invocation: m.invocation ?? "initial-prompt",
      invocationTemplate: m.invocationTemplate,
    }));
}

/**
 * Convert a kebab-or-snake-cased id into a human-readable display name.
 *
 * Rules:
 *   1. Split on `-` and `_`.
 *   2. Lower-case every segment.
 *   3. Upper-case the first character of every segment.
 *   4. Join with a single space.
 *
 * Examples:
 *   humanize("plan")         === "Plan"
 *   humanize("gpt-4o")       === "Gpt 4o"
 *   humanize("claude_3_opus") === "Claude 3 Opus"
 *   humanize("")             === ""
 *   humanize("CODE")         === "Code"   // normalized to lower first, then title-case
 */
function humanize(id: string): string;
```

- Duplicate ids are de-duplicated, keeping the first occurrence.
- Unknown fields are dropped (forward-compatible).
- `humanize` is a pure function; its behavior MUST be covered by the tests in §7.

---

## 4. Application at runtime

### 4.1 Mode

- `invocation = "initial-prompt"` mode delivery: the selected mode's `promptPrefix` (if any) is prepended to the first user message of every agent turn.
- Changing mode mid-session applies to the **next** turn, not the current one (see data-model invariant 6). The extension records a `SystemChatMessage { kind: "mode-changed" }` when the user changes mode.

### 4.2 Model

- `invocation = "initial-prompt"`: the selected model's id is included in the first message of the session (typical envelope: `[model: <id>]\n`).
- `invocation = "cli-flag"`: the selected model's `invocationTemplate` (e.g. `--model {id}`) is appended to the `spawnArgs` of the `AcpProviderDescriptor` at session-start. Because the subprocess is long-lived, **switching model mid-session is not supported in v1** — the panel offers to start a new session (consistent with data-model §5 invariant 6).

### 4.3 Follow-up input

- `acceptsFollowUp = false` causes the input bar to be disabled after the initial turn completes, with a `SystemChatMessage` explaining that the agent does not accept follow-ups (FR-004).
- Cloud sessions are always read-only in v1 (FR-003) regardless of this flag; the flag is ignored for `source = "cloud"` sessions.

---

## 5. Catalog schema (persistence)

The extended catalog lives in `src/features/agent-chat/agent-capabilities-catalog.ts` as a static TypeScript data structure compiled into the extension bundle.

```ts
interface AgentCatalogEntry {
  /** Matches AcpProviderDescriptor.id. */
  id: string;
  capabilities?: KnownAgentCapabilities;
}

export const AGENT_CAPABILITIES_CATALOG: readonly AgentCatalogEntry[] = [
  // Example seed entries (final list TBD during implementation)
  {
    id: "opencode",
    capabilities: {
      modes: [
        { id: "code", displayName: "Code", promptPrefix: "[mode: code]\n" },
        { id: "ask", displayName: "Ask", promptPrefix: "[mode: ask]\n" },
        { id: "plan", displayName: "Plan", promptPrefix: "[mode: plan]\n" },
      ],
      models: [/* populated during implementation */],
      acceptsFollowUp: true,
    },
  },
  {
    id: "claude-code",
    capabilities: {
      modes: [],           // claude-code does not expose discrete modes today
      models: [/* populated */],
      acceptsFollowUp: true,
    },
  },
];
```

- The catalog is **read-only at runtime**; updates require a code change and a new extension release.
- The catalog is tested by a snapshot test that asserts shape stability, and by a unit test that asserts the resolver returns the expected `ResolvedCapabilities` for each seeded entry when the agent reports nothing.

---

## 6. Telemetry

The resolver emits exactly one telemetry event per `resolve()` call using the project-wide `logTelemetry(event, properties)` pattern (see `src/features/hooks/actions/acp-action.ts:163-170`, `src/features/devin/telemetry.ts:53-59`):

```ts
import { logTelemetry } from "../telemetry";

logTelemetry("agent-chat.capabilities.resolved", {
  agentId,
  source: result.source,              // "agent" | "catalog" | "none"
  modeCount: result.source === "none" ? 0 : result.modes.length,
  modelCount: result.source === "none" ? 0 : result.models.length,
  acceptsFollowUp: result.source === "none" ? "n/a" : String(result.acceptsFollowUp),
});
```

Property values conform to `logTelemetry`'s signature (`Record<string, string | number | boolean>`), so `acceptsFollowUp` is serialized as a string when not applicable. No PII is emitted (mode/model ids are assumed to be enum-like; user-provided model ids that might include PII are counted but not logged by value).

---

## 7. Test coverage (TDD)

The following tests MUST exist before implementation:

- **Agent reports only modes** → `source = "agent"`, modes populated, models = [] (from catalog or agent — verified both paths).
- **Agent reports only models** → symmetric.
- **Agent reports `acceptsFollowUp = false`, no modes/models** → `source = "agent"` (because follow-up is a signal), selectors hidden.
- **Agent silent, catalog populated** → `source = "catalog"`.
- **Agent silent, catalog entry without `capabilities`** → `source = "none"`.
- **Agent silent, no catalog entry** → `source = "none"`.
- **Agent reports modes that conflict with catalog** → agent wins (FR-011b).
- **Normalization drops invalid ids** (empty, non-string).
- **Normalization de-duplicates ids** (keeping first).
- **`humanize` pure-function tests**: `humanize("plan") === "Plan"`; `humanize("gpt-4o") === "Gpt 4o"`; `humanize("claude_3_opus") === "Claude 3 Opus"`; `humanize("") === ""`; `humanize("CODE") === "Code"`.

Location: `tests/unit/features/agent-chat/agent-capabilities-service.test.ts` and `tests/unit/features/agent-chat/agent-capabilities-catalog.test.ts`.
