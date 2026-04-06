import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import { checkboxPlugin } from "./plugins/checkbox-plugin";
import { taskGroupPlugin } from "./plugins/task-group-plugin";
import { mermaidPlugin } from "./plugins/mermaid-plugin";

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
	highlight: (str: string, lang: string): string => {
		if (lang && hljs.getLanguage(lang)) {
			try {
				return hljs.highlight(str, { language: lang, ignoreIllegals: true })
					.value;
			} catch {
				// Fall through to default
			}
		}
		// Use auto-detection for unknown languages
		try {
			return hljs.highlightAuto(str).value;
		} catch {
			// Fall through to default
		}
		return ""; // Use external default escaping
	},
};

export const createPreviewRenderer = (
	options: PreviewRendererOptions = {}
): MarkdownIt => {
	const md = new MarkdownIt({ ...DEFAULT_OPTIONS, ...options.markdown });

	// Add custom checkbox plugin for task lists
	md.use(checkboxPlugin);

	// Add task group button plugin
	md.use(taskGroupPlugin);

	// Add mermaid/plantuml diagram support
	if (options.enableMermaid !== false) {
		md.use(mermaidPlugin);
	}

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
