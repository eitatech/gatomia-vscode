# Instructions for API Proposal Evaluation
## Based on copilot-proposta-api.md

This document contains the 6 steps that must be followed to evaluate the quality of an API proposal issue.

## Step 1: Identify Main Entity

The main entity is the central business object of the API. It is the **noun** that represents the functional domain.

### How to Identify:
- Analyze the use case described in the issue
- Identify the central **business object**, not the actions
- Apply DDD (Domain-Driven Design) principles

### Examples:
- **Correct**: The main entity is "Payment"
  - Actions: create payment, query payment, cancel payment

- **Wrong**: Confusing actions with entities
  - "CreatePayment", "CancelPayment" are NOT entities, they are actions

### Common Mistake:
Mixing entities with actions and thinking there are "multiple entities" in one API.

**Real Example:**
```
Question: I have endpoints to search investment offers, search fees, and execute application.
What is my main entity?

Answer: The main entity is Investment.
The actions are:
- Search Investment product Offers
- Search Investment contracting Fees
- Execute Investment contracting

Investment relates to other entities (Customer, Fee, Product, Contract),
but the API is about Investment.
```

### Step 1 Output:
- Main entity name (Upper Camel Case)
- Justification based on use case
- Related entities identified

---

## Step 2: List Operations

List ALL HTTP operations that the API must support.

### Standard Operations:

**GET /{resource}**
- List/query multiple resources
- With filters via query parameters
- With pagination (_offset, _limit)

**GET /{resource}/{id}**
- Query specific resource
- Path parameter: Unique resource ID

**POST /{resource}**
- Create new resource
- Request body with required data

**PUT /{resource}/{id}**
- COMPLETE update of existing resource
- Replaces all fields

**PATCH /{resource}/{id}**
- PARTIAL update of existing resource
- Modifies only specified fields

**DELETE /{resource}/{id}**
- Delete existing resource

### Important Validations:

1. **List vs Detail**:
   - If there is `GET /` with query param `{resource}_id`, MUST create separate `GET /{id}`
   - Query param MUST NOT contain unique ID of the main entity

2. **Input vs Output Data**:
   - All query params from `GET /` MUST have equivalent values in the response
   - Example:
     ```
     GET /documents?name=X
     Response: { "documents": [{ "documentId": 1, "name": "X" }] }
     ```

3. **Status and Types**:
   - If mentions "status" or "type", MUST specify ENUM
   - Example: Payment Status: PEND - Pending, APPR - Approved, CANC - Cancelled

### Step 2 Output:
- [ ] GET /{resource} - Description
- [ ] GET /{resource}/{id} - Description
- [ ] POST /{resource} - Description
- [ ] PUT /{resource}/{id} - Description (if applicable)
- [ ] PATCH /{resource}/{id} - Description (if applicable)
- [ ] DELETE /{resource}/{id} - Description (if applicable)

---

## Step 3: Assess Requirements Coverage

Verify if the issue contains ALL necessary elements:

### Coverage Checklist:

| Aspect | Status | Observations |
|---------|--------|-------------|
| **Use cases** | ✅/⚠️/❌ | Clearly described? |
| **Input data** | ✅/⚠️/❌ | Request bodies specified? |
| **Output data** | ✅/⚠️/❌ | Response bodies specified? |
| **Business rules** | ✅/⚠️/❌ | Validations described? |
| **Error scenarios** | ✅/⚠️/❌ | Codes and messages? |
| **Security** | ✅/⚠️/❌ | OAuth 2.0 / scopes mentioned? |

### Mandatory Elements:

1. **Main Use Case**:
   - Description of complete functional flow
   - Example: "Customer scans bank slip → system validates → customer confirms → system processes"

2. **Input Data** (for each POST/PUT/PATCH operation):
   - JSON/YAML structure with required fields marked
   - Data types defined
   - Value examples

3. **Output Data** (for each operation):
   - JSON/YAML structure of response
   - Returned fields
   - Examples

4. **Business Rules**:
   - Field validations (e.g.: CPF, barcode)
   - Limits (e.g.: maximum value R$ 10,000)
   - Restrictions (e.g.: minimum date D+0, maximum D+60)

5. **Error Scenarios**:
   - HTTP Status (400, 404, 500, etc.)
   - Custom error code
   - Error message
   - Example:
     ```
     Status: 400
     Code: INVALID_BARCODE
     Message: "Invalid barcode"
     ```

6. **Security**:
   - Authentication type (OAuth 2.0)
   - Required scopes (read, write)
   - Rate limiting

### Step 3 Output:
Coverage table with status of each aspect and specific observations.

---

## Step 4: Identify Gaps

List ALL missing or ambiguous information that prevents contract creation.

### Gap Categories:

**1. Functional Gaps:**
- Use cases not described
- Alternative flows missing
- Business rules not specified

**2. Technical Gaps:**
- Data types not defined
- Formats not specified (e.g.: date, currency)
- Enums without values

**3. Validation Gaps:**
- Validation rules not mentioned
- Limits not specified
- Restrictions missing

**4. Error Gaps:**
- Error scenarios not covered
- Error messages not defined
- Exception handling missing

**5. Security Gaps:**
- Authentication not mentioned
- Authorization not specified
- Scopes not defined

### Gap Examples:
```
1. How to handle insufficient balance error?
   - Error code?
   - Message?
   - HTTP Status?

2. Bank slip barcode validation not mentioned
   - Validation algorithm?
   - Check digit?

3. Transaction timeout not specified
   - How long to wait?
   - What to do after timeout?

4. Required vs optional fields not marked
   - Which fields are required?

5. Pagination not specified
   - How many items per page?
   - How to navigate between pages?
```

### Step 4 Output:
Numbered list of identified gaps, grouped by category.

---

## Step 5: Suggest Labels

Based on the analysis, suggest appropriate labels for the issue.

### Standard Labels:

**Issue Status:**
- `ready-for-proposal` - Issue complete, ready to generate contract
- `needs-clarification` - Issue incomplete, awaiting clarifications
- `awaiting-po-approval` - Awaiting Product Owner approval

**Business Area:**
- `payments` - Payments
- `accounts` - Accounts
- `cards` - Cards
- `loans` - Loans
- `investments` - Investments
- `insurance` - Insurance

**Change Type:**
- `api-proposal` - New API
- `api-modification` - Modification of existing API
- `breaking-change` - Incompatible change

**Required Work:**
- `requires-terms` - Needs to create/modify terms in dictionary
- `requires-contract` - Needs to create OpenAPI contract
- `requires-validation` - Needs technical validation

**Priority:**
- `priority-high` - High priority
- `priority-medium` - Medium priority
- `priority-low` - Low priority

### Selection Logic:

```python
if complete_coverage and no_critical_gaps:
    labels.append("ready-for-proposal")
else:
    labels.append("needs-clarification")

if business_area_identified:
    labels.append(business_area)  # e.g.: "payments"

if entity_not_in_dictionary:
    labels.append("requires-terms")

labels.append("api-proposal")  # or "api-modification"
```

### Step 5 Output:
List of suggested labels, with justification for each one.

---

## Step 6: Propose Next Steps

Clearly define what should happen next.

### If Issue is COMPLETE (`ready-for-proposal`):

**Next Steps:**
1. ✅ Issue approved for contract creation
2. 🔍 Search entities in Terms Dictionary (Term Finder)
3. ➕ Create new entities if necessary (Term Proposer)
4. 📝 Generate OpenAPI contract (Contract Generator)
5. ✅ Validate with Spectral
6. 🔀 Create PRs (PR Creator)

**Message for Issue:**
```markdown
✅ Issue Complete - Ready for Implementation

The proposal is well-structured and contains all necessary elements
for creating the OpenAPI contract.

**Main Entity Identified:** {EntityName}

**Next Steps:**
1. Search entities in Terms Dictionary
2. Create OpenAPI contract
3. Validate with Spectral
4. Create PR for review

**Estimate:** Complete automation in < 5 minutes
```

### If Issue is INCOMPLETE (`needs-clarification`):

**Next Steps:**
1. ⚠️ Await PO clarifications
2. 📝 Answer questions raised in Step 4
3. ✏️ Update issue with missing information
4. 🔄 Re-evaluate issue after update

**Message for Issue:**
```markdown
⚠️ Issue Incomplete - Clarifications Needed

The proposal is partial and needs additional information
for creating the OpenAPI contract.

**Identified Gaps:**
{list of gaps from Step 4}

**Next Steps:**
@{PO_username} Please clarify the above points so we can proceed
with creating the contract.

After clarifications, we will re-evaluate the issue.
```

### If Issue is AMBIGUOUS (decision needed):

**Next Steps:**
1. ❓ Present options to PO
2. ⏳ Await decision
3. ➡️ Proceed after choice

**Message for Issue:**
```markdown
❓ Decision Needed

We identified ambiguity that requires PO decision:

**Question:** {description of ambiguity}

**Options:**
1. **Option A:** {description}
   - Pros: {list}
   - Cons: {list}

2. **Option B:** {description}
   - Pros: {list}
   - Cons: {list}

@{PO_username} Please indicate which option we should follow.
```

### Step 6 Output:
- Final status: COMPLETE / INCOMPLETE / AMBIGUOUS
- Specific and actionable next steps
- Formatted message to post in the issue

---

## Complete Analysis Example

### Issue #123: Bank Slip Payment API

**Input:**
```
Title: New API for Bank Slip Payments

Description:
We need a REST API to allow customers to make bank slip payments.

Features:
1. Query payment by ID
2. Create new bank slip payment
3. List customer payments

Input Data (POST):
- barcode: barcode (47 digits)
- amount: payment amount
- scheduledDate: scheduled date (optional)

Output Data:
- paymentId
- amount
- dueDate
- payee (name and document)
- status

Rules:
- Validate barcode
- Check account balance
- Maximum limit R$ 10,000 per transaction
- Status: PENDING, PAID, FAILED, CANCELLED
```

**Analysis Output:**

### Step 1: Main Entity
✅ **BillPayment**

**Justification:** The central use case is bank slip payment.
It is a specific type of Payment.

**Related Entities:**
- Amount (value)
- Account (debited account)
- BankSlip (bank slip, contains barcode)
- Payee (beneficiary)

### Step 2: Operations
- [x] GET /bill-payments - List payments (with filters)
- [x] GET /bill-payments/{paymentId} - Query specific payment
- [x] POST /bill-payments - Create new payment
- [ ] PUT /bill-payments/{paymentId} - Not mentioned
- [ ] PATCH /bill-payments/{paymentId} - Not mentioned (but useful for cancellation)
- [ ] DELETE /bill-payments/{paymentId} - Not mentioned

**Suggestion:** Add PATCH for cancellation.

### Step 3: Requirements Coverage

| Aspect | Status | Observations |
|---------|--------|-------------|
| Use cases | ✅ | Well described |
| Input data | ⚠️ | Missing required/optional marks |
| Output data | ✅ | Complete |
| Business rules | ⚠️ | Partial - needs detail |
| Error scenarios | ❌ | Not specified |
| Segurança | ❌ | Não mencionada |

### Etapa 4: Lacunas Identificadas

**Funcionais:**
1. Como cancelar um pagamento agendado?
2. O que acontece após pagamento ser processado?

**Técnicas:**
3. Formato exato do código de barras (47 dígitos numéricos?)
4. Tipo da propriedade `amount` (objeto Amount com currency?)
5. Formato de `dueDate` (ISO 8601?)

**Validação:**
6. Algoritmo de validação do código de barras não especificado
7. O que fazer se saldo insuficiente? (código de erro? mensagem?)
8. Limite diário também existe? (além do R$ 10k por transação)

**Erro:**
9. Códigos de erro não definidos (ex: INVALID_BARCODE, INSUFFICIENT_BALANCE)
10. Mensagens de erro não definidas
11. Status HTTP para cada erro não especificado

**Segurança:**
12. OAuth 2.0 não mencionado
13. Scopes não definidos (payments:read, payments:write?)
14. Rate limiting não especificado

### Etapa 5: Labels Sugeridas
- ✅ `ready-for-proposal` (apesar de lacunas, há o suficiente para começar)
- ✅ `payments`
- ✅ `requires-terms` (precisa criar/validar BillPayment entity)
- ✅ `api-proposal`

### Etapa 6: Próximos Passos

**Status:** PRONTA (com ressalvas)

**Ação:**
1. Buscar entidades no Dicionário de Termos
   - Payment, BankSlip, Amount, Payee
2. Criar BillPayment entity se não existir
3. Gerar contrato OpenAPI assumindo defaults razoáveis para lacunas
4. Validar com Spectral
5. Criar PRs

**Mensagem para Issue:**
```markdown
✅ Issue Pronta para Implementação

A proposta contém informações suficientes para iniciarmos a criação do contrato.

**Entidade Principal:** BillPayment

**Operações Identificadas:**
- GET /bill-payments
- GET /bill-payments/{paymentId}
- POST /bill-payments

**Próximos Passos:**
1. Buscar/criar entidades no Dicionário de Termos
2. Gerar contrato OpenAPI
3. Validar com Spectral
4. Criar PRs para review

**Observações:**
Algumas lacunas foram identificadas (segurança, cenários de erro detalhados).
Estas serão preenchidas com defaults padrão Santander. Se necessário ajustar,
podemos revisar após review do contrato.

**Labels Aplicadas:** `ready-for-proposal`, `payments`, `requires-terms`, `api-proposal`

cc @product-owner
```

---

## Summary of the 6 Steps

1. ✅ **Identify Main Entity** - The central "noun" of the API
2. ✅ **List Operations** - GET, POST, PUT, PATCH, DELETE needed
3. ✅ **Assess Coverage** - Verify if all requirements are present
4. ✅ **Identify Gaps** - List missing or ambiguous information
5. ✅ **Suggest Labels** - Categorize the issue appropriately
6. ✅ **Propose Next Steps** - Define clear and actionable actions

**Final Objective:** Determine if the issue is ready to generate contract or needs clarifications.
