/**
 * PermissionChip — compact toggle for the InputBar toolbar that surfaces
 * the current `gatomia.acp.permissionDefault` value (Ask / Auto / Reject)
 * during an active session. Click opens a dropdown menu so the user can
 * change the policy mid-conversation without leaving the chat surface.
 *
 * Pure presentation: state lives in the bridge; this component only owns
 * the local `open` boolean for the dropdown. All visuals come from
 * `app.css` and use VS Code theme tokens — no hard-coded colours.
 *
 * Internally delegates to {@link ChipDropdown} so all chips on the
 * composer share the exact same shell.
 */

import { ChipDropdown, type ChipDropdownOption } from "./chip-dropdown";
import type { PermissionDefaultMode } from "@/features/agent-chat/types";

interface PermissionChipProps {
	readonly value: PermissionDefaultMode | undefined;
	readonly onChange: (mode: PermissionDefaultMode) => void;
}

const OPTIONS: readonly ChipDropdownOption<PermissionDefaultMode>[] = [
	{
		value: "ask",
		label: "Ask (Default)",
		description: "Prompt before each tool call. This is the default policy.",
		icon: "codicon-question",
	},
	{
		value: "allow",
		label: "Auto-approve",
		description: "Approve every tool call automatically.",
		icon: "codicon-check-all",
	},
	{
		value: "deny",
		label: "Reject",
		description: "Reject every tool call automatically.",
		icon: "codicon-circle-slash",
	},
];

const DEFAULT_VALUE: PermissionDefaultMode = "ask";

// Short label rendered inside the chip toggle button. We surface
// "Ask (Default)" rather than just "Ask" so the user always knows the
// fallback policy (per PR feedback). All values are rendered in plain
// text — never italic.
const SHORT_LABEL: Record<PermissionDefaultMode, string> = {
	ask: "Ask (Default)",
	allow: "Auto",
	deny: "Reject",
};

export function PermissionChip({
	value,
	onChange,
}: PermissionChipProps): JSX.Element {
	const active = value ?? DEFAULT_VALUE;
	return (
		<ChipDropdown
			ariaPrefix="Permission"
			currentLabel={SHORT_LABEL[active]}
			icon="codicon-shield"
			onChange={onChange}
			options={OPTIONS}
			value={active}
		/>
	);
}
