import MarkdownIt from "markdown-it";
import markdownItMermaid from "markdown-it-mermaid";
import markdownItPlantuml from "markdown-it-plantuml";

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

	if (options.enableMermaid !== false) {
		md.use(
			(markdownItMermaid as { default?: typeof markdownItMermaid }).default ??
				markdownItMermaid
		);
	}

	if (options.enablePlantUML !== false) {
		md.use(markdownItPlantuml);
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
