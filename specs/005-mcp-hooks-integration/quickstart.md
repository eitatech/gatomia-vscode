# Quickstart Guide: MCP Server Integration for Hooks

**Feature**: 005-mcp-hooks-integration  
**Audience**: Users and Developers  
**Last Updated**: December 5, 2025

## Overview

This guide shows you how to use MCP (Model Context Protocol) servers with the Hooks module to automate workflows by connecting hook events to any MCP-enabled tools in your GitHub Copilot environment.

## Prerequisites

- VS Code with GitHub Copilot installed and configured
- At least one MCP server configured in Copilot (e.g., GitHub MCP, Slack MCP)
- Gatomia VS Code Extension installed

## Quick Start

### 1. Verify MCP Servers Are Available

1. Open Command Palette (`Cmd/Ctrl+Shift+P`)
2. Type "Open MCP Config"
3. Verify your `mcp.json` contains configured servers

Example `mcp.json`:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"]
    }
  }
}
```

### 2. Create a Hook with MCP Action

1. Open the **Gatomia: Hooks** view in the Activity Bar
2. Click **"+ Create Hook"**
3. Fill in hook details:
   - **Name**: "Create GitHub Issue After Spec"
   - **Trigger**: SpecKit → specify → after
4. Under **Action**, select **"MCP Tool"**
5. A searchable tree view appears showing your MCP servers
6. Expand the **"GitHub MCP"** server node
7. Select the **"create_issue"** tool
8. The system automatically maps available parameters:
   - `repository` ← from current git remote
   - `title` ← template: `"New spec: {{feature}}"`
   - `body` ← template: `"Created from branch {{branch}} on {{timestamp}}"`
9. Click **Save**

### 3. Test the Hook

1. Run `/speckit.specify` command in Copilot Chat
2. Complete the specification workflow
3. When specification is saved, the hook triggers automatically
4. Check GitHub for the newly created issue
5. View execution log in **Hooks** view → **Execution Logs**

## Common Use Cases

### Auto-Create GitHub Issues After Planning

**Scenario**: Automatically create a tracking issue when you generate an implementation plan.

**Configuration**:
- **Trigger**: SpecKit → plan → after
- **Action**: MCP Tool → GitHub MCP → create_issue
- **Parameters**:
  - `title`: `"Implement: {{feature}}"`
  - `body`: `"Implementation plan ready on {{branch}}"`

---

### Notify Slack After Task Completion

**Scenario**: Send a Slack notification when tasks are generated.

**Configuration**:
- **Trigger**: SpecKit → tasks → after
- **Action**: MCP Tool → Slack MCP → send_message
- **Parameters**:
  - `channel`: `"#dev-updates"` (literal)
  - `text`: `"Tasks generated for {{feature}}"` (template)

---

### Update Project Management Tool

**Scenario**: Update a project management tool (Linear, Jira) when implementation is complete.

**Configuration**:
- **Trigger**: SpecKit → implementation → after
- **Action**: MCP Tool → Linear MCP → update_issue
- **Parameters**:
  - `issueId`: `"DEV-123"` (literal)
  - `status`: `"In Review"` (literal)

---

## Parameter Mapping

### Automatic Name-Based Mapping

The system automatically matches parameter names between your hook context and the MCP tool's requirements.

**Available Context Variables**:
- `{{feature}}` - Current feature name (e.g., "mcp-hooks-integration")
- `{{branch}}` - Current git branch (e.g., "005-mcp-hooks-integration")
- `{{timestamp}}` - ISO 8601 timestamp (e.g., "2025-12-05T18:30:00Z")
- `{{user}}` - Git user name from config

**Mapping Types**:
1. **Context**: Use value from hook context (e.g., `{{feature}}`)
2. **Literal**: Use fixed string value (e.g., `"#dev-updates"`)
3. **Template**: Mix context variables with text (e.g., `"Issue for {{feature}} on {{branch}}"`)

**Example**: GitHub's `create_issue` tool expects:
- `repository` (string) → Auto-mapped from current git remote
- `title` (string) → Template: `"Spec: {{feature}}"`
- `body` (string, optional) → Template: `"Branch: {{branch}}"`

---

## Advanced Features

### Custom Timeout

Override the default 30-second timeout for long-running MCP tools:

1. In hook configuration, expand **Advanced Settings**
2. Set **Timeout**: `60000` (60 seconds in milliseconds)
3. Valid range: 1,000 - 300,000 ms (1 second - 5 minutes)

### Concurrency Control

The system limits concurrent MCP executions to 5 by default. If multiple hooks trigger simultaneously:
- First 5 execute immediately
- Remaining hooks queue and wait for capacity
- No configuration needed - automatic

### Error Handling

**If an MCP server is unavailable**:
- Hook marks action as "skipped" (doesn't fail)
- Error logged to Execution Logs
- Visual indicator in UI shows server status
- Hook configuration preserved for when server returns

**Viewing Errors**:
1. Open **Gatomia: Hooks** view
2. Expand **Execution Logs**
3. Click on failed execution
4. View error details and suggestions

---

## Troubleshooting

### MCP Server Not Showing Up

**Problem**: Your MCP server doesn't appear in the action picker.

**Solutions**:
1. Verify server is in `mcp.json` and Copilot recognizes it
2. Restart VS Code to refresh MCP configuration
3. Click **Refresh** button in MCP action picker
4. Check Copilot output channel for MCP errors
5. Cache is refreshed every 5 minutes - wait or manually refresh

### Tool Execution Fails

**Problem**: MCP tool execution fails with timeout or error.

**Solutions**:
1. Check tool requires no authentication (or auth is configured)
2. Increase timeout in Advanced Settings (default: 30s, max: 5 minutes)
3. Verify parameter values are correct (check Execution Logs)
4. Test tool manually via Copilot Chat to isolate issue
5. System automatically retries transient failures once (2s delay)

### Parameters Not Mapping

**Problem**: Required parameters show as missing.

**Solutions**:
1. Verify parameter names match tool's input schema exactly
2. Use template expansion for dynamic values: `{{feature}}`
3. Use literal values for fixed strings: `"production"`
4. Check Execution Logs for actual values being sent
5. Review parameter validation errors in hook configuration

### Server Becomes Unavailable

**Problem**: Previously working MCP server shows as unavailable.

**Solutions**:
1. Check if MCP server process is running
2. Verify network connectivity if server is remote
3. System will gracefully skip execution and log error
4. Hook configuration is preserved automatically
5. Visual indicator (gray badge) shows unavailable servers
6. Use "Update Hook" action in error notification to reconfigure

### Hook Execution Skipped

**Problem**: Hook shows "skipped" status in execution logs.

**Reasons**:
1. Hook is disabled in configuration
2. MCP server is unavailable (temporary)
3. MCP tool not found on server
4. Pre-execution validation failed
5. Hook references invalid server/tool

**Solutions**:
1. Re-enable hook if accidentally disabled
2. Wait for server to become available (auto-retry on next trigger)
3. Update hook configuration with correct tool name
4. Click "Update Hook" in error notification to fix references
5. Use "Remove Hook" if no longer needed

### Large Output Truncation

**Problem**: MCP tool output is truncated in execution logs.

**Explanation**: System automatically truncates output >1MB to prevent memory issues.

**Solutions**:
1. This is normal behavior for large responses
2. Full output is still sent to MCP tool (truncation is for display only)
3. Check tool documentation for pagination options
4. Consider filtering output at tool level if possible

### Performance Issues

**Problem**: Multiple hooks executing slowly.

**Explanation**: System limits concurrent executions to 5 (prevents overwhelming MCP servers).

**Solutions**:
1. This is expected behavior - hooks queue automatically
2. No action needed - queued hooks execute when capacity available
3. Review execution logs to understand queue depth
4. Consider consolidating similar hooks to reduce load
5. Increase timeout if tools need more processing time

---

## Best Practices

### 1. Start Simple

Begin with single-action hooks (e.g., "create issue after plan") before chaining multiple hooks.

### 2. Use Descriptive Names

Name hooks clearly to understand what they do:
- ✅ "Create GitHub Issue After Spec"
- ❌ "Hook 1"

### 3. Test with Manual Triggers

Before relying on automatic triggers, test hooks manually using the "Execute Now" button.

### 4. Monitor Execution Logs

Regularly check execution logs to catch errors early and understand hook behavior.

### 5. Handle Unavailable Servers

Design your workflow to be resilient:
- Use optional MCP actions for nice-to-have notifications
- Keep critical actions (git commit) separate from MCP actions
- Review hook status indicators regularly

---

## Example: Complete Workflow

**Goal**: Automate spec-to-implementation workflow with GitHub integration.

**Hooks Configuration**:

1. **Hook: "GitHub Issue After Spec"**
   - Trigger: SpecKit → specify → after
   - Action: GitHub MCP → create_issue
   - Parameters:
     - `title`: `"Spec: {{feature}}"`
     - `labels`: `["spec", "ready-for-planning"]`

2. **Hook: "GitHub Issue After Plan"**
   - Trigger: SpecKit → plan → after
   - Action: GitHub MCP → update_issue
   - Parameters:
     - `issueNumber`: (from previous issue)
     - `labels`: `["spec", "planned", "ready-for-tasks"]`

3. **Hook: "GitHub Issue After Tasks"**
   - Trigger: SpecKit → tasks → after
   - Action: GitHub MCP → add_comment
   - Parameters:
     - `issueNumber`: (from original issue)
     - `body`: `"Tasks generated: {{branch}}/tasks.md"`

---

## Developer Guide

### Testing MCP Integration

**Unit Tests**:
```typescript
// tests/unit/features/hooks/actions/mcp-action.test.ts
describe("MCPActionExecutor", () => {
  it("should execute tool with resolved parameters", async () => {
    const executor = new MCPActionExecutor(mockServices);
    const result = await executor.execute(params, context);
    expect(result.success).toBe(true);
  });
});
```

**Integration Tests**:
```typescript
// tests/integration/mcp-hooks-integration.test.ts
describe("MCP Hooks Integration", () => {
  it("should create GitHub issue when spec completes", async () => {
    await triggerHook("speckit", "specify");
    expect(mockGitHubClient.createIssue).toHaveBeenCalled();
  });
});
```

### Adding New MCP Servers

MCP servers are automatically discovered from Copilot configuration. No code changes needed to support new servers!

---

## Reference

### MCP Action Parameters Schema

```typescript
{
  serverId: string;        // MCP server identifier
  toolName: string;        // Tool to execute
  parameterMappings: [     // How to map parameters
    {
      toolParam: string;   // Parameter name in tool schema
      source: "context" | "literal" | "template";
      value: string;       // Template or literal value
    }
  ];
  timeout?: number;        // Optional timeout override
}
```

### Supported Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{feature}}` | Current feature name | "mcp-hooks-integration" |
| `{{branch}}` | Current git branch | "005-mcp-hooks-integration" |
| `{{timestamp}}` | ISO 8601 timestamp | "2025-12-05T18:30:00Z" |
| `{{user}}` | Git user name | "John Doe" |

---

## Getting Help

- **Documentation**: See [hooks module docs](../../docs/hooks.md)
- **Issues**: Report bugs on GitHub
- **Community**: Join our Discord for questions

---

**Last Updated**: December 5, 2025  
**Version**: 1.0.0 (Initial Release)
