# ALMA (Agentic Lifecycle Management Automation)

[![Visual Studio Marketplace](https://img.shields.io/vscode-marketplace/v/EITA.alma.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=EITA.alma)
[![Downloads](https://img.shields.io/vscode-marketplace/d/EITA.alma.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=EITA.alma)
[![GitHub stars](https://img.shields.io/github/stars/eitatech/alma-vscode.svg?style=flat-square)](https://github.com/eitatech/alma-vscode/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/eitatech/alma-vscode.svg?style=flat-square)](https://github.com/eitatech/alma-vscode/issues)

ALMA is a VS Code extension that brings Agentic Lifecycle Management Automation to your workflow, leveraging **Spec-Kit**, **OpenSpec**, and **GitHub Copilot**.

It allows you to visually manage Specs, Steering documents (Constitution/AGENTS.md), and custom prompts, seamlessly integrating with GitHub Copilot Chat to generate high-quality documentation and code.

![Create new Spec](./screenshots/image.png)

## Features

### Spec Management

- **Create Specs**: Run `ALMA: Create New Spec` (`alma.spec.create`) to open the creation dialog. Define your summary, product context, and constraints.
- **Support for Multiple Systems**: Choose between **Spec-Kit** (Recommended) or **OpenSpec** (Legacy) for your Spec-Driven Development workflow.
- **Generate with Copilot**: The extension compiles your input into an optimized prompt and sends it to **GitHub Copilot Chat** to generate the full specification.
- **Manage Specs**: Browse generated specs in the **Specs** view.
- **Execute Tasks**: Open `tasks.md` and use the "Start Task" CodeLens to send task context to GitHub Copilot Chat for implementation.

### Prompt Management

- **Custom Prompts**: Manage Markdown prompts under `.github/prompts` (configurable) alongside instructions and agents to keep all project guidance in one place.
- **Project Instructions & Agents**: The Prompts explorer shows `Project Instructions` and `Project Agents` groups, surfacing `.github/instructions` and `.github/agents` files.
- **Run Prompts**: Execute prompts directly from the tree view, passing the context to GitHub Copilot Chat.
- **Rename or Delete**: Use the item context menu to rename or delete prompts.

### Steering

- **Constitution / Agents**: Manage your project's "Constitution" (Spec-Kit) or "AGENTS.md" (OpenSpec) to steer Copilot's behavior.
- **Global Instructions**: Configure global instructions for Copilot across all your projects.

### Migration

- **Migrate to Spec-Kit**: Easily migrate existing OpenSpec projects to the modern Spec-Kit structure using the `ALMA: Migrate to Spec-Kit` command.

## Installation

### Prerequisites

- Visual Studio Code 1.84.0 or newer.
- **[GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)** extension must be installed.

### SpecKit

ALMA works best with [Spec-Kit](https://github.com/github/spec-kit).

1. Install the CLI globaly:

   ```shell
   uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
   ```

2. Initialize in your project:

   ```shell
   specify init --here
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

Search for "ALMA" in the VS Code Marketplace and install the extension.

### From Local VSIX

1. Build the package with `npm run package` (produces `alma-<version>.vsix`).
2. Install via `code --install-extension alma-<version>.vsix`.

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

### 3. Create Constitution (Spec-Kit)

1. Open the **Steering** view.
2. Click **Create Project Rule**.
3. Select **Spec-Kit**.
4. Enter your directives (e.g., "Focus on clean code").
5. Copilot will generate your `constitution.md`.

## Configuration

All settings live under the `alma` namespace.

| Setting | Type | Default | Purpose |
| --- | --- | --- | --- |
| `alma.chatLanguage` | string | `English` | The language GitHub Copilot should use for responses. |
| `alma.specSystem` | string | `auto` | The Spec System to use (`auto`, `speckit`, `openspec`). |
| `alma.speckit.specsPath` | string | `specs` | Path for Spec-Kit specs. |
| `alma.speckit.memoryPath` | string | `.specify/memory` | Path for Spec-Kit memory. |
| `alma.speckit.templatesPath` | string | `.specify/templates` | Path for Spec-Kit templates. |
| `alma.copilot.specsPath` | string | `openspec` | Path for OpenSpec specs. |
| `alma.copilot.promptsPath` | string | `.github/prompts` | Path for Markdown prompts. |
| `alma.views.specs.visible` | boolean | `true` | Show or hide the Specs explorer. |
| `alma.views.prompts.visible` | boolean | `true` | Toggle the Prompts explorer. |
| `alma.views.steering.visible` | boolean | `true` | Toggle the Steering explorer. |
| `alma.views.settings.visible` | boolean | `true` | Toggle the Settings overview. |

## Workspace Layout

### Spec-Kit Structure

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

- [Spec-Kit](https://github.com/github/spec-kit)
- [OpenSpec](https://github.com/Fission-AI/OpenSpec)
