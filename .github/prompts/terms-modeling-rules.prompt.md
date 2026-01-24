# Modeling Rules - Terms Dictionary
## Extracted from copilot-instructions.md

## Generic Rules

### 1. Use of Structured Terms
- Always use structured terms
- Don't over-structure - use only necessary structures
- All descriptions must be in **Oxford Standard English**

### 2. Naming Conventions

**Upper Camel Case for Objects/Entities:**
- ✅ `Payment`, `BillPayment`, `FraudTypology`
- ❌ `payment`, `bill_payment`, `fraud-typology`

**Lower Camel Case for Properties:**
- ✅ `paymentId`, `dueDate`, `transactionAmount`
- ❌ `PaymentId`, `due_date`, `transaction-amount`

### 3. Hierarchies and References
- Dictionary allows hierarchies between terms (simple and composite)
- When property references another entity, use `$ref`
- Include description for the referencing property

**Exemplo:**
```yaml
statusInfo:
  description: "Data structure containing information about the account's status info"
  $ref: "#/components/schemas/StatusInfo"
```

### 4. Self-Explanation and Conciseness
- Descriptions must be highly self-explanatory
- Precise and concise
- Avoid redundancy

### 5. Use of Standards (ISO, etc.)
- When standard exists (e.g.: ISO20022), analyze, use and adapt if necessary
- When no standard exists, model following guidelines:
  - Avoid defining same concept with different descriptions
  - Use attributes for specifications (e.g.: availability.type)
  - Define structures with generic descriptions understood by context
  - Group semantically related terms (self-contained)

### 6. Value Lists - Code/Description Standard
Attributes with value lists MUST use pair of attributes with `Code` and `Description` suffixes:

**Exemplos:**
- `maritalStatusCode` + `maritalStatusDescription`
- `genderCode` + `genderDescription`
- `statusCode` + `statusDescription`
- `typeCode` + `typeDescription`

**YAML:**
```yaml
statusCode:
  type: string
  description: "Code for the payment status"
  example: "PEND"
statusDescription:
  type: string
  description: "Description of the payment status"
  example: "Pending"
```

---

## Specific Rules

### 1. Reuse of Existing Objects

Always check if generic object already exists before creating new one:

**Common Generic Objects:**
- **StatusInfo** - For status of any entity
- **Audit** - For audit information
- **Period** / **Term** - For time periods
- **Amount** - For monetary values
- **Country** - For countries
- **PostalAddress** - For addresses
- **Channel** - For channels

**Exemplo:**
```yaml
# ✅ CORRETO - Reutilizar Amount
amount:
  description: "Data structure containing the payment amount"
  $ref: "#/components/schemas/Amount"

# ❌ ERRADO - Criar objeto novo desnecessário
paymentValue:
  type: object
  properties:
    value:
      type: number
    currency:
      type: string
```

### 2. Naming of Dates/DateTimes
- Dates: suffix `Date` → `issueDate`, `dueDate`, `executionDate`
- Date-times: suffix `DateTime` → `creationDateTime`, `executionDateTime`

**Com formato ISO 8601:**
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

### 3. Booleans - Prefixes can/is/has or Suffix Indicator

**Prefixes:**
- `is` → `isActive`, `isPaid`, `isValid`
- `has` → `hasBalance`, `hasExistingMortgage`
- `can` → `canBeModified`, `canBeRefunded`

**Suffix (less common):**
- `Indicator` → `urgencyIndicator`, `forceAccountingIndicator`

**Example:**
```yaml
isActive:
  type: boolean
  description: "Indicates whether the benefits program is currently active"
  example: true
```

**Special usage:**
When boolean indicates presence of optional block:
```yaml
institutionalPaymentIndicator:
  type: boolean
  description: "Whether a financial institution has initiated the payment. If true, 'institutionalPaymentInfo' is included."
  example: true
institutionalPaymentInfo:
  type: object
  description: "Data structure containing information about institutional payment"
  properties:
    # ...
```

### 4. Plural for Arrays
- DO NOT use suffix `List`, `Array`
- Use PLURAL to indicate multiple elements

**Examples:**
- ✅ `documents` (not `documentList`)
- ✅ `payments` (not `paymentArray`)
- ✅ `accounts` (not `accountsList`)

```yaml
payments:
  type: array
  description: "Array of payments"
  items:
    $ref: "#/components/schemas/Payment"
```

### 5. Naming of Identifiers
- Pattern: `{object}Id`
- Allows identifying reference even when object returned anonymously

**Examples:**
- `personId` (not `id`, `person_id`, `personIdentifier`)
- `paymentId` (not `payId`, `paymentIdentifier`)
- `accountId` (not `accountNumber`, `acctId`)

### 6. Avoid Abbreviations
- Use complete words whenever possible
- Exceptions: when abbreviation is market standard (e.g.: `FX`, `AML`, `ATM`)

**Examples:**
- ✅ `document` (not `doc`)
- ✅ `description` (not `desc`)
- ✅ `amount` (not `amt`)
- ✅ `identifier` (not `id` when not a suffix)

### 7. Value Lists Management (Enums)

**Situation A:** Fixed values equal for all APIs
```yaml
statusCode:
  type: string
  enum:
    - PENDING
    - PAID
    - CANCELLED
    - EXPIRED
  description: "Code for the payment status"
  example: "PENDING"
```

**Situation B:** Values depend on the API
```yaml
statusCode:
  type: string
  description: "Code for the payment status. Values are API-dependent."
  example: "CUSTOM_STATUS"
```

If many values, reference URL or file:
```yaml
countryCode:
  type: string
  description: "Country code defined in ISO 3166-1 alpha-2"
  example: "BR"
```

### 8. Display Attributes
When presentation-oriented, use prefix `display`:

```yaml
displayLine1:
  type: string
  description: "First line for displaying the postal address"
  example: "Av. Paulista, 1000"
```

### 9. Links
**Link to details of the object itself:**
```yaml
link:
  type: string
  description: "Link to the account details"
  example: "https://api.santander.com/accounts/123"
```

**Link to related information:**
```yaml
balancesLink:
  type: string
  description: "Link to the account balances information"
  example: "https://api.santander.com/accounts/123/balances"
```

### 10. Rates (Fees/Percentages)
- DO NOT use `percentage` anymore
- Always use `rate`
- Add phrase "expressed as a percentage" ONLY if always a percentage

```yaml
interestRate:
  type: number
  format: double
  description: "Interest rate expressed as a percentage"
  example: 5.75
```

### 11. Same Criteria for Same Concept
If `openingDate` already exists in an object, use **same name** in others:
- ✅ `openingDate` (consistent)
- ❌ `openDate`, `openedDate`, `createDate` (inconsistent)

### 12. Single or Multiple Elements
Define both possibilities when applicable:

```yaml
document:
  $ref: "#/components/schemas/Document"
documents:
  type: array
  items:
    $ref: "#/components/schemas/Document"
```

API decides whether to use singular or plural.

---

## Validation Checklist

Before proposing new entity, verify:

- [ ] Name in Upper Camel Case?
- [ ] Properties in lowerCamelCase?
- [ ] Descriptions in Oxford English?
- [ ] Booleans with is/has/can?
- [ ] Enums with Code/Description?
- [ ] Dates with Date/DateTime suffix?
- [ ] Arrays in plural?
- [ ] IDs with Id suffix?
- [ ] Reuses generic objects (Amount, StatusInfo, Audit, Period)?
- [ ] References with $ref and description?
- [ ] Examples provided for each property?
- [ ] No unnecessary abbreviations?
- [ ] Consistent with naming of similar objects?

---

## Examples of Well-Modeled Entities

### Example 1: Account (Simple)
```yaml
Account:
  type: object
  description: "Data structure containing account information"
  properties:
    accountId:
      description: "Unique account ID"
      type: string
      example: '00491655300123456700'
    typeCode:
      description: "Account type code"
      type: string
      example: '10'
    typeDescription:
      description: "Account type description"
      type: string
      example: 'Saving'
    statusInfo:
      description: "Data structure containing information about the account's status info"
      $ref: "#/components/schemas/StatusInfo"
```

### Example 2: Payment (Complex with multiple references)
```yaml
Payment:
  description: "Data structure containing information about a payment"
  type: object
  properties:
    paymentId:
      type: string
      description: "Unique payment ID"
    payer:
      $ref: "#/components/schemas/Payer"
    payee:
      $ref: "#/components/schemas/Payee"
    paymentAmountInfo:
      type: object
      description: "Data structure containing the total amount information"
      properties:
        direct:
          description: "Data structure containing the direct amount of the payment"
          $ref: "#/components/schemas/Amount"
    isInstant:
      type: boolean
      description: "Whether the payment is an instant payment"
      example: true
    statusInfo:
      $ref: "#/components/schemas/StatusInfo"
    audit:
      $ref: "#/components/schemas/Audit"
```

### Example 3: FraudDiagnosticTypology (With arrays and Code/Description)
```yaml
FraudDiagnosticTypology:
  type: object
  description: "Data structure containing information about a fraud diagnostic typology"
  properties:
    typologyId:
      type: string
      description: "Unique ID for the fraud diagnostic typology"
      example: "TYP-12345"
    typologyCode:
      type: string
      enum: [PHISHING, IDENTITY_THEFT, CARD_FRAUD]
      description: "Code for the fraud diagnostic typology"
      example: "PHISHING"
    typologyDescription:
      type: string
      description: "Description for the fraud diagnostic typology"
      example: "Phishing Attack"
    severityCode:
      type: string
      enum: [LOW, MEDIUM, HIGH, CRITICAL]
      description: "Code for the severity level"
      example: "HIGH"
    severityDescription:
      type: string
      description: "Description for the severity level"
      example: "High Severity"
    isActive:
      type: boolean
      description: "Indicates whether the typology is currently active"
      example: true
    subTypologies:
      type: array
      description: "Array of sub-typologies"
      items:
        $ref: "#/components/schemas/SubTypology"
    audit:
      $ref: "#/components/schemas/Audit"
```
