export interface CreateSpecFormData {
	description: string;
}

export interface ImageAttachmentMeta {
	id: string;
	uri: string;
	name: string;
	dataUrl: string;
}

export interface CreateSpecDraftState {
	formData: CreateSpecFormData;
	lastUpdated: number;
}

export interface CreateSpecInitPayload {
	shouldFocusPrimaryField: boolean;
	draft?: CreateSpecDraftState;
}

export type CreateSpecExtensionMessage =
	| { type: "create-spec/init"; payload: CreateSpecInitPayload }
	| { type: "create-spec/submit:success" }
	| { type: "create-spec/submit:error"; payload: { message: string } }
	| { type: "create-spec/confirm-close"; payload: { shouldClose: boolean } }
	| { type: "create-spec/focus" }
	| {
			type: "create-spec/import-markdown:result";
			payload: { content: string; warning?: string } | { error: string };
	  }
	| {
			type: "create-spec/attach-images:result";
			payload:
				| {
						images: ImageAttachmentMeta[];
						capped?: boolean;
				  }
				| { error: string };
	  };
