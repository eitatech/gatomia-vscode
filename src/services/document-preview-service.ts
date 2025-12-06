import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import matter from "gray-matter";
import {
	type Event,
	EventEmitter,
	type Uri,
	type OutputChannel,
	workspace,
} from "vscode";
import type {
	DocumentArtifact,
	DocumentPermissions,
	FormField,
	FormSubmissionPayload,
	PreviewDocumentType,
	PreviewSection,
} from "../types/preview";

export interface LoadDocumentOptions {
	documentType?: PreviewDocumentType;
	titleOverride?: string;
}

const LINE_SPLIT_PATTERN = /\r?\n/;
const HEADING_PATTERN = /^##\s+(.+)/;

export class DocumentPreviewService {
	private readonly changeEmitter = new EventEmitter<Uri>();
	readonly onDidChangeDocument: Event<Uri>;
	private readonly outputChannel: OutputChannel;

	constructor(outputChannel: OutputChannel) {
		this.outputChannel = outputChannel;
		this.onDidChangeDocument = this.changeEmitter.event;
	}

	async loadDocument(
		uri: Uri,
		options: LoadDocumentOptions = {}
	): Promise<DocumentArtifact> {
		const bytes = await workspace.fs.readFile(uri);
		const content = Buffer.from(bytes).toString("utf8");
		const parsed = matter(content);

		const documentType =
			options.documentType ?? this.inferTypeFromUri(uri.fsPath);

		const sections = this.extractSections(parsed.content);
		const forms = this.parseForms(parsed.data?.forms);
		const permissions = this.parsePermissions(parsed.data?.permissions);

		const artifact: DocumentArtifact = {
			documentId: uri.toString(),
			documentType,
			title:
				options.titleOverride ||
				(parsed.data?.title as string | undefined) ||
				basename(uri.fsPath),
			version: parsed.data?.version as string | undefined,
			owner: parsed.data?.owner as string | undefined,
			updatedAt:
				(parsed.data?.updatedAt as string | undefined) ||
				new Date().toISOString(),
			renderStandard:
				(parsed.data?.renderStandard as string | undefined) || "markdown",
			sessionId: randomUUID(),
			sections,
			diagrams: [],
			forms,
			rawContent: parsed.content,
			metadata: parsed.data ?? {},
			permissions,
		};

		this.outputChannel.appendLine(
			`[DocumentPreviewService] Loaded ${artifact.documentType} from ${uri.fsPath}`
		);

		return artifact;
	}

	persistFormSubmission(payload: FormSubmissionPayload): void {
		const changedFieldIds = payload.fields
			.map((field) => field.fieldId)
			.join(", ");
		this.outputChannel.appendLine(
			`[DocumentPreviewService] Received form submission for ${payload.documentId} (session ${payload.sessionId}) with fields: ${changedFieldIds}`
		);
	}

	markDocumentChanged(uri: Uri): void {
		this.changeEmitter.fire(uri);
	}

	private parseForms(rawForms: unknown): FormField[] {
		if (!Array.isArray(rawForms)) {
			return [];
		}

		return rawForms
			.map((rawField, index) => this.normalizeFormField(rawField, index))
			.filter((field): field is FormField => Boolean(field));
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Normalizing heterogeneous form definitions requires consolidated branching.
	private normalizeFormField(
		rawField: unknown,
		index: number
	): FormField | undefined {
		if (!rawField || typeof rawField !== "object") {
			return;
		}

		const candidate = rawField as Record<string, unknown>;
		const supportedTypes = new Set<FormField["type"]>([
			"checkbox",
			"dropdown",
			"text",
			"textarea",
			"multiselect",
		]);

		const rawType =
			typeof candidate.type === "string" ? candidate.type : "text";
		const type = supportedTypes.has(rawType as FormField["type"])
			? (rawType as FormField["type"])
			: "text";

		const fieldId =
			typeof candidate.fieldId === "string" && candidate.fieldId.trim()
				? candidate.fieldId.trim()
				: `form-field-${index + 1}`;

		let value: string | string[] | undefined;
		if (type === "multiselect") {
			if (Array.isArray(candidate.value)) {
				value = candidate.value.filter(
					(item): item is string => typeof item === "string"
				);
			} else if (
				typeof candidate.value === "string" &&
				candidate.value.length > 0
			) {
				value = candidate.value.split(",").map((item) => item.trim());
			} else {
				value = [];
			}
		} else if (typeof candidate.value === "string") {
			value = candidate.value;
		}

		const options = Array.isArray(candidate.options)
			? candidate.options
					.map((option) => (typeof option === "string" ? option : undefined))
					.filter((option): option is string => Boolean(option))
			: undefined;

		return {
			fieldId,
			label:
				(typeof candidate.label === "string" && candidate.label.trim()) ||
				fieldId,
			type,
			options,
			required: Boolean(candidate.required),
			value,
			validationRules:
				candidate.validationRules &&
				typeof candidate.validationRules === "object"
					? (candidate.validationRules as Record<string, unknown>)
					: undefined,
			readOnly: Boolean(candidate.readOnly),
		};
	}

	private parsePermissions(
		rawPermissions: unknown
	): DocumentPermissions | undefined {
		if (!rawPermissions || typeof rawPermissions !== "object") {
			return;
		}

		const candidate = rawPermissions as Record<string, unknown>;
		let canEditForms = true;
		if (typeof candidate.canEditForms === "boolean") {
			canEditForms = candidate.canEditForms;
		} else if (typeof candidate.canEdit === "boolean") {
			canEditForms = candidate.canEdit;
		} else if (candidate.readOnly === true) {
			canEditForms = false;
		}

		const reason =
			typeof candidate.reason === "string" && candidate.reason.trim().length > 0
				? candidate.reason.trim()
				: undefined;

		return {
			canEditForms,
			reason,
		};
	}

	private inferTypeFromUri(path: string): PreviewDocumentType {
		const normalized = path.toLowerCase();
		if (normalized.includes("/plan") || normalized.includes("-plan")) {
			return "plan";
		}
		if (normalized.includes("research")) {
			return "research";
		}
		if (normalized.includes("task")) {
			return "task";
		}
		if (
			normalized.includes("data-model") ||
			normalized.includes("data_model")
		) {
			return "dataModel";
		}
		if (normalized.includes("quickstart")) {
			return "quickstart";
		}
		if (normalized.includes("api")) {
			return "api";
		}
		return "spec";
	}

	private extractSections(content: string): PreviewSection[] {
		const lines = content.split(LINE_SPLIT_PATTERN);
		const sections: PreviewSection[] = [];
		let currentTitle = "Overview";
		let currentId = "overview";
		let currentBody: string[] = [];
		const slugCounts = new Map<string, number>();

		const commit = () => {
			const body = currentBody.join("\n").trim();
			sections.push({
				id: this.uniqueSlug(currentId, slugCounts),
				title: currentTitle,
				body,
			});
		};

		for (const line of lines) {
			const match = line.match(HEADING_PATTERN);
			if (match) {
				if (currentBody.length > 0 || sections.length === 0) {
					commit();
				}
				currentTitle = match[1].trim();
				currentId = this.slugify(currentTitle);
				currentBody = [];
				continue;
			}
			currentBody.push(line);
		}

		if (currentBody.length > 0 || sections.length === 0) {
			commit();
		}

		return sections;
	}

	private slugify(value: string): string {
		return (
			value
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "") || "section"
		);
	}

	private uniqueSlug(value: string, counts: Map<string, number>): string {
		const count = counts.get(value) ?? 0;
		counts.set(value, count + 1);
		if (count === 0) {
			return value;
		}
		return `${value}-${count}`;
	}
}
