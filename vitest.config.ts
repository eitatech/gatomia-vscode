import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	test: {
		environment: "jsdom",
		include: ["src/**/*.test.ts", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
		setupFiles: ["./vitest.setup.ts"],
		coverage: { reporter: ["text", "lcov", "html"], provider: "v8" },
	},
	resolve: {
		alias: {
			vscode: path.resolve(__dirname, "tests/__mocks__/vscode.ts"),
			"@": path.resolve(__dirname, "webview-ui/src"),
			react: path.resolve(__dirname, "node_modules/react"),
			"react-dom": path.resolve(__dirname, "node_modules/react-dom"),
		},
	},
});
