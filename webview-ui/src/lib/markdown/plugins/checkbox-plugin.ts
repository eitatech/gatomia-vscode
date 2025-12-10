/**
 * Custom markdown-it plugin to render GitHub-style task list checkboxes.
 * Converts `- [ ]` and `- [x]` patterns into proper checkbox HTML.
 *
 * This is a lightweight alternative to external plugins that may access
 * the DOM during module initialization, causing issues in webview contexts.
 */

import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import type Token from "markdown-it/lib/token.mjs";

const CHECKBOX_PATTERN = /^\[([ xX])\]\s/;

function isTaskListItem(token: Token): boolean {
	if (token.type !== "inline" || !token.content) {
		return false;
	}
	return CHECKBOX_PATTERN.test(token.content);
}

function findInlineTokenIndex(tokens: Token[], startIndex: number): number {
	for (let j = startIndex + 1; j < tokens.length; j++) {
		if (tokens[j].type === "list_item_close") {
			return -1;
		}
		if (tokens[j].type === "inline") {
			return j;
		}
	}
	return -1;
}

function createCheckboxToken(state: StateCore, isChecked: boolean): Token {
	const checkboxHtml = `<input type="checkbox" class="task-list-checkbox" disabled${isChecked ? " checked" : ""} /> `;
	const checkboxToken = new state.Token("html_inline", "", 0);
	checkboxToken.content = checkboxHtml;
	return checkboxToken;
}

function updateInlineTokenContent(inlineToken: Token): void {
	inlineToken.content = inlineToken.content.replace(CHECKBOX_PATTERN, "");

	if (inlineToken.children && inlineToken.children.length > 0) {
		const firstChild = inlineToken.children[0];
		if (firstChild.type === "text") {
			firstChild.content = firstChild.content.replace(CHECKBOX_PATTERN, "");
		}
	}
}

function processListItem(
	state: StateCore,
	tokens: Token[],
	listItemIndex: number
): void {
	const inlineIndex = findInlineTokenIndex(tokens, listItemIndex);
	if (inlineIndex === -1) {
		return;
	}

	const inlineToken = tokens[inlineIndex];
	if (!isTaskListItem(inlineToken)) {
		return;
	}

	const match = inlineToken.content.match(CHECKBOX_PATTERN);
	if (!match) {
		return;
	}

	const isChecked = match[1].toLowerCase() === "x";
	const listItemToken = tokens[listItemIndex];

	listItemToken.attrJoin("class", "task-list-item");
	updateInlineTokenContent(inlineToken);

	const checkboxToken = createCheckboxToken(state, isChecked);
	if (inlineToken.children) {
		inlineToken.children.unshift(checkboxToken);
	}
}

function processTaskLists(state: StateCore): void {
	const tokens = state.tokens;

	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].type === "list_item_open") {
			processListItem(state, tokens, i);
		}
	}
}

export function checkboxPlugin(md: MarkdownIt): void {
	md.core.ruler.after("inline", "task-lists", processTaskLists);
}
