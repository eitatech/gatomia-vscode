# Quickstart: Steering Instructions & Rules

## Prerequisites

- Install dependencies: `npm run install:all`
- Run checks: `npm run check`

## Manual validation (Extension Development Host)

1. Start the extension in debug mode (VS Code: Run → Start Debugging).
2. In the Extension Development Host, open the **Steering** view.

### Verify listing (project scope)

1. In the repo under test, create a file: `.github/instructions/typescript.instructions.md`.
2. Return to the **Steering** view.
3. Confirm the file appears under the project instructions group.
4. Click it and confirm it opens.

### Verify listing (user scope)

1. Create a file at `$HOME/.github/instructions/typescript.instructions.md`.
2. Return to the **Steering** view.
3. Confirm the file appears under a user instructions group.
4. Click it and confirm it opens.

### Verify Create Project Rule

1. Click `Create Project Rule`.
2. Enter `TypeScript Rules`.
3. Confirm `.github/instructions/typescript-rules.instructions.md` is created.
4. Confirm it contains the standard instruction template.
5. Confirm the tree refreshes and shows the new file.

### Verify Create User Rule

1. Click `Create User Rule`.
2. Enter `TypeScript Rules`.
3. Confirm `$HOME/.github/instructions/typescript-rules.instructions.md` is created.
4. Confirm it contains the standard instruction template.

### Verify Create Constitution

1. Click `Create Constitution`.
2. Enter a short description.
3. Confirm Copilot Chat opens with a prompt starting with `/speckit.constitution`.
4. Confirm the extension performs no additional actions after the agent responds.

## Automated validation (to add during implementation)

- Unit tests for name normalization and file creation behavior (no overwrite, directory creation).
- Provider tests verifying listing behavior for both scopes.
