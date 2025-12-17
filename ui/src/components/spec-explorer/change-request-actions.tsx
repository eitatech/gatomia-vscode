/**
 * Change Request Actions Component
 * Provides UI controls for dispatching change requests to tasks prompt and retry on failure
 */

import { useState } from "react";
import { Button } from "../ui/button";

interface TaskLink {
	taskId: string;
	source: "tasksPrompt";
	status: "open" | "inProgress" | "done";
	createdAt: Date;
}

interface ChangeRequest {
	id: string;
	specId: string;
	title: string;
	description: string;
	severity: "low" | "medium" | "high" | "critical";
	status: "open" | "blocked" | "inProgress" | "addressed";
	tasks: TaskLink[];
	submitter: string;
	createdAt: Date;
	updatedAt: Date;
	sentToTasksAt: Date | null;
	notes?: string;
}

interface ChangeRequestActionsProps {
	changeRequest: ChangeRequest;
	onDispatch: (changeRequestId: string) => Promise<void>;
	onRetry: (changeRequestId: string) => Promise<void>;
}

const BUTTON_DISPATCH = "Dispatch to Tasks";
const BUTTON_RETRY = "Retry";
const BUTTON_DISPATCHING = "Dispatching...";

export function ChangeRequestActions({
	changeRequest,
	onDispatch,
	onRetry,
}: ChangeRequestActionsProps) {
	const [isDispatching, setIsDispatching] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const canDispatch = changeRequest.status === "open";
	const canRetryDispatch = changeRequest.status === "blocked";
	const isInProgress = changeRequest.status === "inProgress";
	const isAddressed = changeRequest.status === "addressed";

	const handleDispatch = async () => {
		setIsDispatching(true);
		setErrorMessage(null);

		try {
			await onDispatch(changeRequest.id);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to dispatch change request";
			setErrorMessage(message);
		} finally {
			setIsDispatching(false);
		}
	};

	const handleRetry = async () => {
		setIsDispatching(true);
		setErrorMessage(null);

		try {
			await onRetry(changeRequest.id);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Retry failed";
			setErrorMessage(message);
		} finally {
			setIsDispatching(false);
		}
	};

	return (
		<div className="change-request-actions">
			<div className="actions-buttons">
				{canDispatch && (
					<Button
						disabled={isDispatching}
						onClick={handleDispatch}
						variant="default"
					>
						{isDispatching ? BUTTON_DISPATCHING : BUTTON_DISPATCH}
					</Button>
				)}

				{canRetryDispatch && (
					<Button
						disabled={isDispatching}
						onClick={handleRetry}
						variant="outline"
					>
						{isDispatching ? BUTTON_DISPATCHING : BUTTON_RETRY}
					</Button>
				)}

				{isInProgress && (
					<div className="status-badge in-progress">
						<span className="status-indicator" />
						<span>In Progress ({changeRequest.tasks.length} tasks)</span>
					</div>
				)}

				{isAddressed && (
					<div className="status-badge addressed">
						<span className="status-indicator" />
						<span>Addressed</span>
					</div>
				)}
			</div>

			{errorMessage && (
				<div className="error-message" role="alert">
					<span className="error-icon">⚠️</span>
					<span>{errorMessage}</span>
				</div>
			)}

			{canRetryDispatch && (
				<output className="info-message">
					<span className="info-icon">ℹ️</span>
					<span>
						Tasks prompt unavailable. You can retry when the service is back
						online.
					</span>
				</output>
			)}
		</div>
	);
}
