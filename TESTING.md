# Artho AI — Comprehensive Test Documentation & Verification Matrix

This document provides a complete catalog of all automated and manual test suites, test cases, verification procedures, and actual execution results for **Artho AI**.

---

## 1. Testing Prerequisites & Setup

To execute the automated test suites locally:
1. **Node.js:** Ensure Node.js v18+ or v20+ is installed (`node -v`).
2. **Dependencies:** Ensure packages are installed via `npm install`.
3. **Environment:** Copy `.env.example` to `.env`. Tests run against an isolated in-memory fallback or local/test database.
4. **Test Runner:** Tests use Node.js's native test runner (`node:test`) and TypeScript execution via `npx tsx`.

---

## 2. Test Execution Commands

```bash
# 1. Type Check / Static Analysis
npm run lint

# 2. Production Build Check
npm run build

# 3. Core Automated Test Suites
npx tsx server/tests/financialPlanningAssistant.test.ts
npx tsx server/tests/factualAccuracy.test.ts
npx tsx server/tests/savingsPlan.test.ts
npx tsx server/tests/registrationVerificationFlow.test.ts
npx tsx server/tests/spendingAnalysisCategorization.test.ts
npx tsx server/tests/financialHealthConsistency.test.ts
npx tsx server/tests/cashFlowForecastConsistency.test.ts
npx tsx server/tests/customCategories.test.ts
npx tsx server/tests/modularEmailProviders.test.ts
npx tsx server/tests/bilingualNumberValidation.test.ts
npx tsx server/tests/coachPersonalizationVerification.ts

# 4. 100-Case AI Coach Automated Evaluation Harness
npm run test:coach-eval
```

---

## 3. Test Suite Inventory & Architecture

```text
server/tests/
├── financialPlanningAssistant.test.ts   # 8-part roadmaps, 50/30/20, starter budgets, deficits
├── factualAccuracy.test.ts              # Deterministic category extrema (lowest/highest)
├── savingsPlan.test.ts                  # Target parsing, surplus feasibility, duration math
├── registrationVerificationFlow.test.ts # Auth, duplicate handling, OTP bypass mode
├── spendingAnalysisCategorization.test.ts# Expense normalization, income exclusion
├── financialHealthConsistency.test.ts   # Piecewise health score calculation & data sufficiency
├── cashFlowForecastConsistency.test.ts  # Daily burn rate, 30-day forecast, buffer math
├── customCategories.test.ts             # Custom categories CRUD, persistence, deletion safety
├── modularEmailProviders.test.ts        # Brevo, SMTP, Resend providers, credential hashing
├── bilingualNumberValidation.test.ts    # Regex number validator, hallucination rejection
├── coachPersonalizationVerification.ts  # Multi-tenant user greeting and data isolation
└── server/evaluation/testCases.ts       # 100 bilingual benchmark evaluation inquiries
```

---

## 4. Detailed Test Case Catalog

### Category A: Authentication & User Lifecycle

| Test ID | Test Objective | Preconditions | Procedure | Expected Result | Actual Result | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **AUTH-01** | Verify new user registration with password hashing | Test runner active | POST `/api/auth/signup` with valid payload | Returns 201 Created; password hashed with bcrypt | User created with bcrypt hash | **PASS** |
| **AUTH-02** | Reject registration with duplicate email address | Existing user in DB | POST `/api/auth/signup` with same email | Returns 409 Conflict | Returns 409 Conflict | **PASS** |
| **AUTH-03** | Enforce minimum password length validation | Test runner active | POST `/api/auth/signup` with 4-char password | Returns 400 Bad Request | Returns 400 Bad Request | **PASS** |
| **AUTH-04** | Reject invalid login credentials | Existing user | POST `/api/auth/login` with incorrect password | Returns 401 Unauthorized | Returns 401 Unauthorized | **PASS** |
| **AUTH-05** | Verify direct JWT token issuance in OTP bypass mode | `EMAIL_OTP_ENABLED=false` | POST `/api/auth/signup` | Returns 201 with `requiresVerification: false` & JWT | Direct sign-in without OTP block | **PASS** |
| **AUTH-06** | Enforce verification when OTP is active | `EMAIL_OTP_ENABLED=true` | POST `/api/auth/signup` | Returns 201 with `requiresVerification: true` | OTP required before login | **PASS** |
| **AUTH-07** | Enforce 60-second cooldown on OTP resend requests | OTP sent $< 60$s ago | POST `/api/auth/resend-verification` | Returns cooldown rejection with remaining seconds | Cooldown enforced | **PASS** |

### Category B: Transaction Ledger & Categorization

| Test ID | Test Objective | Preconditions | Procedure | Expected Result | Actual Result | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **TX-01** | Create expense transaction with valid merchant | Authenticated user | POST `/api/users/:userId/transactions` | Returns 201 Created; transaction stored in DB | Transaction created | **PASS** |
| **TX-02** | Reject expense transaction missing merchant | Authenticated user | POST `/api/users/:userId/transactions` without merchant | Returns 400 Bad Request | Returns 400 Bad Request | **PASS** |
| **TX-03** | Normalize expense category "Food" to "Food & Groceries" | Transaction input | Process transaction with `category: "Food"` | Category normalized to "Food & Groceries" | Normalized correctly | **PASS** |
| **TX-04** | Prevent income category "Salary & Inflow" on expense | Transaction input | POST expense with category "Salary & Inflow" | Auto-normalized or rejected with 400 | Reclassified or rejected | **PASS** |
| **TX-05** | Exclude income transactions from total spending sum | Inflow & outflows exist | Run `calculateTotalSpending` | Total spending equals only expense amounts | Income strictly excluded | **PASS** |
| **TX-06** | Update transaction details and amount | Existing transaction | PUT `/api/users/:userId/transactions/:txId` | Updates amount, maintains normalized category | Updated successfully | **PASS** |
| **TX-07** | Delete transaction from user ledger | Existing transaction | DELETE `/api/users/:userId/transactions/:txId` | Returns 200; transaction removed from MongoDB | Deleted successfully | **PASS** |

### Category C: Savings Goals & Scenario Planning

| Test ID | Test Objective | Preconditions | Procedure | Expected Result | Actual Result | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **GOAL-01** | Create new savings goal with target and deadline | Authenticated user | POST `/api/users/:userId/goals` | Goal created with target amount and initial pace | Created in MongoDB | **PASS** |
| **GOAL-02** | Calculate required monthly savings pace | Goal with deadline | Run `calculateRequiredMonthlySavings` | Divides remaining gap by months to deadline | Correct rounded pace | **PASS** |
| **GOAL-03** | Generate 3 scenario plans (Conservative, Balanced, Sprint) | Goal object | Run `calculateScenarioPlans(goal)` | Returns 3 tiered plans with monthly amounts | 3 distinct plans returned | **PASS** |
| **GOAL-04** | Delete savings goal with ownership verification | Existing goal | DELETE `/api/users/:userId/goals/:goalId` | Goal deleted; user `primaryGoalId` cleaned | Goal removed cleanly | **PASS** |
| **GOAL-05** | Reject deleting another user's savings goal | User A token, Goal B | DELETE `/api/users/:userIdB/goals/:goalIdB` | Returns 403 Forbidden | Returns 403 Forbidden | **PASS** |

### Category D: Financial Health Score & Data Sufficiency

| Test ID | Test Objective | Preconditions | Procedure | Expected Result | Actual Result | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **HLTH-01** | Calculate weighted health score across 4 pillars | 3+ months data | Run `calculateFinancialHealthScore` | Returns score 0-100 and High confidence | Score calculated cleanly | **PASS** |
| **HLTH-02** | Return null score when data is insufficient | 0 transactions | Run `calculateFinancialHealthScore` | Returns `score: null`, status `insufficient_data` | Insufficient data returned | **PASS** |
| **HLTH-03** | Reject fabricating 100/100 score on empty ledger | Empty ledger | Verify AI Coach output for health query | Coach explains insufficient data, never shows 100 | Zero fake score | **PASS** |
| **HLTH-04** | Evaluate multi-month Saving Consistency | 2+ historical months | Run consistency algorithm | Factor computed from regularity of positive savings | Correct consistency % | **PASS** |

### Category E: AI Coach Factual Intelligence & Extrema

| Test ID | Test Objective | Preconditions | Procedure | Expected Result | Actual Result | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **AI-01** | Answer lowest spending category query accurately | User with 3+ expenses | Query: *"Which category I spend lowest money?"* | Cites exact lowest category, amount, and % | Correct lowest category | **PASS** |
| **AI-02** | Answer highest spending category query accurately | User with 3+ expenses | Query: *"Which category has highest spending?"* | Cites exact highest category, amount, and % | Correct highest category | **PASS** |
| **AI-03** | Semantic contradiction guard (Lowest vs Highest) | Extrema query | Query asks for lowest category | Output strictly never returns highest category | Contradiction prevented | **PASS** |
| **AI-04** | Formulate 8-part future savings roadmap | Target query | Query: *"How to save 50000 in 6 months?"* | Returns 8 structured sections with $T/M$ math | 8-part plan returned | **PASS** |
| **AI-05** | Issue Budget Deficit Alert when spending > income | Deficit ledger | Query: *"How can I save money?"* | Issues Deficit Alert with 3 immediate reduction steps | Deficit alert issued | **PASS** |
| **AI-06** | Analyze zero-income cash burn & runway | ৳0 income ledger | Query: *"How to budget with zero income?"* | Computes burn rate and runway in months | Burn rate calculated | **PASS** |
| **AI-07** | Provide ৳30,000 illustrative starter budget template | Empty ledger | Query: *"Help me create a budget"* | Returns clearly labeled ৳30k benchmark template | Starter template given | **PASS** |
| **AI-08** | Intercept and reject hallucinated numbers | LLM outputs fake $ | Run `validateCoachNumbers` | Rejects response; triggers deterministic fallback | Fallback triggered | **PASS** |
| **AI-09** | Greet user with personalized name | Authenticated user | Execute Coach inquiry | Starts with `Assalamu Alaikum {firstName}!` | Personalized greeting | **PASS** |
| **AI-10** | Isolate user financial data across sessions | User A and User B | Query Coach from both sessions | User A gets User A data; User B gets User B data | Strict tenant isolation | **PASS** |

---

## 5. AI Coach 100-Case Evaluation Suite

The repository contains an automated bilingual evaluation harness (`server/evaluation/runEvaluation.ts`) evaluating 100 real-world financial questions across 5 core categories:

### Execution Summary (Verified Audit):
- **Command:** `npm run test:coach-eval`
- **Total Test Cases:** 100
- **Passed (PASS):** 94 (94.0%)
- **Failed (FAIL):** 2 (2.0%)
- **Needs Review (NEEDS_REVIEW):** 4 (4.0%)
- **Execution Time:** ~0.24 seconds (Deterministic Engine)

### Category Performance Breakdown:
1. **Spending Analysis:** 20 / 20 Passed (100%)
2. **Savings Planning:** 20 / 20 Passed (100%)
3. **Budget Planning:** 18 / 20 Passed (90%) [2 review cases on specific keyword presence]
4. **Financial Projection:** 20 / 20 Passed (100%)
5. **Personalized Recommendations:** 16 / 20 Passed (80%) [2 intent classification mismatches]

### Analysis of Non-Passing Cases:
- **TC-085 (FAIL):** *"How can I optimize spending when medical expenses are large?"* — Classified as `category_spending` due to the word "expenses" rather than `budget_help`. (Handled safely with factual response).
- **TC-089 (FAIL):** *"What are the biggest financial stability risks in my profile?"* — Classified as `savings_plan` due to "stability" rather than `financial_health`.
- **TC-045 & TC-050 (REVIEW):** System returned grounded advice but omitted the literal words "variable" or "zero" expected by the test string assertion.

> [!NOTE]
> Evaluation pass rates evaluate semantic intent classification and deterministic grounding. They do not represent a guarantee of financial advice efficacy.

---

## 6. Actual Execution Results Table (This Audit)

| Suite Name | Execution Command | Tests Passed | Tests Failed | Status |
| :--- | :--- | :---: | :---: | :---: |
| **TypeScript Compiler** | `npm run lint` | 0 Errors | 0 | **PASS** |
| **Vite Production Build** | `npm run build` | Built in 528ms | 0 | **PASS** |
| **Financial Planning Assistant** | `npx tsx server/tests/financialPlanningAssistant.test.ts` | 10 / 10 | 0 | **PASS** |
| **Factual Extrema & Accuracy** | `npx tsx server/tests/factualAccuracy.test.ts` | 19 / 19 | 0 | **PASS** |
| **Personalized Savings Planning** | `npx tsx server/tests/savingsPlan.test.ts` | 15 / 15 | 0 | **PASS** |
| **Registration & OTP Bypass Flow** | `npx tsx server/tests/registrationVerificationFlow.test.ts` | 12 / 12 | 0 | **PASS** |
| **Spending Categorization Fix** | `npx tsx server/tests/spendingAnalysisCategorization.test.ts` | 6 / 6 | 0 | **PASS** |
| **Financial Health Consistency** | `npx tsx server/tests/financialHealthConsistency.test.ts` | 24 / 24 | 0 | **PASS** |
| **Cash Flow Forecast Consistency** | `npx tsx server/tests/cashFlowForecastConsistency.test.ts` | 11 / 11 | 0 | **PASS** |
| **Custom Categories Full Suite** | `npx tsx server/tests/customCategories.test.ts` | 16 / 16 | 0 | **PASS** |
| **Modular Email Providers** | `npx tsx server/tests/modularEmailProviders.test.ts` | 24 / 24 | 0 | **PASS** |
| **Bilingual Number Validation** | `npx tsx server/tests/bilingualNumberValidation.test.ts` | 5 / 5 | 0 | **PASS** |
| **Personalization & Isolation** | `npx tsx server/tests/coachPersonalizationVerification.ts` | 8 / 8 | 0 | **PASS** |
| **AI Coach 100-Case Evaluation** | `npm run test:coach-eval` | 94 / 100 | 2 (4 rev) | **94% PASS** |

---

## 7. Known Testing Limitations

1. **Live Gemini Smoke Tests (`runSmokeLiveGemini.ts`):** Requires an active `GEMINI_API_KEY` in environment variables. When running in environments without outbound internet or without an API key, live network calls are blocked. The application falls back safely to `coachFallbackEngine.ts`.
2. **SMTP Network Timeouts on Render:** Render Free tier blocks outbound TCP connections on port 465, causing Nodemailer connection timeouts. This is verified and handled in tests via `devSimulationProvider.ts` and `modularEmailProviders.test.ts`.
3. **Database Test Isolation:** Tests connect to an isolated test collection or run against memory mock stores to ensure no test data contaminates production records.
