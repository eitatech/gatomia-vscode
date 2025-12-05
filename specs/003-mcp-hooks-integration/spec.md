# Feature Specification: MCP Hooks Integration

**Feature Branch**: `003-mcp-hooks-integration`  
**Created**: 2025-12-05  
**Status**: Draft  
**Input**: User description: "MCP Support in Hooks, the user must be able to select any MCP server present in his configuration to configure as a hook action, the only need is the MCP Server configured and working with Copilot. The Hooks module must be able to load all configured MCPs and load actions for each MCP to provide the proper action to the hook configuration and to the user action."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and Select MCP Server Actions (Priority: P1)

Users want to configure hook actions using their existing MCP servers. When creating or editing a hook, users should be able to browse all MCP servers they have configured and working with Copilot, then select specific actions (tools) from those servers to use as the hook action.

**Why this priority**: This is the core capability that enables MCP integration with hooks. Without the ability to discover and select MCP server actions, no other MCP-related hook functionality is possible. This story delivers immediate value by exposing all available MCP capabilities within the hooks system.

**Independent Test**: Can be fully tested by opening the hook configuration, selecting "MCP Server Action" as the action type, verifying all configured MCP servers appear in a list, selecting one server, and confirming all available tools/actions from that server are displayed for selection.

**Acceptance Scenarios**:

1. **Given** the user is creating a new hook and has MCP servers configured with Copilot, **When** they select "MCP Server Action" as the action type, **Then** a list of all configured MCP servers is displayed
2. **Given** the user selects an MCP server from the list, **When** the server has available tools/actions, **Then** all actions from that server are displayed with their names and descriptions
3. **Given** the user selects an MCP server, **When** the server connection is healthy, **Then** the server status indicator shows "connected" or "available"
4. **Given** the user has no MCP servers configured, **When** they try to add an MCP action, **Then** a helpful message indicates no MCP servers are available and provides guidance on configuration

---

### User Story 2 - Configure MCP Action Parameters (Priority: P2)

Users need to configure parameters for their selected MCP actions. Each MCP tool may require different input parameters, and users should be able to provide static values or template variables that will be resolved when the hook executes.

**Why this priority**: After selecting an MCP action, users need to configure its parameters for it to work correctly. This enables practical use of MCP actions within hooks and builds directly on the P1 story.

**Independent Test**: Can be fully tested by selecting an MCP action that requires parameters (e.g., GitHub create issue requires repo, title, body), filling in the parameter form with both static values and template variables, saving the hook, and verifying the parameters are persisted correctly.

**Acceptance Scenarios**:

1. **Given** the user selects an MCP action, **When** the action has required parameters, **Then** a form displays all required parameters with appropriate input fields
2. **Given** an MCP action has optional parameters, **When** the user views the parameter form, **Then** optional parameters are clearly distinguished from required ones
3. **Given** a parameter field supports template variables, **When** the user enters a template expression, **Then** the system validates the syntax and shows available variables
4. **Given** the user has configured all required parameters, **When** they save the hook, **Then** the complete action configuration including parameters is persisted

---

### User Story 3 - Execute MCP Actions from Hooks (Priority: P3)

When a hook's trigger condition is met, the system must execute the configured MCP action with the resolved parameters and handle the response appropriately, providing feedback to the user about success or failure.

**Why this priority**: This is the runtime component that makes MCP hooks functional. Without execution capability, the configuration serves no purpose. It depends on P1 and P2 being complete.

**Independent Test**: Can be fully tested by creating a hook with an MCP action (e.g., "After SpecKit Specify → Create GitHub Issue"), triggering the condition, and verifying the MCP action executes successfully with the correct parameters and the result is communicated to the user.

**Acceptance Scenarios**:

1. **Given** a hook with an MCP action is triggered, **When** the MCP server is available, **Then** the action executes with the configured parameters
2. **Given** template variables are used in action parameters, **When** the hook executes, **Then** all template variables are resolved to actual values before calling the MCP action
3. **Given** the MCP action completes successfully, **When** the result is received, **Then** the user receives visual feedback confirming success
4. **Given** the MCP action fails, **When** the error is returned, **Then** the user receives a clear error message indicating what went wrong

---

### User Story 4 - Handle MCP Server Unavailability (Priority: P4)

Users need graceful handling when MCP servers become unavailable. The system should detect connection issues, inform users, and provide options for recovery without breaking the entire hooks system.

**Why this priority**: This is an important reliability feature but the basic flow works without it. Users can manually retry or check their MCP configuration. This is an enhancement for production readiness.

**Independent Test**: Can be fully tested by configuring a hook with an MCP action, disconnecting or stopping the MCP server, triggering the hook, and verifying the system gracefully handles the failure with appropriate error messaging and doesn't crash or hang.

**Acceptance Scenarios**:

1. **Given** an MCP server is unavailable, **When** the user browses available actions, **Then** the server shows an "unavailable" status and its actions are not selectable
2. **Given** a hook triggers with an unavailable MCP server, **When** the execution is attempted, **Then** the system fails gracefully with a clear error message
3. **Given** an MCP action execution times out, **When** the timeout period expires, **Then** the hook execution is marked as failed with a timeout error
4. **Given** the user has multiple MCP servers and one is unavailable, **When** browsing actions, **Then** other available servers and their actions remain accessible

---

### Edge Cases

- What happens when an MCP server's action schema changes after a hook is configured (e.g., required parameter added)?
- How does the system handle MCP actions that return large payloads or streams?
- What happens when an MCP action takes longer than expected (should there be a timeout)?
- How are MCP server credentials or authentication handled during hook execution?
- What happens when the same MCP action is configured in multiple hooks that trigger simultaneously?
- How does the system handle MCP actions that require user confirmation or interactive input?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST load and display all MCP servers configured in the user's VS Code/Copilot settings
- **FR-002**: System MUST query each available MCP server to retrieve its list of tools/actions
- **FR-003**: System MUST display MCP server connection status (available, unavailable, connecting) in the hook configuration UI
- **FR-004**: Users MUST be able to select an MCP server from a list when configuring a hook action
- **FR-005**: Users MUST be able to select a specific tool/action from the selected MCP server
- **FR-006**: System MUST display action descriptions and parameter schemas from the MCP server's tool definitions
- **FR-007**: System MUST generate appropriate input fields based on each action's parameter schema (string, number, boolean, object, array)
- **FR-008**: Users MUST be able to configure required parameters for the selected MCP action
- **FR-009**: System MUST validate that all required parameters are provided before allowing hook save
- **FR-010**: System MUST support template variables in action parameters that are resolved at execution time
- **FR-011**: System MUST execute the configured MCP action when the hook's trigger condition is met
- **FR-012**: System MUST resolve template variables to actual values before invoking the MCP action
- **FR-013**: System MUST handle MCP action responses and provide appropriate feedback to users
- **FR-014**: System MUST handle MCP server unavailability gracefully without crashing
- **FR-015**: System MUST persist MCP action configurations as part of the hook configuration
- **FR-016**: System MUST refresh the list of available MCP servers when requested by the user
- **FR-017**: System MUST display a helpful message when no MCP servers are configured
- **FR-018**: System MUST timeout MCP action executions that exceed a configurable duration (default: 30 seconds)
- **FR-019**: System MUST log MCP action executions in the hook execution history
- **FR-020**: System MUST respect MCP server authentication requirements during action execution

### Key Entities

- **MCP Server**: Represents a configured Model Context Protocol server with its identifier, name, connection status, and list of available tools
- **MCP Tool/Action**: Represents a single action available from an MCP server including its name, description, and input schema defining required and optional parameters
- **MCP Action Configuration**: The hook action configuration that includes the selected MCP server identifier, tool name, and parameter values (static or template)
- **MCP Parameter Value**: A configured value for an MCP action parameter, which can be a literal value or a template expression to be resolved at execution time
- **MCP Execution Result**: The outcome of executing an MCP action including success/failure status, response data, error details, and execution duration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can browse and select from all configured MCP servers within 3 seconds of opening the action selector
- **SC-002**: All available actions from a selected MCP server are displayed within 2 seconds
- **SC-003**: Users can configure an MCP action with parameters in under 90 seconds
- **SC-004**: 95% of MCP action executions complete within the configured timeout period
- **SC-005**: When an MCP server is unavailable, users receive clear status indication within 5 seconds
- **SC-006**: MCP action configurations persist correctly across extension restarts 100% of the time
- **SC-007**: Users can successfully execute at least 3 different types of MCP actions (e.g., GitHub issue creation, file operations, custom tool) through hooks
- **SC-008**: 80% of users can configure their first MCP-based hook without external documentation
- **SC-009**: Failed MCP action executions provide actionable error messages in 100% of cases
- **SC-010**: MCP action execution history is viewable and shows all relevant details (server, action, parameters, result, duration)

## Assumptions

- Users have already configured MCP servers and verified they work with GitHub Copilot before attempting to use them in hooks
- MCP servers follow the standard Model Context Protocol specification for tool discovery and invocation
- The extension has access to VS Code's MCP configuration or can query Copilot's available MCP servers
- MCP servers provide schema information for their tools that can be used to generate parameter input forms
- MCP action execution runs in the same security context as normal Copilot MCP interactions
- Template variable syntax will be consistent with other hook action configurations in the Hooks module
- MCP servers may have authentication requirements that are already configured in VS Code/Copilot settings
- The default timeout of 30 seconds is reasonable for most MCP operations; long-running operations are exceptional
- MCP server availability can change during the extension session (servers can start/stop)
- The system will not cache MCP action results; each execution calls the MCP server fresh
