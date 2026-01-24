# Feature Specification: Copilot Agents Integration

**Feature Branch**: `010-copilot-agents`  
**Created**: January 23, 2026  
**Updated**: January 24, 2026  
**Status**: Draft  
**Input**: User description: "Include AI agent capabilities in extension to work with GitHub Copilot Chat using agents, prompts, skills, instructions, scripts in resources/ directory"

## Clarifications

### Session 2026-01-24 - CRITICAL CORRECTION

**IMPORTANT**: This feature is NOT about creating new agents (like a CodeWiki agent). The agents and tools already exist. This feature is about **mapping and implementing the integration** of existing GitHub Copilot agents and their tools within the VS Code extension.

**Scope**:
- Map existing agents from `resources/agents/` to VS Code chat participants
- Implement tool execution handlers for existing agent tools
- Integrate existing prompts, skills, and instructions from `resources/` directory
- Enable existing agents to work seamlessly within VS Code environment

### Session 2026-01-23

- Q: What is the expected behavior when GitHub Copilot Chat is not available or not enabled in the user's VS Code installation? → A: Show friendly error message with link to install/enable Copilot Chat
- Q: How should the system handle agent resource updates (prompts, skills, instructions) after the extension is already activated? → A: Detect changes and reload agents automatically using file watchers
- Q: What format do agent definition files use? → A: Markdown files with YAML frontmatter containing agent metadata and commands
- Q: How are tools discovered and invoked when an agent command is called? → A: Tools are registered in VS Code extension and agents reference them by name
- Q: How should the system parse and pass parameters from agent commands to tool handlers? → A: Free-text string passed to tool handler for custom parsing
- Q: How should resources (prompts, skills, instructions) be loaded and provided to tool handlers during execution? → A: Resources loaded on extension activation and cached in memory
- Q: What format should tool handlers return to display results to the user? → A: Structured object with markdown content and optional file references

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover Registered Agents (Priority: P1)

As a developer, when I install the GatomIA extension, I want to immediately see all registered agents available in GitHub Copilot Chat so I can use them to interact with my project's specifications and workflows.

**Why this priority**: This is the entry point for all agent functionality. Without discoverability, users cannot access any agent capabilities.

**Independent Test**: Can be fully tested by installing the extension, opening GitHub Copilot Chat, and verifying that all registered agents appear in the chat participants list with their descriptions.

**Acceptance Scenarios**:

1. **Given** GatomIA extension is installed, **When** I open GitHub Copilot Chat (Ctrl+Shift+I), **Then** I see all registered agents (e.g., @speckit, @task-planner) in the chat participants dropdown
2. **Given** I view the agents list in Copilot Chat, **When** I hover over any registered agent, **Then** I see a tooltip describing its purpose
3. **Given** I type `@` in Copilot Chat, **When** I start typing an agent name, **Then** matching agents appear in the autocomplete suggestions
4. **Given** agents are defined in `resources/agents/`, **When** extension activates, **Then** all valid agent definitions are registered as chat participants

---

### User Story 2 - Execute Agent Commands (Priority: P1)

As a developer, I want to invoke agent commands through GitHub Copilot Chat so that agents can perform their intended operations using their existing tools.

**Why this priority**: Core functionality that enables users to actually use the agents. This is the primary value proposition of the integration.

**Independent Test**: Can be fully tested by typing an agent command in Copilot Chat and verifying the agent executes the correct tool and returns results.

**Acceptance Scenarios**:

1. **Given** I'm in Copilot Chat, **When** I type `@speckit /specify <feature-description>`, **Then** the agent executes the corresponding registered tool handler and creates a feature specification
2. **Given** I've invoked an agent command, **When** the tool is processing, **Then** I see a progress indicator showing what operation is being performed
3. **Given** a tool execution completes successfully, **When** I view the results, **Then** I see markdown-formatted content with links to files created or modified
4. **Given** I type `@agent /`, **When** I wait for autocomplete, **Then** I see all available commands defined in the agent's markdown file with descriptions

---

### User Story 3 - Access Agent Resources (Priority: P1)

As a developer, I want agents to automatically load their prompts, skills, and instructions from the `resources/` directory so they have the proper context and behavior when executing commands.

**Why this priority**: Essential for agents to function correctly. Without proper resources, agents cannot perform their tasks according to their defined behavior.

**Independent Test**: Can be fully tested by invoking an agent command that requires specific prompts/skills and verifying the agent uses the correct resources from the directory.

**Acceptance Scenarios**:

1. **Given** prompts exist in `resources/prompts/`, **When** an agent is invoked, **Then** the agent has access to cached prompts loaded on extension activation
2. **Given** skills exist in `resources/skills/`, **When** an agent needs domain knowledge, **Then** the agent can reference cached skill content from memory
3. **Given** instructions exist in `resources/instructions/`, **When** an agent is activated, **Then** the agent follows behavior from cached instructions loaded on startup
4. **Given** agent resources are modified, **When** file changes are saved, **Then** the system automatically reloads and re-caches the affected resources without requiring VS Code restart

---

### User Story 4 - Handle Tool Execution Errors (Priority: P1)

As a developer, I want clear error messages when agent tool executions fail so I can understand what went wrong and how to fix it.

**Why this priority**: Essential for usability. Without clear error handling, users will be frustrated and unable to diagnose issues.

**Independent Test**: Can be fully tested by deliberately triggering tool failures (invalid inputs, missing files, etc.) and verifying error messages are clear and actionable.

**Acceptance Scenarios**:

1. **Given** an agent command fails due to invalid input, **When** the error occurs, **Then** I see a clear message explaining what was invalid and how to correct it
2. **Given** a required resource file is missing, **When** an agent tries to use it, **Then** I see an error message identifying the missing file and its expected location
3. **Given** GitHub Copilot Chat is not enabled, **When** I try to use an agent, **Then** I see a friendly message with instructions to install/enable Copilot Chat
4. **Given** a tool execution times out or crashes, **When** the failure occurs, **Then** the system logs the error details and shows a user-friendly message

---

### User Story 5 - View Agent Documentation (Priority: P2)

As a developer, I want to easily access documentation about available agents and their commands so I can learn how to use them effectively without leaving VS Code.

**Why this priority**: Enhances usability but agents remain functional without it. Users can learn through trial and error or external docs.

**Independent Test**: Can be fully tested by invoking help commands and verifying comprehensive documentation is displayed inline.

**Acceptance Scenarios**:

1. **Given** I'm in Copilot Chat, **When** I type `@agent /help`, **Then** I see a list of all available commands for that agent with brief descriptions
2. **Given** I type `@agent /help <command>`, **When** the command executes, **Then** I see detailed documentation about that specific command including examples
3. **Given** I hover over an agent in the participants list, **When** the tooltip appears, **Then** I see a summary of what the agent does

---

### User Story 6 - Configure Agent Behavior (Priority: P3)

As a developer, I want to customize agent behavior through extension settings so I can tailor agents to my project's specific needs.

**Why this priority**: Advanced feature for power users. Default configurations should work well for most cases.

**Independent Test**: Can be fully tested by changing agent configuration settings, invoking agents, and verifying the new settings are applied.

**Acceptance Scenarios**:

1. **Given** I navigate to extension settings, **When** I find the "Agents" section, **Then** I can configure options like resource paths, timeout values, and default behaviors
2. **Given** I've modified an agent setting, **When** I save the change and invoke the agent, **Then** the agent uses my updated configuration
3. **Given** I specify a custom resources path, **When** the extension activates, **Then** agents load resources from the configured path

---

### Edge Cases

- What happens when an agent definition file is malformed or has syntax errors? (System logs warning, skips that agent, continues loading others)
- How does the system handle when a required tool for an agent command is not available? (System shows error message indicating missing tool and suggests installation steps)
- What happens when multiple agent definitions have the same ID? (System prevents name collision, loads first valid definition, logs warning about duplicates)
- How does the system handle very long-running tool executions? (System shows progress updates and allows cancellation)
- What happens when GitHub Copilot Chat is not available or not enabled? (System shows friendly error message with link to install/enable Copilot Chat, prevents agent command execution until dependency is met)
- How does the system handle when agent resources directory doesn't exist? (System creates default structure with built-in resources on first activation)
- What happens when a user tries to execute an agent command with missing required parameters? (System prompts for missing parameters or shows usage example)
- How does the system handle concurrent tool executions from multiple agent commands? (System queues executions or runs in parallel depending on tool type and resource constraints)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Extension MUST register chat participants for all valid agent definitions found in `resources/agents/` directory
- **FR-002**: Extension MUST define chat participant metadata including unique ID, display name, full name, and description from agent definition files
- **FR-003**: Extension MUST organize agent resources (prompts, skills, instructions, scripts) in the `resources/` directory with clear subdirectory structure
- **FR-004**: Extension MUST support command-based agent invocation through GitHub Copilot Chat by mapping commands to tool execution handlers
- **FR-005**: System MUST provide clear command descriptions from agent definitions that appear in autocomplete suggestions
- **FR-006**: Extension MUST automatically discover and load agent definitions from `resources/agents/` directory on activation
- **FR-007**: System MUST handle missing or malformed agent definition files gracefully without crashing. **Graceful handling means**: (1) Log warning with file path and error details to extension output channel, (2) Skip the malformed agent and continue loading other agents, (3) Do NOT show user-facing notification unless all agents fail to load, (4) Extension activation MUST NOT fail due to single malformed agent
- **FR-008**: Extension MUST implement tool execution handlers that map agent commands to their corresponding tool implementations
- **FR-009**: System MUST load and cache all agent resources (prompts from `resources/prompts/`, skills from `resources/skills/`, instructions from `resources/instructions/`) in memory on extension activation, and provide them to tool handlers during execution via the `AgentResources` interface
- **FR-010**: Extension MUST validate agent definitions on load and log warnings for invalid configurations
- **FR-011**: System MUST support tool executions that can create, modify, or read workspace files
- **FR-012**: Extension MUST provide tool execution feedback in Copilot Chat with status updates and results
- **FR-013**: System MUST support configuration setting for custom agents path (default: `resources/agents`)
- **FR-014**: Extension MUST make skill definitions from `resources/skills/` available to agents during tool execution
- **FR-015**: *(Covered by FR-009)* System MUST make instruction files from `resources/instructions/` available to agents during tool execution
- **FR-016**: Extension MUST package agent resources so they're available immediately after installation
- **FR-017**: System MUST prevent name collisions when multiple agents have the same ID
- **FR-018**: Extension MUST provide clear error messages when tool executions fail with actionable guidance
- **FR-019**: System MUST detect when GitHub Copilot Chat is not available or enabled and display a friendly error message with guidance to install/enable it
- **FR-020**: System MUST automatically detect changes to agent resource files and reload affected agents without requiring VS Code window reload. **FileWatcher MUST monitor**: (1) `resources/**/*.md` (all markdown files recursively), (2) `resources/**/*.json` (configuration files), (3) `resources/agents/*.agent.md` (agent definitions specifically). **FileWatcher MUST NOT monitor**: temporary files (`.tmp`, `.swp`, `.bak`) or hidden files (starting with `.` except `.gitkeep`)
- **FR-021**: Extension MUST implement a mapping layer between VS Code chat participant API and agent tool execution
- **FR-022**: System MUST support asynchronous tool execution with progress reporting
- **FR-023**: Extension MUST support passing parameters from chat commands to tool handlers as free-text strings for custom parsing
- **FR-024**: System MUST support tool handlers that return structured objects containing markdown content and optional file references for displaying results
- **FR-025**: Extension MUST log all agent activations and tool executions for debugging and telemetry purposes

### Key Entities

- **Chat Participant**: The registered VS Code chat participant that represents an agent in Copilot Chat. Has properties: id, name, fullName, description, isSticky, commands array.
- **Agent Definition**: A configuration object defining an agent's metadata, including its prompts, skills, instructions, and available commands. Stored as Markdown files with YAML frontmatter in `resources/agents/`.
- **Agent Command**: A specific action an agent can perform (e.g., `/specify`, `/plan`). Has properties: name, description, handler mapping to registered tool implementation by name.
- **Tool Handler**: The TypeScript implementation registered in the VS Code extension that executes when an agent command is invoked. Receives context, parameters, and has access to agent resources. Returns a structured object with markdown content and optional file references.
- **Tool Response**: The structured object returned by a tool handler containing: markdown-formatted content for display, optional array of file URIs that were created/modified, and optional metadata about the operation performed.
- **Skill**: A reusable domain knowledge package from `resources/skills/` that agents can reference during tool execution. Contains documentation, examples, and best practices for specific topics.
- **Instruction**: Context and behavior guidelines from `resources/instructions/` for agents. Defines how tools should interpret requests and format responses.
- **agent resource**: Generic term for any file in `resources/` used by agents (prompts, skills, instructions, scripts, templates). When referring to the TypeScript interface, use `AgentResources` (code formatting).
- **Tool Execution Context**: Runtime context passed to tool handlers including workspace info, agent resources, user input, and VS Code APIs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can discover and view all registered agents in Copilot Chat within 10 seconds of opening the chat interface
- **SC-002**: Users can successfully invoke at least one agent command and receive results within 30 seconds of typing the command
- **SC-003**: System correctly loads and registers all valid agents from `resources/agents/` on extension activation without errors in 100% of standard installations
- **SC-004**: Users can access help documentation for any agent's commands in under 3 interactions (type @agent, type /help, view results)
- **SC-005**: System successfully maps and executes all defined agent commands to their corresponding tool implementations
- **SC-006**: System handles tool execution failures gracefully with clear error messages in 100% of error scenarios
- **SC-007**: Agent resources from workspace `resources/` directory are automatically discovered and loaded within 5 seconds of extension activation
- **SC-008**: Agent command autocomplete suggestions appear within 200ms of typing `/` after @agent mention
- **SC-009**: All registered agents have complete metadata: description, command list, usage examples
- **SC-010**: System successfully reloads agent resources within 5 seconds when resource files are modified

