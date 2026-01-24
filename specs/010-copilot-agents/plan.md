# Implementation Plan: Copilot Agents Integration

**Branch**: `010-copilot-agents` | **Date**: 2026-01-24 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/010-copilot-agents/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Integrate existing GitHub Copilot agents into the GatomIA VS Code extension by mapping agent definitions from `resources/agents/` directory to VS Code chat participants, implementing tool execution handlers, and loading agent resources (prompts, skills, instructions) to enable seamless agent interaction through GitHub Copilot Chat. Agents are defined in Markdown files with YAML frontmatter, tools are registered TypeScript implementations, resources are cached in memory on activation, and tool responses return structured objects with markdown content and optional file references.

## Technical Context

**Language/Version**: TypeScript 5.3+ with strict mode enabled (target: ES2022)  
**Primary Dependencies**: VS Code Extension API 1.84.0+, VS Code Chat Participant API, esbuild (bundler), Vite (webview), React 18.3+ (webview only)  
**Storage**: File system for agent resources (resources/ directory), in-memory cache for loaded resources, JSON workspace state for configuration  
**Testing**: Vitest 3.2+ with dual dependency resolution (root + ui/node_modules)  
**Target Platform**: VS Code extension host (Node.js environment) + webview (browser environment)  
**Project Type**: VS Code extension with dual-build system (extension + webview)  
**Performance Goals**: Agent registration < 5s on activation, command autocomplete < 200ms, resource reload < 5s on file change  
**Constraints**: GitHub Copilot Chat must be available/enabled, agent resources must be bundled with extension, file watchers for hot-reload  
**Scale/Scope**: Multiple agents (5-10 initially), multiple commands per agent (3-10), resource files (prompts, skills, instructions) totaling ~100-200 files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **Kebab-Case File Naming** | ✅ PASS | All new files will follow kebab-case: `agent-loader.ts`, `chat-participant-registry.ts`, `tool-handler.ts` |
| **TypeScript-First Development** | ✅ PASS | Using TypeScript 5.3+ with strict mode enabled (per tsconfig.json). All agent integration code will be strictly typed |
| **Test-First Development (TDD)** | ✅ PASS | Tests will be written before implementation. Integration tests for agent loading, tool execution, resource caching |
| **Observability & Instrumentation** | ✅ PASS | Telemetry for agent activations, tool executions, resource loading, and errors. Logging for debugging |
| **Simplicity & YAGNI** | ✅ PASS | Implementing only what's needed now: agent registration, tool execution, resource loading. No complex abstractions |

**Gate Result**: ✅ **PASS** - All constitution principles satisfied. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/010-copilot-agents/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── agent-definition.schema.json     # YAML frontmatter schema for agent markdown files
│   ├── tool-handler-interface.ts        # TypeScript interface for tool handlers
│   └── tool-response.schema.json        # Schema for tool response objects
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── features/
│   └── agents/                          # NEW: Agent integration feature
│       ├── agent-loader.ts              # Discovers and loads agent definitions from resources/
│       ├── chat-participant-registry.ts # Registers agents as VS Code chat participants
│       ├── tool-registry.ts             # Registers and manages tool handlers
│       ├── resource-cache.ts            # Loads and caches prompts, skills, instructions
│       ├── file-watcher.ts              # Watches resource files for hot-reload
│       └── types.ts                     # TypeScript types for agents, tools, resources
├── services/
│   └── agent-service.ts                 # NEW: Coordinates agent operations (existing pattern)
├── utils/
│   └── yaml-parser.ts                   # NEW: Parses YAML frontmatter from markdown files
└── extension.ts                         # MODIFIED: Register agent feature on activation

resources/                                # Agent resources bundled with extension
├── agents/                              # Agent definition files (markdown + YAML)
│   ├── speckit.agent.md                # Example: SpecKit agent definition
│   └── task-planner.agent.md           # Example: Task Planner agent definition
├── prompts/                             # Prompt templates for agents
├── skills/                              # Domain knowledge packages
└── instructions/                        # Behavior guidelines for agents

tests/
├── unit/
│   └── features/
│       └── agents/                      # Unit tests for agent feature
│           ├── agent-loader.test.ts
│           ├── tool-registry.test.ts
│           └── resource-cache.test.ts
└── integration/
    └── agents/                          # Integration tests for agent workflows
        ├── agent-registration.test.ts
        └── tool-execution.test.ts
```

**Structure Decision**: Single VS Code extension project (Option 1). New `features/agents/` module follows existing pattern seen in `features/spec/`, `features/hooks/`, `features/steering/`. Agent resources stored in `resources/` directory at repo root, matching existing `resources/prompts/` structure.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**No violations identified.** All constitution principles are satisfied without requiring additional complexity or abstractions.

---

## Phase Completion Summary

### Phase 0: Outline & Research ✅

**Completed**: 2026-01-24

**Artifacts Generated**:
- [research.md](./research.md) - All technical decisions documented and clarified through specification refinement

**Key Decisions**:
1. Agent format: Markdown with YAML frontmatter
2. Tool execution: Registered TypeScript functions
3. Resource loading: In-memory caching on activation
4. Parameter parsing: Free-text strings for flexibility
5. Response format: Structured objects with markdown + file references

**Unknowns Resolved**: All "NEEDS CLARIFICATION" items resolved. No open questions remaining.

---

### Phase 1: Design & Contracts ✅

**Completed**: 2026-01-24

**Artifacts Generated**:
- [data-model.md](./data-model.md) - Core entities and relationships
- [contracts/agent-definition.schema.json](./contracts/agent-definition.schema.json) - YAML frontmatter schema
- [contracts/tool-handler-interface.ts](./contracts/tool-handler-interface.ts) - TypeScript interfaces for tools
- [contracts/tool-response.schema.json](./contracts/tool-response.schema.json) - Tool response schema
- [quickstart.md](./quickstart.md) - Developer and user guide

**Agent Context Updated**: ✅ Updated `.github/agents/copilot-instructions.md` with new technologies

---

### Constitution Check (Post-Design) ✅

**Re-evaluation Status**: ✅ **PASS**

All design artifacts follow constitution principles:
- File naming: All contracts and source files follow kebab-case
- TypeScript-first: Strict types defined for all entities
- TDD-ready: Clear interfaces enable test-first development
- Observability: Telemetry and logging built into design
- Simplicity: No unnecessary abstractions, YAGNI followed

---

## Implementation Readiness

### ✅ Ready to Proceed to Phase 2 (Task Generation)

**Prerequisites Complete**:
- ✅ Technical context fully defined
- ✅ Constitution check passed
- ✅ Research completed (no unknowns)
- ✅ Data model documented
- ✅ API contracts defined
- ✅ Quickstart guide created
- ✅ Agent context updated

**Next Command**: `/speckit.tasks`

This command will generate actionable, dependency-ordered tasks in [tasks.md](./tasks.md) based on the design artifacts created in this plan.

---

## References

- **Feature Specification**: [spec.md](./spec.md)
- **Project Constitution**: [../../.specify/memory/constitution.md](../../.specify/memory/constitution.md)
- **VS Code Chat API**: https://code.visualstudio.com/api/extension-guides/chat
- **GitHub Copilot Documentation**: https://docs.github.com/en/copilot
- **TypeScript 5.3**: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-3.html
