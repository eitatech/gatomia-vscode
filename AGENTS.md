# Repository Guidelines

## Project Structure & Module Organization
- `src/`: VS Code extension source (TypeScript) compiled to `dist/extension.js`.
- `ui/`: React + Vite webview; outputs to `ui/dist` and is pulled into the extension build.
- `scripts/`: Build helpers (e.g., prompt bundling).
- `tests/`: Vitest suites (`unit/`, `integration/`) with shared mocks in `__mocks__/`.
- `specs/` and `openspec/`: Example spec assets for SpecKit/OpenSpec workflows; keep in sync with extension behaviors.
- `dist/`, `icons/`, `screenshots/`: Generated or static assets—avoid manual edits in `dist/`.

## Build, Test, and Development Commands
- `npm run install:all`: Install root + `ui` dependencies.
- `npm run build`: Build prompts, extension, and webview for publishing.
- `npm run watch`: Dev loop; TypeScript watch plus webview dev server.
- `npm run build:webview`: Rebuild only the React webview bundle.
- `npm run package`: Produce the VSIX (`gatomia-<version>.vsix`).
- `npm run lint` | `npm run fix`: Lint or auto-fix via Ultracite/Biome.
- `npm run format`: Apply formatter settings (tabs, double quotes, semicolons).
- `npm run check`: Type and style checks without fixing.
- `npm run test` | `npm run test:watch` | `npm run test:coverage`: Run Vitest suites once, in watch mode, or with coverage.

## Coding Style & Naming Conventions
- TypeScript-first with React for UI; prefer interfaces over types when shaping contracts.
- Formatter enforces tab indentation, double quotes, and required semicolons—run `npm run format` before committing.
- Name React components and classes in PascalCase; utilities and hooks in camelCase (e.g., `useSpecStore`).
- File names in kebab-case (e.g., `change-request-form.tsx`).
- Keep modules focused; favor small files over multi-purpose modules. Place shared helpers in `src/utils/` and `ui/src/lib/`.
- Always run `npm run check` before mark any task as complete. This ensures code quality and formatting standards are met.


## Testing Guidelines
- Vitest with React Testing Library powers unit and integration coverage; mirror fixtures in `tests/__mocks__/` when stubbing VS Code APIs.
- Place UI-focused tests in `tests/unit/webview/**`; extension logic under `tests/unit/features/**`; end-to-end flows in `tests/integration/`.
- Name files `*.test.ts` or `*.test.tsx`; prefer descriptive `describe` blocks tied to feature names.
- Target new behavior with focused unit tests before expanding to integration. Use `npm run test:coverage` to confirm meaningful assertions.

## Commit & Pull Request Guidelines
- Write concise, imperative commits (e.g., "Add hook executor guard"); group related changes and avoid noisy churn in `dist/`.
- PRs should summarize scope, link any tracked issues, and note user-visible changes (screenshots for UI when relevant).
- Include build/test status in the PR description when possible; ensure `npm run lint`, `npm run format`, and `npm run test` pass locally.
- Call out spec updates in `specs/` or `openspec/` so reviewers can verify alignment with extension behavior.

## Security & Configuration Tips
- Do not commit secrets or tokens; VS Code uses user-level settings for credentials.
- Keep `node_modules/` and build artifacts out of commits; rely on scripts above to regenerate outputs.
- Validate spec-related changes with the SpecKit/OpenSpec workflows documented in `README.md` to avoid drift between prompts, specs, and UI.

## Active Technologies
- TypeScript 5.x (extension + React webview) + VS Code Extension API, React 18, Vite tooling, Markdown-it + diagram plugins, existing SpecKit document services (001-document-preview)
- Local workspace files plus existing SpecKit metadata (no new datastore) (001-document-preview)
- TypeScript 5.x (extension + React webview) + VS Code Extension API, React 18, Vite build, Zustand/store utilities, Vitest + Testing Library (001-spec-review-flow)
- Local workspace specs + in-memory stores (no external DB) (001-spec-review-flow)
