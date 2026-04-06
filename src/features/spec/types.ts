export interface CreateSpecFormData {
	description: string;
}

export interface CreateSpecDraftState {
	formData: CreateSpecFormData;
	lastUpdated: number;
}

export interface CreateSpecInitPayload {
	shouldFocusPrimaryField: boolean;
	draft?: CreateSpecDraftState;
}

export interface CreateSpecSubmitSuccessMessage {
	type: "create-spec/submit:success";
}

export interface CreateSpecSubmitErrorMessage {
	type: "create-spec/submit:error";
	payload: { message: string };
}

export interface CreateSpecConfirmCloseMessage {
	type: "create-spec/confirm-close";
	payload: { shouldClose: boolean };
}

export interface CreateSpecFocusMessage {
	type: "create-spec/focus";
}

export interface CreateSpecInitMessage {
	type: "create-spec/init";
	payload: CreateSpecInitPayload;
}

export interface CreateSpecImportMarkdownResultMessage {
	type: "create-spec/import-markdown:result";
	payload: { content: string; warning?: string } | { error: string };
}

export interface CreateSpecAttachImagesResultMessage {
	type: "create-spec/attach-images:result";
	payload:
		| {
				images: Array<{
					id: string;
					uri: string;
					name: string;
					dataUrl: string;
				}>;
				capped?: boolean;
		  }
		| { error: string };
}

export type CreateSpecExtensionMessage =
	| CreateSpecInitMessage
	| CreateSpecSubmitSuccessMessage
	| CreateSpecSubmitErrorMessage
	| CreateSpecConfirmCloseMessage
	| CreateSpecFocusMessage
	| CreateSpecImportMarkdownResultMessage
	| CreateSpecAttachImagesResultMessage;

export interface CreateSpecSubmitMessage {
	type: "create-spec/submit";
	payload: { description: string; imageUris: string[] };
}

export interface CreateSpecAutosaveMessage {
	type: "create-spec/autosave";
	payload: { description: string };
}

export interface CreateSpecCloseAttemptMessage {
	type: "create-spec/close-attempt";
	payload: { hasDirtyChanges: boolean };
}

export interface CreateSpecImportMarkdownRequestMessage {
	type: "create-spec/import-markdown:request";
}

export interface CreateSpecAttachImagesRequestMessage {
	type: "create-spec/attach-images:request";
	payload: { currentCount: number };
}

export interface CreateSpecCancelMessage {
	type: "create-spec/cancel";
}

export interface CreateSpecReadyMessage {
	type: "create-spec/ready";
}

export type CreateSpecWebviewMessage =
	| CreateSpecSubmitMessage
	| CreateSpecAutosaveMessage
	| CreateSpecCloseAttemptMessage
	| CreateSpecImportMarkdownRequestMessage
	| CreateSpecAttachImagesRequestMessage
	| CreateSpecCancelMessage
	| CreateSpecReadyMessage;
