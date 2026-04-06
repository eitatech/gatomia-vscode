import { vscode } from "@/bridge/vscode";
import { Send, X } from "lucide-react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type FormEvent,
} from "react";
import { CreateSpecForm } from "./components/create-spec-form";
import { StatusBanner } from "./components/status-banner";
import type {
	CreateSpecDraftState,
	CreateSpecExtensionMessage,
	CreateSpecFormData,
	CreateSpecInitPayload,
	ImageAttachmentMeta,
} from "./types";

const AUTOSAVE_DEBOUNCE_MS = 600;

const normalizeDescription = (
	data: Partial<CreateSpecFormData> | undefined
): string => (typeof data?.description === "string" ? data.description : "");

const formatTimestamp = (timestamp: number | undefined): string | undefined => {
	if (!timestamp) {
		return;
	}

	try {
		return new Intl.DateTimeFormat(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date(timestamp));
	} catch {
		return;
	}
};

const readPersistedDraft = (): CreateSpecDraftState | undefined => {
	const raw = vscode.getState() as CreateSpecDraftState | undefined;
	if (!raw?.formData || typeof raw.lastUpdated !== "number") {
		return;
	}

	return {
		formData: { description: normalizeDescription(raw.formData) },
		lastUpdated: raw.lastUpdated,
	};
};

export const CreateSpecView = () => {
	const [description, setDescription] = useState("");
	const [attachments, setAttachments] = useState<ImageAttachmentMeta[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [fieldError, setFieldError] = useState<string | undefined>();
	const [submissionError, setSubmissionError] = useState<string | undefined>();
	const [draftSavedAt, setDraftSavedAt] = useState<number | undefined>();
	const [closeWarningVisible, setCloseWarningVisible] = useState(false);
	const [pendingImportConfirm, setPendingImportConfirm] = useState(false);
	const [isImporting, setIsImporting] = useState(false);

	const descriptionRef = useRef<HTMLTextAreaElement>(null);
	const lastPersistedRef = useRef<string>("");

	const isDirty = description !== lastPersistedRef.current;

	const persistDraft = useCallback((desc: string) => {
		if (desc === lastPersistedRef.current) {
			return;
		}

		const nextState: CreateSpecDraftState = {
			formData: { description: desc },
			lastUpdated: Date.now(),
		};

		lastPersistedRef.current = desc;
		setDraftSavedAt(nextState.lastUpdated);
		vscode.setState(nextState);
		vscode.postMessage({
			type: "create-spec/autosave",
			payload: { description: desc },
		});
	}, []);

	const handleDescriptionChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setDescription(event.target.value);
		},
		[]
	);

	const handleSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (isSubmitting) {
				return;
			}

			const trimmed = description.trim();
			if (!trimmed) {
				setFieldError("Description is required.");
				descriptionRef.current?.focus();
				return;
			}

			setFieldError(undefined);
			setIsSubmitting(true);
			setSubmissionError(undefined);

			vscode.postMessage({
				type: "create-spec/submit",
				payload: {
					description: trimmed,
					imageUris: attachments.map((a) => a.uri),
				},
			});
		},
		[description, attachments, isSubmitting]
	);

	const handleCancel = useCallback(() => {
		vscode.postMessage({
			type: "create-spec/close-attempt",
			payload: { hasDirtyChanges: isDirty },
		});
	}, [isDirty]);

	const focusPrimaryField = useCallback(() => {
		window.setTimeout(() => {
			descriptionRef.current?.focus();
		}, 0);
	}, []);

	const handleImportClick = useCallback(() => {
		if (description.trim()) {
			setPendingImportConfirm(true);
		} else {
			setIsImporting(true);
			vscode.postMessage({ type: "create-spec/import-markdown:request" });
		}
	}, [description]);

	const handleConfirmImport = useCallback(() => {
		setPendingImportConfirm(false);
		setIsImporting(true);
		vscode.postMessage({ type: "create-spec/import-markdown:request" });
	}, []);

	const handleCancelImport = useCallback(() => {
		setPendingImportConfirm(false);
	}, []);

	const handleAttach = useCallback(() => {
		vscode.postMessage({
			type: "create-spec/attach-images:request",
			payload: { currentCount: attachments.length },
		});
	}, [attachments.length]);

	const handleRemoveAttachment = useCallback((id: string) => {
		setAttachments((previous) => previous.filter((a) => a.id !== id));
	}, []);

	const handleInitMessage = useCallback(
		(initPayload?: CreateSpecInitPayload) => {
			const desc = normalizeDescription(initPayload?.draft?.formData);
			lastPersistedRef.current = desc;
			setDescription(desc);
			setAttachments([]);
			setDraftSavedAt(initPayload?.draft?.lastUpdated);
			setSubmissionError(undefined);
			setIsSubmitting(false);
			setFieldError(undefined);
			setCloseWarningVisible(false);
			setPendingImportConfirm(false);
			setIsImporting(false);
			vscode.setState(initPayload?.draft);

			if (initPayload?.shouldFocusPrimaryField) {
				focusPrimaryField();
			}
		},
		[focusPrimaryField]
	);

	useEffect(() => {
		const persistedDraft = readPersistedDraft();
		if (persistedDraft) {
			lastPersistedRef.current = persistedDraft.formData.description;
			setDescription(persistedDraft.formData.description);
			setDraftSavedAt(persistedDraft.lastUpdated);
		}

		vscode.postMessage({ type: "create-spec/ready" });
	}, []);

	const handleImportMarkdownResult = useCallback(
		(payload: { content: string; warning?: string } | { error: string }) => {
			setIsImporting(false);
			if ("error" in payload) {
				setSubmissionError(payload.error);
			} else {
				setDescription(payload.content);
				lastPersistedRef.current = "";
			}
		},
		[]
	);

	const handleAttachImagesResult = useCallback(
		(
			payload:
				| { images: ImageAttachmentMeta[]; capped?: boolean }
				| { error: string }
		) => {
			if ("error" in payload) {
				setSubmissionError(payload.error);
			} else {
				setAttachments((previous) => [...previous, ...payload.images]);
			}
		},
		[]
	);

	useEffect(() => {
		const handleMessage = (event: MessageEvent<CreateSpecExtensionMessage>) => {
			const msg = event.data;
			if (!msg || typeof msg !== "object") {
				return;
			}

			switch (msg.type) {
				case "create-spec/init": {
					handleInitMessage(msg.payload);
					break;
				}
				case "create-spec/submit:success": {
					setIsSubmitting(false);
					setSubmissionError(undefined);
					break;
				}
				case "create-spec/submit:error": {
					setIsSubmitting(false);
					setSubmissionError(msg.payload?.message ?? "Failed to submit.");
					break;
				}
				case "create-spec/confirm-close": {
					setCloseWarningVisible(!msg.payload?.shouldClose);
					break;
				}
				case "create-spec/focus": {
					focusPrimaryField();
					break;
				}
				case "create-spec/import-markdown:result": {
					handleImportMarkdownResult(msg.payload);
					break;
				}
				case "create-spec/attach-images:result": {
					handleAttachImagesResult(msg.payload);
					break;
				}
				default:
					break;
			}
		};

		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, [
		focusPrimaryField,
		handleInitMessage,
		handleImportMarkdownResult,
		handleAttachImagesResult,
	]);

	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!isDirty) {
				return;
			}

			event.preventDefault();
			event.returnValue = "";
			vscode.postMessage({
				type: "create-spec/close-attempt",
				payload: { hasDirtyChanges: true },
			});
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [isDirty]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			persistDraft(description);
		}, AUTOSAVE_DEBOUNCE_MS);

		return () => {
			window.clearTimeout(timer);
		};
	}, [description, persistDraft]);

	const statusBanner = useMemo(() => {
		if (submissionError) {
			return (
				<StatusBanner ariaLive="assertive" role="alert" tone="error">
					{submissionError}
				</StatusBanner>
			);
		}

		if (closeWarningVisible) {
			return (
				<StatusBanner role="status" tone="warning">
					Changes are still available. Close action was cancelled.
				</StatusBanner>
			);
		}

		if (isSubmitting) {
			return (
				<StatusBanner role="status" tone="info">
					Sending spec prompt…
				</StatusBanner>
			);
		}

		return null;
	}, [closeWarningVisible, isSubmitting, submissionError]);

	const lastSavedLabel = formatTimestamp(draftSavedAt);
	const autosaveStatus = useMemo(() => {
		if (lastSavedLabel) {
			return `Draft saved at ${lastSavedLabel}`;
		}

		if (isDirty) {
			return "Unsaved changes";
		}

		return "All changes saved";
	}, [isDirty, lastSavedLabel]);

	return (
		<div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 px-4 pb-6">
			<header className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-[var(--vscode-editor-background)] pt-6 pb-4">
				<div className="flex flex-col gap-2">
					<h1 className="font-semibold text-2xl text-[color:var(--vscode-foreground)]">
						Create New Spec
					</h1>
					<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm">
						Describe the specification you want to create. Optionally, import
						from a Markdown file or attach reference images.
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<button
						aria-label="Cancel"
						className="rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-secondaryBackground,#3c3c3c)] px-2 py-1 text-[color:var(--vscode-button-secondaryForeground)] text-sm transition-colors hover:bg-[color:var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50"
						disabled={isSubmitting}
						onClick={handleCancel}
						title="Cancel"
						type="button"
					>
						<X aria-hidden="true" className="h-4 w-4" />
					</button>
					<button
						aria-label={isSubmitting ? "Creating…" : "Create Spec"}
						className="rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-background)] px-2 py-1 text-[color:var(--vscode-button-foreground)] text-sm transition-colors hover:bg-[color:var(--vscode-button-hoverBackground)] disabled:opacity-50"
						disabled={isSubmitting}
						form="create-spec-form"
						title={isSubmitting ? "Creating…" : "Create Spec"}
						type="submit"
					>
						<Send aria-hidden="true" className="h-4 w-4" />
					</button>
				</div>
			</header>

			{statusBanner}

			<CreateSpecForm
				attachments={attachments}
				autosaveStatus={autosaveStatus}
				description={description}
				descriptionRef={descriptionRef}
				fieldError={fieldError}
				formId="create-spec-form"
				isImporting={isImporting}
				isSubmitting={isSubmitting}
				onAttach={handleAttach}
				onCancelImport={handleCancelImport}
				onConfirmImport={handleConfirmImport}
				onDescriptionChange={handleDescriptionChange}
				onImport={handleImportClick}
				onRemoveAttachment={handleRemoveAttachment}
				onSubmit={handleSubmit}
				pendingImportConfirm={pendingImportConfirm}
			/>
		</div>
	);
};

export default CreateSpecView;
