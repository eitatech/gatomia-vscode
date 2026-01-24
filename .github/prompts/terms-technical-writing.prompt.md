# Technical Writing Rules - Terms Dictionary
## Extracted from copilot-instructions.md - Technical Writing Guidelines

## Rules for Entity Descriptions

### Base Pattern
Entities are defined data structures, so the description MUST start with:

**"Data structure containing information about"** + entity context

### Correct Examples:

```yaml
BlockchainWallet:
  description: "Data structure containing information about a blockchain wallet"

Payment:
  description: "Data structure containing information about a payment"

FraudDiagnosticTypology:
  description: "Data structure containing information about a fraud diagnostic typology"

BenefitsProgram:
  description: "Data structure containing information about a benefits program"
```

### ❌ Incorrect Examples:
```yaml
# Missing "Data structure containing information about"
Payment:
  description: "A payment transaction"

# Too generic
Account:
  description: "Data structure for account"
```

---

## Rules for Property Descriptions

### 1. IDs (Unique Identifiers)

**Pattern:** "Unique ID for the" + property name

```yaml
blockchainWalletId:
  type: string
  description: "Unique ID for the blockchain wallet"
  example: "wallet-7c6b5a4d"

paymentId:
  type: string
  description: "Unique payment ID"
  example: "PAY-123456"

customerId:
  type: string
  description: "Unique ID for the customer"
  example: "F123456789"
```

### 2. Arrays

**Pattern:** "Array of" + item description

```yaml
blockchainAccountAddresses:
  type: array
  description: "Array of blockchain account addresses associated with the wallet"
  items:
    $ref: "#/components/schemas/BlockchainAccountAddress"

payments:
  type: array
  description: "Array of payments"
  items:
    $ref: "#/components/schemas/Payment"

indicators:
  type: array
  description: "Array of fraud indicators detected"
  items:
    type: string
```

### 3. References to Other Entities

**Pattern:** "Data structure containing information about the" + possessive pronoun related to entities

```yaml
statusInfo:
  description: "Data structure containing information about the blockchain wallet's status info"
  $ref: "#/components/schemas/StatusInfo"

audit:
  description: "Data structure containing information about the payment's audit"
  $ref: "#/components/schemas/Audit"

payer:
  description: "Data structure containing information about the payer"
  $ref: "#/components/schemas/Payer"
```

**Note:** Use possessive ('s) when relevant to parent entity context.

### 4. Type Code/Description

**Pattern:**
- typeCode: "Code for the" + entity description
- typeDescription: "Description for the" + entity description

```yaml
typeCode:
  description: "Code for the blockchain wallet type"
  type: string
  example: "HOT"

typeDescription:
  description: "Description for the blockchain wallet type"
  type: string
  example: "Hot Wallet"
```

**Also applies to:**
- statusCode / statusDescription
- categoryCode / categoryDescription
- severityCode / severityDescription

### 5. Functional Properties (General Case)

If the property doesn't fit into any rule above, use **market functional definition**.

```yaml
publicKey:
  description: "Public key associated with the blockchain account address"
  type: string
  example: "08b908801a3A87D92e8208b908801a3A87D92e82dce83A2b1282f1837cDdce83A2b1282f1837cD"

barcode:
  description: "Barcode number for the bank slip"
  type: string
  example: "03396971300000100009000004500000000004060101"

subject:
  description: "Description of the payment instruction"
  type: string
  example: "Rent Payment"
```

---

## Format of Dates and DateTimes

### Date (date only)

```yaml
executionDate:
  type: string
  format: date
  description: |-
    Date when the payment is executed.

    The value uses the complete data format defined in ISO 8601:
    'YYYY-MM-DD'

    Where:
    - YYYY: 4-digit year
    - MM: 2-digit month (for example, 01 = January)
    - DD: 2-digit day of the month (01 through 31)
  example: "2024-02-15"
```

### DateTime (date and time)

```yaml
executionDateTime:
  type: string
  format: date-time
  description: |-
    Date and time when the payment is executed.

    The value uses the complete data format defined in ISO 8601:
    'YYYY-MM-DDThh:mm:ss.sssTZD'

    Where:
    - YYYY: 4-digit year
    - MM: 2-digit month (for example, 01 = January)
    - DD: 2-digit day of the month (01 through 31)
    - hh: 2-digit hour of the day (00 through 23)
    - mm: 2-digit minute of the hour (00 through 59)
    - ss.sss: 5-digit seconds and milliseconds, separated by a point
    - TZD: Time zone indicator
  example: "2024-03-28T17:32:28Z"
```

---

## New Entity Proposals

### Format with Markup Tags

**New Entity:**
```yaml
#INIT NEW OBJECT
EntityName:
  type: object
  description: "Data structure containing information about..."
  properties:
    # properties here
#END NEW OBJECT
```

**Modify Existing Entity:**
```yaml
#INIT MODIFY OBJECT
ExistingEntity:
  type: object
  description: "Data structure containing information about..."
  properties:
    # existing properties...

    #INIT NEW PROPERTY
    newProperty:
      type: string
      description: "Description of new property"
      example: "example value"
    #END NEW PROPERTY
#END MODIFY OBJECT
```

**Multiple New Properties:**
```yaml
#INIT MODIFY OBJECT
Notification:
  type: object
  description: "Data structure containing information about a notification"
  properties:
    #INIT NEW PROPERTY
    typeCode:
      type: string
      description: "Code for the notification type"
      example: "ALERT"
    typeDescription:
      type: string
      description: "Description for the notification type"
      example: "Alert Notification"
    requiresAction:
      type: boolean
      description: "Indicates whether the notification requires action from the customer"
      example: true
    #END NEW PROPERTY
#END MODIFY OBJECT
```

---

## Summary: Quick Checklist

**For Entities:**
- [ ] Description starts with "Data structure containing information about"
- [ ] Name in Upper Camel Case
- [ ] Type: object

**For Properties:**
- [ ] Name in lowerCamelCase
- [ ] Correct type (string, number, boolean, array, object)
- [ ] Description follows appropriate pattern:
  - IDs: "Unique ID for the..."
  - Arrays: "Array of..."
  - Refs: "Data structure containing information about the..."
  - Types: "Code for the..." / "Description for the..."
  - Others: Functional definition
- [ ] Example provided
- [ ] Format specified when relevant (date, date-time, double, etc.)

**For Code/Description:**
- [ ] Both defined together
- [ ] Code with enum (when fixed values)
- [ ] Description as string

**For References:**
- [ ] Uses $ref: "#/components/schemas/..."
- [ ] Includes description before $ref

**For Booleans:**
- [ ] Prefix is/has/can OR suffix Indicator
- [ ] Description uses "Indicates whether" or "Whether"
