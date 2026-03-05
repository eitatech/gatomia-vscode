# Devin API Research

**Date**: 2026-02-24  
**Source**: https://docs.devin.ai/api-reference/overview

## API Versions Overview

Devin provides three API versions:

| Version | Status | Authentication | Use Case |
|---------|--------|----------------|----------|
| v1 | Legacy | Personal API Key (`apk_user_*`) or Service API Key (`apk_*`) | Legacy integrations |
| v2 | Legacy | Same as v1 | Legacy integrations |
| v3 (Beta) | Current | Service User with `cog_` prefix + RBAC | New integrations |

**Decision**: Support all three versions with automatic detection based on API key prefix.

**Rationale**: Users may have existing legacy API keys. The extension should detect key type (`cog_` for v3, `apk_*` for v1/v2) and route to appropriate API version.

**Alternatives considered**:
- v3 only: Rejected - would break existing users with legacy keys
- v1/v2 only: Rejected - v3 provides better RBAC and audit capabilities

---

## Authentication Methods

### v3 Service User (Recommended)
- **Token Format**: `cog_` prefix (e.g., `cog_abc123xyz`)
- **Header**: `Authorization: Bearer {token}`
- **Features**: Role-based access control, audit trails, centralized key management
- **Required Permissions**:
  - `ManageOrgSessions` - Create and manage sessions
  - `ViewOrgSessions` - Retrieve session details
  - `UseDevinExpert` - For advanced mode sessions
  - `ImpersonateOrgSessions` - For `create_as_user_id` parameter

### Legacy v1/v2
- **Token Format**: `apk_user_*` (personal) or `apk_*` (service)
- **Header**: `Authorization: Bearer {token}`
- **Limitations**: No RBAC, personal keys tied to user account

**Decision**: Implement automatic API version detection based on token prefix.

---

## Core API Endpoints

### Create Session

**v3 Endpoint**: `POST /v3/organizations/{org_id}/sessions`

**Request Body**:
```json
{
  "prompt": "string (required) - Task description",
  "advanced_mode": "string|null - Mode: analyze|create|improve|batch|manage",
  "attachment_urls": ["string"]|null - URLs to attach",
  "bypass_approval": "boolean|null - Skip approval for batch mode",
  "create_as_user_id": "string|null - Impersonate another user",
  "knowledge_ids": ["string"]|null - Knowledge base IDs",
  "max_acu_limit": "integer|null - Resource limit",
  "playbook_id": "string|null - Existing playbook ID",
  "repos": [{"url": "string", "branch": "string"}]|null - Repository links",
  "secret_ids": ["string"]|null - Pre-existing secret IDs",
  "session_links": ["string"]|null - Session references",
  "structured_output_schema": "object|null - JSON validation schema",
  "tags": ["string"]|null - Session tags",
  "title": "string|null - Session title"
}
```

**Response (200)**:
```json
{
  "session_id": "string",
  "url": "string",
  "status": "string",
  "acus_consumed": "number",
  "created_at": "integer (timestamp)",
  "updated_at": "integer (timestamp)",
  "pull_requests": [{"pr_url": "string", "pr_state": "string|null"}],
  "user_id": "string|null",
  "playbook_id": "string|null"
}
```

**v1/v2 Endpoint**: `POST /v1/sessions` (simpler, fewer parameters)

---

### Get Session Details

**v3 Endpoint**: `GET /v3/organizations/{org_id}/sessions/{devin_id}`

**Response (200)**:
```json
{
  "session_id": "string",
  "url": "string",
  "status": "new|claimed|running|exit|error|suspended|resuming",
  "status_detail": "working|waiting_for_user|finished|etc|null",
  "tags": ["string"],
  "org_id": "string",
  "created_at": "integer (timestamp)",
  "updated_at": "integer (timestamp)",
  "acus_consumed": "number",
  "pull_requests": [{"pr_url": "string", "pr_state": "string|null"}],
  "title": "string|null",
  "user_id": "string|null",
  "parent_session_id": "string|null",
  "child_session_ids": ["string"]|null,
  "playbook_id": "string|null",
  "is_advanced": "boolean",
  "is_archived": "boolean",
  "structured_output": "object|null",
  "service_user_id": "string|null"
}
```

**v1/v2 Endpoint**: `GET /v1/sessions/{session_id}`

---

### List Sessions

**v3 Endpoint**: `GET /v3/organizations/{org_id}/sessions`

**Query Parameters**:
- `after`: String - cursor for pagination
- `first`: Integer (1-200, default: 100) - results per page
- `session_ids`: Array[string] - filter by specific IDs
- `created_after/before`: Integer - timestamp filters
- `updated_after/before`: Integer - timestamp filters
- `tags`: Array[string] - filter by tags
- `playbook_id`: String - filter by playbook
- `origins`: Array[enum] - filter by source (webapp, slack, etc.)
- `schedule_id`: String - filter by schedule
- `user_ids`: Array[string] - filter by users
- `service_user_ids`: Array[string] - filter by service users

---

## Session Status Values

| Status | Description |
|--------|-------------|
| `new` | Session just created |
| `claimed` | Session assigned to Devin |
| `running` | Devin actively working |
| `exit` | Session completed normally |
| `error` | Session failed with error |
| `suspended` | Session paused |
| `resuming` | Session resuming from suspend |

**Status Detail** (v3 only): Provides granular state like `working`, `waiting_for_user`, `finished`.

---

## Key Implementation Decisions

### 1. API Version Detection
**Decision**: Auto-detect API version from token prefix
- `cog_*` → v3 API
- `apk_*` → v1/v2 API

**Rationale**: Seamless user experience - no manual version selection needed.

### 2. Session Polling Strategy
**Decision**: Poll every 5-10 seconds for status updates

**Rationale**: Balance between real-time updates and API rate limits. Devin sessions are long-running (minutes to hours), so sub-second updates are unnecessary.

**Alternatives considered**:
- Webhooks: Not available in current API
- SSE/WebSocket: Not supported by Devin API

### 3. Repository Linking
**Decision**: Pass repository URL and branch in `repos` parameter for v3

**Rationale**: Ensures Devin works on correct codebase and branch as specified in spec requirements.

### 4. Error Handling
**Decision**: Implement exponential backoff retry for 5xx errors and network failures

**Rationale**: Matches spec requirement for "automatic retry with exponential backoff (max 3 attempts)".

### 5. Session Persistence
**Decision**: Store session metadata in VS Code workspace state

**Rationale**: Sessions must persist across VS Code restarts as per clarification. Workspace state is appropriate for branch-specific session tracking.

---

## API Limitations & Constraints

1. **No Real-time Updates**: API is poll-only, no webhooks or streaming
2. **Rate Limits**: Not documented, implement conservative polling (5-10s)
3. **ACU Limits**: Sessions can have `max_acu_limit` to control costs
4. **Organization Required**: v3 API requires `org_id` in all endpoints
5. **Permissions**: Service users need explicit permission grants

---

## Integration Architecture

```
VS Code Extension
├── DevinApiClient (abstracts v1/v2/v3 differences)
│   ├── detectApiVersion(token): "v1" | "v2" | "v3"
│   ├── createSession(params): Session
│   ├── getSession(sessionId): Session
│   └── listSessions(filters): Session[]
├── DevinSessionManager
│   ├── startTask(task, branch): Session
│   ├── pollStatus(sessionId): Status
│   └── cancelSession(sessionId): void
└── DevinProgressPanel (webview)
    ├── displaySession(session)
    └── updateStatus(status)
```

---

## References

- v3 API Docs: https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions
- v1 API Docs: https://docs.devin.ai/api-reference/v1/sessions/retrieve-details-about-an-existing-session
- Overview: https://docs.devin.ai/api-reference/overview
