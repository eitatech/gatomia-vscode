# Feature Specification: Custom Agent Hooks Refactoring

**Feature Branch**: `011-custom-agent-hooks`  
**Created**: 2026-01-26  
**Status**: Draft  
**Input**: User description: "we need to reafactory hooks mechanism for custom agents, all custom agents must be loaded in the agent name field as a select input, it could be loaded from the `.github/agents/*.agent.md` or from extensions which have agents registered, The use also can choose if it's a Local agent, like those i described, or it could be background agents, like Open AI Codex CLI, Gemini CLI, GitHub Copilot CLI, Claude Code, and as described in the documentation: https://code.visualstudio.com/docs/copilot/agents/overview in the arguments user must be able to send some information details related with the output from the trigger operation."

## Clarifications

### Session 2026-01-26

- Q: When a user tries to trigger a hook but the configured agent is unavailable at runtime, what should happen? → A: Show error notification but allow retry, log failure for diagnostics
- Q: How should the system identify and display agents when multiple agents share the same display name? → A: Append source indicator to display name (e.g., "Agent Name (Local)" vs "Agent Name (Extension)")
- Q: When a template variable references unavailable data, what default value should be used? → A: Replace with empty string (no characters)
- Q: When should the agent list refresh occur? → A: Automatic real-time refresh when files/extensions change
- Q: What hook execution events should be logged for operational visibility? → A: Log execution start, completion, failures, and agent unavailability

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select Custom Agent from Dropdown (Priority: P1)

As a developer configuring a hook, I need to select a custom agent from a dropdown list so that I can route hook triggers to the appropriate AI agent without manually typing agent names or paths.

**Why this priority**: This is the core interaction point for the refactored hooks system. Without agent selection, users cannot configure hooks to use custom agents, making this the foundational capability that all other features depend on.

**Independent Test**: Can be fully tested by opening the hooks configuration UI, clicking the agent name field, and verifying that a dropdown appears showing all available agents (both local file-based agents and registered extension agents). Delivers immediate value by eliminating manual agent name entry errors.

**Acceptance Scenarios**:

1. **Given** I am creating a new hook, **When** I click on the "Agent Name" field, **Then** I see a dropdown list showing all available agents organized by source (Local Agents and Background Agents)
2. **Given** the agent dropdown is open, **When** I select an agent from the list, **Then** the selected agent name is populated in the field and the hook is configured to use that agent
3. **Given** multiple `.agent.md` files exist in `.github/agents/`, **When** I open the agent dropdown, **Then** I see all agents from those files listed under "Local Agents"
4. **Given** extensions have registered agents, **When** I open the agent dropdown, **Then** I see those agents listed under "Background Agents"

---

### User Story 2 - Choose Agent Type (Local vs Background) (Priority: P2)

As a developer configuring a hook, I need to specify whether my selected agent is a Local agent or a Background agent so that the system knows how to invoke and communicate with the agent appropriately.

**Why this priority**: While agent selection (P1) allows choosing agents, this feature ensures the system handles different agent types correctly. It's P2 because basic agent selection can work with default type handling, but explicit type selection improves reliability and user control.

**Independent Test**: Can be tested independently by configuring a hook with a Local agent (from `.github/agents/`), verifying it executes locally, then switching to a Background agent (like GitHub Copilot CLI) and verifying it invokes the external CLI tool.

**Acceptance Scenarios**:

1. **Given** I have selected an agent from `.github/agents/*.agent.md`, **When** I view the agent type, **Then** it is automatically marked as "Local Agent"
2. **Given** I have selected an agent like "GitHub Copilot CLI" from the dropdown, **When** I view the agent type, **Then** it is automatically marked as "Background Agent"
3. **Given** I want to manually override the agent type, **When** I click the agent type selector, **Then** I can choose between "Local Agent" and "Background Agent" options
4. **Given** I have selected "Local Agent" type, **When** the hook triggers, **Then** the system loads and executes the agent definition from the local `.agent.md` file
5. **Given** I have selected "Background Agent" type, **When** the hook triggers, **Then** the system invokes the external CLI tool or registered extension agent

---

### User Story 3 - Pass Trigger Context to Agent Arguments (Priority: P1)

As a developer configuring a hook, I need to define arguments that include information from the trigger operation output so that the agent receives relevant context about what triggered the hook and can act appropriately.

**Why this priority**: This is P1 alongside agent selection because hooks are event-driven and meaningless without context. An agent that doesn't know what triggered it or what data is available cannot perform useful actions, making this critical to any functional hook.

**Independent Test**: Can be tested independently by creating a hook with a simple trigger (e.g., file save), configuring arguments to include `{triggerEvent}` and `{filePath}`, then triggering the hook and verifying the agent receives the correct values.

**Acceptance Scenarios**:

1. **Given** I am configuring hook arguments, **When** I type in the arguments field, **Then** I can use template variables like `{triggerEvent}`, `{triggerOutput}`, `{timestamp}` to reference trigger operation data
2. **Given** I have configured arguments with template variables, **When** the hook triggers, **Then** the template variables are replaced with actual values from the trigger operation before being sent to the agent
3. **Given** a hook is triggered by a spec status change, **When** the agent receives arguments, **Then** it includes details like `{specId}`, `{oldStatus}`, `{newStatus}`, and `{changeAuthor}`
4. **Given** I want to pass custom static arguments, **When** I configure the arguments field, **Then** I can mix static text with dynamic template variables (e.g., "Review spec {specId} changed to {newStatus}")

---

### User Story 4 - Discover Agents from Extension Registry (Priority: P3)

As a developer, I want agents registered by installed VS Code extensions to automatically appear in the agent dropdown so that I can leverage third-party agents without manual configuration.

**Why this priority**: This is P3 because it's a convenience feature that enhances extensibility. The core functionality works with local agents (P1) and manually configured background agents. Extension-registered agents improve the ecosystem but aren't required for MVP.

**Independent Test**: Can be tested independently by installing a VS Code extension that registers an agent, opening the hooks configuration, and verifying the registered agent appears in the dropdown under "Background Agents" without requiring any manual setup.

**Acceptance Scenarios**:

1. **Given** an extension has registered an agent using the VS Code extension API, **When** I open the agent dropdown, **Then** I see the registered agent listed with its display name and description
2. **Given** multiple extensions have registered agents, **When** I open the agent dropdown, **Then** I see all registered agents grouped together under "Background Agents"
3. **Given** an extension is uninstalled, **When** I open the agent dropdown, **Then** agents from that extension no longer appear in the list

---

### Edge Cases

- What happens when a selected agent file (`.agent.md`) is deleted or moved after the hook is configured?
- When an agent is unavailable at runtime (e.g., background CLI tool not installed), the system displays an error notification to the user with details about the unavailable agent, allows the user to retry the hook execution manually, and logs the failure with full diagnostic information including agent identifier, trigger context, and timestamp
- When two agents have the same display name but are from different sources, the system appends a source indicator to the display name in the dropdown (e.g., "Agent Name (Local)" for `.github/agents/` files vs "Agent Name (Extension)" for extension-registered agents) to ensure users can distinguish and select the correct agent
- How does the system behave when the `.github/agents/` directory doesn't exist or is empty?
- When template variables in arguments reference data that isn't available for a particular trigger type, the system replaces those variables with an empty string (no characters), allowing the argument string to remain valid while letting agents handle missing data gracefully
- How does the system handle extremely long argument strings or special characters in trigger output data?
- What happens when an extension registers an agent with invalid or missing metadata?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST scan the `.github/agents/` directory for all files matching the pattern `*.agent.md` and load them as available Local Agents
- **FR-002**: System MUST provide a dropdown selector UI component for the "Agent Name" field that displays all available agents grouped by type (Local Agents and Background Agents), and when multiple agents share the same display name, MUST append source indicators (e.g., "(Local)" or "(Extension)") to disambiguate them
- **FR-003**: System MUST automatically detect the agent type based on the agent source (local file = Local Agent, CLI/extension = Background Agent)
- **FR-004**: Users MUST be able to manually override the detected agent type by selecting from "Local Agent" or "Background Agent" options
- **FR-005**: System MUST support template variables in the arguments field that reference trigger operation data (e.g., `{triggerEvent}`, `{triggerOutput}`, `{specId}`, `{timestamp}`)
- **FR-006**: System MUST replace template variables with actual values from the trigger operation context before passing arguments to the agent
- **FR-007**: System MUST discover and list available Background Agents (examples include OpenAI Codex CLI, Gemini CLI, GitHub Copilot CLI, and Claude Code) based on installed VS Code extensions and user configuration
- **FR-008**: System MUST query the VS Code extension API to discover agents registered by installed extensions
- **FR-009**: System MUST display extension-registered agents in the dropdown with their provided display name and description
- **FR-010**: System MUST handle missing or deleted agent files gracefully by showing an error notification with details about the unavailable agent when a configured hook references it, allowing users to retry execution, and logging all failures with diagnostic information
- **FR-011**: System MUST validate that the selected agent is available and accessible before allowing the hook to be saved
- **FR-012**: System MUST support both static text and dynamic template variables in the same arguments field
- **FR-013**: System MUST replace template variables that reference unavailable data with an empty string (no characters), allowing agents to receive valid argument strings even when some trigger context data is missing
- **FR-014**: System MUST automatically refresh the agent list in real-time when files in `.github/agents/` change (added, modified, deleted) or when extensions are installed/uninstalled, ensuring the dropdown always displays current available agents without requiring manual user refresh
- **FR-015**: System MUST log hook execution events including: execution start (with hook ID, agent identifier, and trigger type), successful completion (with execution duration), failures (with error details and stack trace), and agent unavailability incidents (with agent identifier and diagnostic information)

### Key Entities

- **Custom Agent**: Represents an AI agent that can receive hook triggers. Includes properties: name, type (Local or Background), source (file path or extension ID), description, configuration schema, and unique identifier formed by combining display name with source type
- **Hook Configuration**: Represents the configuration of a hook, including: trigger type, selected agent reference, agent type override, and argument template string.
- **Trigger Context**: Represents the runtime data available when a hook is triggered, including: event name, timestamp, affected resources (files, specs, etc.), and output data from the triggering operation.
- **Agent Registry Entry**: Represents an agent registered by a VS Code extension, including: display name, unique identifier, description, and invocation endpoint or command.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure a hook with an agent selection in under 30 seconds without needing to reference documentation
- **SC-002**: 100% of agents from `.github/agents/*.agent.md` files appear in the dropdown within 2 seconds of opening the hooks configuration UI
- **SC-003**: Template variable replacement occurs without errors for all standard trigger types (spec changes, file saves, MCP events)
- **SC-004**: Users successfully configure hooks that pass trigger context to agents on first attempt without trial and error
- **SC-005**: Zero hooks fail due to agent unavailability errors that could have been detected during configuration (validation prevents saves)
- **SC-006**: Extension-registered agents appear in the dropdown within 5 seconds of extension installation through automatic real-time refresh without requiring manual UI refresh or user intervention
- **SC-007**: All hook execution events (start, completion, failures, agent unavailability) are logged with sufficient diagnostic information to support troubleshooting and monitoring

## Assumptions

- The `.github/agents/` directory structure is already defined and documented
- Agent markdown file format (`.agent.md`) has a consistent schema that can be parsed
- Background agent CLIs (OpenAI Codex, Gemini, GitHub Copilot, Claude Code) follow standard invocation patterns or are accessible via documented VS Code APIs
- VS Code Extension API provides a mechanism for extensions to register agents (either existing API or will be added)
- Template variable syntax uses curly braces (e.g., `{variableName}`) and follows consistent naming conventions
- Trigger operations provide structured output data that can be accessed via well-defined keys
- Users have basic familiarity with hooks and agent concepts from existing system documentation

## Dependencies

- VS Code Extension API for agent discovery from registered extensions
- File system watcher for monitoring changes to `.github/agents/` directory
- Existing hooks infrastructure that defines trigger types and execution flow
- Agent invocation layer that can route requests to both local and background agents
- Template parsing library or utility for variable replacement in argument strings

## Out of Scope

- Creating or editing `.agent.md` files (users must create these files manually or via separate tooling)
- Installing or managing background agent CLI tools (users must install OpenAI Codex CLI, etc. separately)
- Agent response handling or result formatting (this spec focuses on selection and invocation only)
- Agent authentication or credential management for background agents
- Multi-agent workflows or chaining multiple agents in a single hook
- Agent version management or compatibility checking
- Custom agent type definitions beyond Local and Background
