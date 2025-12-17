import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import type Token from "markdown-it/lib/token.mjs";

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;",
	};
	return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Plugin for markdown-it that detects task group headers and adds an execute button.
 * Detects headers like "## Phase X: User Story Y" and wraps them with an interactive button.
 */
const PHASE_USER_STORY_PATTERN =
	/^(Phase\s+\d+:\s*[^(]*?)(\s*\(P\d+\))?\s*(?:🎯)?.*$/i;

function isTaskGroupHeading(token: Token): boolean {
	if (token.type !== "inline") {
		return false;
	}
	if (!token.content) {
		return false;
	}
	return PHASE_USER_STORY_PATTERN.test(token.content);
}

function processTaskGroupHeading(
	state: StateCore,
	tokens: Token[],
	headingIndex: number
): void {
	// Look for the heading_open token and check if next inline token matches pattern
	if (headingIndex + 2 >= tokens.length) {
		return;
	}

	const headingOpen = tokens[headingIndex];
	const inline = tokens[headingIndex + 1];
	const headingClose = tokens[headingIndex + 2];

	// Only process h2 headings (##)
	if (headingOpen.type !== "heading_open" || headingOpen.tag !== "h2") {
		return;
	}

	if (!isTaskGroupHeading(inline)) {
		return;
	}

	const match = inline.content.match(PHASE_USER_STORY_PATTERN);
	if (!match) {
		return;
	}

	const groupName = match[1];

	// Create button token
	const buttonToken = new state.Token("html_inline", "", 0);
	buttonToken.content = `
<button 
  class="ml-2 rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-background)] px-2 py-1 text-[color:var(--vscode-button-foreground)] text-xs hover:bg-[color:var(--vscode-button-hoverBackground)] transition-colors"
  data-execute-task-group="${escapeHtml(groupName)}"
  type="button"
  title="Execute all tasks in this group"
>
  $(play) Execute Group
</button>`;

	// Insert button token after the inline token
	tokens.splice(headingIndex + 2, 0, buttonToken);
}

export const taskGroupPlugin = (md: MarkdownIt) => {
	md.core.ruler.push("task_group_buttons", (state: StateCore) => {
		const tokens = state.tokens;

		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].type === "heading_open") {
				processTaskGroupHeading(state, tokens, i);
			}
		}

		return false;
	});
};
