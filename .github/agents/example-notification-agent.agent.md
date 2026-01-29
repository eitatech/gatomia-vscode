---
description: Example agent for sending notifications about spec changes to team channels. Demonstrates integration with external services.
---

## User Input

```text
$ARGUMENTS
```

## Notification Instructions

This is an example notification agent that sends updates about spec changes to team communication channels.

### Supported Channels

- Slack webhooks
- Microsoft Teams webhooks
- Discord webhooks
- Email notifications
- GitHub issues

### Template Variables Expected

- `{specId}`: Spec identifier (e.g., `011-custom-agent-hooks`)
- `{newStatus}`: New spec status (e.g., `review`, `approved`)
- `{oldStatus}`: Previous spec status
- `{changeAuthor}`: Who made the change
- `{timestamp}`: When the change occurred
- `{specPath}`: Path to the spec file

### Notification Format

When sending notifications, include:

1. **Clear Subject**: "Spec {specId} status changed to {newStatus}"
2. **Context**: Who made the change and when
3. **Link**: Direct link to the spec file
4. **Action Items**: What team members should do next

### Example Slack Message

```json
{
  "text": "Spec Update: {specId}",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "📋 Spec {specId} updated"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Status:*\n{oldStatus} → {newStatus}"
        },
        {
          "type": "mrkdwn",
          "text": "*Changed by:*\n{changeAuthor}"
        },
        {
          "type": "mrkdwn",
          "text": "*When:*\n{timestamp}"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*File:* `{specPath}`"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Review Spec"
          },
          "url": "vscode://file/{specPath}"
        }
      ]
    }
  ]
}
```

## Example Usage

**Hook Configuration**:
- **Trigger**: After `/speckit.clarify`
- **Action**: Custom Agent → "Example Notification Agent"  
- **Arguments**: `Notify team: spec {specId} changed from {oldStatus} to {newStatus} by {changeAuthor} at {timestamp}`

**Expected Behavior**: When a spec is clarified, this agent will format and send a notification to the configured team channel with relevant details and a link to review the spec.

### Setup Required

1. Configure webhook URL in `.env` file:
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

2. Or use VS Code settings:
   ```json
   {
     "gatomia.notifications.slack.webhookUrl": "https://..."
   }
   ```

3. Test notification manually: `/notify-test`
