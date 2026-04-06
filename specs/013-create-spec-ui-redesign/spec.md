# Feature Specification: Create New Spec UI Redesign

**Feature Branch**: `013-create-spec-ui-redesign`
**Created**: 2026-02-20
**Status**: Draft
**Input**: User description: "modifique a tela 'Create New Spec' para que tenhamos apenas um campo de texto onde o usuário descreve a especificação, um botão onde o usuário pode importar uma especificação de um arquivo markdown presente no computador do usuário, além da possibilidade de anexar imagens como anexos para a especifição. Esse conteúdo deve ser enviado para o chat conforme já ocorrer."

## User Scenarios & Testing *(mandatory)*

### Layout

The panel is composed of four stacked zones:

1. **Toolbar** — a compact row placed directly above the text area, containing the "Import from file" button and the image attachment button.
2. **Text area** — the single free-form description field, spanning the full available width.
3. **Attachment previews** — a horizontal strip of image thumbnails shown below the text area when images are attached; hidden when no images are attached.
4. **Footer** — the existing Submit / Cancel buttons and draft-saved status, unchanged.

---

### User Story 1 - Describe Spec in Single Field (Priority: P1)

A user opens the "Create New Spec" panel and sees a single, prominent text area. They type a free-form description of the feature they want to specify, then submit it to be sent to the Copilot Chat conversation — the same way it works today.

**Why this priority**: Replaces the fragmented multi-field form with a simpler, open-ended input that removes friction and reduces cognitive load. This is the core interaction and must work before anything else.

**Independent Test**: Can be fully tested by opening the panel, typing a description, submitting, and verifying the message appears in the chat conversation.

**Acceptance Scenarios**:

1. **Given** the Create New Spec panel is open, **When** the user types a description in the text area and clicks Submit, **Then** the description is sent as a prompt to the active Copilot Chat conversation.
2. **Given** the user has not typed anything, **When** they attempt to submit, **Then** a validation message informs them the description field is required and submission is blocked.
3. **Given** the user had previously started filling the form and navigated away (draft state), **When** they reopen the panel, **Then** their previous text is restored in the field.

---

### User Story 2 - Import Spec from Markdown File (Priority: P2)

A user already has a markdown document (e.g., a rough spec, a PRD, notes) saved on their computer. They click an "Import from file" button, select a `.md` file via the system file picker, and the file's content is loaded into the description field for review and editing before submission.

**Why this priority**: Enables reuse of existing documentation without copy-pasting, reducing friction for users who already have written context.

**Independent Test**: Can be fully tested by clicking the import button, selecting a `.md` file, and verifying the file content appears in the text area.

**Acceptance Scenarios**:

1. **Given** the panel is open and the description field is empty, **When** the user clicks "Import from file" and selects a valid `.md` file, **Then** the file's text content is loaded into the description field immediately.
2. **Given** the description field already contains text, **When** the user clicks "Import from file" and selects a valid `.md` file, **Then** an inline confirmation prompt appears asking whether to replace the current content; if the user confirms, the field is replaced; if they cancel, the field is unchanged.
3. **Given** the user selects a file that is not a markdown file, **When** the import is attempted, **Then** the system informs the user only `.md` files are accepted and the field is not modified.
4. **Given** the user imports a markdown file, **When** the content is loaded, **Then** the user can freely edit the content in the text field before submitting.
5. **Given** the user selects an empty markdown file, **When** the import completes, **Then** the text field is cleared and the user receives a message that the imported file was empty.

---

### User Story 3 - Attach Images to Specification (Priority: P3)

A user wants to provide visual context for their specification — such as a screenshot, wireframe, or diagram. They attach one or more image files to the spec form. When submitted, the images are included as attachments in the chat message alongside the text description.

**Why this priority**: Visual context is valuable for complex specs, but text alone is sufficient for most use cases. This is an enhancement that can be added after the core flow is in place.

**Independent Test**: Can be fully tested by attaching images, verifying thumbnails appear, removing one, and submitting to confirm images appear in the chat.

**Acceptance Scenarios**:

1. **Given** the panel is open, **When** the user clicks the attachment button and selects one or more image files, **Then** thumbnail previews of the selected images appear in the form below the text field.
2. **Given** images are attached, **When** the user submits the form, **Then** both the text description and attached images are sent to the chat conversation.
3. **Given** one or more images are shown as previews, **When** the user clicks the remove icon on a thumbnail, **Then** that image is removed from the attachment list without affecting other attachments or the text field.
4. **Given** the user attempts to attach a non-image file (e.g., `.pdf`, `.zip`), **When** the selection is made, **Then** the system rejects the file and informs the user only image files are accepted.
5. **Given** no text has been entered, **When** the user attaches only images and submits, **Then** submission is blocked and the user is informed the description field is required.

---

### Edge Cases

- What happens when the user imports a very large markdown file? If the selected file exceeds 512 KB, the system MUST reject the import and notify the user; the description field must remain unchanged.
- What happens when the user attempts to attach more than 5 images? The system rejects additional files beyond the 5-image limit and notifies the user.
- What if the user clicks "Import from file" but cancels the system file picker without selecting a file? The form must remain unchanged.
- What if the Copilot Chat conversation is not active when the user submits? The existing error-handling behavior for submission failures applies.
- What if the user edits the imported markdown content before submitting? This must be supported — the loaded content is editable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Create New Spec screen MUST display a single free-form text area as the primary input for the spec description, replacing the existing multi-field form.
- **FR-002**: The text area MUST be required; submission MUST be blocked and the user notified when the field is empty or contains only whitespace.
- **FR-003**: The screen MUST provide an "Import from file" action that opens the system file picker filtered to `.md` files. Files larger than 512 KB MUST be rejected with a clear message; the field MUST remain unchanged.
- **FR-004**: When a valid markdown file is selected and the description field is empty, its text content MUST be loaded immediately. If the field already contains text, the system MUST display an inline confirmation before replacing the existing content; if the user declines, the field MUST remain unchanged.
- **FR-005**: When a non-markdown file is selected for import, the system MUST reject it and notify the user with a clear message.
- **FR-006**: The screen MUST provide a way to attach up to 5 image files as visual attachments. If the user attempts to add more than 5, the system MUST reject additional files and notify the user of the limit.
- **FR-007**: Attached images MUST be displayed as thumbnail previews in the form before submission.
- **FR-008**: Users MUST be able to remove individual image attachments from the preview list before submitting.
- **FR-009**: On submission, the system MUST send the description text to the active Copilot Chat conversation as the prompt, and MUST attach each image using the VS Code Chat API native attachment mechanism (structured references alongside the text prompt).
- **FR-010**: Draft state (unsaved text) MUST persist across panel close/reopen within the same VS Code session, as the current form already does.
- **FR-011**: Non-image files (e.g., PDFs, documents) MUST be rejected when selected for image attachment, and the user notified.

### Key Entities

- **Spec Description**: The free-form text authored or imported by the user. Required for submission.
- **Imported Markdown**: A `.md` file selected from the file system whose content populates the description field. Optional.
- **Image Attachment**: An image file attached to the spec for visual context. Zero or more per submission.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open the panel, write a description, and submit a spec to the chat in under 60 seconds — a reduction from the current multi-field form experience.
- **SC-002**: Users can import a markdown file and have its content ready in the description field within 3 interactions (open panel → click import → select file).
- **SC-003**: After attaching images, users can visually confirm all attachments before sending, with each image shown as a preview thumbnail.
- **SC-004**: 100% of submissions that include images send both the text description and all attached images to the chat without loss.
- **SC-005**: Validation prevents empty submissions, with a clear error message displayed to the user before any data is sent.

## Assumptions

- The submission mechanism (sending content to Copilot Chat) remains unchanged; only the input form is redesigned.
- Supported image formats follow standard web conventions: PNG, JPEG, GIF, WebP, and SVG.
- File size limits: markdown import is capped at 512 KB; image attachments follow VS Code extension constraints (10 MB per image is acceptable).
- Draft persistence applies only to the text content, not to attached images (attachments must be re-added after a panel close).
- The "Cancel" and close-warning behaviors remain unchanged.

## Clarifications

### Session 2026-02-20

- Q: How are images sent to the chat — base64 inline, local path placeholders, or VS Code Chat API native attachments? → A: Use the VS Code Chat API native attachment mechanism (e.g., `ChatRequestTurn.references`) to attach images as separate structured references alongside the text prompt.
- Q: What happens when the user imports a markdown file but the description field already has content — silent replace, inline confirmation, or append? → A: Show a brief inline confirmation ("This will replace your current text. Continue?") before replacing; if the user cancels, the field is unchanged.
- Q: Where do the "Import from file" and attachment buttons live? → A: Compact toolbar row placed directly above the text area; both buttons sit side by side in that toolbar.
- Q: What is the maximum number of image attachments allowed per submission? → A: 5 images.
- Q: What is the maximum file size for a markdown import? → A: 512 KB; imports exceeding this limit are rejected with a message and the field is left unchanged.
