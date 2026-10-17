# ArthoBachao AI Coach — 100-Case Automated Evaluation Report

**Execution Date**: 2026-10-17T13:00:56.690Z  
**Execution Duration**: 0.09s  
**Total Test Cases Evaluated**: 100  
**Overall Pass Rate**: **100%** (100 / 100)  

## 1. Executive Summary

| Metric | Count | Percentage |
| :--- | :--- | :--- |
| **Passed (PASS)** | **100** | **100.0%** |
| **Failed (FAIL)** | **0** | **0.0%** |
| **Needs Review (NEEDS_REVIEW)** | **0** | **0.0%** |
| Intent Classification Failures | 0 | 0.0% |
| Critical Financial Calculation Failures | 0 | 0.0% |
| Unsupported / Hallucinated Claims | 0 | 0.0% |
| Data Sufficiency Warning Gaps | 0 | 0.0% |
| Safety & Ethics Violations | 0 | 0.0% |

## 2. Category Performance Breakdown

| Category | Total | Pass | Fail | Review | Pass Rate |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **SPENDING ANALYSIS** | 20 | 20 | 0 | 0 | **100%** |
| **SAVINGS PLANNING** | 20 | 20 | 0 | 0 | **100%** |
| **BUDGET PLANNING** | 20 | 20 | 0 | 0 | **100%** |
| **FINANCIAL PROJECTION** | 20 | 20 | 0 | 0 | **100%** |
| **PERSONALIZED RECOMMENDATIONS** | 20 | 20 | 0 | 0 | **100%** |

## 3. Failure & Review Analysis

*Zero test failures detected across all 100 representative evaluation cases.*

## 4. Complete 100-Case Evaluation Results Table

| ID | Question | Expected Intent | Actual Intent | Status | Notes |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **TC-001** | Where is all my money going? | `spending_total | top_category` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-002** | How much have I spent this month? | `spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-003** | Break down expenses by category. | `spending_total | top_category` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-004** | Which category has the highest spending? | `top_category` | `top_category` | ✅ PASS | Grounded & verified |
| **TC-005** | Which category has the lowest spending? | `lowest_category` | `lowest_category` | ✅ PASS | Grounded & verified |
| **TC-006** | Compare this month with last month. | `mom_comparison` | `mom_comparison` | ✅ PASS | Grounded & verified |
| **TC-007** | Show my five largest expense transactions. | `largest_expense | transaction_lookup` | `largest_expense` | ✅ PASS | Grounded & verified |
| **TC-008** | Which merchants receive the most of my spending? | `highest_merchant` | `highest_merchant` | ✅ PASS | Grounded & verified |
| **TC-009** | Analyze everyday expenses. | `spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-010** | Compare essential and discretionary spending. | `budget_help | spending_total` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-011** | Identify categories requiring attention. | `unusual_spending | top_category` | `unusual_spending` | ✅ PASS | Grounded & verified |
| **TC-012** | Detect unusual or potentially duplicate transactions. | `unusual_spending` | `unusual_spending` | ✅ PASS | Grounded & verified |
| **TC-013** | Identify recurring expenses where evidence exists. | `unusual_spending | spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-014** | Analyze spending habits affecting savings. | `savings_plan | spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-015** | Identify spending trends. | `mom_comparison | spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-016** | Analyze spending by weekday when sufficient data exists. | `spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-017** | Calculate average daily spending and a clearly labeled estimate. | `spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-018** | Identify expenses affecting cash flow. | `month_end_balance | spending_total` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-019** | Evaluate a potential 10% spending reduction. | `budget_help | savings_plan` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-020** | Summarize overall spending behavior. | `spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-021** | How to start saving money. | `savings_plan | general_education` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-022** | Realistic monthly savings capacity. | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-023** | Save ৳6,000 per month. | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-024** | Weekly savings needed for a monthly target. | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-025** | Calculate savings rate. | `savings_plan | spending_total` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-026** | Save ৳50,000. | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-027** | Save ৳100,000 within 12 months. | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-028** | Save for a laptop within a deadline. | `savings_goal_progress | savings_plan` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-029** | Prioritize multiple savings goals. | `savings_goal_progress | savings_plan` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-030** | Evaluate existing savings-goal progress. | `savings_goal_progress` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-031** | Explain why money is not left at month-end. | `month_end_balance | savings_plan | budget_help` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-032** | Address negative cash flow before saving. | `month_end_balance | savings_plan | budget_help` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-033** | Plan savings with variable income. | `savings_plan | budget_help` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-034** | Build an emergency fund. | `savings_goal_progress | savings_plan` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-035** | Prioritize emergency savings versus other goals. | `savings_goal_progress | savings_plan` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-036** | Create a weekly savings plan. | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-037** | Plan what to do on payday. | `savings_plan | budget_help` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-038** | Estimate emergency reserves. | `savings_goal_progress | savings_plan | month_end_balance` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-039** | Evaluate a 10% reduction in discretionary spending. | `savings_plan | budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-040** | Create a three-month savings improvement plan. | `savings_plan | financial_projection` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-041** | Explain budgeting to a beginner. | `general_education | budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-042** | Create a budget for next month. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-043** | Allocate income among expenses and savings. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-044** | Evaluate spending relative to income. | `budget_help | spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-045** | Create a realistic monthly budget. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-046** | Recommend category-level budgets. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-047** | Set category spending limits. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-048** | Identify justified spending reductions. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-049** | Reduce discretionary spending by 10%. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-050** | Estimate safe personal spending. | `budget_help | month_end_balance` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-051** | Address running out of money before month-end. | `month_end_balance | budget_help` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-052** | Handle income arriving at different times. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-053** | Plan for unexpected expenses. | `budget_help | health_recommendations | savings_plan` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-054** | Create a budget for reduced income. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-055** | Handle fixed and variable expenses. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-056** | Compare actual spending with a stored budget, if available. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-057** | Identify over-budget categories, if budget data exists. | `budget_help | top_category` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-058** | Calculate remaining spendable funds using available obligations. | `budget_help | month_end_balance` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-059** | Create a weekly plan for the remaining month. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-060** | Review budget performance. | `budget_help | spending_total` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-061** | Estimate month-end spending. | `month_end_balance | financial_projection` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-062** | Estimate month-end cash flow. | `month_end_balance | financial_projection` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-063** | Assess the risk of running out of money. | `month_end_balance | financial_projection` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-064** | Estimate safe spending for the rest of the month. | `month_end_balance | budget_help` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-065** | Project next month's financial position. | `financial_projection | month_end_balance` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-066** | Estimate next month's savings. | `financial_projection | savings_plan` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-067** | Simulate a 15% increase in expenses. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-068** | Simulate a 20% reduction in income. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-069** | Project three months of financial activity. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-070** | Evaluate the reliability of a six-month projection. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-071** | Simulate expenses increasing by 5% monthly. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-072** | Simulate saving an additional ৳2,000 monthly. | `financial_projection | savings_plan` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-073** | Estimate the time required to build an emergency fund. | `savings_goal_progress | financial_projection` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-074** | Simulate a 10% income increase. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-075** | Simulate an additional ৳5,000 in essential expenses. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-076** | Compare optimistic, expected, and pessimistic scenarios. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-077** | Evaluate income-loss resilience using verified available balances. | `financial_projection | financial_health` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-078** | Simulate an unexpected ৳20,000 expense. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-079** | Identify financial stability risks. | `financial_health | financial_projection | month_end_balance` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-080** | Identify data needed for better future projections. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-081** | Explain the user's financial situation to a beginner. | `financial_health | spending_total` | `financial_health` | ✅ PASS | Grounded & verified |
| **TC-082** | Identify three financial problems and possible actions. | `health_recommendations | financial_health` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-083** | Recommend three personalized improvements. | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-084** | Identify good habits and areas for improvement. | `financial_health | health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-085** | Recommend one priority action. | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-086** | Prioritize expense reduction, savings, and cash-flow stability. | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-087** | Recommend habits for the next 30 days. | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-088** | Create a weekly financial action plan. | `health_recommendations | budget_help` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-089** | Find realistic savings opportunities. | `savings_plan | health_recommendations | budget_help` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-090** | Estimate the impact of specific spending changes. | `health_recommendations | financial_projection` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-091** | Explain how to evaluate expensive purchases. | `general_education | health_recommendations` | `general_education` | ✅ PASS | Grounded & verified |
| **TC-092** | Address repeated overspending. | `health_recommendations | unusual_spending | month_end_balance` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-093** | Prepare for unexpected expenses. | `health_recommendations | savings_plan` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-094** | Identify financial risks. | `financial_health | health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-095** | Explain the user's financial position in simple language. | `financial_health | spending_total` | `financial_health` | ✅ PASS | Grounded & verified |
| **TC-096** | Ask useful clarifying questions when required. | `health_recommendations | budget_help | spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-097** | Prioritize financial goals. | `savings_goal_progress | health_recommendations` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-098** | Identify one habit to stop, continue, and start. | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-099** | Create a payday, mid-month, and month-end checklist. | `health_recommendations | budget_help` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-100** | Create a personalized 90-day financial improvement plan. | `health_recommendations | savings_plan` | `health_recommendations` | ✅ PASS | Grounded & verified |

## 5. Recommended Fixes Ranked by Severity

1. **Priority 1 (Critical Calculation & Hallucination Guard)**: Ensure every response citing numbers validates 100% against authenticated ledger snapshots.
2. **Priority 2 (User-Data Isolation & Security)**: Enforce strict boundary rules preventing prompt injections and cross-user data leakage.
3. **Priority 3 (Intent Classification Precision)**: Expand pattern matching for multi-month projections, budget allocations, and granular savings scenarios.
4. **Priority 4 (Insufficient Data Disclaimers)**: When users have $< 3$ months of history, clearly label projections as illustrative run-rate estimates rather than definitive forecasts.
5. **Priority 5 (Essential Obligation Protection)**: Non-discretionary necessities (healthcare, education, rent, utilities) must never be suggested for reductions simply because their absolute amount is large.
