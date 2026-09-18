# services/

Domain/service layer. Every financial mutation (payment, expense, income,
ledger posting, approval, reversal, reconciliation) must go through a
service here — never directly from a UI component or API route handler.

Populated starting PHASE 5 (FINANCIAL ENGINE): `LedgerService`,
`IncomeService`, `ExpenseService`, `PaymentService`, `ApprovalService`,
`ReversalService`, `ReconciliationService`.
