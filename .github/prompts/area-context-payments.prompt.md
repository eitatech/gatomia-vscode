# Area Context: Payments
## Extracted from copilot-instructions-payments.md

This file is automatically attached by the Orchestrator when the identified area is **Payments**.

## Total APIs in Domain
**327 APIs** cataloged in the PAYMENTS domain

## Main APIs Related to Payments

### 1. Gln Payments
- GET / - Payment list with filters
- POST / - Create payment order
- POST /simulate_payment - Simulate payment

### 2. Bill Payment Providers
- Bank slip payments
- Filters by date and status
- Endpoints for agreement and payee

### 3. Other Domain APIs
- Account Parameters (PIX)
- Validation Authorization Debit
- Balance Queries
- International Accounts

## Main Domain Entities
- **Payment** - Central entity
- **BillPayment** - Bank slip payments
- **Payer** - Payer
- **Payee** - Payee/Beneficiary
- **Amount** - Monetary value
- **BankSlip** - Bank slip (with barcode)

## Domain Keywords
- pagamento (payment), payment
- pix, ted, boleto
- transferencia (transfer), transacao (transaction)
- payer, payee
- barcode, bank slip

**Usage:** When issue contains these keywords, classify as PAYMENTS area and load this context.
