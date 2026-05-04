import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	test: {
		environment: "jsdom",
		include: [
			"src/**/*.test.ts",
			"tests/**/*.test.ts",
			"tests/**/*.test.tsx",
			"ui/tests/**/*.spec.tsx",
		],
		setupFiles: ["./vitest.setup.ts"],
		coverage: { reporter: ["text", "lcov", "html"], provider: "v8" },
		// Force @tanstack/react-virtual through vite's transform pipeline so the
		// `react` alias below actually intercepts its internal `import * as React
		// from "react"` — otherwise `ui/node_modules/react` is loaded as a
		// second React instance and hooks fail with "null.useReducer".
		server: {
			deps: {
				inline: ["@tanstack/react-virtual"],
			},
		},
	},
	resolve: {
		alias: {
			vscode: path.resolve(__dirname, "tests/__mocks__/vscode.ts"),
			"@": path.resolve(__dirname, "ui/src"),
			// Add explicit aliases for UI dependencies
			clsx: path.resolve(__dirname, "ui/node_modules/clsx"),
			"@radix-ui/react-slot": path.resolve(
				__dirname,
				"ui/node_modules/@radix-ui/react-slot"
			),
			"class-variance-authority": path.resolve(
				__dirname,
				"ui/node_modules/class-variance-authority"
			),
			"tailwind-merge": path.resolve(
				__dirname,
				"ui/node_modules/tailwind-merge"
			),
			"@tanstack/react-virtual": path.resolve(
				__dirname,
				"ui/node_modules/@tanstack/react-virtual"
			),
			// Force all React imports to use the root version (testing library uses root)
			react: path.resolve(__dirname, "node_modules/react"),
			"react-dom": path.resolve(__dirname, "node_modules/react-dom"),
			"react/jsx-runtime": path.resolve(
				__dirname,
				"node_modules/react/jsx-runtime"
			),
			"react/jsx-dev-runtime": path.resolve(
				__dirname,
				"node_modules/react/jsx-dev-runtime"
			),
		},
		dedupe: ["react", "react-dom", "@tanstack/react-virtual"],
	},
	esbuild: {
		jsx: "automatic",
	},
});
