/**
 * provider-icon — maps a `providerId` (the stable id surfaced by the
 * extension's `AcpProviderRegistry`) to a VS Code codicon class.
 *
 * Why this exists: the redesign requested that the Provider chip on the
 * composer toolbar render only the agent icon (no text), Cursor-style.
 * codicons don't ship vendor logos so we approximate each agent with a
 * codicon that visually evokes its origin.
 *
 * The mapping is intentionally conservative — if a future provider id
 * doesn't match any prefix below, we fall back to `codicon-robot` so
 * the chip is never empty.
 */

const PROVIDER_ICON_MAP: ReadonlyArray<readonly [RegExp, string]> = [
	// Anthropic / Claude family
	[/^claude/i, "codicon-comment-discussion"],
	// Google / Gemini family
	[/^gemini/i, "codicon-sparkle"],
	// OpenAI GPT / Codex / O-series
	[/^(gpt|openai|codex|o[1-9])/i, "codicon-chip"],
	// Alibaba / Qwen
	[/^qwen/i, "codicon-globe"],
	// Devin (Cognition)
	[/^devin/i, "codicon-account"],
	// Stakpak
	[/^stakpak/i, "codicon-server"],
	// F1rst Tecnologia (internal Santander/F1rst tooling)
	[/^f1rst/i, "codicon-flame"],
	// Aider
	[/^aider/i, "codicon-tools"],
	// Cline / Codename
	[/^cline/i, "codicon-terminal"],
];

export function providerIconClass(providerId: string): string {
	for (const [pattern, icon] of PROVIDER_ICON_MAP) {
		if (pattern.test(providerId)) {
			return icon;
		}
	}
	return "codicon-robot";
}
