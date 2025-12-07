# GatomIA (Agentic Lifecycle Management Automation)

[![Visual Studio Marketplace](https://img.shields.io/vscode-marketplace/v/EITA.gatomia.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=EITA.gatomia)
[![Downloads](https://img.shields.io/vscode-marketplace/d/EITA.gatomia.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=EITA.gatomia)
[![GitHub stars](https://img.shields.io/github/stars/eitatech/gatomia-vscode.svg?style=flat-square)](https://github.com/eitatech/gatomia-vscode/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/eitatech/gatomia-vscode.svg?style=flat-square)](https://github.com/eitatech/gatomia-vscode/issues)

GatomIA is a VS Code extension that brings Agentic Lifecycle Management Automation to your workflow, leveraging **SpecKit**, **OpenSpec**, and **GitHub Copilot**.

It allows you to visually manage Specs, Steering documents (Constitution/AGENTS.md), and custom prompts, seamlessly integrating with GitHub Copilot Chat to generate high-quality documentation and code.

## Features

### Spec Management

- **Create Specs**: Run `GatomIA: Create New Spec` (`gatomia.spec.create`) to open the creation dialog. Define your summary, product context, and constraints.
- **Support for Multiple Systems**: Choose between **SpecKit** (Recommended) or **OpenSpec** for your Spec-Driven Development workflow.
- **Generate with Copilot**: The extension compiles your input into an optimized prompt and sends it to **GitHub Copilot Chat** to generate the full specification.
- **Manage Specs**: Browse generated specs in the **Specs** view.
- **Execute Tasks**: Open `tasks.md` and use the "Start Task" CodeLens to send task context to GitHub Copilot Chat for implementation.

### Prompt Management

- **Custom Prompts**: Manage Markdown prompts under `.github/prompts` (configurable) alongside instructions and agents to keep all project guidance in one place.
- **Project Instructions & Agents**: The Prompts explorer shows `Project Instructions` and `Project Agents` groups, surfacing `.github/instructions` and `.github/agents` files.
- **Run Prompts**: Execute prompts directly from the tree view, passing the context to GitHub Copilot Chat.
- **Rename or Delete**: Use the item context menu to rename or delete prompts.

### Steering

- **Constitution / Agents**: Manage your project's "Constitution" (SpecKit) or "AGENTS.md" (OpenSpec) to steer Copilot's behavior.
- **Global Instructions**: Configure global instructions for Copilot across all your projects.

### Migration

- **Migrate to SpecKit**: Easily migrate existing OpenSpec projects to the modern SpecKit structure using the `GatomIA: Migrate to SpecKit` command.

### Hooks & Automation

- **MCP Hooks Integration**: Automate workflows by creating hooks that trigger MCP (Model Context Protocol) actions when agent operations complete.
- **Browse MCP Servers**: Discover available MCP servers and tools configured in your GitHub Copilot setup.
- **Configure Actions**: Set up hooks to execute MCP tools automatically (e.g., create GitHub issues, send Slack notifications) after operations like spec generation or task completion.
- **Execution Tracking**: View execution logs and monitor hook performance in real-time.
- **Error Handling**: Graceful degradation when MCP servers are unavailable, with automatic retry logic for transient failures.

## Installation

### Prerequisites

- Visual Studio Code 1.84.0 or newer.
- **[GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)** extension must be installed.

### SpecKit (Recommended)

GatomIA works best with [SpecKit](https://github.com/github/spec-kit).

1. Install the Specify CLI globally:

   ```shell
   uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
   ```

1. Initialize SpecKit in your project:

   ```shell
   specify init --here --ai copilot
   ```

### OpenSpec

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

### 3. Create Constitution (SpecKit)

1. Open the **Steering** view.
2. Click **Create Project Rule**.
3. Select **SpecKit**.
4. Enter your directives (e.g., "Focus on clean code").
5. Copilot will generate your `constitution.md`.

### 4. Automate with Hooks

1. Open the **Hooks** view in the Activity Bar.
2. Click **Create New Hook**.
3. Configure the trigger (e.g., after "plan" operation in "speckit" agent).
4. Select an action type (MCP, Agent, Git, GitHub, or Custom).
5. For MCP actions:
   - Browse available MCP servers and tools
   - Map parameters using context variables or literal values
   - Save and enable the hook
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
   - `npm run install:all`
2. Build:
   - `npm run build`
3. Launch:
   - Press `F5` inside VS Code.

## License

MIT License. See [`LICENSE`](LICENSE).

## Credits

- [SpecKit](https://github.com/github/spec-kit)
- [OpenSpec](https://github.com/Fission-AI/OpenSpec)
