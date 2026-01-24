# GatomIA (Agentic Spec-Driven Development Toolkit)

[![Visual Studio Marketplace](https://img.shields.io/vscode-marketplace/v/EITA.gatomia.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=EITA.gatomia)
[![Downloads](https://img.shields.io/vscode-marketplace/d/EITA.gatomia.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=EITA.gatomia)
[![GitHub stars](https://img.shields.io/github/stars/eitatech/gatomia-vscode.svg?style=flat-square)](https://github.com/eitatech/gatomia-vscode/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/eitatech/gatomia-vscode.svg?style=flat-square)](https://github.com/eitatech/gatomia-vscode/issues)

GatomIA is a VS Code extension that brings Agentic Spec-Driven Development  to your workflow, leveraging **SpecKit**, **OpenSpec**, and **GitHub Copilot**.

It allows you to visually manage Specs, Steering documents (Constitution/AGENTS.md), and custom prompts, seamlessly integrating with GitHub Copilot Chat to generate high-quality documentation and code.

---

## Current Project Status

This project is under **continuous development**. Some features may still exhibit unexpected behavior, contain bugs, or be only partially implemented.

**Bug reports, suggestions, and general feedback are highly appreciated!** They play a crucial role in helping us stabilize and improve the extension.

We are actively working on:

* **Stabilizing all existing features**
* **Implementing the upcoming functionalities from our roadmap**
* **Improving overall reliability and user experience**

You can follow our progress, open issues, or contribute directly through our official repository:

**[https://github.com/eitatech/gatomia-vscode/issues](https://github.com/eitatech/gatomia-vscode/issues)**

## Features

### Copilot Agents Integration

* **Agent Discovery**: Automatically discover and register agents from `resources/agents/` directory as Copilot Chat participants
* **Ask Agents**: Interact with agents directly in GitHub Copilot Chat with intelligent command suggestions and autocomplete
* **Tool Execution**: Execute agent-defined tools with comprehensive error handling and real-time progress feedback
* **Resource Management**: Automatic loading and caching of agent resources (prompts, skills, instructions)
  - **Prompts**: Template prompts available to agents for consistent responses
  - **Skills**: Domain knowledge packages that agents can reference
  - **Instructions**: Behavior guidelines that shape agent responses
* **Hot-Reload**: Real-time resource updates without extension reload (configurable, enabled by default)
* **Configuration**: Customize agent behavior through extension settings
  - **resourcesPath**: Directory containing agents and resources (default: `resources`)
  - **enableHotReload**: Auto-reload resources on file changes (default: true)
  - **logLevel**: Logging verbosity for debugging (default: info)
* **Example Implementation**: Built-in example agent and tool handlers demonstrating best practices
* **Comprehensive Help**: Built-in `/help` command for all agents with full documentation

### Spec Management

* **Create Specs**: Run `GatomIA: Create New Spec` (`gatomia.spec.create`) to open the creation dialog. Define your summary, product context, and constraints.
* **Support for Multiple Systems**: Choose between **SpecKit** (Recommended) or **OpenSpec** for your Spec-Driven Development workflow.
* **Generate with Copilot**: The extension compiles your input into an optimized prompt and sends it to **GitHub Copilot Chat** to generate the full specification.
* **Manage Specs**: Browse generated specs in the **Specs** view.
* **Execute Tasks**: Open `tasks.md` and use the "Start Task" CodeLens to send task context to GitHub Copilot Chat for implementation.

### Prompt Management

* **Custom Prompts**: Manage Markdown prompts under `.github/prompts` (configurable) alongside instructions and agents to keep all project guidance in one place.
* **Project Instructions & Agents**: The Prompts explorer shows `Project Instructions` and `Project Agents` groups, surfacing `.github/instructions` and `.github/agents` files.
* **Run Prompts**: Execute prompts directly from the tree view, passing the context to GitHub Copilot Chat.
* **Rename or Delete**: Use the item context menu to rename or delete prompts.

### Steering

* **Instruction Rules**: Create and manage instruction rules for GitHub Copilot at both project (`.github/instructions/*.instructions.md`) and user (`$HOME/.github/instructions/*.instructions.md`) levels.
  - **Project Rules**: Standardize team guidelines within the repository
  - **User Rules**: Define personal reusable guidance without committing to the repo
  - **Constitution**: Request Constitution document generation via `Create Constitution` button with AI-assisted drafting
* **Constitution / Agents**: Manage your project's "Constitution" (SpecKit) or "AGENTS.md" (OpenSpec) to steer Copilot's behavior.
* **Global Instructions**: Configure global instructions for Copilot across all your projects.

### Migration

* **Migrate to SpecKit**: Easily migrate existing OpenSpec projects to the modern SpecKit structure using the `GatomIA: Migrate to SpecKit` command.

### Hooks & Automation

* **MCP Hooks Integration**: Automate workflows by creating hooks that trigger MCP (Model Context Protocol) actions when agent operations complete.
* **Browse MCP Servers**: Discover available MCP servers and tools configured in your GitHub Copilot setup.
* **Configure Actions**: Set up hooks to execute MCP tools automatically (e.g., create GitHub issues, send Slack notifications) after operations like spec generation or task completion.
* **Execution Tracking**: View execution logs and monitor hook performance in real-time.
* **Error Handling**: Graceful degradation when MCP servers are unavailable, with automatic retry logic for transient failures.

### Welcome Screen

- **First-Time Setup**: Interactive welcome screen appears on first activation to guide you through extension setup.
- **Dependency Detection**: Automatically checks for GitHub Copilot Chat, SpecKit CLI, and OpenSpec CLI installations.
- **Quick Installation**: One-click install buttons copy installation commands to your clipboard.
- **Configuration Management**: Edit key settings directly from the welcome screen with inline validation.
- **Learning Resources**: Browse documentation, examples, and tutorials organized by category.
- **Feature Discovery**: Explore all extension features with quick-access command buttons.
- **System Health**: Monitor extension status with real-time diagnostics and health indicators.
- **Persistent Access**: Re-open welcome screen anytime via `GatomIA: Show Welcome Screen` command.

## Installation

### Prerequisites

* Visual Studio Code 1.84.0 or newer.
* **[GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)** extension must be installed.

### [SpecKit](https://github.com/github/spec-kit)

1. Install the Specify CLI globally:

   ```shell
   uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
   ```

2. Initialize SpecKit in your project:

   ```shell
   specify init --here --ai copilot

   ```

### [OpenSpec](https://github.com/fission-ai/openspec)

If you prefer OpenSpec:

1. Install the CLI globally:

   ```shell
   npm install -g @fission-ai/openspec@latest
   ```

2. Initialize in your project:

   ```shell
   openspec init
   ```

### Marketplace

Search for "GatomIA" in the VS Code Marketplace and install the extension.

### From Local VSIX

1. Build the package with `npm run package` (produces `gatomia-<version>.vsix`).
2. Install via `code --install-extension gatomia-<version>.vsix`.

## Usage

### 1. Create a Spec

1. Open the **Specs** view in the Activity Bar.
2. Click **Create New Spec**.
3. Fill in the details (Product Context is required).
4. Click **Create Spec**. This will open GitHub Copilot Chat with a generated prompt.
5. Follow the chat instructions to generate the spec files.

### 2. Implement Tasks

1. Open a generated `tasks.md` file.
2. Click **Start All Tasks** above a checklist item.
3. GitHub Copilot Chat will open with the task context. Interact with it to implement the code.

### 3. Manage Instruction Rules

1. Open the **Steering** view in the Activity Bar.
2. **Create Project Rule**:
   - Click **Create Project Rule** button
   - Enter a name (e.g., "TypeScript Rules")
   - Edit the generated `.github/instructions/<name>.instructions.md` file
3. **Create User Rule**:
   - Click **Create User Rule** button
   - Enter a name for personal guidance
   - Edit the generated `$HOME/.github/instructions/<name>.instructions.md` file
4. **Create Constitution**:
   - Click **Create Constitution** button
   - Enter a brief description (e.g., "Python project with FastAPI")
   - Copilot Chat opens with `/speckit.constitution` prompt
   - The agent generates your `constitution.md`

### 4. Use Copilot Agents

GatomIA auto-discovers agents defined in `resources/agents/` and registers them with GitHub Copilot Chat. You can interact with them directly in the chat interface.

**Using Agents**:

1. Open GitHub Copilot Chat (Ctrl+Shift+I / Cmd+Shift+I)
2. Type `@` to see available agents (e.g., `@example-agent`, `@speckit`, `@task-planner`)
3. Type a command after the agent name (e.g., `@example-agent /hello`)
4. Press Enter to execute the agent command
5. The agent executes its tool handler and returns results as markdown

**Available Commands**:

* `@agent /help` - Show all available commands for the agent
* `@agent /help <command>` - Show detailed documentation for a specific command
* Agent-specific commands as defined in `resources/agents/<agent>.agent.md`

**Creating Custom Agents**:

1. Create a file at `resources/agents/my-agent.agent.md`:

   ```markdown
   ---
   id: my-agent
   name: My Agent
   fullName: My Custom Agent Implementation
   description: Describes what this agent does
   commands:
     - name: analyze
       description: Analyze project structure
       tool: my.analyze
   resources:
     prompts: [analysis.prompt.md]
     skills: [expertise.skill.md]
   ---
   
   # My Agent
   
   Documentation about the agent...
   ```

2. Create tool handlers in `src/features/agents/tools/` (reference [example-tool-handler.ts](src/features/agents/tools/example-tool-handler.ts))
3. Register tools in the tool registry during extension initialization
4. Agents are auto-discovered and registered when the extension activates

**Configuration**:

Access agent settings in VS Code: Settings → GatomIA → Agents

| Setting | Type | Default | Purpose |
| --- | --- | --- | --- |
| `gatomia.agents.resourcesPath` | string | `resources` | Directory containing agents and resources. |
| `gatomia.agents.enableHotReload` | boolean | `true` | Auto-reload resources when files change. |
| `gatomia.agents.logLevel` | string | `info` | Logging verbosity (debug, info, warn, error). |

For more details, see [src/features/agents/README.md](src/features/agents/README.md).

### 5. Automate with Hooks

1. Open the **Hooks** view in the Activity Bar.
2. Click **Create New Hook**.
3. Configure the trigger (e.g., after "plan" operation in "speckit" agent).
4. Select an action type (MCP, Agent, Git, GitHub, or Custom).
5. For MCP actions:
   * Browse available MCP servers and tools
   * Map parameters using context variables or literal values
   * Save and enable the hook
6. Execute operations that match your trigger.
7. View execution logs in the Hooks view to monitor automation.

## Configuration

All settings live under the `gatomia` namespace.

| Setting | Type | Default | Purpose |
| --- | --- | --- | --- |
| `gatomia.chatLanguage` | string | `English` | The language GitHub Copilot should use for responses. |
| `gatomia.specSystem` | string | `auto` | The Spec System to use (`auto`, `speckit`, `openspec`). |
| `gatomia.speckit.specsPath` | string | `specs` | Path for SpecKit specs. |
| `gatomia.speckit.memoryPath` | string | `.specify/memory` | Path for SpecKit memory. |
| `gatomia.speckit.templatesPath` | string | `.specify/templates` | Path for SpecKit templates. |
| `gatomia.copilot.specsPath` | string | `openspec` | Path for OpenSpec specs. |
| `gatomia.copilot.promptsPath` | string | `.github/prompts` | Path for Markdown prompts. |
| `gatomia.views.specs.visible` | boolean | `true` | Show or hide the Specs explorer. |
| `gatomia.views.prompts.visible` | boolean | `true` | Toggle the Prompts explorer. |
| `gatomia.views.steering.visible` | boolean | `true` | Toggle the Steering explorer. |
| `gatomia.views.settings.visible` | boolean | `true` | Toggle the Settings overview. |

## Workspace Layout

### SpecKit Structure

```text
.specify/
├── constitution.md         # Global steering rules
├── memory/                 # Project memory
├── templates/              # Spec templates
specs/                      # Feature specifications
├── 001-feature-name/
│   ├── spec.md
│   └── 001-task-name.md
```

### OpenSpec Structure

```text
openspec/
├── AGENTS.md               # Project-specific steering rules
├── project.md              # Project specification
├── specs/
│   ├── <spec>/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
```

## Development

1. Install dependencies:
   * `npm run install:all`
2. Build:
   * `npm run build`
3. Launch:
   * Press `F5` inside VS Code.

## License

MIT License. See [`LICENSE`](LICENSE).

## Credits

* [SpecKit](https://github.com/github/spec-kit)
* [OpenSpec](https://github.com/Fission-AI/OpenSpec)
