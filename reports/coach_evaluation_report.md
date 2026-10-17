# ArthoBachao AI Coach — 100-Case Automated Bilingual Evaluation Report

**Execution Date**: 2026-10-17T19:47:37.978Z  
**Execution Duration**: 0.16s  
**Total Test Cases Evaluated**: 100 (Bilingual: 50 English + 50 Bangla)  
**Overall Pass Rate**: **100%** (100 / 100)  
**Language Matching Rate**: **100%** (100% language fidelity)  
**Architecture Evaluated**: Deterministic Fallback Engine with Strict Number Validation (Zero Live API Cost, Fast, 100% Reproducible). Live Gemini generation is validated via separate opt-in smoke suite.  

## 1. Executive Summary

| Metric | Count | Percentage |
| :--- | :--- | :--- |
| **Passed (PASS)** | **100** | **100.0%** |
| **Failed (FAIL)** | **0** | **0.0%** |
| **Needs Review (NEEDS_REVIEW)** | **0** | **0.0%** |
| English Cases Evaluated | 50 | 50.0% |
| Bangla Cases Evaluated | 50 | 50.0% |
| Language Matching Accuracy | 100 | 100% |
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
| **TC-006** | What was my single biggest expense? | `largest_expense` | `largest_expense` | ✅ PASS | Grounded & verified |
| **TC-007** | What was my smallest transaction? | `smallest_expense` | `smallest_expense` | ✅ PASS | Grounded & verified |
| **TC-008** | Which merchant did I spend the most at? | `highest_merchant` | `highest_merchant` | ✅ PASS | Grounded & verified |
| **TC-009** | Which merchant did I spend the least at? | `lowest_merchant` | `lowest_merchant` | ✅ PASS | Grounded & verified |
| **TC-010** | Compare this month's spending with last month. | `mom_comparison` | `mom_comparison` | ✅ PASS | Grounded & verified |
| **TC-011** | আমার সব টাকা কোথায় খরচ হচ্ছে? | `spending_total | top_category` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-012** | চলতি মাসে আমার মোট খরচ কত হয়েছে? | `spending_total` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-013** | ক্যাটাগরি অনুযায়ী আমার খরচের বিবরণ দাও। | `spending_total | top_category` | `spending_total` | ✅ PASS | Grounded & verified |
| **TC-014** | কোন খাতে সবচেয়ে বেশি খরচ হয়েছে? | `top_category` | `top_category` | ✅ PASS | Grounded & verified |
| **TC-015** | কোন খাতে সবচেয়ে কম খরচ হয়েছে? | `lowest_category` | `lowest_category` | ✅ PASS | Grounded & verified |
| **TC-016** | আমার একক সবচেয়ে বড় খরচ কোনটি? | `largest_expense` | `largest_expense` | ✅ PASS | Grounded & verified |
| **TC-017** | সবচেয়ে ছোট খরচের লেনদেন কোনটি ছিল? | `smallest_expense` | `smallest_expense` | ✅ PASS | Grounded & verified |
| **TC-018** | কোন মার্চেন্টে সবচেয়ে বেশি টাকা দিয়েছি? | `highest_merchant` | `highest_merchant` | ✅ PASS | Grounded & verified |
| **TC-019** | কোন মার্চেন্টে সবচেয়ে কম খরচ হয়েছে? | `lowest_merchant` | `lowest_merchant` | ✅ PASS | Grounded & verified |
| **TC-020** | গত মাসের তুলনায় এ মাসের খরচের পরিবর্তন কেমন? | `mom_comparison` | `mom_comparison` | ✅ PASS | Grounded & verified |
| **TC-021** | How can I save 6000 tk per month? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-022** | How can I save 20000 tk per month with a deficit? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-023** | Can I save 15000 tk in 3 months? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-024** | What is my current savings rate? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-025** | How can I reach a 30% savings rate? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-026** | How much should I save every week to hit my monthly target? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-027** | How can I save money when my income is variable? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-028** | Should I save money on the day I get paid? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-029** | How are my active savings goals progressing? | `savings_goal_progress` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-030** | Can I afford to contribute ৳5,000 more to my emergency fund goal? | `savings_goal_progress | savings_plan` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-031** | আমি প্রতি মাসে ৬০০০ টাকা কীভাবে সঞ্চয় করব? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-032** | ঘাটতি থাকা অবস্থায় আমি কি মাসে ২০০০০ টাকা সঞ্চয় করতে পারব? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-033** | ৩ মাসে ১৫০০০ টাকা সঞ্চয় করার উপায় কী? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-034** | আমার বর্তমান সঞ্চয়ের হার কত শতাংশ? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-035** | আমি কীভাবে ৩০% সঞ্চয়ের হারে পৌঁছাতে পারব? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-036** | মাসিক লক্ষ্য পূরণে সপ্তাহে কত টাকা সঞ্চয় করা দরকার? | `savings_goal_progress | savings_plan` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-037** | অনিয়মিত বা পরিবর্তনশীল আয়ে কীভাবে নিয়মিত সঞ্চয় করব? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-038** | বেতন বা আয় পাওয়ার দিনই কি সঞ্চয় আলাদা করে রাখা উচিত? | `savings_plan` | `savings_plan` | ✅ PASS | Grounded & verified |
| **TC-039** | আমার বর্তমান সঞ্চয় লক্ষ্যগুলোর অগ্রগতি কেমন? | `savings_goal_progress` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-040** | ইমার্জেন্সি ফান্ড লক্ষ্যে আরও ৫০০০ টাকা জমা দেওয়া কি সম্ভব? | `savings_goal_progress | savings_plan` | `savings_goal_progress` | ✅ PASS | Grounded & verified |
| **TC-041** | How should I allocate my income across categories? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-042** | Help me create a realistic monthly budget. | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-043** | Which category should I cut spending in? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-044** | What is my split between essential and discretionary expenses? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-045** | How should I handle fixed vs variable expenses? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-046** | What is a safe personal spending limit for the rest of this month? | `budget_help | month_end_balance` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-047** | How can I manage my budget when income arrives at different times? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-048** | What is my weekly spending limit for the remaining days? | `budget_help | month_end_balance` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-049** | What impact would cutting discretionary spending by 10% have? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-050** | How do I budget with zero recorded income? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-051** | বিভিন্ন খাতে আমার আয় কীভাবে বণ্টন করা উচিত? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-052** | আমার জন্য একটি বাস্তবসম্মত মাসিক বাজেট তৈরি করো। | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-053** | খরচ কমাতে আমার কোন খাতটি কমানো উচিত? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-054** | আমার প্রয়োজনীয় ও নমনীয় খরচের ভাগ কেমন? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-055** | স্থায়ী খরচ ও পরিবর্তনশীল খরচের ভারসাম্য কীভাবে করব? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-056** | চলতি মাসের বাকি দিনগুলোতে খরচের নিরাপদ সীমা কত? | `budget_help | month_end_balance` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-057** | মাসের বিভিন্ন সময়ে আয় আসলে বাজেট কীভাবে নিয়ন্ত্রণ করব? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-058** | বাকি দিনগুলোর জন্য আমার সাপ্তাহিক খরচের সীমা কত? | `budget_help | month_end_balance` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-059** | অপ্রয়োজনীয় বা নমনীয় খরচ ১০% কমালে কী লাভ হবে? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-060** | কোনো রেকর্ড করা আয় না থাকলে কীভাবে বাজেট চালাব? | `budget_help` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-061** | Predict my financial position for the next six months. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-062** | What will my month-end balance be at this spending rate? | `month_end_balance` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-063** | Will I run out of money before next payday? | `month_end_balance` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-064** | Project my finances for next month based on current trends. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-065** | How much money will I accumulate in 6 months under my baseline trend? | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-066** | Simulate what happens if my living expenses increase by 15%. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-067** | If an unexpected ৳20,000 expense happens, can my balance absorb it? | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-068** | Project my finances for 3 months with incomplete transaction history. | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-069** | What is my financial trajectory under optimistic vs pessimistic scenarios? | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-070** | How much cash flow buffer do I need to avoid deficits? | `month_end_balance | financial_projection` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-071** | আগামী ৬ মাসের জন্য আমার আর্থিক অবস্থানের পূর্বাভাস দাও। | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-072** | বর্তমান খরচের গতি অনুযায়ী মাস শেষে আমার ব্যালেন্স কত দাঁড়াবে? | `month_end_balance` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-073** | পরবর্তী আয় আসার আগেই কি আমার টাকা শেষ হয়ে যাওয়ার ঝুঁকি আছে? | `month_end_balance` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-074** | বর্তমান ধারা অনুযায়ী আগামী মাসে আমার আর্থিক অবস্থান কেমন হবে? | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-075** | বর্তমান গতিতে আগামী ৬ মাসে আমার কত টাকা সঞ্চয় হতে পারে? | `financial_projection | savings_plan` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-076** | আমার জীবনযাত্রার খরচ ১৫% বেড়ে গেলে বাজেটে কী প্রভাব পড়বে? | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-077** | হঠাৎ ২০০০০ টাকা অপ্রত্যাশিত খরচ আসলে কি ব্যালেন্স তা সামলাতে পারবে? | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-078** | সীমিত বা অসম্পূর্ণ লেনদেন তথ্যে ৩ মাসের পূর্বাভাস দাও। | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-079** | আশাবাদী ও রক্ষণশীল পরিস্থিতিতে আমার আর্থিক পূর্বাভাস কেমন হবে? | `financial_projection` | `financial_projection` | ✅ PASS | Grounded & verified |
| **TC-080** | ঘাটতি এড়াতে আমার কত টাকা নিরাপত্তা বাফার রাখা দরকার? | `month_end_balance | financial_projection` | `month_end_balance` | ✅ PASS | Grounded & verified |
| **TC-081** | What are the 3 most useful actions I should take right now? | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-082** | How can I reduce cash-out and MFS fees? | `reduce_cash_outs` | `reduce_cash_outs` | ✅ PASS | Grounded & verified |
| **TC-083** | What good financial habits should I build over the next 30 days? | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-084** | How healthy is my current financial situation overall? | `financial_health` | `financial_health` | ✅ PASS | Grounded & verified |
| **TC-085** | How can I optimize spending when medical expenses are large? | `budget_help | health_recommendations` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-086** | How should I handle repeated overspending in dining and entertainment? | `health_recommendations | budget_help` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-087** | What should I prepare before making a major financial purchase? | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-088** | Provide a checklist for my mid-month and month-end financial reviews. | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-089** | What are the biggest financial stability risks in my profile? | `financial_health | health_recommendations` | `financial_health` | ✅ PASS | Grounded & verified |
| **TC-090** | What missing financial data should I add for better advice? | `health_recommendations | spending_total` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-091** | আমার আর্থিক উন্নতির জন্য এখনই ৩টি অগ্রাধিকারমূলক পদক্ষেপ কী কী? | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-092** | ক্যাশ আউট ও এমএফএস ফি কমানোর উপায় কী? | `reduce_cash_outs` | `reduce_cash_outs` | ✅ PASS | Grounded & verified |
| **TC-093** | আগামী ৩০ দিনে আর্থিক স্বাস্থ্য উন্নত করতে কোন অভ্যাসগুলো গড়ে তুলব? | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-094** | সামগ্রিক দিক থেকে আমার বর্তমান আর্থিক স্বাস্থ্য কেমন? | `financial_health` | `financial_health` | ✅ PASS | Grounded & verified |
| **TC-095** | জরুরি চিকিৎসা খরচে হাত না দিয়ে কীভাবে অন্য খরচ অপটিমাইজ করব? | `budget_help | health_recommendations` | `budget_help` | ✅ PASS | Grounded & verified |
| **TC-096** | বাইরে খাওয়া ও বিনোদনে বারবার অতিরিক্ত খরচ কীভাবে নিয়ন্ত্রণ করব? | `health_recommendations | budget_help` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-097** | বড় কোনো খরচের সিদ্ধান্ত নেওয়ার আগে কী কী বিষয় যাচাই করা উচিত? | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-098** | মাস ও পক্ষকালের আর্থিক পর্যালোচনার জন্য একটি চেকলিস্ট দাও। | `health_recommendations` | `health_recommendations` | ✅ PASS | Grounded & verified |
| **TC-099** | আমার আর্থিক স্থিতিশীলতার ক্ষেত্রে প্রধান দুর্বলতা বা ঝুঁকিগুলো কী? | `financial_health | health_recommendations` | `financial_health` | ✅ PASS | Grounded & verified |
| **TC-100** | আরও নিখুঁত পরামর্শ পেতে অ্যাপে আমার কী কী আর্থিক তথ্য যুক্ত করা উচিত? | `health_recommendations | spending_total` | `health_recommendations` | ✅ PASS | Grounded & verified |

## 5. Recommended Fixes Ranked by Severity

1. **Priority 1 (Critical Calculation & Hallucination Guard)**: Ensure every response citing numbers validates 100% against authenticated ledger snapshots.
2. **Priority 2 (User-Data Isolation & Security)**: Enforce strict boundary rules preventing prompt injections and cross-user data leakage.
3. **Priority 3 (Intent Classification Precision)**: Expand pattern matching for multi-month projections, budget allocations, and granular savings scenarios.
4. **Priority 4 (Insufficient Data Disclaimers)**: When users have $< 3$ months of history, clearly label projections as illustrative run-rate estimates rather than definitive forecasts.
5. **Priority 5 (Essential Obligation Protection)**: Non-discretionary necessities (healthcare, education, rent, utilities) must never be suggested for reductions simply because their absolute amount is large.
