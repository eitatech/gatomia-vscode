export type PreviewDocumentType =
	| "task"
	| "spec"
	| "plan"
	| "research"
	| "dataModel"
	| "api"
	| "quickstart";

export interface PreviewSection {
	id: string;
	title: string;
	body?: string;
}

export interface DiagramBlock {
	diagramId: string;
	language: string;
	rawSource: string;
	renderStandard?: string;
}

export interface FormField {
	fieldId: string;
	label: string;
	type: "checkbox" | "dropdown" | "text" | "textarea" | "multiselect";
	options?: string[];
	required?: boolean;
	value?: string | string[];
	validationRules?: Record<string, unknown>;
	readOnly?: boolean;
}

export interface FormSubmissionPayload {
	requestId: string;
	documentId: string;
	sessionId: string;
	fields: Array<{ fieldId: string; value: string | string[]; dirty: boolean }>;
	submittedAt: string;
}

export type RefinementIssueType =
	| "missingDetail"
	| "incorrectInfo"
	| "missingAsset"
	| "other";

export interface RefinementRequestPayload {
	requestId: string;
	documentId: string;
	documentType: PreviewDocumentType;
	documentVersion?: string;
	sectionRef?: string;
	issueType: RefinementIssueType;
	description: string;
	submittedAt: string;
}

export interface RefinementResultPayload {
	requestId: string;
	status: "success" | "error";
	message?: string;
}

export interface DocumentPermissions {
	canEditForms: boolean;
	reason?: string;
}

export interface DocumentArtifact {
	documentId: string;
	documentType: PreviewDocumentType;
	title: string;
	version?: string;
	owner?: string;
	updatedAt?: string;
	renderStandard: string;
	sessionId: string;
	sections: PreviewSection[];
	diagrams: DiagramBlock[];
	forms: FormField[];
	rawContent: string;
	metadata: Record<string, unknown>;
	permissions?: DocumentPermissions;
}

export type PreviewPanelMessage =
	| { type: "preview/load-document"; payload: DocumentArtifact }
	| { type: "preview/show-placeholder"; payload?: { reason?: string } }
	| {
			type: "preview/forms/result";
			payload: {
				requestId: string;
				status: "success" | "error";
				message?: string;
			};
	  }
	| { type: "preview/refine/result"; payload: RefinementResultPayload }
	| { type: "preview/refresh-request" };

export type PreviewWebviewMessage =
	| { type: "preview/ready" }
	| { type: "preview/request-reload" }
	| { type: "preview/edit-attempt"; payload?: { reason?: string } }
	| { type: "preview/open-in-editor" }
	| { type: "preview/forms/submit"; payload: FormSubmissionPayload }
	| { type: "preview/refine/submit"; payload: RefinementRequestPayload };
