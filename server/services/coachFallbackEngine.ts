import { CoachContext } from './coachContextBuilder';
import { IntentResult } from './intentClassifier';

export interface CoachResponsePayload {
  source: 'ai' | 'fallback';
  modelUsed?: string;
  answer: string;
  factsUsed: string[];
  followUps: string[];
  dataGaps: string[];
}

function convertBnToAsciiDigits(str: string): string {
  const bnToAscii: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return str.replace(/[০-৯]/g, (ch) => bnToAscii[ch] || ch);
}

/**
 * Deterministic Fallback Engine
 * Generates data-grounded, educational responses in English and Bengali using ONLY real ledger facts.
 * Never outputs hardcoded mock figures or generic greetings when real data is available.
 */
export function generateDeterministicCoachResponse(
  intentResult: IntentResult,
  ctx: CoachContext,
  language: 'en' | 'bn' = 'en',
  query: string = ''
): CoachResponsePayload {
  const isBn = language === 'bn';
  const { intent, parsedPlan } = intentResult;
  const norm = (query || '').toLowerCase();

  const factsUsed: string[] = [];
  const followUps: string[] = [];
  const dataGaps: string[] = [];

  const income = ctx.snapshot.monthlyIncome;
  const spending = ctx.snapshot.monthlySpending;
  const netSavings = ctx.snapshot.netSavings;
  const currentSurplus = netSavings;
  const fmt = (n: number) => n.toLocaleString();
  const savingsRate = ctx.snapshot.savingsRate;
  const balance = ctx.snapshot.currentBalance;
  const topCat = ctx.spending.topCategory;
  const lowestCat = ctx.spending.lowestCategory;
  const merchants = ctx.spending.merchants;
  const extrema = ctx.spending.extrema;
  const comparison = ctx.spending.comparison;
  const zeroSpendingCats = ctx.spending.zeroSpendingCategories;
  const monthEndBalance = ctx.cashFlow.forecastMonthEndBalance;
  const recommendedBuffer = ctx.cashFlow.recommendedBuffer;
  const weeklyTrim = ctx.cashFlow.recommendedWeeklyReduction;
  const isBalanceEstimated = ctx.cashFlow.isBalanceEstimated ?? false;
  const isForecastSufficient = ctx.cashFlow.isForecastSufficient ?? true;
  const upcomingBills = ctx.cashFlow.upcomingBills ?? 0;
  const committedFunds = ctx.cashFlow.committedFunds ?? 0;
  const uncommittedPool = ctx.cashFlow.uncommittedDiscretionaryPool ?? Math.max(0, balance - (upcomingBills + recommendedBuffer));
  const safeSpendingWeekly = ctx.cashFlow.safeSpendingLimitWeekly ?? (uncommittedPool > 0 ? Math.round(uncommittedPool / 4) : 0);
  const remainingDays = ctx.cashFlow.remainingDaysInMonth ?? 14;
  const primaryGoal = ctx.goals.items[0] || null;
  const healthScore = ctx.health.score;
  const healthBand = ctx.health.band;
  const cashOutTotal = ctx.cashOut.totalAmount;
  const feeCost = ctx.cashOut.feeCost;

  let answer = '';

  switch (intent) {
    case 'spending_total': {
      factsUsed.push('snapshot.monthlySpending', 'snapshot.monthlyIncome', 'snapshot.netSavings');
      if (topCat) {
        factsUsed.push('spending.topCategory', 'spending.topCategoryAmount');
      }

      if (spending === 0 && income === 0) {
        dataGaps.push('No transactions found for the current billing period');
        answer = isBn
          ? 'চলতি মাসে আপনার কোনো খরচের তথ্য এখনো পাওয়া যায়নি। নতুন লেনদেন যোগ করলে আপনার মোট খরচ ও বিশ্লেষণ এখানে প্রদর্শিত হবে।'
          : 'No expense records found for the current billing period. Add transactions to begin tracking your monthly total.';
        break;
      }

      const catEntries = Object.entries(ctx.spending.categoryTotals || {});
      const breakdownTextBn =
        catEntries.length > 1
          ? `\n\nখাতভিত্তিক বিভাজন:\n` +
            catEntries.map(([cat, amt]) => `• **${cat}**: ৳${amt.toLocaleString()}`).join('\n')
          : '';
      const breakdownTextEn =
        catEntries.length > 1
          ? `\n\nCategory Breakdown:\n` +
            catEntries.map(([cat, amt]) => `• **${cat}**: ৳${amt.toLocaleString()}`).join('\n')
          : '';

      if (isBn) {
        answer = `চলতি মাসে আপনার মোট ব্যয় **৳${spending.toLocaleString()}** (মোট আয় ৳${income.toLocaleString()}, যার মধ্যে নিট সঞ্চয় ৳${netSavings.toLocaleString()})।${
          topCat
            ? ` আপনার ব্যয়ের প্রধান খাত **${topCat.category}** (৳${topCat.amount.toLocaleString()}, যা মোট ব্যয়ের ${topCat.percentage}%)।`
            : ''
        }${breakdownTextBn}`;
      } else {
        answer = `Your total spending for the current month is **৳${spending.toLocaleString()}** against a recorded income of ৳${income.toLocaleString()}, leaving a net monthly surplus of ৳${netSavings.toLocaleString()}.${
          topCat
            ? ` Your largest outflow is **${topCat.category}** at ৳${topCat.amount.toLocaleString()} (${topCat.percentage}% of all expenses).`
            : ''
        }${breakdownTextEn}`;
      }
      followUps.push(
        isBn ? 'আমার শীর্ষ খরচের খাত কোনটি?' : 'What is my top spending category?',
        isBn ? 'আমার সর্বনিম্ন খরচের খাত কোনটি?' : 'What is my lowest spending category?'
      );
      break;
    }

    case 'top_category': {
      if (topCat) {
        factsUsed.push(
          'spending.topCategory',
          'spending.topCategoryAmount',
          'spending.topCategoryPercentage',
          'spending.topCategoryMomChange'
        );
        if (topCat.isTie && topCat.tiedCategories && topCat.tiedCategories.length > 1) {
          if (isBn) {
            answer = `আপনার সবচেয়ে বড় খরচের খাত যৌথভাবে **${topCat.tiedCategories.join(' এবং ')}**, প্রতিটিতে ব্যয় হয়েছে **৳${topCat.amount.toLocaleString()}** (মোট ব্যয়ের **${topCat.percentage}%**)।`;
          } else {
            answer = `Your top spending is tied between **${topCat.tiedCategories.join(' and ')}** at **৳${topCat.amount.toLocaleString()}** each (${topCat.percentage}% of total expenses).`;
          }
        } else {
          if (isBn) {
            const hasPrior = topCat.hasMomComparison !== undefined ? topCat.hasMomComparison && topCat.momChangePercentage !== 0 : topCat.momChangePercentage !== 0;
            const momText = hasPrior
              ? ` (গত মাসের তুলনায় ${topCat.momChangePercentage > 0 ? '+' : ''}${topCat.momChangePercentage}%)`
              : '';
            answer = `আপনার সবচেয়ে বড় খরচের খাত হলো **${topCat.category}**। এ মাসে এখানে ব্যয় হয়েছে **৳${topCat.amount.toLocaleString()}**, যা আপনার মোট ব্যয়ের **${topCat.percentage}%**${momText}। এই প্রধান খাতের খরচ নিয়ন্ত্রণে রাখাই আপনার সঞ্চয় বাড়ানোর সবচেয়ে কার্যকর পথ।`;
          } else {
            const hasPrior = topCat.hasMomComparison !== undefined ? topCat.hasMomComparison && topCat.momChangePercentage !== 0 : topCat.momChangePercentage !== 0;
            const momText = hasPrior
              ? ` (${topCat.momChangePercentage > 0 ? '+' : ''}${topCat.momChangePercentage}% compared to last month)`
              : '';
            answer = `Your top spending category is **${topCat.category}**, with **৳${topCat.amount.toLocaleString()}** spent this month (${topCat.percentage}% of your total expenses)${momText}. Moderating outflows in this category offers the fastest route to boosting your monthly savings.`;
          }
        }
      } else {
        dataGaps.push('No categorized spending recorded');
        answer = isBn
          ? 'আপনার কোনো নির্দিষ্ট খরচের তথ্য পাওয়া যায়নি। লেনদেন যোগ করলে শীর্ষ খাত স্বয়ংক্রিয়ভাবে চিহ্নিত হবে।'
          : 'No categorized spending transactions found. Add expenses to identify your top category.';
      }
      followUps.push(
        isBn ? 'আমার সর্বনিম্ন খরচের খাত কোনটি?' : 'What is my lowest spending category?',
        isBn ? 'এই খাতে খরচ কমানোর উপায় কি?' : 'How can I reduce spending in this category?'
      );
      break;
    }

    case 'lowest_category': {
      if (lowestCat) {
        factsUsed.push(
          'spending.lowestCategory',
          'spending.lowestCategoryAmount',
          'spending.lowestCategoryPercentage',
          'spending.lowestCategoryMomChange'
        );
        if (lowestCat.isTie && lowestCat.tiedCategories && lowestCat.tiedCategories.length > 1) {
          if (isBn) {
            answer = `আপনার সর্বনিম্ন ইতিবাচক ব্যয়ের খাত যৌথভাবে **${lowestCat.tiedCategories.join(' এবং ')}**, প্রতিটিতে ব্যয় হয়েছে **৳${lowestCat.amount.toLocaleString()}** (মোট ব্যয়ের **${lowestCat.percentage}%**)।`;
          } else {
            answer = `Your lowest spending is tied between **${lowestCat.tiedCategories.join(' and ')}** at **৳${lowestCat.amount.toLocaleString()}** each (${lowestCat.percentage}% of total expenses).`;
          }
        } else {
          if (isBn) {
            const hasPrior = lowestCat.hasMomComparison !== undefined ? lowestCat.hasMomComparison && lowestCat.momChangePercentage !== 0 : lowestCat.momChangePercentage !== 0;
            const momText = hasPrior
              ? ` (গত মাসের তুলনায় ${lowestCat.momChangePercentage > 0 ? '+' : ''}${lowestCat.momChangePercentage}%)`
              : '';
            answer = `আপনার সর্বনিম্ন খরচের খাত হলো **${lowestCat.category}**। এ মাসে এখানে ব্যয় হয়েছে মাত্র **৳${lowestCat.amount.toLocaleString()}**, যা আপনার মোট ব্যয়ের **${lowestCat.percentage}%**${momText}।`;
          } else {
            const hasPrior = lowestCat.hasMomComparison !== undefined ? lowestCat.hasMomComparison && lowestCat.momChangePercentage !== 0 : lowestCat.momChangePercentage !== 0;
            const momText = hasPrior
              ? ` (${lowestCat.momChangePercentage > 0 ? '+' : ''}${lowestCat.momChangePercentage}% compared to last month)`
              : '';
            answer = `Your lowest spending category for this month is **${lowestCat.category}**, with **৳${lowestCat.amount.toLocaleString()}** spent (${lowestCat.percentage}% of your total expenses)${momText}.`;
          }
        }
      } else {
        dataGaps.push('No categorized spending recorded');
        answer = isBn
          ? 'চলতি মাসে আপনার কোনো ইতিবাচক খরচের রেকর্ড পাওয়া যায়নি। লেনদেন যোগ করলে সর্বনিম্ন খাত চিহ্নিত হবে।'
          : 'No positive expense transactions recorded for the current month. Add expenses to track your lowest category.';
      }
      followUps.push(
        isBn ? 'আমার শীর্ষ খরচের খাত কোনটি?' : 'What is my top spending category?',
        isBn ? 'কোন খাতে কোনো খরচ হয়নি?' : 'Which categories had zero spending?'
      );
      break;
    }

    case 'highest_merchant': {
      const topM = merchants?.highestMerchant;
      if (topM) {
        factsUsed.push('spending.highestMerchant', 'spending.highestMerchantAmount', 'spending.highestMerchantPercentage');
        if (topM.isTie && topM.tiedMerchants && topM.tiedMerchants.length > 1) {
          answer = isBn
            ? `আপনার সর্বোচ্চ ব্যয়ের মার্চেন্ট যৌথভাবে **${topM.tiedMerchants.join(' এবং ')}**, প্রতিটিতে মোট ব্যয় **৳${topM.amount.toLocaleString()}** (${topM.percentage}%)।`
            : `Your highest spending merchant is tied between **${topM.tiedMerchants.join(' and ')}** with **৳${topM.amount.toLocaleString()}** spent at each (${topM.percentage}% of total expenses).`;
        } else {
          answer = isBn
            ? `আপনার সবচেয়ে বেশি খরচ হয়েছে **${topM.merchant}** মার্চেন্টে। এ মাসে এখানে মোট **৳${topM.amount.toLocaleString()}** (${topM.count}টি লেনদেন, মোট ব্যয়ের ${topM.percentage}%) ব্যয় হয়েছে।`
            : `Your highest spending merchant this month is **${topM.merchant}**, with **৳${topM.amount.toLocaleString()}** spent across ${topM.count} transaction(s) (${topM.percentage}% of your total expenses).`;
        }
      } else {
        dataGaps.push('No merchant spending recorded');
        answer = isBn
          ? 'চলতি মাসে কোনো মার্চেন্ট খরচের তথ্য পাওয়া যায়নি।'
          : 'No merchant spending recorded for the current month.';
      }
      followUps.push(
        isBn ? 'আমার সর্বনিম্ন খরচের মার্চেন্ট কোনটি?' : 'Which merchant had my lowest spending?',
        isBn ? 'আমার একক সর্বোচ্চ খরচ কত ছিল?' : 'What was my largest individual expense?'
      );
      break;
    }

    case 'lowest_merchant': {
      const lowM = merchants?.lowestMerchant;
      if (lowM) {
        factsUsed.push('spending.lowestMerchant', 'spending.lowestMerchantAmount', 'spending.lowestMerchantPercentage');
        if (lowM.isTie && lowM.tiedMerchants && lowM.tiedMerchants.length > 1) {
          answer = isBn
            ? `আপনার সর্বনিম্ন ব্যয়ের মার্চেন্ট যৌথভাবে **${lowM.tiedMerchants.join(' এবং ')}**, প্রতিটিতে মোট ব্যয় **৳${lowM.amount.toLocaleString()}** (${lowM.percentage}%)।`
            : `Your lowest spending merchant is tied between **${lowM.tiedMerchants.join(' and ')}** with **৳${lowM.amount.toLocaleString()}** spent at each (${lowM.percentage}% of total expenses).`;
        } else {
          answer = isBn
            ? `আপনার সর্বনিম্ন খরচের মার্চেন্ট হলো **${lowM.merchant}**। এ মাসে এখানে ব্যয় হয়েছে মাত্র **৳${lowM.amount.toLocaleString()}** (${lowM.count}টি লেনদেন, মোট ব্যয়ের ${lowM.percentage}%)।`
            : `Your lowest spending merchant this month is **${lowM.merchant}**, with **৳${lowM.amount.toLocaleString()}** spent (${lowM.count} transaction(s), ${lowM.percentage}% of total expenses).`;
        }
      } else {
        dataGaps.push('No merchant spending recorded');
        answer = isBn
          ? 'চলতি মাসে কোনো মার্চেন্ট খরচের তথ্য পাওয়া যায়নি।'
          : 'No merchant spending recorded for the current month.';
      }
      followUps.push(
        isBn ? 'আমার সর্বোচ্চ খরচের মার্চেন্ট কোনটি?' : 'Which merchant had my highest spending?',
        isBn ? 'আমার একক সর্বনিম্ন খরচ কত?' : 'What was my smallest individual expense?'
      );
      break;
    }

    case 'largest_expense': {
      const largest = extrema?.largestExpense;
      if (largest) {
        factsUsed.push('spending.largestExpenseAmount', 'spending.largestExpenseCategory');
        const merchText = largest.merchant ? ` (${largest.merchant})` : '';
        answer = isBn
          ? `চলতি মাসে আপনার একক সর্বোচ্চ ব্যয়ের লেনদেন ছিল **৳${largest.amount.toLocaleString()}**। এটি **${largest.category}**${merchText} খাতে ${largest.date} তারিখে হয়েছিল।`
          : `Your single largest expense transaction this month was **৳${largest.amount.toLocaleString()}** in **${largest.category}**${merchText} on ${largest.date}.`;
      } else {
        dataGaps.push('No individual expenses found');
        answer = isBn
          ? 'চলতি মাসে কোনো খরচের লেনদেন পাওয়া যায়নি।'
          : 'No expense transactions recorded for the current month.';
      }
      followUps.push(
        isBn ? 'আমার একক সর্বনিম্ন খরচ কত ছিল?' : 'What was my smallest single expense?',
        isBn ? 'আমার শীর্ষ খরচের খাত কোনটি?' : 'What is my top spending category?'
      );
      break;
    }

    case 'smallest_expense': {
      const smallest = extrema?.smallestExpense;
      if (smallest) {
        factsUsed.push('spending.smallestExpenseAmount', 'spending.smallestExpenseCategory');
        const merchText = smallest.merchant ? ` (${smallest.merchant})` : '';
        answer = isBn
          ? `চলতি মাসে আপনার একক সর্বনিম্ন খরচের লেনদেন ছিল **৳${smallest.amount.toLocaleString()}**। এটি **${smallest.category}**${merchText} খাতে ${smallest.date} তারিখে হয়েছিল।`
          : `Your single smallest expense transaction this month was **৳${smallest.amount.toLocaleString()}** in **${smallest.category}**${merchText} on ${smallest.date}.`;
      } else {
        dataGaps.push('No individual expenses found');
        answer = isBn
          ? 'চলতি মাসে কোনো খরচের লেনদেন পাওয়া যায়নি।'
          : 'No expense transactions recorded for the current month.';
      }
      followUps.push(
        isBn ? 'আমার একক সর্বোচ্চ খরচ কত ছিল?' : 'What was my largest single expense?',
        isBn ? 'আমার সর্বনিম্ন খরচের খাত কোনটি?' : 'What is my lowest spending category?'
      );
      break;
    }

    case 'zero_spending': {
      factsUsed.push('spending.zeroSpendingCategories');
      if (zeroSpendingCats && zeroSpendingCats.length > 0) {
        answer = isBn
          ? `চলতি মাসে যেসব খাতে আপনার কোনো খরচ হয়নি:\n${zeroSpendingCats.map((c) => `• **${c}** (৳০)`).join('\n')}`
          : `Categories with zero recorded spending this month:\n${zeroSpendingCats.map((c) => `• **${c}** (৳0)`).join('\n')}`;
      } else {
        answer = isBn
          ? 'চলতি মাসে আপনার প্রতিটি সক্রিয় খাতেই ব্যয় রেকর্ড করা হয়েছে; কোনো শূন্য খরচের খাত নেই।'
          : 'All active expense categories have recorded spending this month; there are no zero-spend categories.';
      }
      followUps.push(
        isBn ? 'আমার সর্বনিম্ন খরচের খাত কোনটি?' : 'What was my lowest positive spending category?',
        isBn ? 'আমার মোট খরচ কত?' : 'What is my total spending this month?'
      );
      break;
    }

    case 'mom_comparison': {
      factsUsed.push('spending.totalSpending', 'spending.previousMonthSpending', 'spending.momChangePercentage');
      const prev = comparison?.previousSpending || 0;
      const curr = spending;
      const pct = Math.abs(comparison?.percentageChange || 0);
      const diff = Math.abs(comparison?.difference || 0);

      if (prev === 0) {
        answer = isBn
          ? `চলতি মাসে আপনার ব্যয় **৳${curr.toLocaleString()}**। পূর্ববর্তী মাসে কোনো খরচের তথ্য না থাকায় তুলনা করা সম্ভব হচ্ছে না।`
          : `Your spending this month is **৳${curr.toLocaleString()}**. No prior month transaction data is available for comparison.`;
      } else if (comparison?.direction === 'higher') {
        answer = isBn
          ? `চলতি মাসে আপনার ব্যয় **৳${curr.toLocaleString()}**। গত মাসের (৳${prev.toLocaleString()}) তুলনায় এ মাসে আপনার খরচ **${pct}%** বৃদ্ধি পেয়েছে (অতিরিক্ত **৳${diff.toLocaleString()}**)।`
          : `This month your spending is **৳${curr.toLocaleString()}**. Compared to last month (৳${prev.toLocaleString()}), your spending has increased by **${pct}%** (+**৳${diff.toLocaleString()}**).`;
      } else if (comparison?.direction === 'lower') {
        answer = isBn
          ? `চলতি মাসে আপনার ব্যয় **৳${curr.toLocaleString()}**। গত মাসের (৳${prev.toLocaleString()}) তুলনায় এ মাসে আপনার খরচ **${pct}%** কমেছে (**৳${diff.toLocaleString()}** সাশ্রয় হয়েছে)।`
          : `This month your spending is **৳${curr.toLocaleString()}**. Compared to last month (৳${prev.toLocaleString()}), your spending has decreased by **${pct}%** (saving **৳${diff.toLocaleString()}**).`;
      } else {
        answer = isBn
          ? `গত মাসের (৳${prev.toLocaleString()}) তুলনায় এ মাসে আপনার ব্যয় অপরিবর্তিত রয়েছে (৳${curr.toLocaleString()})।`
          : `Your spending is identical to last month at **৳${curr.toLocaleString()}**.`;
      }
      followUps.push(
        isBn ? 'শীর্ষ খরচের খাত কোনটি?' : 'What is my top spending category?',
        isBn ? 'বাজেট নিয়ন্ত্রণে পরামর্শ দিন' : 'How can I optimize my budget?'
      );
      break;
    }

    case 'income_total': {
      factsUsed.push('snapshot.monthlyIncome', 'snapshot.netSavings', 'snapshot.savingsRate');
      if (income === 0) {
        dataGaps.push('No income records found for the current billing period');
        answer = isBn
          ? 'চলতি মাসে আপনার কোনো আয়ের তথ্য এখনো রেকর্ড করা হয়নি।'
          : 'No income records found for the current billing period.';
      } else {
        answer = isBn
          ? `চলতি মাসে আপনার মোট রেকর্ডকৃত আয় **৳${income.toLocaleString()}**। এর মধ্যে মোট ব্যয় ৳${spending.toLocaleString()} বাদ দিয়ে নিট সঞ্চয় রয়েছে **৳${netSavings.toLocaleString()}** (সঞ্চয়ের হার: **${savingsRate}%**)।`
          : `Your recorded total income for the current month is **৳${income.toLocaleString()}**. After total expenses of ৳${spending.toLocaleString()}, your net savings is **৳${netSavings.toLocaleString()}** (savings rate: **${savingsRate}%**).`;
      }
      followUps.push(
        isBn ? 'আমার মোট খরচ কত?' : 'What is my total spending?',
        isBn ? 'আমার সঞ্চয় লক্ষ্য কেমন চলছে?' : 'How are my savings goals progressing?'
      );
      break;
    }

    case 'month_end_balance': {
      factsUsed.push(
        'cashFlow.startingBalance',
        'cashFlow.monthEndBalance',
        'cashFlow.recommendedBuffer',
        'cashFlow.recommendedWeeklyReduction',
        'snapshot.monthlyIncome',
        'snapshot.monthlySpending',
        'snapshot.netSavings'
      );
      if (ctx.cashFlow.upcomingBills !== undefined) {
        factsUsed.push('cashFlow.upcomingBills');
      }
      if (ctx.cashFlow.safeSpendingLimitWeekly !== undefined) {
        factsUsed.push('cashFlow.safeSpendingLimitWeekly');
      }
      if (topCat) {
        factsUsed.push('spending.topCategory');
      }
      const netCashFlow = ctx.snapshot.netCashFlow !== undefined ? ctx.snapshot.netCashFlow : (income - spending);
      const isDeficit = netCashFlow < 0 || spending > income;
      const absShortfall = Math.abs(netCashFlow);

      if (isBn) {
        let safeSpendingLine = '';
        if (uncommittedPool === 0 && balance > 0 && committedFunds >= balance) {
          safeSpendingLine = `• **নিরাপদ সীমা**: আপনার ব্যালেন্স **৳${balance.toLocaleString()}** এর সম্পূর্ণ অংশই আসন্ন নির্ধারিত বিল, সঞ্চয় লক্ষ্য বা নিরাপত্তা বাফারে বরাদ্দ রয়েছে। তাই অতিরিক্ত ব্যয়ের নিরাপদ সীমা **৳০/সপ্তাহ**।`;
        } else {
          safeSpendingLine = `• **নিরাপদ সীমা**: ব্যালেন্স **৳${balance.toLocaleString()}** এর ভিত্তিতে, নির্ধারিত প্রতিশ্রুতিসমূহ আলাদা রাখার পর বাকি ${remainingDays} দিনের জন্য মোট নিরাপদ তহবিল **৳${uncommittedPool.toLocaleString()}** (সাপ্তাহিক খরচের নিরাপদ সীমা: প্রায় **৳${safeSpendingWeekly.toLocaleString()}**)।`;
        }

        const balanceDesc = isBalanceEstimated
          ? `আপনার **আনুমানিক নিট উদ্বৃত্ত ৳${balance.toLocaleString()}** (রেকর্ডকৃত লেনদেন থেকে প্রাপ্ত; কোনো ব্যাংক বা ওয়ালেট অ্যাকাউন্ট সংযুক্ত নেই)`
          : `আপনার বর্তমান উপলব্ধ ব্যালেন্স **৳${balance.toLocaleString()}**`;

        const forecastDesc = isForecastSufficient
          ? `আগামী মাস শেষে সম্ভাব্য ব্যালেন্স দাঁড়াবে প্রায় **৳${monthEndBalance.toLocaleString()}** (AI-assisted forecast)`
          : `আগামী মাস শেষে সম্ভাব্য ব্যালেন্স দাঁড়াবে প্রায় **৳${monthEndBalance.toLocaleString()}** (প্রাথমিক পূর্বাভাস — নিয়মিত খরচের হারের জন্য পর্যাপ্ত ডেটা নেই; নির্ধারিত বিল ৳${upcomingBills.toLocaleString()} সমন্বিত, কোনো অতিরিক্ত অনুমানমূলক খরচ ধরা হয়নি)`;

        let bufferDesc = '';
        if (recommendedBuffer > 0) {
          bufferDesc = `• **নিরাপত্তা বাফার**: আপনার অ্যাকাউন্টের জন্য প্রস্তাবিত নিরাপত্তা বাফার হলো **৳${recommendedBuffer.toLocaleString()}**।${
            monthEndBalance < recommendedBuffer
              ? ` ক্যাশ-ফ্লো স্থিতিশীল রাখতে ও ঘাটতির ঝুঁকি এড়াতে সপ্তাহে প্রায় **৳${weeklyTrim.toLocaleString()}** সাশ্রয় করার পরামর্শ দেওয়া হচ্ছে।`
              : ' আপনার পূর্বাভাসিত ব্যালেন্স প্রস্তাবিত বাফারের মধ্যে নিরাপদ রয়েছে।'
          }`;
        } else {
          bufferDesc = `• **নিরাপত্তা বাফার**: নিরাপত্তা বাফার নির্ধারণের জন্য বর্তমানে কোনো নিয়মিত বিল বা পর্যাপ্ত ব্যয়ের ইতিহাস নেই। নিয়মিত বিল যোগ করলে স্বয়ংক্রিয় বাফার সক্রিয় হবে।`;
        }

        const dataNote = isBalanceEstimated
          ? `\n⚠️ *সতর্কতা: কোনো ব্যাংক বা ওয়ালেট অ্যাকাউন্ট সংযুক্ত না থাকায় এবং মৌলিক জীবনযাত্রার খরচ (বাসা ভাড়া, খাবার, ইউটিলিটি) নথিবদ্ধ না থাকায় এটি একটি প্রাথমিক প্রাক্কলন।*`
          : '';

        answer = `${balanceDesc} এর ভিত্তিতে ${forecastDesc}।\n\n` +
          `• **আয়-ব্যয়ের অবস্থান**: চলতি মাসে আপনার রেকর্ডকৃত আয় **৳${income.toLocaleString()}** এবং মোট ব্যয় **৳${spending.toLocaleString()}** (${isDeficit ? `মাসিক নিট ঘাটতি **৳${absShortfall.toLocaleString()}** (ঘাটতি ও নগদ সংকটের ঝুঁকি)` : `মাসিক নিট উদ্বৃত্ত **৳${currentSurplus.toLocaleString()}**`}${topCat ? `, যার প্রধান খাত **${topCat.category}** (৳${topCat.amount.toLocaleString()})` : ''})।\n` +
          `${bufferDesc}\n` +
          `${safeSpendingLine}${dataNote}`;
      } else {
        let safeSpendingLine = '';
        if (uncommittedPool === 0 && balance > 0 && committedFunds >= balance) {
          safeSpendingLine = `• **Safe Spending Limit**: Your liquid balance of **৳${balance.toLocaleString()}** is fully committed to upcoming scheduled bills, active savings goals, or safety reserves. Your safe personal spending limit is **৳0/week**.`;
        } else {
          safeSpendingLine = `• **Safe Spending Limit**: Backed by your liquid balance of **৳${balance.toLocaleString()}**, after reserving funds for commitments and safety buffer, your safe personal spending limit for the remaining ${remainingDays} days is **৳${uncommittedPool.toLocaleString()}** (weekly spending limit: approximately **৳${safeSpendingWeekly.toLocaleString()}**).`;
        }

        const balanceDesc = isBalanceEstimated
          ? `Based on your **estimated net cash of ৳${balance.toLocaleString()}** (derived from recorded income minus expenses; no bank or MFS accounts are currently linked)`
          : `Based on your verified liquid balance of **৳${balance.toLocaleString()}**`;

        const forecastDesc = isForecastSufficient
          ? `your projected month-end balance is approximately **৳${monthEndBalance.toLocaleString()}** (AI-assisted forecast)`
          : `your projected month-end balance is approximately **৳${monthEndBalance.toLocaleString()}** (Preliminary forecast — insufficient historical spending data to establish a daily burn rate; reflects scheduled bills of ৳${upcomingBills.toLocaleString()} with zero unrecorded daily expenses assumed)`;

        let bufferDesc = '';
        if (recommendedBuffer > 0) {
          bufferDesc = `• **Safety Buffer**: The recommended liquidity safety buffer is **৳${recommendedBuffer.toLocaleString()}**.${
            monthEndBalance < recommendedBuffer
              ? ` To restore healthy cash flow and manage liquidity risk, trimming ~**৳${weeklyTrim.toLocaleString()}/week** in flexible spending is recommended.`
              : ' Your projected margin remains comfortably above the recommended safety buffer.'
          }`;
        } else {
          bufferDesc = `• **Safety Buffer**: No recurring obligations are recorded and insufficient expense history exists to calculate a tailored safety buffer. Adding recurring bills will establish an automated liquidity buffer.`;
        }

        const dataNote = isBalanceEstimated
          ? `\n⚠️ *Data Limitation: No bank or wallet accounts are connected, and essential monthly living costs (such as rent, groceries, and utilities) appear unrecorded. Treat this safe personal spending limit as a preliminary ceiling.*`
          : '';

        answer = `${balanceDesc}, ${forecastDesc}.\n\n` +
          `• **Cash Flow Position**: Your recorded monthly income is **৳${income.toLocaleString()}** against total expenses of **৳${spending.toLocaleString()}** (${isDeficit ? `net monthly deficit of **৳${absShortfall.toLocaleString()}** (risk of running short)` : `net monthly surplus of **৳${currentSurplus.toLocaleString()}**`}${topCat ? `, with largest outflow in **${topCat.category}** (৳${topCat.amount.toLocaleString()})` : ''}).\n` +
          `${bufferDesc}\n` +
          `${safeSpendingLine}${dataNote}`;
      }
      followUps.push(
        isBn ? 'আমি কীভাবে বেশি সঞ্চয় করতে পারি?' : 'How can I save more money?',
        isBn ? 'আমার সঞ্চয় লক্ষ্য ঠিক পথে আছে?' : 'Is my savings goal on track?'
      );
      break;
    }

    case 'savings_goal_progress': {
      const targetGoal =
        ctx.goals.items.find((g) =>
          norm.includes(g.title.toLowerCase().split(' ')[0]) ||
          g.title.toLowerCase().split(' ').some((word) => word.length > 2 && norm.includes(word.toLowerCase()))
        ) || primaryGoal;

      if (targetGoal) {
        factsUsed.push(
          'goals.goal1.title',
          'goals.goal1.targetAmount',
          'goals.goal1.currentAmount',
          'goals.goal1.progressPercentage',
          'goals.goal1.remainingAmount',
          'goals.goal1.requiredMonthlyContribution'
        );
        if (isBn) {
          answer = `আপনার সঞ্চয় লক্ষ্য **${targetGoal.title}** এর বর্তমান অগ্রগতি:\n• লক্ষ্যমাত্রা: ৳${targetGoal.targetAmount.toLocaleString()}\n• বর্তমান জমা: ৳${targetGoal.currentAmount.toLocaleString()} (${targetGoal.progressPercentage}% সম্পন্ন)\n• অবশিষ্ট ঘাটতি: ৳${targetGoal.remainingAmount.toLocaleString()}\n• নির্ধারিত সময়ে পৌঁছাতে প্রয়োজনীয় মাসিক সঞ্চয়: ৳${targetGoal.requiredMonthlyContribution.toLocaleString()}/মাস।`;
        } else {
          answer = `Progress for your goal **${targetGoal.title}**:\n• Target: ৳${targetGoal.targetAmount.toLocaleString()}\n• Saved: ৳${targetGoal.currentAmount.toLocaleString()} (${targetGoal.progressPercentage}% completed)\n• Remaining Gap: ৳${targetGoal.remainingAmount.toLocaleString()}\n• Required Monthly Pace: ৳${targetGoal.requiredMonthlyContribution.toLocaleString()}/month to meet your deadline (${targetGoal.deadline}).`;
        }
      } else {
        dataGaps.push('No active savings goals found');
        answer = isBn
          ? 'বর্তমানে আপনার কোনো সক্রিয় সঞ্চয় লক্ষ্য সেট করা নেই। গোল সেকশন থেকে একটি নতুন লক্ষ্য যোগ করুন।'
          : 'You do not have any active savings goals set. Add a goal from the Savings Goals screen to track your progress.';
      }
      followUps.push(
        isBn ? 'লক্ষ্য দ্রুত পূরণের উপায় কি?' : 'How can I reach my goal faster?',
        isBn ? 'আমার আর্থিক স্বাস্থ্য স্কোর কত?' : 'What is my financial health score?'
      );
      break;
    }

    case 'savings_plan': {
      if (parsedPlan) {
        if (!parsedPlan.isRecurringMonthly && parsedPlan.monthsDuration && parsedPlan.monthsDuration > 1) {
          factsUsed.push(
            'savingsPlan.parsedTargetAmount',
            'savingsPlan.parsedMonthsDuration',
            'savingsPlan.requiredMonthly',
            'snapshot.netSavings'
          );
          if (isBn) {
            answer = `**${parsedPlan.monthsDuration} মাসে ৳${parsedPlan.targetAmount.toLocaleString()}** সঞ্চয় করতে প্রতি মাসে প্রয়োজন **৳${parsedPlan.requiredMonthly.toLocaleString()}**।\n\nআপনার বর্তমান মাসিক নিট উদ্বৃত্ত ৳${netSavings.toLocaleString()}।${
              parsedPlan.isFeasible
                ? ' আপনার বর্তমান উদ্বৃত্ত এই লক্ষ্য পূরণের জন্য যথেষ্ট এবং পরিকল্পনাটি বাস্তবসম্মত।'
                : ` লক্ষ্যটি সফলভাবে পূরণ করতে প্রতি মাসে অতিরিক্ত ৳${parsedPlan.monthlyGap.toLocaleString()} সাশ্রয় করতে হবে (শীর্ষ খরচের খাত থেকে খরচ হ্রাস করে)।`
            }`;
          } else {
            answer = `To save **৳${parsedPlan.targetAmount.toLocaleString()} in ${parsedPlan.monthsDuration} months**, you need to save **৳${parsedPlan.requiredMonthly.toLocaleString()}/month**.\n\nYour current monthly net surplus is ৳${netSavings.toLocaleString()}.${
              parsedPlan.isFeasible
                ? ' Your current monthly cash flow is sufficient to achieve this goal.'
                : ` Bridging the monthly gap of ৳${parsedPlan.monthlyGap.toLocaleString()} requires optimizing flexible spending in your top expense categories.`
            }`;
          }
        } else {
          // Recurring monthly target (e.g. "How can I save 6000 tk per month?")
          const monthlyTarget = parsedPlan.monthlyTarget ?? parsedPlan.targetAmount;
          const weeklyTarget = parsedPlan.weeklyTarget ?? Math.round(monthlyTarget / 4);
          const hasRecordedInc = income > 0;
          const hasRecordedExp = spending > 0;
          const profileInc = ctx.snapshot.profileMonthlyIncome || 0;
          const netCashFlow = ctx.snapshot.netCashFlow !== undefined ? ctx.snapshot.netCashFlow : (income - spending);
          const currentSurplus = netCashFlow;
          const fmt = (val: number) => (isBn ? val.toLocaleString('bn-BD') : val.toLocaleString());

          factsUsed.push(
            'savingsPlan.targetAmount',
            'savingsPlan.monthlyTarget',
            'savingsPlan.weeklyTarget',
            'savingsPlan.requiredMonthly'
          );

          if (!hasRecordedInc && !hasRecordedExp && profileInc === 0) {
            // Insufficient data: no income or expense transactions
            dataGaps.push('No income or expense transactions recorded for the current period');
            if (isBn) {
              answer = `চলতি হিসাবকালে আপনার কোনো আয় বা ব্যয়ের লেনদেন রেকর্ড পাওয়া যায়নি। প্রতি মাসে **৳${fmt(monthlyTarget)}** (সাপ্তাহিক প্রায় **৳${fmt(weeklyTarget)}**) সঞ্চয়ের সুনির্দিষ্ট ও বাস্তবমুখী পরিকল্পনা তৈরির জন্য অনুগ্রহ করে আপনার আয় ও দৈনন্দিন খরচের লেনদেন যুক্ত করুন।`;
            } else {
              answer = `There are no recorded transactions in your ledger for this period. To build an accurate, personalized savings plan for **৳${fmt(monthlyTarget)}/month** (approximately **৳${fmt(weeklyTarget)}/week**), please log your income and expense transactions.`;
            }
          } else if (!hasRecordedInc && profileInc > 0) {
            // Profile income exists but no recorded income transaction
            dataGaps.push('Profile benchmark income present, but no recorded income transactions found');
            factsUsed.push('snapshot.profileMonthlyIncome', 'snapshot.monthlySpending');
            if (isBn) {
              answer = `আপনার প্রোফাইল অনুযায়ী নির্দেশিত মাসিক আয় **৳${fmt(profileInc)}**, তবে চলতি মাসে কোনো আয়ের লেনদেন রেকর্ড করা হয়নি। রেকর্ডকৃত লেনদেন অনুযায়ী বর্তমান ব্যয় **৳${fmt(spending)}**।\n\nপ্রতি মাসে **৳${fmt(monthlyTarget)}** (সাপ্তাহিক প্রায় **৳${fmt(weeklyTarget)}**) সঞ্চয়ের লক্ষ্য বাস্তবায়নের জন্য প্রকৃত আয়ের লেনদেন যুক্ত করুন, যেন আপনার প্রকৃত মাসিক নগদ উদ্বৃত্তের ভিত্তিতে সঠিক পরিকল্পনা করা যায়।`;
            } else {
              answer = `Your profile indicates an expected monthly income of **৳${fmt(profileInc)}**, but no income transactions have been logged for this period. Based on recorded transactions, current spending is **৳${fmt(spending)}**.\n\nTo construct an authentic savings plan for your **৳${fmt(monthlyTarget)}/month** target (approx. **৳${fmt(weeklyTarget)}/week**), please record your actual income transactions.`;
            }
          } else if (!hasRecordedInc && profileInc === 0) {
            // Income transactions absent, no profile income
            dataGaps.push('No income transactions recorded for the current period');
            factsUsed.push('snapshot.monthlySpending');
            if (isBn) {
              answer = `চলতি মাসে আপনার মোট ব্যয় **৳${fmt(spending)}** রেকর্ড করা হয়েছে, তবে কোনো আয়ের লেনদেন পাওয়া যায়নি। প্রতি মাসে **৳${fmt(monthlyTarget)}** (সাপ্তাহিক প্রায় **৳${fmt(weeklyTarget)}**) সঞ্চয়ের পরিকল্পনা মূল্যায়ন করতে অনুগ্রহ করে আপনার আয়ের রেকর্ড যুক্ত করুন।`;
            } else {
              answer = `Your recorded monthly expenses are **৳${fmt(spending)}**, but no income transactions have been recorded for this period. To evaluate feasibility for saving **৳${fmt(monthlyTarget)}/month** (approximately **৳${fmt(weeklyTarget)}/week**), please log your income.`;
            }
          } else if (hasRecordedInc && !hasRecordedExp) {
            // Expense transactions absent
            dataGaps.push('No expense transactions recorded for the current period');
            factsUsed.push('snapshot.monthlyIncome');
            if (isBn) {
              answer = `চলতি মাসে আপনার রেকর্ডকৃত আয় **৳${fmt(income)}**, তবে কোনো ব্যয়ের লেনদেন রেকর্ড করা হয়নি। প্রতি মাসে **৳${fmt(monthlyTarget)}** (সাপ্তাহিক প্রায় **৳${fmt(weeklyTarget)}**) সঞ্চয় বাস্তবায়নের পরিকল্পনা দেখতে অনুগ্রহ করে আপনার খরচের লেনদেনগুলো যুক্ত করুন।`;
            } else {
              answer = `Your recorded monthly income is **৳${fmt(income)}**, but no expense transactions have been recorded for this period. To evaluate your real net surplus for saving **৳${fmt(monthlyTarget)}/month** (approximately **৳${fmt(weeklyTarget)}/week**), please log your daily expenses.`;
            }
          } else {
            // Both income and spending are recorded
            factsUsed.push('snapshot.monthlyIncome', 'snapshot.monthlySpending', 'snapshot.netSavings');

            if (currentSurplus >= monthlyTarget) {
              // State 1: Surplus >= Target (Feasible)
              const surplusMargin = currentSurplus - monthlyTarget;
              factsUsed.push('savingsPlan.surplusDiff', 'savingsPlan.isFeasible');
              if (isBn) {
                answer = `প্রতি মাসে **৳${fmt(monthlyTarget)}** সঞ্চয় করার পরিকল্পনা (সাপ্তাহিক প্রায় **৳${fmt(weeklyTarget)}**):\n\n` +
                  `• **রেকর্ডকৃত আয় ও ব্যয়**: চলতি মাসে আপনার রেকর্ডকৃত মোট আয় **৳${fmt(income)}** এবং মোট ব্যয় **৳${fmt(spending)}**। ফলে আপনার বর্তমান নিট মাসিক নগদ উদ্বৃত্ত **৳${fmt(currentSurplus)}**।\n` +
                  `• **বাস্তবায়নযোগ্যতা**: আপনার ৳${fmt(monthlyTarget)}/মাস সঞ্চয়ের লক্ষ্যটি **সম্পূর্ণ বাস্তবায়নযোগ্য**। আপনার বর্তমান মাসিক উদ্বৃত্ত লক্ষ্যের চেয়ে **৳${fmt(surplusMargin)}** বেশি রয়েছে।\n` +
                  `• **সঞ্চয় বনাম উদ্বৃত্তের পার্থক্য**: ওয়ালেটে অবশিষ্ট নগদ উদ্বৃত্তই স্বয়ংক্রিয়ভাবে সঞ্চয় নয়। নির্দিষ্ট সঞ্চয় তহবিলে স্থানান্তর না করলে এ অর্থ দৈনন্দিন খরচে শেষ হয়ে যাওয়ার ঝুঁকি থাকে।\n` +
                  `• **কার্যকর কর্মপরিকল্পনা**:\n` +
                  `  ১. **আয়ের শুরুতেই সঞ্চয় আলাদা করুন (Pay Yourself First)**: মাস শেষের জন্য অপেক্ষা না করে আয় প্রাপ্তির সাথে সাথে প্রতি মাসে **৳${fmt(monthlyTarget)}** (বা সপ্তাহে **৳${fmt(weeklyTarget)}**) একটি পৃথক সঞ্চয় অ্যাকাউন্টে স্থানান্তর করুন।\n` +
                  `  ২. **বর্তমান ব্যয়ের শৃঙ্খলা বজায় রাখুন**: আপনার চলতি খরচের গতি সুষম রেখে এই ইতিবাচক উদ্বৃত্ত ধরে রাখুন।\n` +
                  `  ৩. **লক্ষ্য ট্র্যাকিং**: এ অর্থ সরাসরি আপনার সঞ্চয় লক্ষ্যে যুক্ত করে নিয়মিত অগ্রগতি পর্যবেক্ষণ করুন।`;
              } else {
                answer = `To save **৳${fmt(monthlyTarget)} per month** (approximately **৳${fmt(weeklyTarget)} per week**):\n\n` +
                  `• **Recorded Inflow & Outflow**: Your recorded monthly income is **৳${fmt(income)}** and total expenses are **৳${fmt(spending)}**, generating a net monthly cash surplus of **৳${fmt(currentSurplus)}**.\n` +
                  `• **Feasibility Assessment**: Your target of ৳${fmt(monthlyTarget)}/month is **fully feasible**. Your current monthly surplus exceeds your target by **৳${fmt(surplusMargin)}**.\n` +
                  `• **Surplus vs. Actual Savings**: Cash surplus remaining in your transaction account is not yet saved money until it is protected. Unallocated funds risk leaking into casual spending before month end.\n` +
                  `• **Actionable Plan**:\n` +
                  `  1. **Pay Yourself First**: Transfer **৳${fmt(monthlyTarget)}** (or **৳${fmt(weeklyTarget)} weekly**) into a separate savings account or DPS right after your income arrives, rather than waiting for month end.\n` +
                  `  2. **Protect Current Margins**: Maintain your current spending habits to preserve this positive cash-flow buffer.\n` +
                  `  3. **Track Toward Goals**: Direct this allocation toward an active savings goal to monitor your milestone progress.`;
              }
            } else if (currentSurplus > 0 && currentSurplus < monthlyTarget) {
              // State 2: 0 < Surplus < Target (Partial Surplus, Shortfall)
              const gap = monthlyTarget - currentSurplus;
              const weeklyGap = Math.round(gap / 4);
              factsUsed.push('savingsPlan.monthlyGap', 'savingsPlan.isFeasible');

              const discCats = ctx.spending.discretionaryCategories || [];
              let discAdviceBn = '';
              let discAdviceEn = '';

              if (discCats.length > 0) {
                const topDisc = discCats.slice(0, 2);
                const catNamesBn = topDisc.map((c) => `**${c.category}** (৳${fmt(c.amount)})`).join(' ও ');
                const catNamesEn = topDisc.map((c) => `**${c.category}** (৳${fmt(c.amount)})`).join(' and ');
                discAdviceBn = `\n• **খরচ কমানোর সম্ভাব্য খাত**: চিকিৎসা বা জরুরি খরচে হাত না দিয়ে আপনার নমনীয় ব্যয়ের খাতগুলো যেমন ${catNamesBn} থেকে অপ্রয়োজনীয় কেনাকাটা ও বাইরের খাওয়া সীমিত করে সপ্তাহে প্রায় **৳${fmt(weeklyGap)}** সাশ্রয় করা সম্ভব।`;
                discAdviceEn = `\n• **Targeted Reduction Areas**: Without touching essential healthcare or living costs, flexible spending in categories such as ${catNamesEn} can be trimmed by approximately **৳${fmt(weeklyGap)}/week** to bridge the gap.`;
              }

              if (isBn) {
                answer = `প্রতি মাসে **৳${fmt(monthlyTarget)}** সঞ্চয় করার পরিকল্পনা (সাপ্তাহিক প্রায় **৳${fmt(weeklyTarget)}**):\n\n` +
                  `• **আয় ও ব্যয়ের চিত্র**: চলতি মাসে আপনার রেকর্ডকৃত আয় **৳${fmt(income)}** এবং মোট ব্যয় **৳${fmt(spending)}**। আপনার বর্তমান নিট মাসিক উদ্বৃত্ত **৳${fmt(currentSurplus)}**।\n` +
                  `• **ঘাটতি বিশ্লেষণ**: আপনার ৳${fmt(monthlyTarget)} মাসিক লক্ষ্য পূরণে প্রতি মাসে এখনো **৳${fmt(gap)}** (সাপ্তাহিক প্রায় **৳${fmt(weeklyGap)}**) ঘাটতি রয়েছে।\n` +
                  `• **বাস্তবায়নযোগ্যতা**: নমনীয় ব্যয়ের ক্ষেত্রে সামান্য সাশ্রয়ী হয়ে এই লক্ষ্য পূরণ করা **সম্ভব**।${discAdviceBn}\n` +
                  `• **কার্যকর কর্মপরিকল্পনা**:\n` +
                  `  ১. আয়ের শুরুতেই বর্তমান উদ্বৃত্তের **৳${fmt(currentSurplus)}** সঞ্চয়ে সরিয়ে রাখুন।\n` +
                  `  ২. অপ্রয়োজনীয় ও ঐচ্ছিক খরচ থেকে প্রতি সপ্তাহে প্রায় **৳${fmt(weeklyGap)}** সাশ্রয় করে মাসিক ঘাটতি পূরণ করুন।\n` +
                  `  ৩. প্রতি সপ্তাহে ব্যয়ের হিসাব মিলিয়ে লক্ষ্য অর্জনের পথে থাকুন।`;
              } else {
                answer = `To save **৳${fmt(monthlyTarget)} per month** (approximately **৳${fmt(weeklyTarget)} per week**):\n\n` +
                  `• **Recorded Inflow & Outflow**: Your recorded monthly income is **৳${fmt(income)}** and total expenses are **৳${fmt(spending)}**, resulting in a current net surplus of **৳${fmt(currentSurplus)}**.\n` +
                  `• **Target Gap**: Your current surplus is **৳${fmt(gap)}** short of your ৳${fmt(monthlyTarget)} monthly target (a weekly gap of approximately **৳${fmt(weeklyGap)}**).\n` +
                  `• **Feasibility Assessment**: Achievable with moderate adjustments to flexible spending.${discAdviceEn}\n` +
                  `• **Actionable Plan**:\n` +
                  `  1. Allocate your existing **৳${fmt(currentSurplus)}** surplus into savings on payday.\n` +
                  `  2. Reduce discretionary purchases by approximately **৳${fmt(weeklyGap)} per week** to cover the gap.\n` +
                  `  3. Track spending weekly to ensure flexible leaks do not exceed your planned budget.`;
              }
            } else {
              // State 3: Surplus <= 0 (Deficit or break-even, expenses >= income)
              const deficit = Math.abs(currentSurplus);
              const totalAdjustment = deficit + monthlyTarget;
              factsUsed.push('savingsPlan.isFeasible');

              if (isBn) {
                answer = `প্রতি মাসে **৳${fmt(monthlyTarget)}** সঞ্চয় করার পরিকল্পনা (সাপ্তাহিক প্রায় **৳${fmt(weeklyTarget)}**):\n\n` +
                  `• **আয় ও ব্যয়ের চিত্র**: চলতি মাসে আপনার রেকর্ডকৃত আয় **৳${fmt(income)}** এবং মোট ব্যয় **৳${fmt(spending)}**। ফলে বর্তমানে কোনো উদ্বৃত্ত নেই${deficit > 0 ? ` এবং **৳${fmt(deficit)}** মাসিক ঘাটতি রয়েছে` : ''}।\n` +
                  `• **বাস্তবায়নযোগ্যতা**: বর্তমান আর্থিক উপাত্ত অনুযায়ী প্রতি মাসে ৳${fmt(monthlyTarget)} সঞ্চয় করা **এই মুহূর্তে বাস্তবায়নযোগ্য নয়**, কারণ আপনার ব্যয় আয়ের সমান বা তার চেয়ে বেশি হচ্ছে।\n` +
                  `• **প্রয়োজনীয় আর্থিক উন্নতি**: এ লক্ষ্য অর্জন করতে আপনার বাজেটে মোট **৳${fmt(totalAdjustment)}** এর সাশ্রয় বা আয় বৃদ্ধি প্রয়োজন (${deficit > 0 ? `ঘাটতি মেটাতে ৳${fmt(deficit)} + ` : ''}সঞ্চয়ের জন্য ৳${fmt(monthlyTarget)})।\n` +
                  `• **কার্যকর কর্মপরিকল্পনা**:\n` +
                  `  ১. **প্রথমে ঘাটতি দূর করুন**: নতুন সঞ্চয় প্রতিশ্রুতির আগে অপ্রয়োজনীয় ও নমনীয় খরচ কমিয়ে আয়-ব্যয়কে সমতায় আনুন।\n` +
                  `  ২. **নমনীয় খরচ চিহ্নিত করুন**: বাইরে খাওয়া, ডেলিভারি ও সাবস্ক্রিপশন ফি পর্যালোচনা করুন।\n` +
                  `  ৩. **ধাপে ধাপে অগ্রসর হোন**: বাজেট উদ্বৃত্তে এলে একটি ছোট প্রারম্ভিক লক্ষ্য দিয়ে সঞ্চয় শুরু করুন।`;
              } else {
                answer = `To save **৳${fmt(monthlyTarget)} per month** (approximately **৳${fmt(weeklyTarget)} per week**):\n\n` +
                  `• **Recorded Inflow & Outflow**: Your recorded monthly income is **৳${fmt(income)}** and total expenses are **৳${fmt(spending)}**, leaving no net surplus${deficit > 0 ? ` (net monthly deficit of **৳${fmt(deficit)}**)` : ''}.\n` +
                  `• **Feasibility Assessment**: Based on your current financial records, saving ৳${fmt(monthlyTarget)}/month is **not currently feasible** because expenditures exceed or equal inflows.\n` +
                  `• **Required Budget Restructuring**: Reaching this target requires a total monthly cash-flow recovery of **৳${fmt(totalAdjustment)}** (${deficit > 0 ? `৳${deficit.toLocaleString()} to close the deficit + ` : ''}৳${monthlyTarget.toLocaleString()} for savings).\n` +
                  `• **Actionable Plan**:\n` +
                  `  1. **Stop the Deficit First**: Before committing to new savings, bring spending below income by cutting non-essential flexible costs.\n` +
                  `  2. **Audit Discretionary Outflows**: Review takeout, entertainment, and avoidable service fees.\n` +
                  `  3. **Build Sequentially**: Once your cash flow breaks even, establish an initial emergency buffer before scaling to ৳${monthlyTarget.toLocaleString()}/month.`;
              }
            }
          }
        }
      } else {
        factsUsed.push('snapshot.netSavings', 'snapshot.savingsRate');
        const discCats = ctx.spending.discretionaryCategories || [];
        const targetTrimCat =
          discCats.length > 0
            ? discCats[0].category
            : topCat && !topCat.category.toLowerCase().includes('health')
            ? topCat.category
            : 'flexible spending';

        if (isBn) {
          answer = `আপনার বর্তমান মাসিক সঞ্চয় ৳${netSavings.toLocaleString()} (সঞ্চয়ের হার: ${savingsRate}%)। সঞ্চয় বাড়ানোর বাস্তবসম্মত পদক্ষেপ:\n১. **আয়ের শুরুতেই সঞ্চয় আলাদা করুন (Pay Yourself First)**: বেতন বা আয় পাওয়ার সাথে সাথে উদ্বৃত্ত অর্থ একটি পৃথক সেভিংস অ্যাকাউন্ট বা ডিপিএসে স্থানান্তর করুন।\n২. নমনীয় খরচের খাত **${targetTrimCat}** এর খরচ নিয়ন্ত্রণে রাখা।\n৩. অপ্রয়োজনীয় ক্যাশ-আউট চার্জ এড়িয়ে চলা।`;
        } else {
          answer = `Your current monthly savings is ৳${netSavings.toLocaleString()} (savings rate: ${savingsRate}%). Practical steps to save more:\n1. **Pay Yourself First**: Transfer your surplus directly into a separate savings account or DPS on payday rather than waiting for month end.\n2. Moderate outflows in your flexible category **${targetTrimCat}**.\n3. Eliminate avoidable cash-out tariffs and subscription leaks.`;
        }
      }
      followUps.push(
        isBn ? 'আমার বাজেট কি নিরাপদ?' : 'Is my monthly budget balanced?',
        isBn ? 'মাস শেষ ব্যালেন্স কত হবে?' : 'What will my balance be at month end?'
      );
      break;
    }

    case 'unusual_spending': {
      factsUsed.push('spending.anomaliesCount');
      if (ctx.spending.anomalies.length > 0) {
        const a1 = ctx.spending.anomalies[0];
        factsUsed.push('spending.topCategory');
        if (isBn) {
          answer = `আপনার লেজারে **${ctx.spending.anomaliesCount}টি** অস্বাভাবিক লেনদেন পাওয়া গেছে। এর মধ্যে উল্লেখযোগ্য হলো **${a1.category}** খাতে ৳${a1.amount.toLocaleString()} এর লেনদেন। বড় আকারের একক খরচ এবং অতিরিক্ত ট্রানজেকশন ফি এড়িয়ে চললে মাসিক বাজেটের ভারসাম্য ঠিক থাকবে।`;
        } else {
          answer = `ArthoBachao AI detected **${ctx.spending.anomaliesCount} unusual spending pattern(s)** in your ledger. Notably in **${a1.category}** (৳${a1.amount.toLocaleString()}). Keeping tabs on unscheduled surges and fee leaks prevents sudden month-end cash flow pressure.`;
        }
      } else {
        if (topCat) {
          factsUsed.push('spending.topCategory', 'spending.topCategoryAmount');
        }
        if (isBn) {
          answer = `চলতি মাসে কোনো অস্বাভাবিক ব্যয়ের প্যাটার্ন বা অপ্রত্যাশিত সার্জ পাওয়া যায়নি। আপনার খরচের গতি স্বাভাবিক ও সুষম রয়েছে${topCat ? `। তবে আপনার প্রধান নিয়মিত ব্যয়ের খাত হলো **${topCat.category}** (৳${topCat.amount.toLocaleString()})` : ''}।`;
        } else {
          answer = `No unusual spending spikes or anomalous transactions detected in your current ledger. Your outflow pace is well-controlled.${topCat ? ` However, your largest ongoing expense category is **${topCat.category}** (৳${topCat.amount.toLocaleString()}), which warrants regular monitoring.` : ''}`;
        }
      }
      followUps.push(
        isBn ? 'আমার শীর্ষ খরচের খাত কি?' : 'What is my top spending category?',
        isBn ? 'ক্যাশআউট চার্জ কীভাবে কমাব?' : 'How do I reduce withdrawal fees?'
      );
      break;
    }

    case 'reduce_cash_outs': {
      factsUsed.push('cashOut.totalAmount', 'cashOut.count', 'cashOut.feeCost', 'cashOut.feeRate');
      if (isBn) {
        answer = `এ মাসে আপনার ক্যাশ আউট ও এমএফএস লেনদেনের সংখ্যা **${ctx.cashOut.count}টি** (মোট ৳${cashOutTotal.toLocaleString()}), যেখানে আনুমানিক **৳${feeCost.toLocaleString()}** ১.৮৫% এমএফএস এজেন্ট চার্জ ও ফি ব্যয় হয়েছে।\n\nক্যাশ আউট ফি কমানোর পরামর্শ:\n১. ঘন ঘন ছোট অঙ্কের ক্যাশ আউট না করে মাসে এক বা দুইবারে প্রয়োজনমতো টাকা উত্তোলন করুন।\n২. সিটি ব্যাংক এটিএম কার্ড ব্যবহার করে বিনামূল্যে ফি ছাড়া টাকা তুলুন।\n৩. সরাসরি মার্চেন্ট পেমেন্টে কিউআর কোড বা ডিজিটাল পে ব্যবহার করে ক্যাশ আউট ফি সম্পূর্ণ এড়ান।`;
      } else {
        answer = `You logged **${ctx.cashOut.count} cash-out transaction(s)** totaling ৳${cashOutTotal.toLocaleString()}, incurring approximately **৳${feeCost.toLocaleString()}** in avoidable 1.85% MFS agent tariffs and fees.\n\nOptimization steps:\n1. Consolidate frequent micro-withdrawals into 1–2 planned cash-outs.\n2. Use City Bank / debit card ATMs to withdraw funds fee-free.\n3. Make direct digital merchant payments via bKash QR or POS to avoid cash-out fees completely.`;
      }
      followUps.push(
        isBn ? 'আমার মোট খরচ কত?' : 'What is my total spending this month?',
        isBn ? 'আমার হেলথ স্কোর কত?' : 'What is my financial health score?'
      );
      break;
    }

    case 'financial_health': {
      factsUsed.push(
        'snapshot.monthlyIncome',
        'snapshot.monthlySpending',
        'snapshot.netSavings',
        'health.score',
        'health.band',
        'health.savingConsistency',
        'health.spendingControl',
        'health.cashFlowStability',
        'health.goalProgress'
      );
      if (ctx.health.confidence) factsUsed.push('health.confidence');
      const isDeficit = netSavings < 0 || spending > income;
      const deficitAmt = Math.abs(income - spending);
      const totalTx = ctx.metadata?.dataWindow?.totalTransactions ?? ctx.recentTransactions?.length ?? 0;
      const isConfidenceLow = (ctx.health.confidence ? ctx.health.confidence.toLowerCase() === 'low' : false) || totalTx <= 3;
      const isInsufficient = healthScore === null || healthBand === 'Insufficient Data' || healthBand === 'insufficient_data' || !ctx.health.available;

      if (isInsufficient) {
        if (isBn) {
          answer = `চলতি মাসে আপনার রেকর্ডকৃত মোট আয় **৳${income.toLocaleString()}** এবং মোট ব্যয় **৳${spending.toLocaleString()}** (নিট উদ্বৃত্ত: **৳${netSavings.toLocaleString()}**)।\n\nআপনার সামগ্রিক আর্থিক স্বাস্থ্য স্কোর (Financial Health Score) নির্ণয়ের জন্য **পর্যাপ্ত লেনদেনের তথ্য নেই (Insufficient Data)**।\n\nনির্ভরযোগ্য হেলথ স্কোর পেতে:\n১. প্রতিদিনের নিয়মিত খরচ (বাজার, বাসা ভাড়া, ইউটিলিটি ইত্যাদি) লেজারে যুক্ত করুন।\n২. অন্তত ১টি সক্রিয় সঞ্চয় লক্ষ্য (যেমন জরুরি তহবিল) তৈরি করুন।\n৩. নিয়মিত লেনদেনের ইতিহাস তৈরি হলে এআই স্বয়ংক্রিয়ভাবে আপনার সামগ্রিক হেলথ স্কোর ও ৪টি পিলার মূল্যায়ন করবে।`;
        } else {
          answer = `Based on your recorded monthly income of **৳${income.toLocaleString()}** and total expenses of **৳${spending.toLocaleString()}** (net savings: **৳${netSavings.toLocaleString()}**), there is **insufficient transaction data** to calculate a reliable Financial Health Score.\n\nTo unlock a reliable score:\n1. Log your routine living expenses (housing, groceries, utilities, transit) regularly.\n2. Create at least one active savings goal (such as an Emergency Fund).\n3. Once regular transaction history is established, ArthoBachao AI will automatically calculate your composite score across all 4 diagnostic pillars.`;
        }
        followUps.push(
          isBn ? 'কীভাবে খরচ যোগ করব?' : 'How do I add transactions?',
          isBn ? 'সঞ্চয় লক্ষ্য কীভাবে তৈরি করব?' : 'How do I create a savings goal?'
        );
        break;
      }

      const savingConsistencyStr =
        ctx.health.savingConsistency !== null
          ? (isConfidenceLow ? (isBn ? `প্রাথমিক (${ctx.health.savingConsistency}%)` : `Preliminary (${ctx.health.savingConsistency}%)`) : `${ctx.health.savingConsistency}%`)
          : (isBn ? 'পর্যাপ্ত তথ্য নেই' : 'Insufficient Data');
      const spendingControlStr =
        ctx.health.spendingControl !== null
          ? (isConfidenceLow ? (isBn ? `প্রাথমিক (${ctx.health.spendingControl}% — সীমিত রেকর্ডের ভিত্তিতে)` : `Preliminary (${ctx.health.spendingControl}% — based on limited records)`) : `${ctx.health.spendingControl}%`)
          : (isBn ? 'পর্যাপ্ত তথ্য নেই' : 'Insufficient Data');
      const cashFlowStabilityStr =
        ctx.health.cashFlowStability !== null
          ? (isConfidenceLow ? (isBn ? `প্রাথমিক (${ctx.health.cashFlowStability}% — একক মাসের উদ্বৃত্ত)` : `Preliminary (${ctx.health.cashFlowStability}% — single month surplus)`) : `${ctx.health.cashFlowStability}%`)
          : (isBn ? 'পর্যাপ্ত তথ্য নেই' : 'Insufficient Data');
      const goalProgressStr =
        ctx.health.goalProgress !== null
          ? `${ctx.health.goalProgress}%`
          : (isBn ? 'কোনো সক্রিয় সঞ্চয় লক্ষ্য নেই' : 'No Active Goals');

      if (isBn) {
        const riskNote = isDeficit
          ? `\n\n• **প্রধান দুর্বলতা ও ঝুঁকি**: আপনার মাসিক ব্যয় আয়ের চেয়ে বেশি হওয়ায় **৳${deficitAmt.toLocaleString()}** এর বাজেট ঘাটতি রয়েছে, যা আর্থিক স্থিতিশীলতার জন্য প্রধান ঝুঁকি।`
          : '';
        const scoreBlock = isConfidenceLow
          ? `আপনার অর্থবাঁচাও এআই আর্থিক স্বাস্থ্য ও হেলথ স্কোর (Health Score) **${healthScore} / ১০০** (অবস্থা: **${healthBand}** — সীমিত তথ্যের কারণে প্রাথমিক)।\n\n*প্রাথমিক স্কোরের কারণ*: লেজারে সীমিত সংখ্যক লেনদেন (${totalTx}টি) থাকায় এটি একটি প্রাথমিক মূল্যায়ন। সকল নিয়মিত খরচ অন্তর্ভুক্ত হলে এটি আরও নির্ভুল হবে।`
          : `আপনার অর্থবাঁচাও এআই আর্থিক স্বাস্থ্য ও হেলথ স্কোর (Health Score) **${healthScore} / ১০০** (অবস্থা: **${healthBand}**)।`;

        answer = `চলতি মাসে আপনার রেকর্ডকৃত মোট আয় **৳${income.toLocaleString()}** এবং মোট ব্যয় **৳${spending.toLocaleString()}** (নিট উদ্বৃত্ত: **৳${netSavings.toLocaleString()}**)।\n\n${scoreBlock}${riskNote}\n\nপিলার বিশ্লেষণ:\n• সঞ্চয়ের ধারাবাহিকতা: ${savingConsistencyStr}\n• ব্যয় নিয়ন্ত্রণ: ${spendingControlStr}\n• ক্যাশ-ফ্লো স্থায়িত্ব: ${cashFlowStabilityStr}\n• সঞ্চয় লক্ষ্যের অগ্রগতি: ${goalProgressStr}`;
      } else {
        const riskNote = isDeficit
          ? `\n\n• **Core Stability Risk**: Outflows exceed inflows by **৳${deficitAmt.toLocaleString()}**, creating a monthly cash deficit that represents the primary liquidity risk to your financial profile.`
          : '';
        const scoreBlock = isConfidenceLow
          ? `your ArthoBachao AI Financial Health Score is **${healthScore} / 100** (Rating: **${healthBand}** — Preliminary due to limited history).\n\n*Note on Preliminary Status*: Because your ledger contains limited transaction history (${totalTx} transaction(s)), this score is an initial baseline. Recurring living costs or pending bills may not yet be reflected.`
          : `your ArthoBachao AI Financial Health Score is **${healthScore} / 100** (Rating: **${healthBand}**).`;

        answer = `Based on your recorded monthly income of **৳${income.toLocaleString()}** and total expenses of **৳${spending.toLocaleString()}** (net savings: **৳${netSavings.toLocaleString()}**), ${scoreBlock}${riskNote}\n\nDiagnostic Pillars:\n• Saving Consistency: ${savingConsistencyStr}\n• Spending Control: ${spendingControlStr}\n• Cash Flow Stability: ${cashFlowStabilityStr}\n• Goal Progress: ${goalProgressStr}`;
      }
      followUps.push(
        isBn ? 'স্কোর আরও বাড়ানোর উপায় কি?' : 'How can I improve my health score?',
        isBn ? 'আমার সঞ্চয় লক্ষ্য কেমন চলছে?' : 'How are my savings goals progressing?'
      );
      break;
    }

    case 'health_recommendations': {
      factsUsed.push('snapshot.monthlyIncome', 'snapshot.monthlySpending', 'snapshot.netCashFlow');
      if (healthScore !== null) {
        factsUsed.push('health.score', 'health.band');
        if (ctx.health.confidence) factsUsed.push('health.confidence');
      }
      if (topCat) factsUsed.push('spending.topCategory', 'spending.topCategoryAmount');

      const discCats = ctx.spending.discretionaryCategories || [];
      const hasDiscretionary = discCats.length > 0;
      const targetTrimAmt = currentSurplus > 0 ? currentSurplus : 0;
      const totalTx = ctx.metadata?.dataWindow?.totalTransactions ?? ctx.recentTransactions?.length ?? 0;
      const catCount = (ctx.spending.topCategories || []).length;
      const isDataSparse = totalTx <= 3 || catCount <= 1;
      const isConfidenceLow = (ctx.health.confidence ? ctx.health.confidence.toLowerCase() === 'low' : false) || totalTx <= 3;

      const hasMedicalExpenses = (ctx.spending.topCategories || []).some(
        (c) =>
          c.category.toLowerCase().includes('health') ||
          c.category.toLowerCase().includes('heath') ||
          c.category.toLowerCase().includes('medic')
      );

      let extraBlockBn = '';
      let extraBlockEn = '';

      if (norm.includes('habit') || norm.includes('30 days') || norm.includes('অভ্যাস') || norm.includes('৩০ দিন')) {
        extraBlockBn = `\n\n• **আগামী ৩০ দিনে আর্থিক অভ্যাস**: আগামী ৩০ দিনে আর্থিক স্বাস্থ্য উন্নত করতে প্রতিদিনের ব্যয়ের তথ্য তাৎক্ষণিক রেকর্ড করা এবং মাস শেষে নয় বরং আয়ের শুরুতেই সঞ্চয় আলাদা করার অভ্যাস গড়ে তুলুন।`;
        extraBlockEn = `\n\n• **Financial Habits for the Next 30 Days**: Over the next 30 days, build disciplined habits of logging daily transactions immediately and automating savings transfers on payday rather than relying on month-end remainders.`;
      } else if (norm.includes('checklist') || norm.includes('চেকলিস্ট') || norm.includes('পক্ষকাল')) {
        extraBlockBn = `\n\n• **মাস ও পক্ষকালের আর্থিক পর্যালোচনা চেকলিস্ট**:\n  ১. আয় ও ব্যয়ের লেজার হিসাব মিলিয়ে ক্যাশ-ফ্লো ঘাটতি রয়েছে কিনা যাচাই করুন।\n  ২. নমনীয় বা ঐচ্ছিক খরচের খাতগুলো পর্যালোচনা করুন।\n  ৩. জরুরি তহবিলের বর্তমান ব্যালেন্স ও লক্ষ্য অগ্রগতি পর্যবেক্ষণ করুন।`;
        extraBlockEn = `\n\n• **Mid-Month and Month-End Financial Review Checklist**:\n  1. Reconcile recorded outflows against inflows to check for cash-flow deficits.\n  2. Audit flexible discretionary spending to prevent category budget creep.\n  3. Verify automated deposits into your liquid emergency reserve.`;
      } else if (norm.includes('purchase') || norm.includes('সিদ্ধান্ত') || norm.includes('যাচাই')) {
        extraBlockBn = `\n\n• **বড় কোনো খরচের সিদ্ধান্ত নেওয়ার আগে যাচাই**:\n  ১. জরুরি তহবিল বা আবশ্যকীয় খরচে হাত না দিয়ে ব্যালেন্স এই কেনাকাটা বহন করতে পারবে কি না যাচাই করুন।\n  ২. এটি স্থায়ী সঞ্চয় লক্ষ্যের সময়সীমাকে বিলম্বিত করবে কি না হিসাব করুন।`;
        extraBlockEn = `\n\n• **Major Financial Purchase Readiness**:\n  1. Confirm that your emergency buffer remains intact without dipping into essential reserves.\n  2. Verify that funding the purchase will not disrupt recurring savings goal contributions.`;
      } else if (norm.includes('data') || norm.includes('তথ্য') || norm.includes('উপাত্ত') || norm.includes('লেনদেন')) {
        extraBlockBn = `\n\n• **আর্থিক তথ্য ও লেনদেন সংযুক্তি**: আরও নিখুঁত ও নির্ভরযোগ্য আর্থিক পরামর্শ পেতে নিয়মিত সকল দৈনন্দিন খরচ ও আয়ের তথ্য এবং সক্রিয় সঞ্চয় লক্ষ্য অ্যাপে যুক্ত করুন।`;
        extraBlockEn = `\n\n• **Financial Data to Add for Better Advice**: To receive optimal, data-backed guidance, ensure all income streams, recurring bills, and daily transactions and expenses are logged systematically in your ledger.`;
      }

      if (isBn) {
        const isInsufficient = healthScore === null || healthBand === 'Insufficient Data' || healthBand === 'insufficient_data' || !ctx.health.available;
        const scoreHeader = isInsufficient
          ? ` (হেলথ স্কোর: **তথ্য অপর্যাপ্ত** — নির্ভরযোগ্য স্কোর হিসাব করার জন্য পর্যাপ্ত লেনদেনের তথ্য নেই)`
          : isConfidenceLow
            ? ` (প্রাথমিক হেলথ স্কোর: **${healthScore}/১০০**, রেটিং: **${healthBand}** — সীমিত তথ্যের কারণে প্রাথমিক)`
            : ` (হেলথ স্কোর: **${healthScore}/১০০**, রেটিং: **${healthBand}**)`;

        let action1Bn = '';
        if (hasMedicalExpenses) {
          action1Bn =
            `১. **পৃথক জরুরি চিকিৎসা তহবিল (Medical Emergency Reserve) গঠন করুন**:\n` +
            `   • **পদক্ষেপ**: শুধুমাত্র স্বাস্থ্য ও চিকিৎসা সংক্রান্ত জরুরি প্রয়োজনে ব্যবহারের জন্য একটি নির্দিষ্ট নিরাপদ সেভিংস অ্যাকাউন্টে জরুরি তহবিল আলাদা রাখুন।\n` +
            `   • **আর্থিক কারণ**: চলতি মাসে আপনার ${topCat ? `**${topCat.category}** খাতে ৳${fmt(topCat.amount)}` : 'বড় অঙ্কের চিকিৎসা'} ব্যয় হয়েছে। পৃথক জরুরি তহবিল থাকলে ভবিষ্যতে হঠাৎ বড় কোনো স্বাস্থ্য সংক্রান্ত ব্যয়ে নিয়মিত মাসিক বাজেট ও নগদ প্রবাহ বিঘ্নিত হবে না।\n\n`;
        } else {
          action1Bn =
            `১. **লিকুইড জরুরি জীবনযাত্রার তহবিল (Emergency Living Cushion) গঠন করুন**:\n` +
            `   • **পদক্ষেপ**: অপ্রত্যাশিত কোনো সংকট সামাল দিতে একটি পৃথক নিরাপদ সেভিংস অ্যাকাউন্টে সহজে উত্তোলনযোগ্য জরুরি ফান্ড গড়ে তুলুন।\n` +
            `   • **আর্থিক কারণ**: আপনার লেজারে সর্বোচ্চ ব্যয় রেকর্ড হয়েছে ${topCat ? `**${topCat.category}** খাতে (৳${fmt(topCat.amount)})` : 'আবশ্যকীয় খাতে'}। একটি নির্ভরযোগ্য ক্যাশ বাফার থাকলে জরুরি প্রয়োজনে ঋণ না নিয়ে বা স্বাভাবিক জীবনযাত্রা বিঘ্নিত না করে পরিস্থিতি সামাল দেওয়া যায়।\n\n`;
        }

        let action2Bn = '';
        if (isDataSparse) {
          const prudentRate = Math.round(income * 0.15);
          action2Bn =
            `২. **যৌক্তিক হারে আয়ের শুরুতেই সঞ্চয় আলাদা করুন (Pay Yourself First)**:\n` +
            `   • **পদক্ষেপ**: সম্পূর্ণ উদ্বৃত্ত একবারে লক না করে প্রতি মাসে আয় (${fmt(income)} টাকা) পাওয়ার সাথে সাথে একটি যৌক্তিক অংশ (যেমন ১০%–২০% বা প্রায় ৳${fmt(prudentRate)}) একটি পৃথক সেভিংস অ্যাকাউন্ট বা ডিপিএসে সরিয়ে রাখুন।\n` +
            `   • **আর্থিক কারণ**: আপনার হিসাবকৃত অবণ্টিত উদ্বৃত্ত **৳${fmt(currentSurplus)}** (আয় ৳${fmt(income)} মাইনাস ব্যয় ৳${fmt(spending)})। তবে লেজারে মাত্র ${totalTx}টি লেনদেন থাকায় এটি নিশ্চিত ডিসপোজেবল উদ্বৃত্ত নয়; অনেক দৈনন্দিন খরচ এখনও রেকর্ড না হয়ে থাকতে পারে। সম্পূর্ণ উদ্বৃত্ত সঞ্চয়ে স্থানান্তর করলে পরবর্তীতে নিয়মিত খরচ মেটাতে তারল্য সংকট হতে পারে।\n\n`;
        } else {
          action2Bn =
            `২. **আয়ের শুরুতেই সঞ্চয় আলাদা করুন (Pay Yourself First)**:\n` +
            `   • **পদক্ষেপ**: মাস শেষের জন্য অপেক্ষা না করে প্রতি মাসে আয় (${fmt(income)} টাকা) পাওয়ার সাথে সাথে উদ্বৃত্তের একটি নির্দিষ্ট অংশ${targetTrimAmt > 0 ? ` (যেমন ৳${fmt(targetTrimAmt)})` : ''} একটি পৃথক সেভিংস অ্যাকাউন্ট বা ডিপিএসে স্থানান্তর করুন।\n` +
            `   • **আর্থিক কারণ**: বর্তমানে আপনার নিট উদ্বৃত্ত **৳${fmt(currentSurplus)}**। কিন্তু দৈনন্দিন ওয়ালেটে অলস পড়ে থাকা উদ্বৃত্ত স্বয়ংক্রিয়ভাবে সঞ্চিত নয় এবং তা দৈনন্দিন খরচে নিঃশেষ হয়ে যাওয়ার ঝুঁকি থাকে।\n\n`;
        }

        let action3Bn = '';
        if (isDataSparse) {
          action3Bn =
            `৩. **জীবনযাত্রার প্রকৃত ব্যয়ের কাঠামো (Living Expense Baseline) নিশ্চিত করুন**:\n` +
            `   • **পদক্ষেপ**: আপনার খরচের প্রকৃত রূপ বুঝতে বাসা ভাড়া, বাজার, ইউটিলিটি ও যাতায়াতের মতো নিয়মিত সকল মাসিক খরচ লেজারে অন্তর্ভুক্ত করুন${hasDiscretionary ? ` এবং নমনীয় ব্যয়ের খাত যেমন ${discCats.map((c) => `**${c.category}** (৳${fmt(c.amount)})`).join(' ও ')} পর্যবেক্ষণ করুন` : ' এবং দৈনন্দিন খুচরা খরচগুলো নিয়মিত ট্র্যাক করুন'}।\n` +
            `   • **আর্থিক কারণ**: বর্তমানে আপনার লেজারে ${topCat ? `শুধুমাত্র **${topCat.category}** খাতে` : ''} মাত্র ${totalTx}টি লেনদেনে মোট **৳${fmt(spending)}** ব্যয় রেকর্ড রয়েছে, যা সম্পূর্ণ জীবনযাত্রার ব্যয় নয়। সকল নিয়মিত খরচ অন্তর্ভুক্ত করলে আপনার বাজেট পরিকল্পনা এবং হেলথ স্কোর আরও নির্ভরযোগ্য হবে।${extraBlockBn}`;
        } else if (hasMedicalExpenses) {
          action3Bn =
            `৩. **স্থায়ী খরচের ভিত্তি নির্ধারণ ও নমনীয় ব্যয় পর্যবেক্ষণ করুন**:\n` +
            `   • **পদক্ষেপ**: আপনার চলতি ব্যয়ের বড় অংশ এককালীন চিকিৎসা খরচ ছিল কিনা তা পর্যালোচনা করুন${hasDiscretionary ? ` এবং নমনীয় ব্যয়ের খাত যেমন ${discCats.map((c) => `**${c.category}** (৳${fmt(c.amount)})`).join(' ও ')} নিয়ন্ত্রণ করুন` : ' এবং ভবিষ্যতে কোনো ঐচ্ছিক বা নমনীয় খরচ হলে তা নিয়মিত ট্র্যাক করুন'}।\n` +
            `   • **আর্থিক কারণ**: আপনার বর্তমান **৳${fmt(spending)}** ব্যয়ের পুরোটাই অত্যাবশ্যকীয় চিকিৎসা ও নিয়মিত দায়বদ্ধতায় রয়েছে (অত্যাবশ্যকীয় চিকিৎসায় কোনো কাটছাঁট কাম্য নয়)। সঠিক খরচের কাঠামো জানা থাকলে চিকিৎসা পরবর্তী স্বাভাবিক সময়ে সঞ্চয় বৃদ্ধি সহজ হবে।${extraBlockBn}`;
        } else {
          action3Bn =
            `৩. **নমনীয় খরচ পর্যবেক্ষণ ও নিয়মিত ব্যয়ের ভারসাম্য রক্ষা করুন**:\n` +
            `   • **পদক্ষেপ**: স্থায়ী দায়বদ্ধতার পাশাপাশি ঐচ্ছিক খরচগুলো পর্যালোচনা করুন${hasDiscretionary ? ` এবং নমনীয় ব্যয়ের খাত যেমন ${discCats.map((c) => `**${c.category}** (৳${fmt(c.amount)})`).join(' ও ')} নিয়ন্ত্রণ করুন` : ' এবং দৈনন্দিন খরচের ওপর নজর রাখুন'}।\n` +
            `   • **আর্থিক কারণ**: আপনার বর্তমান রেকর্ডকৃত মোট ব্যয় **৳${fmt(spending)}**। নমনীয় খরচের স্বচ্ছতা বজায় রাখলে নিয়মিত ইতিবাচক ক্যাশ-ফ্লো ও দীর্ঘমেয়াদী সঞ্চয় সুরক্ষিত থাকে।${extraBlockBn}`;
        }

        answer = `আপনার আর্থিক তথ্য${scoreHeader} বিশ্লেষণ করে আর্থিক সক্ষমতা ও স্বাস্থ্য উন্নত করার ৩টি অগ্রাধিকারভিত্তিক কার্যকর পদক্ষেপ:\n\n` +
          action1Bn +
          action2Bn +
          action3Bn;
      } else {
        const isInsufficient = healthScore === null || healthBand === 'Insufficient Data' || healthBand === 'insufficient_data' || !ctx.health.available;
        const scoreHeader = isInsufficient
          ? ` (Financial Health Score: **Pending Data** — insufficient transactions to calculate a reliable score)`
          : isConfidenceLow
            ? ` (Financial Health Score: **${healthScore}/100**, Rating: **${healthBand}** — Preliminary due to limited history)`
            : ` (Financial Health Score: **${healthScore}/100**, Rating: **${healthBand}**)`;

        let action1En = '';
        if (hasMedicalExpenses) {
          action1En =
            `1. **Build a Dedicated Emergency Healthcare Reserve**:\n` +
            `   • **Action**: Establish a liquid emergency fund in a separate bank savings account earmarked exclusively for unplanned medical costs.\n` +
            `   • **Financial Rationale**: Your ledger reflects substantial healthcare outflows in ${topCat ? `**${topCat.category}** (৳${fmt(topCat.amount)})` : 'medical care'}. A dedicated reserve buffers against future medical emergencies so essential healthcare needs never disrupt routine monthly cash flow.\n\n`;
        } else {
          action1En =
            `1. **Build a Liquid Emergency Living Cushion**:\n` +
            `   • **Action**: Establish a liquid emergency buffer in an accessible savings account to cover unexpected expenses.\n` +
            `   • **Financial Rationale**: Your largest recorded outflow is in ${topCat ? `**${topCat.category}** (৳${fmt(topCat.amount)})` : 'essential spending'}. Maintaining a liquid cash cushion ensures that unexpected needs never force you to borrow or disrupt your essential living obligations.\n\n`;
        }

        let action2En = '';
        if (isDataSparse) {
          const prudentRate = Math.round(income * 0.15);
          action2En =
            `2. **Allocate a Prudent Baseline Savings Rate (Pay Yourself First)**:\n` +
            `   • **Action**: Rather than committing the full arithmetic remainder, set aside a disciplined baseline (such as 10%–20% of income, ~৳${fmt(prudentRate)}/month) into a separate bank savings account or DPS upon receiving income.\n` +
            `   • **Financial Rationale**: You generate an arithmetic cash surplus of **৳${fmt(currentSurplus)}** (income ৳${fmt(income)} minus recorded spending ৳${fmt(spending)}). With only ${totalTx} transaction(s) logged, this unallocated remainder represents pending/unrecorded living expenses rather than confirmed disposable surplus. Committing the entire remainder to long-term savings prematurely risks cash-flow friction when unrecorded bills occur.\n\n`;
        } else {
          action2En =
            `2. **Automate "Pay Yourself First" Savings on Payday**:\n` +
            `   • **Action**: Rather than waiting for month end, deposit your target savings${targetTrimAmt > 0 ? ` (such as ৳${fmt(targetTrimAmt)}/month)` : ''} into a separate savings account or DPS immediately upon receiving your ৳${fmt(income)} income.\n` +
            `   • **Financial Rationale**: You generate a healthy positive net monthly cash surplus of **৳${fmt(currentSurplus)}**. Cash left sitting in a daily transactional account is not yet saved and risks leaking into casual spending.\n\n`;
        }

        let action3En = '';
        if (isDataSparse) {
          action3En =
            `3. **Establish a Complete Living Expense Baseline**:\n` +
            `   • **Action**: Log all recurring monthly obligations—such as housing, groceries, utilities, and transport—to establish an authentic spending profile${hasDiscretionary ? `, while maintaining caps on flexible categories like ${discCats.map((c) => `**${c.category}** (৳${fmt(c.amount)})`).join(' and ')}` : ', and track everyday variable expenses'}.\n` +
            `   • **Financial Rationale**: With only ${totalTx} transaction(s) recorded in ${topCat ? `**${topCat.category}**` : 'your ledger'}, your current total spending of **৳${fmt(spending)}** reflects a partial snapshot rather than complete household obligations. Logging complete recurring costs ensures future budgets, savings targets, and health scores reflect your true financial reality.${extraBlockEn}`;
        } else if (hasMedicalExpenses) {
          action3En =
            `3. **Track Discretionary Spending & Establish Baseline Normal Costs**:\n` +
            `   • **Action**: Review your expense records to distinguish one-time medical bills from recurring living obligations${hasDiscretionary ? `, and maintain caps on flexible categories such as ${discCats.map((c) => `**${c.category}** (৳${fmt(c.amount)})`).join(' and ')}` : ', and log flexible lifestyle purchases as they occur'}.\n` +
            `   • **Financial Rationale**: Currently, 100% of your recorded ৳${fmt(spending)} spending is in essential commitments (healthcare and committed living costs). Protecting essential health while understanding your true non-medical baseline enables disciplined long-term goal planning.${extraBlockEn}`;
        } else {
          action3En =
            `3. **Track Discretionary Spending & Optimize Everyday Outflows**:\n` +
            `   • **Action**: Review your expense records to distinguish fixed living obligations from discretionary choices${hasDiscretionary ? `, and maintain caps on flexible categories such as ${discCats.map((c) => `**${c.category}** (৳${fmt(c.amount)})`).join(' and ')}` : ', and log flexible lifestyle purchases as they occur'}.\n` +
            `   • **Financial Rationale**: Currently, your recorded spending totals **৳${fmt(spending)}**. Keeping discretionary outflows transparent protects your positive monthly cash flow and keeps your long-term goals on track.${extraBlockEn}`;
        }

        answer = `Based on your authenticated financial records${scoreHeader}, here are the 3 most useful, prioritized actions to improve your financial health:\n\n` +
          action1En +
          action2En +
          action3En;
      }
      followUps.push(
        isBn ? 'আমার বাজেট কি সুষম?' : 'Is my monthly budget balanced?',
        isBn ? 'আমি কীভাবে বেশি সঞ্চয় করব?' : 'How can I save more money?'
      );
      break;
    }

    case 'financial_projection': {
      factsUsed.push('snapshot.monthlyIncome', 'snapshot.monthlySpending', 'snapshot.netCashFlow', 'snapshot.currentBalance');
      const histCount = ctx.metadata.dataWindow.historicalMonthsCount ?? 1;
      const pMonths = 6;
      const totalExpIncome = income * pMonths;
      const totalExpExpenses = spending * pMonths;
      const totalProjectedSavings = currentSurplus * pMonths;

      const hasSufficient = histCount >= 3;
      const isTopMedical =
        topCat &&
        (topCat.category.toLowerCase().includes('health') ||
          topCat.category.toLowerCase().includes('heath') ||
          topCat.category.toLowerCase().includes('medic'));

      let simBlockEn = '';
      let simBlockBn = '';
      const asciiNorm = convertBnToAsciiDigits(norm);

      if (asciiNorm.includes('20,000') || asciiNorm.includes('20000')) {
        const remainingBuffer = Math.max(0, balance - 20000);
        simBlockEn = `\n• **Simulated ৳20,000 Unexpected Expense**: Absorbing an unexpected ৳20,000 one-off outflow against your liquid balance of ৳${fmt(balance)} leaves an adjusted buffer of ৳${fmt(remainingBuffer)}.\n`;
        simBlockBn = `\n• **৳20,000 অপ্রত্যাশিত খরচের দৃশ্যপট**: আপনার বর্তমান ব্যালেন্স ৳${fmt(balance)} থেকে এককালীন ৳20,000 খরচ বহন করলে অবশিষ্ট বাফার থাকবে ৳${fmt(remainingBuffer)}।\n`;
      } else if (asciiNorm.includes('5,000') || asciiNorm.includes('5000')) {
        const newExp = spending + 5000;
        const newSurplus = income - newExp;
        simBlockEn = `\n• **Simulated ৳5,000 Essential Expense Hike**: Adding ৳5,000 in monthly essential obligations increases total spending to ৳${fmt(newExp)}, adjusting monthly surplus to ৳${fmt(newSurplus)}.\n`;
        simBlockBn = `\n• **৳5,000 অত্যাবশ্যকীয় ব্যয় বৃদ্ধির দৃশ্যপট**: প্রতি মাসে অতিরিক্ত ৳5,000 খরচ যুক্ত হলে মোট ব্যয় দাঁড়াবে ৳${fmt(newExp)}, এবং মাসিক উদ্বৃত্ত হবে ৳${fmt(newSurplus)}।\n`;
      } else if (asciiNorm.includes('2,000') || asciiNorm.includes('2000')) {
        const newSurplus = currentSurplus + 2000;
        simBlockEn = `\n• **Simulated ৳2,000 Extra Monthly Savings**: Saving an additional ৳2,000 per month (~৳500/week) lifts your cumulative monthly surplus to ৳${fmt(newSurplus)}.\n`;
        simBlockBn = `\n• **অতিরিক্ত ৳2,000 মাসিক সঞ্চয়ের দৃশ্যপট**: প্রতি মাসে অতিরিক্ত ৳2,000 (সাপ্তাহিক ৳500) সঞ্চয় করলে আপনার মাসিক উদ্বৃত্ত দাঁড়াবে ৳${fmt(newSurplus)}।\n`;
      } else if (asciiNorm.includes('15%')) {
        const hike = Math.round(spending * 0.15);
        const newExp = Math.round(spending * 1.15);
        const newSurplus = Math.round(income - newExp);
        simBlockEn = `\n• **Simulated 15% Expense Increase**: Outflows expand by ৳${fmt(hike)} to ৳${fmt(newExp)}, adjusting monthly surplus to ৳${fmt(newSurplus)}.\n`;
        simBlockBn = `\n• **১৫% ব্যয় বৃদ্ধির প্রভাব ও দৃশ্যপট**: মোট ব্যয় ৳${fmt(hike)} বৃদ্ধি পেয়ে ৳${fmt(newExp)} হবে, যার প্রভাবে মাসিক উদ্বৃত্ত দাঁড়াবে ৳${fmt(newSurplus)}।\n`;
      } else if (asciiNorm.includes('20%')) {
        const drop = Math.round(income * 0.2);
        const newInc = Math.round(income * 0.8);
        const newSurplus = Math.round(newInc - spending);
        simBlockEn = `\n• **Simulated 20% Income Reduction**: Income contracts by ৳${fmt(drop)} to ৳${fmt(newInc)}, adjusting net cash flow to ৳${fmt(newSurplus)}.\n`;
        simBlockBn = `\n• **২০% আয় হ্রাসের দৃশ্যপট**: মাসিক আয় ৳${fmt(drop)} কমে ৳${fmt(newInc)} হবে, যার ফলে নিট ক্যাশ-ফ্লো হবে ৳${fmt(newSurplus)}।\n`;
      } else if (asciiNorm.includes('10%') && (asciiNorm.includes('income') || norm.includes('আয়') || norm.includes('আয়'))) {
        const rise = Math.round(income * 0.1);
        const newInc = Math.round(income * 1.1);
        const newSurplus = Math.round(newInc - spending);
        simBlockEn = `\n• **Simulated 10% Income Increase**: Inflows expand by ৳${fmt(rise)} to ৳${fmt(newInc)}, expanding monthly surplus to ৳${fmt(newSurplus)}.\n`;
        simBlockBn = `\n• **১০% আয় বৃদ্ধির দৃশ্যপট**: মাসিক আয় ৳${fmt(rise)} বৃদ্ধি পেয়ে ৳${fmt(newInc)} হবে, যার ফলে মাসিক উদ্বৃত্ত হবে ৳${fmt(newSurplus)}।\n`;
      } else if (asciiNorm.includes('5%')) {
        const hike = Math.round(spending * 0.05);
        const newExp = Math.round(spending * 1.05);
        const newSurplus = Math.round(income - newExp);
        simBlockEn = `\n• **Simulated 5% Expense Increase**: Outflows expand by ৳${fmt(hike)} to ৳${fmt(newExp)}, adjusting monthly surplus to ৳${fmt(newSurplus)}.\n`;
        simBlockBn = `\n• **৫% ব্যয় বৃদ্ধির দৃশ্যপট**: মোট ব্যয় ৳${fmt(hike)} বৃদ্ধি পেয়ে ৳${fmt(newExp)} হবে, যার ফলে মাসিক উদ্বৃত্ত দাঁড়াবে ৳${fmt(newSurplus)}।\n`;
      } else if (asciiNorm.includes('optimistic') || asciiNorm.includes('pessimistic') || norm.includes('আশাবাদী') || norm.includes('রক্ষণশীল')) {
        const optSurplus = Math.round(income * 1.1 - spending);
        const pessSurplus = Math.round(income * 0.9 - spending);
        simBlockEn = `\n• **Scenario Comparison**:\n  - **Optimistic (+10% Income)**: ৳${fmt(Math.round(income * 1.1))}/mo income, net surplus: ৳${fmt(optSurplus)}\n  - **Expected (Run-Rate)**: ৳${fmt(income)}/mo income, net surplus: ৳${fmt(currentSurplus)}\n  - **Pessimistic (-10% Income)**: ৳${fmt(Math.round(income * 0.9))}/mo income, net surplus: ৳${fmt(pessSurplus)}\n`;
        simBlockBn = `\n• **দৃশ্যপট তুলনা**:\n  - **আশাবাদী (+১০% আয়)**: আয় ৳${fmt(Math.round(income * 1.1))}, নিট উদ্বৃত্ত ৳${fmt(optSurplus)}\n  - **প্রত্যাশিত (বর্তমান ধারা)**: আয় ৳${fmt(income)}, নিট উদ্বৃত্ত ৳${fmt(currentSurplus)}\n  - **রক্ষণশীল (-১০% আয়)**: আয় ৳${fmt(Math.round(income * 0.9))}, নিট উদ্বৃত্ত ৳${fmt(pessSurplus)}\n`;
      } else if (asciiNorm.includes('resilience') || asciiNorm.includes('loss')) {
        simBlockEn = `\n• **Income-Loss Resilience**: ${isBalanceEstimated ? 'Your estimated net balance is' : 'Your verified liquid balance is'} **৳${fmt(balance)}**. At your baseline monthly spending of ৳${fmt(spending)}, this liquidity buffer provides runway without new income.\n`;
        simBlockBn = `\n• **আয়-হ্রাস সহনশীলতা**: ${isBalanceEstimated ? 'আপনার আনুমানিক নিট ব্যালেন্স' : 'আপনার যাচাইকৃত তরল ব্যালেন্স'} **৳${fmt(balance)}**। মাসিক ৳${fmt(spending)} ব্যয়ের গতিতে এই বাফার আয়হীন অবস্থায় সুরক্ষা প্রদান করে।\n`;
      } else if (norm.includes('resilience') || norm.includes('loss')) {
        simBlockEn = `\n• **Income-Loss Resilience**: ${isBalanceEstimated ? 'Your estimated net balance is' : 'Your verified liquid balance is'} **৳${fmt(balance)}**. At your baseline monthly spending of ৳${fmt(spending)}, this liquidity buffer provides runway without new income.\n`;
        simBlockBn = `\n• **আয়-হ্রাস সহনশীলতা**: ${isBalanceEstimated ? 'আপনার আনুমানিক নিট ব্যালেন্স' : 'আপনার যাচাইকৃত তরল ব্যালেন্স'} **৳${fmt(balance)}**। মাসিক ৳${fmt(spending)} ব্যয়ের গতিতে এই বাফার আয়হীন অবস্থায় সুরক্ষা প্রদান করে।\n`;
      }

      if (isBn) {
        if (!hasSufficient) {
          answer = `**৬ মাসের আর্থিক পূর্বাভাস বিশ্লেষণ (সীমাবদ্ধতা ও প্রাথমিক দৃশ্যপট)**:\n\n` +
            `• **উপাত্তের সীমাবদ্ধতা ও সতর্কতা**: নির্ভরযোগ্য পরিসংখ্যানগত পূর্বাভাস তৈরির জন্য কমপক্ষে ৩ মাসের ঐতিহাসিক লেনদেনের উপাত্ত প্রয়োজন। বর্তমানে আপনার অ্যাকাউন্টে শুধুমাত্র ১টি চক্রের (${ctx.metadata.dataWindow.currentMonth}) রেকর্ড রয়েছে। ফলে এটি নিশ্চিত গ্যারান্টিযুক্ত পূর্বাভাস নয়, বরং একটি প্রাথমিক গাণিতিক দৃশ্যপট।\n\n` +
            `• **চলতি গতির ভিত্তিতে ৬ মাসের প্রাথমিক দৃশ্যপট (Illustrative Run-Rate Scenario)**:\n` +
            `  - **প্রত্যাশিত মোট আয়**: **৳${fmt(totalExpIncome)}** (প্রতি মাসে ৳${fmt(income)} ধরে)\n` +
            `  - **প্রত্যাশিত মোট ব্যয়**: **৳${fmt(totalExpExpenses)}** (প্রতি মাসে ৳${fmt(spending)} ধরে)\n` +
            `  - **সম্ভাব্য নিট সঞ্চয় / ক্যাশ-ফ্লো**: **৳${fmt(totalProjectedSavings)}** (প্রতি মাসে ৳${fmt(currentSurplus)} উদ্বৃত্ত ধরে)\n` +
            `  - **${isBalanceEstimated ? 'আনুমানিক নিট ব্যালেন্স (অসংযুক্ত লেজার)' : 'উপলব্ধ ব্যালেন্স'}**: **৳${fmt(balance)}**\n` +
            `${simBlockBn}\n` +
            `• **গুরুত্বপূর্ণ বাস্তবতা ও শর্ত**:\n` +
            `  ${isTopMedical ? `চলতি মাসের ব্যয়ের মধ্যে **${topCat.category}** খাতে ৳${fmt(topCat.amount)} ব্যয় অন্তর্ভুক্ত। এটি যদি এককালীন চিকিৎসা খরচ হয়ে থাকে, তবে আগামী ৬ মাসে আপনার প্রকৃত খরচ অনেক কম হবে এবং সঞ্চয় ৳${fmt(totalProjectedSavings)} এর চেয়ে বহুগুণ বেশি হতে পারে।` : 'মাসিক আয়ের ধারাবাহিকতা এবং খরচের নিয়মিত ধারা বজায় থাকার ওপর এই হিসাব নির্ভরশীল।'}\n\n` +
            `• **পরামর্শ**: আগামী ২–৩ মাস (৬০ থেকে ৯০ দিন) নিয়মিত দৈনন্দিন খরচ ও আয়ের তথ্য রেকর্ড করলে স্বয়ংক্রিয়ভাবে অনেক বেশি নির্ভুল ও অভিযোজিত পূর্বাভাস পাওয়া যাবে।`;
        } else {
          answer = `**আগামী ৬ মাসের আর্থিক অবস্থান পূর্বাভাস**:\n\n` +
            `আপনার অতীত ৩+ মাসের যাচাইকৃত ঐতিহাসিক লেনদেনের গড়ের ভিত্তিতে আগামী ৬ মাসের প্রক্ষেপণ:\n` +
            `• **প্রত্যাশিত মোট আয়**: **৳${fmt(totalExpIncome)}** (মাসিক গড় ৳${fmt(income)})\n` +
            `• **প্রত্যাশিত মোট ব্যয়**: **৳${fmt(totalExpExpenses)}** (মাসিক গড় ৳${fmt(spending)})\n` +
            `• **প্রক্ষেপিত ৬ মাসের নিট সঞ্চয়**: **৳${fmt(totalProjectedSavings)}** (মাসিক উদ্বৃত্ত ৳${fmt(currentSurplus)})\n` +
            `• **${isBalanceEstimated ? 'আনুমানিক নিট ব্যালেন্স (অসংযুক্ত লেজার)' : 'উপলব্ধ ব্যালেন্স'}**: **৳${fmt(balance)}**\n` +
            `${simBlockBn}\n` +
            `• **মূল শর্তাবলি**: বর্তমান ব্যয়ের শৃঙ্খলা ও আয় প্রবাহ অপরিবর্তিত থাকলে আগামী ৬ মাস শেষে আপনার ইতিবাচক ক্যাশ-ফ্লো বজায় থাকবে।`;
        }
      } else {
        if (!hasSufficient) {
          answer = `**Six-Month Financial Projection Analysis (Data Limitations & Illustrative Scenario)**:\n\n` +
            `• **Data Sufficiency & Limitation**: A statistically reliable multi-month projection requires at least 3 months of historical transaction history to capture recurring trends and seasonal variations. Currently, your account contains data for only 1 billing cycle (${ctx.metadata.dataWindow.currentMonth}). Therefore, this projection cannot be presented as a guaranteed forecast.\n\n` +
            `• **Illustrative Run-Rate Scenario & Financial Trajectory (Based on Current Pace)**:\n` +
            `  - **Projected 6-Month Income**: **৳${fmt(totalExpIncome)}** (assuming consistent ৳${fmt(income)}/month over six months)\n` +
            `  - **Projected 6-Month Outflow**: **৳${fmt(totalExpExpenses)}** (assuming current run-rate of ৳${fmt(spending)}/month)\n` +
            `  - **Projected 6-Month Net Surplus**: **৳${fmt(totalProjectedSavings)}** (cumulative net cash flow at ৳${fmt(currentSurplus)}/month over 6 months to accumulate savings)\n` +
            `  - **${isBalanceEstimated ? 'Estimated Net Balance (Unlinked Ledger)' : 'Available Liquid Balance'}**: **৳${fmt(balance)}**\n` +
            `${simBlockEn}\n` +
            `• **Critical Assumptions & Real-World Caveats**:\n` +
            `  ${isTopMedical ? `Your current month expenditures include **৳${fmt(topCat.amount)}** in **${topCat.category}**. If this was a one-time medical intervention rather than a recurring monthly treatment, your ongoing outflows will be substantially lower, resulting in significantly higher accumulated savings (accumulate surplus) than ৳${fmt(totalProjectedSavings)}.` : 'This assumes your income and outflow velocity remain steady over the next 180 days.'}\n\n` +
            `• **Next Steps**: Continue logging your transactions over the next 60 to 90 days to establish a mature baseline for fully adaptive predictive modeling.`;
        } else {
          answer = `**Six-Month Financial Position Forecast & Trajectory**:\n\n` +
            `Based on your verified multi-month historical transaction records (${histCount} months of data):\n` +
            `• **Expected 6-Month Income**: **৳${fmt(totalExpIncome)}** (averaging ৳${fmt(income)}/month over six months)\n` +
            `• **Expected 6-Month Expenses**: **৳${fmt(totalExpExpenses)}** (averaging ৳${fmt(spending)}/month)\n` +
            `• **Projected 6-Month Net Cash Flow**: **৳${fmt(totalProjectedSavings)}** (cumulative surplus at ৳${fmt(currentSurplus)}/month to accumulate savings over 6 months)\n` +
            `• **${isBalanceEstimated ? 'Estimated Net Balance (Unlinked Ledger)' : 'Available Liquid Balance'}**: **৳${fmt(balance)}**\n` +
            `${simBlockEn}\n` +
            `• **Core Assumptions**: Assumes your historical spending discipline and steady income streams persist without major unbudgeted shocks.`;
        }
      }
      followUps.push(
        isBn ? 'আমার বাজেট কি নিরাপদ?' : 'Is my monthly budget balanced?',
        isBn ? 'আমি কীভাবে বেশি সঞ্চয় করব?' : 'How can I increase my savings rate?'
      );
      break;
    }

    case 'budget_help': {
      factsUsed.push('snapshot.monthlyIncome', 'snapshot.monthlySpending', 'snapshot.netCashFlow');
      const discCats = ctx.spending.discretionaryCategories || [];
      const essCats = ctx.spending.essentialCategories || [];
      const essTotal = ctx.spending.essentialTotal ?? (spending - (ctx.spending.discretionaryTotal || 0));
      const discTotal = ctx.spending.discretionaryTotal || 0;
      const essPct = income > 0 ? Number(((essTotal / income) * 100).toFixed(1)) : 0;
      const savPct = income > 0 ? Number(((currentSurplus / income) * 100).toFixed(1)) : 0;
      const weeklySurplus = Math.round(currentSurplus / 4);

      const disc10Amt = Math.round(discTotal * 0.1);
      const is10PctQuery = norm.includes('10%') || norm.includes('১০%');

      const hasMedicalExpenses = (ctx.spending.topCategories || []).some(
        (c) =>
          c.category.toLowerCase().includes('health') ||
          c.category.toLowerCase().includes('heath') ||
          c.category.toLowerCase().includes('medic')
      );

      if (isBn) {
        let discSection = '';
        if (discTotal > 0 && discCats.length > 0) {
          const discList = discCats.slice(0, 3).map((c) => `  • **${c.category}**: ৳${fmt(c.amount)}`).join('\n');
          discSection = `২. **নমনীয় ও পরিবর্তনশীল ব্যয় বরাদ্দ (পরিবর্তনশীল খরচ: ৳${fmt(discTotal)})**:\n${discList}\n  *পরামর্শ: এই খাতগুলো থেকে ১০–১৫% সাশ্রয় করলে অতিরিক্ত সঞ্চয় সম্ভব।*`;
        } else {
          discSection = `২. **নমনীয় ও পরিবর্তনশীল ব্যয় (পরিবর্তনশীল খরচ: ৳০ রেকর্ডকৃত)**:\n` +
            `  • আপনার লেজারে বাইরে খাওয়া, বিনোদন বা শপিংয়ের মতো কোনো ঐচ্ছিক ব্যয়ের রেকর্ড নেই।\n` +
            `  • সব খরচই জীবনযাত্রার আবশ্যকীয় খাতে রয়েছে। কোনো ঐচ্ছিক খরচ শুরু হলে তা আয়ের ৫–১০% এর মধ্যে সীমাবদ্ধ রাখুন।`;
        }

        const essList = essCats.length > 0
          ? essCats.slice(0, 4).map((c) => `  • **${c.category}**: ৳${fmt(c.amount)}`).join('\n')
          : `  • আবশ্যকীয় ব্যয়: ৳${fmt(essTotal)}`;

        const zeroIncNote = income === 0 ? ' (কোনো record করা আয় না থাকলে — zero income বাজেট কাঠামো)' : '';
        const cut10Note = is10PctQuery
          ? `\n\n• **১০% নমনীয় খরচ হ্রাসের প্রভাব**: অপ্রয়োজনীয় বা নমনীয় খরচ ১০% কমালে প্রতি মাসে প্রায় **৳${fmt(disc10Amt)}** অতিরিক্ত সাশ্রয় হবে (১০% সাশ্রয়)।`
          : '';

        answer = `আপনার যাচাইকৃত আর্থিক লেজার অনুযায়ী বিভিন্ন খাতে আয় বণ্টন (মাসিক আয়: **৳${fmt(income)}**, ব্যয়: **৳${fmt(spending)}**)${zeroIncNote}, আগামী মাসের জন্য একটি বাস্তবসম্মত ও ভারসাম্যপূর্ণ বাজেট কাঠামো (ভারসাম্য রক্ষা):\n\n` +
          `১. **প্রয়োজনীয় ও অত্যাবশ্যকীয় দায়বদ্ধতা (স্থায়ী খরচ): ৳${fmt(essTotal)} (আয়ের ${essPct}%)**:\n` +
          `${essList}\n` +
          `  *জরুরি চিকিৎসা, ওষুধ, ইউটিলিটি ও শিক্ষা আবশ্যকীয় স্থায়ী খরচ; বড় আকারের কারণে এগুলোতে হাত দিয়ে জীবনযাত্রার ঝুঁকি নেওয়া অনুচিত।*\n\n` +
          `${discSection}\n\n` +
          `৩. **নিট সঞ্চয় ও ক্যাশ বাফার বরাদ্দ: ৳${fmt(currentSurplus)} (আয়ের ${savPct}%)**:\n` +
          `  • **Pay Yourself First (আয়ের শুরুতেই সঞ্চয়)**: মাস শেষে ওয়ালেটে উদ্বৃত্ত ফেলে না রেখে আয় প্রাপ্তির সাথে সাথে **৳${fmt(currentSurplus)}** (বা সপ্তাহে প্রায় **৳${fmt(weeklySurplus)}**) একটি পৃথক সেভিংস অ্যাকাউন্ট বা ডিপিএসে স্থানান্তর করুন।\n` +
          `  • ইতিবাচক ক্যাশ-ফ্লো স্বয়ংক্রিয়ভাবে সংরক্ষিত সঞ্চয় নয় যতক্ষণ না তা সুরক্ষিত তহবিলে জমা হচ্ছে।${cut10Note}\n\n` +
          `**শর্ত ও সীমাবদ্ধতা**:\n` +
          (hasMedicalExpenses
            ? `• সাম্প্রতিক চিকিৎসা ব্যয় বর্তমান প্রয়োজনের ভিত্তিতে অন্তর্ভুক্ত। এটি যদি এককালীন হয়ে থাকে, তবে আগামী মাসগুলোতে আপনার উদ্বৃত্ত আরও উল্লেখযোগ্যভাবে বৃদ্ধি পাবে।\n`
            : `• এই বাজেট কাঠামো আপনার রেকর্ডকৃত ব্যয়ের ভিত্তিতে তৈরি। নিয়মিত অন্যান্য খরচের খাত যুক্ত হলে বাজেট কাঠামো আরও সামঞ্জস্য করা যাবে।\n`) +
          `• কোনো খরচের শ্রেণিবিভাগ নিয়ে সংশয় থাকলে স্পেন্ডিং অ্যানালাইসিস থেকে ক্যাটাগরি ট্যাগ যাচাই করুন।`;
      } else {
        let discSection = '';
        if (discTotal > 0 && discCats.length > 0) {
          const discList = discCats.slice(0, 3).map((c) => `  • **${c.category}**: ৳${fmt(c.amount)}`).join('\n');
          discSection = `2. **Discretionary Spending Allowance (Variable Lifestyle Costs: ৳${fmt(discTotal)})**:\n${discList}\n  *Optimization: Trimming 10–15% from flexible categories creates incremental savings.*`;
        } else {
          discSection = `2. **Discretionary Spending (Variable Expenses: ৳0 recorded)**:\n` +
            `  • You have no recorded transactions in non-essential lifestyle categories (dining out, entertainment, shopping).\n` +
            `  • All current recorded outflows represent necessary commitments. If flexible spending occurs, cap it at ~5–10% of income.`;
        }

        const essList = essCats.length > 0
          ? essCats.slice(0, 4).map((c) => `  • **${c.category}**: ৳${fmt(c.amount)}`).join('\n')
          : `  • Essential Outflows: ৳${fmt(essTotal)}`;

        const zeroIncNote = income === 0 ? ' (Zero recorded income — allocation based strictly on liquid reserves)' : '';
        const cut10Note = is10PctQuery
          ? `\n\n• **10% Discretionary Cut Impact**: Cutting discretionary spending by 10% yields approximately **৳${fmt(disc10Amt)}/month** in additional savings (10%).`
          : '';

        answer = `Based on your authenticated financial records (Monthly Income: **৳${fmt(income)}**, Expenses: **৳${fmt(spending)}**)${zeroIncNote}, here is a realistic monthly budget allocation across categories:\n\n` +
          `1. **Essential & Committed Obligations (Fixed Expenses): ৳${fmt(essTotal)} (${essPct}% of income)**:\n` +
          `${essList}\n` +
          `  *Note: Healthcare, medicine, education, and utilities are fixed necessities and should never be reduced simply because the category is large.*\n\n` +
          `${discSection}\n\n` +
          `3. **Target Savings Allocation & Cash Buffer: ৳${fmt(currentSurplus)} (${savPct}% of income)**:\n` +
          `  • **Pay Yourself First**: Transfer your **৳${fmt(currentSurplus)}** monthly surplus (or ~**৳${fmt(weeklySurplus)}/week**) into a separate savings account or emergency buffer on payday.\n` +
          `  • Cash surplus remaining in your transaction wallet is not yet saved money until it is protected from incidental leakage.${cut10Note}\n\n` +
          `**Assumptions & Limitations**:\n` +
          (hasMedicalExpenses
            ? `• This budget assumes recent healthcare expenditures reflect current medical needs. If hospital costs were a one-time medical event, your recurring baseline will drop substantially, unlocking greater savings.\n`
            : `• This budget reflects your recorded expenditure baseline. As you log ongoing recurring living costs, your budget allocation can be adjusted.\n`) +
          `• If any transaction classifications are uncertain or contain mixed personal spending, please verify your category tags in Spending Analysis.`;
      }
      followUps.push(
        isBn ? 'আমি কীভাবে বেশি সঞ্চয় করব?' : 'How can I save more money?',
        isBn ? 'আমার ক্যাশ-আউট চার্জ কত?' : 'How much are my cash-out fees?'
      );
      break;
    }

    case 'transaction_lookup': {
      factsUsed.push('snapshot.currentBalance');
      const recent = ctx.recentTransactions.slice(0, 3);
      if (recent.length > 0) {
        const txList = recent
          .map((t) => `• ${t.date}: ${t.category} (৳${t.amount.toLocaleString()}, ${t.type})`)
          .join('\n');
        answer = isBn
          ? `আপনার সাম্প্রতিক লেনদেনসমূহ:\n${txList}\n\nআপনার বর্তমান উপলব্ধ ব্যালেন্স ৳${balance.toLocaleString()}।`
          : `Your recent transactions:\n${txList}\n\nYour current liquid balance is ৳${balance.toLocaleString()}.`;
      } else {
        dataGaps.push('No recent transactions found');
        answer = isBn
          ? 'আপনার কোনো সাম্প্রতিক লেনদেন পাওয়া যায়নি।'
          : 'No recent transactions recorded in your ledger.';
      }
      break;
    }

    case 'general_education': {
      factsUsed.push('snapshot.savingsRate');
      if (isBn) {
        answer = `৫০/৩০/২০ একটি জনপ্রিয় বাজেট নিয়ম: আয়ের ৫০% অত্যাবশ্যক খরচ (বাসা ভাড়া, খাবার, বিল), ৩০% নমনীয় খরচ (বিনোদন, কেনাকাটা), এবং ২০% ভবিষ্যতের সঞ্চয় বা ঋণের জন্য বরাদ্দ রাখা। আপনার বর্তমান সঞ্চয়ের হার **${savingsRate}%**।`;
      } else {
        answer = `The 50/30/20 rule allocates 50% of income to essentials (rent, groceries, utilities), 30% to discretionary choices (dining, hobbies), and 20% to savings. Your current actual savings rate is **${savingsRate}%**.`;
      }
      break;
    }

    case 'out_of_scope': {
      answer = isBn
        ? 'আমি অর্থবাঁচাও এআই পার্সোনাল ফাইন্যান্সিয়াল কোচ। আমি শুধুমাত্র আপনার ব্যক্তিগত আয়, ব্যয় ও সঞ্চয় পরিকল্পনায় সহায়তা করতে পারি। বিনিয়োগের পরামর্শ, স্টক টিপস, ক্রিপ্টো বা ঋণ সংক্রান্ত সিদ্ধান্ত আমার আওতাভুক্ত নয়।'
        : 'I am ArthoBachao AI, focused exclusively on personal budgeting, expense optimization, and savings goals. I do not provide stock picking, crypto recommendations, loan approvals, or regulated investment advice.';
      break;
    }

    default: {
      factsUsed.push('snapshot.monthlyIncome', 'snapshot.monthlySpending', 'snapshot.currentBalance');
      answer = isBn
        ? `আপনার আর্থিক তথ্য অনুযায়ী: এ মাসে আয় ৳${income.toLocaleString()}, ব্যয় ৳${spending.toLocaleString()}, নিট সঞ্চয় ৳${netSavings.toLocaleString()} এবং উপলব্ধ ব্যালেন্স ৳${balance.toLocaleString()}। বাজেট বা সঞ্চয় নিয়ে সুনির্দিষ্ট কোনো প্রশ্ন থাকলে জানান!`
        : `Based on your authenticated ledger: Income is ৳${income.toLocaleString()}, Spending is ৳${spending.toLocaleString()}, Net Savings is ৳${netSavings.toLocaleString()}, and Available Balance is ৳${balance.toLocaleString()}. Please ask if you need help with a specific budget category or savings goal!`;
      break;
    }
  }

  return {
    source: 'fallback',
    answer,
    factsUsed,
    followUps: followUps.slice(0, 2),
    dataGaps,
  };
}
