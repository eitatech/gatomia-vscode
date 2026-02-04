---
name: preview_quick_start
description: Quick start guide for the Preview System
author: Italo A. G.
version: v0.32.1-2-g5a4ac1b
---

# Preview System Quick Start

## Overview
This guide helps you quickly understand and start using the Preview System. The system enables interactive document previews with form editing and refinement capabilities within VS Code.

## 5-Minute Setup

### 1. Basic Document Preview
```typescript
// Load a document into the preview pane
const document: DocumentArtifact = {
    documentId: "my-doc-123",
    documentType: "spec",
    title: "My Specification",
    renderStandard: "# My Document\n\nThis is a preview of my document.",
    sessionId: "session-456",
    sections: [
        {
            id: "section-1",
            title: "Introduction",
            body: "This is the introduction section."
        }
    ]
};

// Send to webview
webview.postMessage({
    type: "preview/load-document",
    payload: document
});
```

### 2. Add Interactive Forms
```typescript
// Create a document with interactive forms
const documentWithForms: DocumentArtifact = {
    ...document,
    forms: [
        {
            fieldId: "status",
            label: "Status",
            type: "dropdown",
            options: ["Draft", "Review", "Approved", "Rejected"],
            value: "Draft",
            required: true
        },
        {
            fieldId: "notes",
            label: "Review Notes",
            type: "textarea",
            validationRules: {
                maxLength: 1000
            }
        }
    ],
    permissions: {
        canEditForms: true // Set based on user permissions
    }
};
```

### 3. Handle Form Submissions
```typescript
// Webview side - React component
import { formStore } from "@/features/preview/stores/form-store";
import { submitForm } from "@/features/preview/api/form-bridge";

function MyFormComponent() {
    const snapshot = useSyncExternalStore(
        formStore.subscribe,
        formStore.getSnapshot
    );
    
    const handleSubmit = async () => {
        const payload = formStore.prepareSubmission();
        if (payload) {
            try {
                const result = await submitForm(payload);
                if (result.status === "success") {
                    alert("Form submitted successfully!");
                    formStore.markSubmitted();
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        }
    };
    
    return (
        <div>
            <button onClick={handleSubmit} disabled={snapshot.isSubmitting}>
                {snapshot.isSubmitting ? "Submitting..." : "Submit"}
            </button>
        </div>
    );
}
```

## Common Use Cases

### Use Case 1: Document Review Workflow
```typescript
// Create a review document with approval form
const reviewDocument: DocumentArtifact = {
    documentId: "review-123",
    documentType: "spec",
    title: "API Specification Review",
    renderStandard: "# API Spec Review\n\n## Endpoints\n- GET /api/users\n- POST /api/users",
    sessionId: "review-session-789",
    forms: [
        {
            fieldId: "reviewer",
            label: "Reviewer Name",
            type: "text",
            required: true
        },
        {
            fieldId: "approval",
            label: "Approval Decision",
            type: "dropdown",
            options: ["Approve", "Request Changes", "Reject"],
            required: true
        },
        {
            fieldId: "comments",
            label: "Review Comments",
            type: "textarea"
        }
    ]
};
```

### Use Case 2: Task Checklist
```typescript
// Create a checklist document
const checklistDocument: DocumentArtifact = {
    documentId: "checklist-456",
    documentType: "checklist",
    title: "Deployment Checklist",
    renderStandard: "# Deployment Steps\n\n1. Run tests\n2. Build artifacts\n3. Deploy to staging",
    sessionId: "checklist-session-101",
    forms: [
        {
            fieldId: "tests-passed",
            label: "All tests passed",
            type: "checkbox",
            value: "false"
        },
        {
            fieldId: "build-successful",
            label: "Build successful",
            type: "checkbox",
            value: "false"
        },
        {
            fieldId: "deployed-to",
            label: "Deployed to environment",
            type: "dropdown",
            options: ["Staging", "Production", "Test"],
            value: "Staging"
        }
    ]
};
```

### Use Case 3: Document Feedback
```typescript
// Allow users to provide feedback on documents
async function submitDocumentFeedback() {
    try {
        const result = await submitRefinement({
            documentId: "doc-123",
            documentType: "spec",
            issueType: "missingDetail",
            description: "The authentication section needs more details about OAuth2 flows.",
            sectionRef: "authentication"
        });
        
        if (result.status === "success") {
            console.log("Feedback submitted successfully");
        }
    } catch (error) {
        console.error("Failed to submit feedback:", error);
    }
}
```

## Troubleshooting

### Common Issues and Solutions

**Issue 1: Form not submitting**
```typescript
// Check: Are there dirty fields?
const dirtyFields = formStore.getDirtyFields();
if (dirtyFields.length === 0) {
    console.warn("No changes to submit");
    return;
}

// Check: Is the form valid?
if (!formStore.validateAll()) {
    const errors = formStore.getSnapshot().validationErrors;
    console.error("Validation errors:", errors);
    return;
}

// Check: Read-only mode?
if (formStore.getSnapshot().readOnlyMode) {
    console.error("Form is in read-only mode");
    return;
}
```

**Issue 2: Preview not loading**
```typescript
// Check: Is the webview ready?
// Send ready message first
webview.postMessage({ type: "preview/ready" });

// Check: Document structure
const isValidDocument = 
    document.documentId && 
    document.documentType && 
    document.renderStandard;
    
if (!isValidDocument) {
    console.error("Invalid document structure");
}
```

**Issue 3: Bridge timeout errors**
```typescript
// Increase timeout for large documents
async function submitWithLongerTimeout(payload: FormSubmissionPayload) {
    const originalSubmit = submitForm;
    
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Custom timeout after 30 seconds"));
        }, 30000);
        
        originalSubmit(payload)
            .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
    });
}
```

## Next Steps

### 1. Explore Advanced Features
- **Real-time updates**: Subscribe to document changes
- **Collaborative editing**: Multiple users editing same document
- **Version history**: Track form changes over time
- **Template system**: Create document templates with pre-filled forms

### 2. Integrate with Other Systems
- **Task system**: Create tasks from form submissions
- **Hook system**: Trigger actions on form events
- **Notification system**: Send alerts on document updates
- **Analytics**: Track document engagement metrics

### 3. Customize for Your Needs
- **Custom field types**: Create specialized form fields
- **Validation rules**: Add domain-specific validation
- **Theming**: Customize preview appearance
- **Extensions**: Add plugins for additional functionality

## Resources

### Documentation
- [Preview System Architecture](preview_system.md) - Complete system overview
- [Form Store Guide](preview_form_store.md) - Detailed form management
- [Bridge APIs](preview_bridge_apis.md) - Communication layer documentation

### Code Examples
- `ui/src/features/preview/preview-app.tsx` - Main preview component
- `ui/src/features/preview/stores/form-store.ts` - Form state management
- `ui/src/features/preview/api/form-bridge.ts` - Form submission API

### Related Modules
- [hooks_system](hooks_system.md) - For extending form actions
- [specification_management](specification_management.md) - For spec documents
- [ui_view_providers](ui_view_providers.md) - For webview infrastructure