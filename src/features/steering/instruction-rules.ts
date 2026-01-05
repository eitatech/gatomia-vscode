import { homedir } from "os";
import { join } from "path";
import { Uri, workspace } from "vscode";

const NON_ALPHANUMERIC_RUN = /[^a-z0-9]+/g;
const DASH_RUN = /-+/g;
const TRIM_DASHES = /^-|-$/g;
const KEBAB_CASE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class InstructionRuleError extends Error {
	readonly userMessage: string;

	constructor(userMessage: string) {
		super(userMessage);
		this.userMessage = userMessage;
	}
}

export type NormalizeInstructionRuleNameResult =
	| {
			ok: true;
			normalizedName: string;
	  }
	| {
			ok: false;
			error: InstructionRuleError;
	  };

export function normalizeToKebabCase(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(NON_ALPHANUMERIC_RUN, "-")
		.replace(DASH_RUN, "-")
		.replace(TRIM_DASHES, "");
}

export function normalizeInstructionRuleName(
	raw: string
): NormalizeInstructionRuleNameResult {
	if (raw.trim().length === 0) {
		return {
			ok: false,
			error: new InstructionRuleError("Instruction name is required."),
		};
	}

	const normalizedName = normalizeToKebabCase(raw);
	if (normalizedName.length === 0) {
		return {
			ok: false,
			error: new InstructionRuleError(
				"Instruction name must include at least one letter or number."
			),
		};
	}

	if (!KEBAB_CASE_PATTERN.test(normalizedName)) {
		return {
			ok: false,
			error: new InstructionRuleError(
				"Instruction name must normalize to lowercase kebab-case."
			),
		};
	}

	return { ok: true, normalizedName };
}

export function instructionRuleFileName(normalizedName: string): string {
	return `${normalizedName}.instructions.md`;
}

export function buildInstructionRuleTemplate(normalizedName: string): string {
	return `---\ndescription: 'TODO: Describe this instruction'\napplyTo: '**'\n---\n\n# ${normalizedName}\n`;
}

export function projectInstructionsDirUri(workspaceFolder: Uri): Uri {
	return Uri.joinPath(workspaceFolder, ".github", "instructions");
}

export function userInstructionsDirUri(): Uri {
	return userInstructionsDirUriFromHomeDir(
		homedir() || process.env.USERPROFILE || ""
	);
}

export function userInstructionsDirUriFromHomeDir(homeDir: string): Uri {
	if (!homeDir) {
		throw new InstructionRuleError(
			"Unable to resolve home directory for user instruction rules."
		);
	}

	return Uri.file(join(homeDir, ".github", "instructions"));
}

export async function assertFileDoesNotExist(uri: Uri): Promise<void> {
	try {
		await workspace.fs.stat(uri);
		throw new InstructionRuleError(
			"File already exists. Choose a different instruction name."
		);
	} catch (error) {
		if (error instanceof InstructionRuleError) {
			throw error;
		}
		// stat failed => file does not exist
	}
}
