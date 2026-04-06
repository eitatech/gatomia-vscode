# Implementation Plan: Devin Remote Implementation Integration

**Branch**: `001-devin-integration` | **Date**: 2026-02-24 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-devin-integration/spec.md`

## Summary

Implement VS Code extension integration with Devin (Cognition) AI to enable remote task delegation. The extension allows users to select tasks from specs, send them to Devin for implementation, monitor progress in real-time, and review resulting pull requests - all without leaving VS Code.

**Technical Approach**:

- Support Devin API v1, v2, and v3 with automatic version detection based on API key prefix (`cog_` for v3, `apk_*` for legacy)
- Use VS Code SecretStorage for secure credential management
- Implement polling-based progress monitoring (5-10s intervals)
- Provide webview-based progress panel for real-time updates
- Store session state in VS Code workspace state with 7-day retention

## Technical Context

**Language/Version**: TypeScript 5.3+ (target: ES2022, strict mode)  
**Primary Dependencies**: VS Code Extension API 1.84.0+, Devin API v1/v2/v3  
**Storage**: VS Code workspace state (sessions), SecretStorage (credentials)  
**Testing**: Vitest 3.2+  
**Target Platform**: VS Code desktop (Windows, macOS, Linux)  
**Project Type**: VS Code extension with webview panel  
**Performance Goals**: <30s task initiation, <10s progress update latency, 95% success rate  
**Constraints**: Poll-based updates (no webhooks), 7-day session retention, max 3 retry attempts  
**Scale/Scope**: Multiple concurrent sessions per workspace, single user per VS Code instance

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Check | Status | Notes |
|-------|--------|-------|
| Kebab-case file naming | Pass | All new files will use kebab-case |
| TypeScript strict mode | Pass | Project uses strict: true |
| Test-first development | Pass | Tests required before implementation |
| Observability | Pass | Telemetry and logging included in design |
| Simplicity/YAGNI | Pass | Focused on core Devin integration only |

**Re-check after Phase 1**: All checks still pass. No complexity violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/001-devin-integration/
├── plan.md              # This file
├── research.md          # Phase 0: API research
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: User setup guide
├── contracts/           # Phase 1: TypeScript interfaces
│   ├── devin-api.ts    # Devin API contracts
│   └── extension-api.ts # Extension internal contracts
└── tasks.md             # Phase 2: Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── features/
│   └── devin/                    # Devin integration feature
│       ├── devin-api-client.ts   # API client for v1/v2/v3
│       ├── devin-session-manager.ts
│       ├── devin-credentials-manager.ts
│       └── types.ts
├── services/
│   └── devin-polling-service.ts  # Status polling logic
├── providers/
│   └── devin-progress-provider.ts # Tree view provider
├── panels/
│   └── devin-progress-panel.ts   # Webview panel
└── commands/
    └── devin-commands.ts         # VS Code commands

ui/src/
├── components/
│   └── devin/
│       ├── devin-progress-view.tsx
│       ├── session-list.tsx
│       └── task-status.tsx
└── stores/
    └── devin-store.ts

tests/
├── unit/
│   └── features/
│       └── devin/
│           ├── devin-api-client.test.ts
│           └── devin-session-manager.test.ts
└── integration/
    └── devin/
        └── devin-workflow.test.ts
```

**Structure Decision**: Following existing project structure with feature-based organization under `src/features/devin/`. Webview components in `ui/src/components/devin/` following React 18 + TypeScript pattern. Tests mirror source structure.

## Complexity Tracking

No complexity violations identified. Implementation follows existing architectural patterns:

- Service layer for API communication
- Provider pattern for VS Code tree views
- Webview panel for rich UI
- Feature-based module organization

## Phase 0: Research Summary

Completed research on Devin API:

**API Versions**:

- v3 (current): Service users with `cog_` prefix, RBAC, audit trails
- v1/v2 (legacy): Personal/service API keys with `apk_*` prefix

**Key Endpoints**:

- `POST /v3/organizations/{org_id}/sessions` - Create session
- `GET /v3/organizations/{org_id}/sessions/{id}` - Get session details
- `GET /v3/organizations/{org_id}/sessions` - List sessions

**Authentication**:

- Header: `Authorization: Bearer {token}`
- Auto-detect version from token prefix

See [research.md](./research.md) for complete details.

## Phase 1: Design Summary

**Data Model**: See [data-model.md](./data-model.md)

- Core entities: DevinSession, DevinTask, DevinCredentials, DevinProgressEvent
- Session persistence across VS Code restarts
- 7-day retention policy

**Contracts**: See [contracts/](./contracts/)

- `devin-api.ts`: Devin API v1/v2/v3 interfaces
- `extension-api.ts`: Extension internal message contracts

**Quickstart**: See [quickstart.md](./quickstart.md)

- Setup instructions for v3 and legacy APIs
- Usage guide for single/batch task delegation
- Troubleshooting common issues

## Next Steps

Run `/speckit.tasks` to generate the implementation task list.
