import type { TemplateContext } from "./types";

/**
 * Expands template variables (e.g., {feature}) using the provided context.
 */
export function expandTemplate(
	template: string,
	context: TemplateContext
): string {
	if (!template) {
		return template;
	}

	return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_match, key) => {
		const value = context[key as keyof TemplateContext];
		return value === undefined || value === null ? "" : String(value);
	});
}
