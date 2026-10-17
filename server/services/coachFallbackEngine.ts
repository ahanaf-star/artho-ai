import { CoachContext } from './coachContextBuilder';
import { IntentResult } from './intentClassifier';

export interface CoachResponsePayload {
  source: 'ai' | 'fallback';
  answer: string;
  factsUsed: string[];
  followUps: string[];
  dataGaps: string[];
}

/**
 * Deterministic Fallback Engine
 * Generates data-grounded, educational responses in English and Bengali using ONLY real ledger facts.
 * Never outputs hardcoded mock figures or generic greetings when real data is available.
 */
export function generateDeterministicCoachResponse(
  intentResult: IntentResult,
  ctx: CoachContext,
  language: 'en' | 'bn' = 'en'
): CoachResponsePayload {
  const isBn = language === 'bn';
  const { intent, parsedPlan } = intentResult;

  const factsUsed: string[] = [];
  const followUps: string[] = [];
  const dataGaps: string[] = [];

  const income = ctx.snapshot.monthlyIncome;
  const spending = ctx.snapshot.monthlySpending;
  const netSavings = ctx.snapshot.netSavings;
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

      if (isBn) {
        answer = `চলতি মাসে আপনার মোট ব্যয় **৳${spending.toLocaleString()}** (মোট আয় ৳${income.toLocaleString()}, যার মধ্যে নিট সঞ্চয় ৳${netSavings.toLocaleString()})।${
          topCat
            ? ` আপনার ব্যয়ের প্রধান খাত **${topCat.category}** (৳${topCat.amount.toLocaleString()}, যা মোট ব্যয়ের ${topCat.percentage}%)।`
            : ''
        }`;
      } else {
        answer = `Your total spending for the current month is **৳${spending.toLocaleString()}** against a recorded income of ৳${income.toLocaleString()}, leaving a net monthly surplus of ৳${netSavings.toLocaleString()}.${
          topCat
            ? ` Your largest outflow is **${topCat.category}** at ৳${topCat.amount.toLocaleString()} (${topCat.percentage}% of all expenses).`
            : ''
        }`;
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
            const momText =
              topCat.momChangePercentage !== 0
                ? ` (গত মাসের তুলনায় ${topCat.momChangePercentage > 0 ? '+' : ''}${topCat.momChangePercentage}%)`
                : '';
            answer = `আপনার সবচেয়ে বড় খরচের খাত হলো **${topCat.category}**। এ মাসে এখানে ব্যয় হয়েছে **৳${topCat.amount.toLocaleString()}**, যা আপনার মোট ব্যয়ের **${topCat.percentage}%**${momText}। এই প্রধান খাতের খরচ নিয়ন্ত্রণে রাখাই আপনার সঞ্চয় বাড়ানোর সবচেয়ে কার্যকর পথ।`;
          } else {
            const momText =
              topCat.momChangePercentage !== 0
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
            const momText =
              lowestCat.momChangePercentage !== 0
                ? ` (গত মাসের তুলনায় ${lowestCat.momChangePercentage > 0 ? '+' : ''}${lowestCat.momChangePercentage}%)`
                : '';
            answer = `আপনার সর্বনিম্ন খরচের খাত হলো **${lowestCat.category}**। এ মাসে এখানে ব্যয় হয়েছে মাত্র **৳${lowestCat.amount.toLocaleString()}**, যা আপনার মোট ব্যয়ের **${lowestCat.percentage}%**${momText}।`;
          } else {
            const momText =
              lowestCat.momChangePercentage !== 0
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
          ? `গত মাসের (৳${prev.toLocaleString()}) তুলনায় এ মাসে আপনার খরচ **${pct}%** বৃদ্ধি পেয়েছে (অতিরিক্ত **৳${diff.toLocaleString()}**)।`
          : `Compared to last month (৳${prev.toLocaleString()}), your spending has increased by **${pct}%** (+**৳${diff.toLocaleString()}**).`;
      } else if (comparison?.direction === 'lower') {
        answer = isBn
          ? `গত মাসের (৳${prev.toLocaleString()}) তুলনায় এ মাসে আপনার খরচ **${pct}%** কমেছে (**৳${diff.toLocaleString()}** সাশ্রয় হয়েছে)।`
          : `Compared to last month (৳${prev.toLocaleString()}), your spending has decreased by **${pct}%** (saving **৳${diff.toLocaleString()}**).`;
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
        'cashFlow.recommendedWeeklyReduction'
      );
      if (isBn) {
        answer = `আপনার বর্তমান উপলব্ধ ব্যালেন্স ৳${balance.toLocaleString()} এর ভিত্তিতে আগামী মাস শেষে সম্ভাব্য ব্যালেন্স দাঁড়াবে প্রায় **৳${monthEndBalance.toLocaleString()}** (AI-assisted forecast)। আপনার অ্যাকাউন্টের জন্য প্রস্তাবিত নিরাপত্তা বাফার হলো ৳${recommendedBuffer.toLocaleString()}।${
          monthEndBalance < recommendedBuffer
            ? ` বাফার পূরণ করতে সপ্তাহে প্রায় ৳${weeklyTrim.toLocaleString()} সাশ্রয় করার পরামর্শ দেওয়া হচ্ছে।`
            : ' আপনার পূর্বাভাসিত ব্যালেন্স প্রস্তাবিত বাফারের মধ্যে নিরাপদ রয়েছে।'
        }`;
      } else {
        answer = `Based on your liquid balance of ৳${balance.toLocaleString()}, your projected month-end balance is approximately **৳${monthEndBalance.toLocaleString()}** (AI-assisted forecast). The recommended safety buffer is ৳${recommendedBuffer.toLocaleString()}.${
          monthEndBalance < recommendedBuffer
            ? ` To avoid cash flow tightening, trimming ~৳${weeklyTrim.toLocaleString()}/week in flexible spending is recommended.`
            : ' Your projected margin remains comfortably above the recommended safety buffer.'
        }`;
      }
      followUps.push(
        isBn ? 'আমি কীভাবে বেশি সঞ্চয় করতে পারি?' : 'How can I save more money?',
        isBn ? 'আমার সঞ্চয় লক্ষ্য ঠিক পথে আছে?' : 'Is my savings goal on track?'
      );
      break;
    }

    case 'savings_goal_progress': {
      if (primaryGoal) {
        factsUsed.push(
          'goals.goal1.title',
          'goals.goal1.targetAmount',
          'goals.goal1.currentAmount',
          'goals.goal1.progressPercentage',
          'goals.goal1.remainingAmount',
          'goals.goal1.requiredMonthlyContribution'
        );
        if (isBn) {
          answer = `আপনার সঞ্চয় লক্ষ্য **${primaryGoal.title}** এর বর্তমান অগ্রগতি:\n• লক্ষ্যমাত্রা: ৳${primaryGoal.targetAmount.toLocaleString()}\n• বর্তমান জমা: ৳${primaryGoal.currentAmount.toLocaleString()} (${primaryGoal.progressPercentage}% সম্পন্ন)\n• অবশিষ্ট ঘাটতি: ৳${primaryGoal.remainingAmount.toLocaleString()}\n• নির্ধারিত সময়ে পৌঁছাতে প্রয়োজনীয় মাসিক সঞ্চয়: ৳${primaryGoal.requiredMonthlyContribution.toLocaleString()}/মাস।`;
        } else {
          answer = `Progress for your goal **${primaryGoal.title}**:\n• Target: ৳${primaryGoal.targetAmount.toLocaleString()}\n• Saved: ৳${primaryGoal.currentAmount.toLocaleString()} (${primaryGoal.progressPercentage}% completed)\n• Remaining Gap: ৳${primaryGoal.remainingAmount.toLocaleString()}\n• Required Monthly Pace: ৳${primaryGoal.requiredMonthlyContribution.toLocaleString()}/month to meet your deadline (${primaryGoal.deadline}).`;
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
                  `  1. **Pay Yourself First**: Transfer **৳${fmt(monthlyTarget)}** (or **৳${fmt(weeklyTarget)} weekly**) into a dedicated savings vault right after your income arrives, rather than waiting for month end.\n` +
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
          answer = `আপনার বর্তমান মাসিক সঞ্চয় ৳${netSavings.toLocaleString()} (সঞ্চয়ের হার: ${savingsRate}%)। সঞ্চয় বাড়ানোর বাস্তবসম্মত পদক্ষেপ:\n১. নমনীয় খরচের খাত **${targetTrimCat}** এর খরচ নিয়ন্ত্রণে রাখা।\n২. অপ্রয়োজনীয় ক্যাশ-আউট চার্জ এড়িয়ে চলা।\n৩. উদ্বৃত্ত অর্থ নির্দিষ্ট সঞ্চয় লক্ষ্যে স্বয়ংক্রিয়ভাবে জমা করা।`;
        } else {
          answer = `Your current monthly savings is ৳${netSavings.toLocaleString()} (savings rate: ${savingsRate}%). Practical steps to save more:\n1. Moderate outflows in your flexible category **${targetTrimCat}**.\n2. Eliminate avoidable cash-out tariffs and subscription leaks.\n3. Route your monthly surplus directly into an automated high-yield savings vault.`;
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
        if (isBn) {
          answer = 'চলতি মাসে কোনো অস্বাভাবিক ব্যয়ের প্যাটার্ন বা অপ্রত্যাশিত সার্জ পাওয়া যায়নি। আপনার খরচের গতি স্বাভাবিক ও সুষম রয়েছে।';
        } else {
          answer = 'No unusual spending spikes or anomalous transactions detected in your current ledger. Your outflow pace is well-controlled.';
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
        answer = `এ মাসে আপনার ক্যাশ-আউট লেনদেনের সংখ্যা **${ctx.cashOut.count}টি** (মোট ৳${cashOutTotal.toLocaleString()}), যেখানে আনুমানিক **৳${feeCost.toLocaleString()}** ১.৮৫% এমএফএস এজেন্ট চার্জে ব্যয় হয়েছে।\n\nচার্জ কমানোর পরামর্শ:\n১. ঘন ঘন ছোট অঙ্কের ক্যাশ-আউট না করে মাসে এক বা দুইবারে প্রয়োজনমতো টাকা উত্তোলন করুন।\n২. সিটি ব্যাংক এটিএম কার্ড ব্যবহার করে বিনামূল্যে টাকা তুলুন।\n৩. সরাসরি মার্চেন্ট পেমেন্টে কিউআর কোড বা ডিজিটাল পে ব্যবহার করুন।`;
      } else {
        answer = `You logged **${ctx.cashOut.count} cash-out transaction(s)** totaling ৳${cashOutTotal.toLocaleString()}, incurring approximately **৳${feeCost.toLocaleString()}** in avoidable 1.85% MFS agent tariffs.\n\nOptimization steps:\n1. Consolidate frequent micro-withdrawals into 1–2 planned cash-outs.\n2. Use City Bank / debit card ATMs to withdraw funds fee-free.\n3. Make direct digital merchant payments via bKash QR or POS to avoid cash-out fees completely.`;
      }
      followUps.push(
        isBn ? 'আমার মোট খরচ কত?' : 'What is my total spending this month?',
        isBn ? 'আমার হেলথ স্কোর কত?' : 'What is my financial health score?'
      );
      break;
    }

    case 'financial_health': {
      factsUsed.push(
        'health.score',
        'health.band',
        'health.percentile',
        'health.savingConsistency',
        'health.spendingControl',
        'health.cashFlowStability',
        'health.goalProgress'
      );
      if (isBn) {
        answer = `আপনার অর্থবাঁচাও এআই ফাইন্যান্সিয়াল হেলথ স্কোর **${healthScore} / ১০০** (অবস্থা: **${healthBand}**)। আপনি ঢাকার সমকক্ষ ব্যবহারকারীদের **${ctx.health.percentile}%** এর চেয়ে এগিয়ে রয়েছেন।\n\nপিলার বিশ্লেষণ:\n• সঞ্চয়ের ধারাবাহিকতা: ${ctx.health.savingConsistency}%\n• ব্যয় নিয়ন্ত্রণ: ${ctx.health.spendingControl}%\n• ক্যাশ-ফ্লো স্থায়িত্ব: ${ctx.health.cashFlowStability}%\n• সঞ্চয় লক্ষ্যের অগ্রগতি: ${ctx.health.goalProgress}%`;
      } else {
        answer = `Your ArthoBachao AI Financial Health Score is **${healthScore} / 100** (Rating: **${healthBand}**), outperforming **${ctx.health.percentile}%** of peers in Dhaka with digital wallets.\n\nDiagnostic Pillars:\n• Saving Consistency: ${ctx.health.savingConsistency}%\n• Spending Control: ${ctx.health.spendingControl}%\n• Cash Flow Stability: ${ctx.health.cashFlowStability}%\n• Goal Progress: ${ctx.health.goalProgress}%`;
      }
      followUps.push(
        isBn ? 'স্কোর আরও বাড়ানোর উপায় কি?' : 'How can I improve my health score?',
        isBn ? 'আমার সঞ্চয় লক্ষ্য কেমন চলছে?' : 'How are my savings goals progressing?'
      );
      break;
    }

    case 'budget_help': {
      factsUsed.push('snapshot.monthlySpending', 'cashFlow.recommendedWeeklyReduction');
      if (topCat) factsUsed.push('spending.topCategory', 'spending.topCategoryAmount');
      if (isBn) {
        answer = `বাজেট নিয়ন্ত্রণে রাখার জন্য আপনার সবচেয়ে বড় সুযোগ রয়েছে **${topCat ? topCat.category : 'শীর্ষ খরচের খাত'}** (বর্তমান খরচ ৳${topCat ? topCat.amount.toLocaleString() : spending.toLocaleString()}) খাতে। নমনীয় খরচ থেকে প্রতি সপ্তাহে প্রায় **৳${weeklyTrim.toLocaleString()}** সাশ্রয় করতে পারলে মাসের শেষে একটি স্বাস্থ্যকর ক্যাশ-ফ্লো বাফার বজায় থাকবে।`;
      } else {
        answer = `Your primary budget optimization opportunity lies in **${topCat ? topCat.category : 'your highest category'}** (currently ৳${topCat ? topCat.amount.toLocaleString() : spending.toLocaleString()}). Trimming approximately **৳${weeklyTrim.toLocaleString()}/week** from discretionary outings and deliveries will secure your month-end cash flow.`;
      }
      followUps.push(
        isBn ? 'আমার ক্যাশ-আউট চার্জ কত?' : 'How much are my cash-out fees?',
        isBn ? 'আমার সঞ্চয় লক্ষ্য ঠিক আছে কি?' : 'Are my savings goals on track?'
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
