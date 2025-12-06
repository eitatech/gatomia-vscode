import MarkdownIt from "markdown-it";
import { checkboxPlugin } from "./plugins/checkbox-plugin";

// Note: markdown-it-mermaid and markdown-it-plantuml are disabled because they
// access the DOM during module initialization, which fails in webview contexts.
// TODO: Implement lazy loading for diagram plugins if needed.

export interface PreviewRendererOptions {
	markdown?: MarkdownIt.Options;
	enableMermaid?: boolean;
	enablePlantUML?: boolean;
}

let cachedRenderer: MarkdownIt | undefined;

const DEFAULT_OPTIONS: MarkdownIt.Options = {
	html: true,
	linkify: true,
	typographer: true,
	breaks: false,
};

export const createPreviewRenderer = (
	options: PreviewRendererOptions = {}
): MarkdownIt => {
	const md = new MarkdownIt({ ...DEFAULT_OPTIONS, ...options.markdown });

	// Add custom checkbox plugin for task lists
	md.use(checkboxPlugin);

	// Diagram plugins are disabled - they access document during initialization
	// if (options.enableMermaid !== false) { ... }
	// if (options.enablePlantUML !== false) { ... }

	return md;
};

export const renderPreviewMarkdown = (
	content: string,
	options?: PreviewRendererOptions
): string => {
	if (options) {
		return createPreviewRenderer(options).render(content);
	}

	if (!cachedRenderer) {
		cachedRenderer = createPreviewRenderer();
	}

	return cachedRenderer.render(content);
};
