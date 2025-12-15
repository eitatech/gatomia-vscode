# Preview Form Components

Reusable form field components for interactive document previews in GatomIA.

## Components

### PreviewFormField

Main form field component that renders different input types based on the `type` prop.

**Supported Field Types:**
- `text` - Single-line text input
- `textarea` - Multi-line text input
- `checkbox` - Boolean checkbox
- `dropdown` - Single-select dropdown
- `multiselect` - Multiple checkbox selections

**Features:**
- Automatic state management via `formStore`
- Built-in validation with inline error display
- Read-only mode support
- VS Code theme integration
- Accessible with ARIA attributes

**Example:**
```tsx
import { PreviewFormField } from "@/components/forms/preview-form-field";

<PreviewFormField
  type="text"
  fieldId="task-title"
  label="Task Title"
  required
  placeholder="Enter task title..."
/>

<PreviewFormField
  type="dropdown"
  fieldId="priority"
  label="Priority"
  required
  options={["Low", "Medium", "High"]}
  placeholder="Select priority..."
/>

<PreviewFormField
  type="multiselect"
  fieldId="tags"
  label="Tags"
  options={["bug", "feature", "enhancement"]}
/>
```

### PreviewFormActions

Action buttons and status display for form submissions.

**Features:**
- Automatic enable/disable based on dirty state
- Validation error summary
- Loading states during submission
- Save/discard controls

**Example:**
```tsx
import { PreviewFormActions } from "@/components/forms/preview-form-actions";

<PreviewFormActions
  onSubmit={async () => {
    const payload = formStore.prepareSubmission();
    await saveFormData(payload);
    formStore.markSubmitted();
  }}
  onCancel={() => {
    formStore.discardChanges();
  }}
  submitLabel="Save Changes"
  cancelLabel="Discard"
  showStatus
/>
```

### PreviewFormContainer

Complete form integration example showing how to use all components together.

**Example:**
```tsx
import { PreviewFormContainer } from "@/components/forms/preview-form-container";

<PreviewFormContainer
  documentId={document.documentId}
  sessionId={sessionId}
  fields={document.forms}
  readOnly={!hasEditPermission}
  onSubmit={handleFormSubmit}
  onCancel={handleCancel}
/>
```

## Form Store Integration

All components connect to `formStore` for state management. The store must be initialized before rendering form fields:

```tsx
import { formStore } from "@/features/preview/stores/form-store";

// Initialize when document loads
useEffect(() => {
	formStore.initializeFields({
		documentId,
		sessionId,
		fields,
		readOnlyMode,
	});

  return () => {
    formStore.reset();
  };
}, [documentId, sessionId, fields, readOnlyMode]);
```

## Validation

Validation happens automatically:
- **On field change** - Immediate validation feedback
- **Before submission** - Blocks invalid submissions
- **Display** - Inline errors + summary in PreviewFormActions

### Supported Validation Rules

**Built-in:**
- `required` - Field must have a value
- Type-specific (dropdown/multiselect option matching)

**Custom (via `validationRules`):**
- `minLength` - Minimum character count
- `maxLength` - Maximum character count
- `pattern` - Regex pattern matching
- `patternMessage` - Custom pattern error message

**Example:**
```tsx
const field = {
  fieldId: "email",
  type: "text",
  label: "Email",
  required: true,
  validationRules: {
    pattern: "^[^@]+@[^@]+\\.[^@]+$",
    patternMessage: "Please enter a valid email address"
  }
};
```

## Styling

All components use VS Code theme variables for consistent styling:
- `--vscode-input-background`
- `--vscode-input-foreground`
- `--vscode-input-border`
- `--vscode-focusBorder`
- `--vscode-errorForeground`
- `--vscode-inputValidation-errorBorder`
- `--vscode-inputValidation-errorBackground`

## Accessibility

- Semantic HTML (fieldset/legend for multiselect)
- ARIA attributes (aria-required, aria-invalid, aria-describedby)
- Keyboard navigation support
- Focus management
- Screen reader friendly error messages

## Related Files

- [form-store.ts](../../features/preview/stores/form-store.ts) - State management
- [data-model.md](../../../../specs/001-document-preview/data-model.md) - Entity definitions
- [contracts/preview.yaml](../../../../specs/001-document-preview/contracts/preview.yaml) - API contracts
