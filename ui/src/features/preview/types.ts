export interface PreviewSectionPayload {
	id: string;
	title: string;
	body?: string;
}

export interface PreviewFormField {
	fieldId: string;
	label: string;
	type: "checkbox" | "dropdown" | "text" | "textarea" | "multiselect";
	options?: string[];
	required?: boolean;
	value?: string | string[];
	validationRules?: Record<string, unknown>;
	readOnly?: boolean;
}

export interface PreviewDocumentPermissions {
	canEditForms: boolean;
	reason?: string;
}

export type PreviewRefinementIssueType =
	| "missingDetail"
	| "incorrectInfo"
	| "missingAsset"
	| "other";

export type PreviewRefinementActionType = "refine" | "update";

export interface DocumentArtifact {
	documentId: string;
	documentType: string;
	title: string;
	filePath?: string;
	version?: string;
	owner?: string;
	updatedAt?: string;
	renderStandard?: string;
	rawContent?: string;
	sessionId?: string;
	isOutdated?: boolean;
	outdatedInfo?: {
		outdatedSince: number;
		changedDependencies: Array<{
			documentId: string;
			documentType: string;
		}>;
	};
	sections?: PreviewSectionPayload[];
	forms?: PreviewFormField[];
	permissions?: PreviewDocumentPermissions;
}

export interface PreviewDocumentPayload extends DocumentArtifact {}

export interface PreviewRefinementPayload {
	requestId: string;
	documentId: string;
	documentType: string;
	documentVersion?: string;
	sectionRef?: string;
	issueType: PreviewRefinementIssueType;
	description: string;
	submittedAt: string;
	actionType?: PreviewRefinementActionType;
	changedDependencies?: Array<{
		documentId: string;
		documentType: string;
	}>;
}

export interface PreviewFormSubmissionPayload {
	requestId: string;
	documentId: string;
	sessionId: string;
	fields: Array<{ fieldId: string; value: string | string[]; dirty: boolean }>;
	submittedAt: string;
}

export type PreviewExtensionMessage =
	| { type: "preview/load-document"; payload: PreviewDocumentPayload }
	| { type: "preview/show-placeholder"; payload?: { reason?: string } }
	| {
			type: "preview/forms/result";
			payload: {
				requestId: string;
				status: "success" | "error";
				message?: string;
			};
	  }
	| {
			type: "preview/refine/result";
			payload: {
				requestId: string;
				status: "success" | "error";
				message?: string;
			};
	  };

export type PreviewWebviewMessage =
	| { type: "preview/ready" }
	| { type: "preview/request-reload" }
	| { type: "preview/open-in-editor" }
	| { type: "preview/edit-attempt"; payload?: { reason?: string } }
	| { type: "preview/forms/submit"; payload: PreviewFormSubmissionPayload }
	| { type: "preview/refine/submit"; payload: PreviewRefinementPayload }
	| { type: "preview/execute-task-group"; payload: { groupName: string } }
	| { type: "preview/open-file"; payload: { filePath: string } };
