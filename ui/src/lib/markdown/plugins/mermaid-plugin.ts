import type MarkdownIt from "markdown-it";

/**
 * Plugin for rendering mermaid diagrams.
 * Instead of executing mermaid at render time (which fails in webview),
 * we output the diagram source in a container that mermaid.js can process client-side.
 */
export const mermaidPlugin = (md: MarkdownIt): void => {
	const defaultFence =
		md.renderer.rules.fence ||
		// biome-ignore lint/nursery/useMaxParams: markdown-it renderer rule signature requires 5 parameters
		((tokens, idx, options, _env, self) =>
			self.renderToken(tokens, idx, options));

	// biome-ignore lint/nursery/useMaxParams: markdown-it renderer rule signature requires 5 parameters
	md.renderer.rules.fence = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const info = token.info.trim().toLowerCase();

		// Handle mermaid code blocks
		if (info === "mermaid") {
			const content = token.content.trim();
			// Output raw content - mermaid.js needs unescaped syntax for arrows (-->)
			return `<pre class="mermaid">${content}</pre>`;
		}

		// Handle plantuml code blocks (placeholder for now)
		if (info === "plantuml" || info === "puml") {
			const content = token.content.trim();
			return `<pre class="plantuml" data-diagram="plantuml">${md.utils.escapeHtml(content)}</pre>`;
		}

		// Default fence handling for other languages
		return defaultFence(tokens, idx, options, env, self);
	};
};
